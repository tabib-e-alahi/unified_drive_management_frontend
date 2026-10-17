import { z } from 'zod';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/**
 * The backend's consistent error envelope: { statusCode, message, error }.
 */
const errorBodySchema = z.object({
  statusCode: z.number(),
  message: z.union([z.string(), z.array(z.string())]),
  error: z.string(),
});

export class ApiError extends Error {
  readonly statusCode: number;
  readonly errorCode: string;
  /** All validation messages, when the backend returned more than one. */
  readonly messages: string[];

  constructor(statusCode: number, errorCode: string, messages: string[]) {
    super(messages[0] ?? 'Request failed');
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.messages = messages;
  }

  /** 401 drives the redirect-to-login behaviour in the auth guard. */
  get isUnauthorized(): boolean {
    return this.statusCode === 401;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** Extra query parameters; undefined and null values are dropped. */
  query?: Record<string, string | number | boolean | undefined | null>;
}

/**
 * API_URL is either an absolute origin (the backend, called directly) or a
 * same-site path such as `/api` (proxied; see next.config.ts), so this
 * joins strings rather than relying on `new URL`, which needs an absolute
 * base.
 */
function buildUrl(path: string, query?: RequestOptions['query']): string {
  const base = API_URL.replace(/\/+$/, '');
  const url = `${base}/${path.replace(/^\/+/, '')}`;

  const params = new URLSearchParams();
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        params.set(key, String(value));
      }
    }
  }
  const search = params.toString();
  return search ? `${url}?${search}` : url;
}

async function toApiError(response: Response): Promise<ApiError> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const parsed = errorBodySchema.safeParse(payload);
  if (parsed.success) {
    const { statusCode, message, error } = parsed.data;
    return new ApiError(
      statusCode,
      error,
      Array.isArray(message) ? message : [message],
    );
  }

  return new ApiError(response.status, response.statusText || 'Error', [
    `Request failed with status ${response.status}`,
  ]);
}

/**
 * Typed fetch wrapper. Always sends cookies, since the session JWT lives in an
 * httpOnly cookie that JavaScript deliberately cannot read.
 *
 * Pass a zod schema to validate the response shape at the boundary; the
 * returned value is then fully typed rather than `any`.
 */
export async function apiRequest<TSchema extends z.ZodType>(
  path: string,
  schema: TSchema,
  options: RequestOptions = {},
): Promise<z.infer<TSchema>> {
  const { method = 'GET', body, signal, query } = options;

  const response = await fetch(buildUrl(path, query), {
    method,
    credentials: 'include',
    signal,
    headers:
      body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    throw await toApiError(response);
  }

  if (response.status === 204) {
    return schema.parse(undefined) as z.infer<TSchema>;
  }

  const json: unknown = await response.json();
  const parsed = schema.safeParse(json);

  if (!parsed.success) {
    // A shape mismatch is a bug, not a user-facing condition — make it loud.
    console.error('Unexpected API response shape', {
      path,
      issues: parsed.error.issues,
    });
    throw new ApiError(500, 'InvalidResponse', [
      'The server returned an unexpected response.',
    ]);
  }

  return parsed.data;
}

/** Absolute URL for endpoints the browser loads directly (downloads, previews). */
export function apiUrl(path: string): string {
  return buildUrl(path);
}

/** Turns any thrown value into something safe to show in a toast. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.messages.join(' · ');
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
}
