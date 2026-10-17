/**
 * Chunked resumable upload straight from the browser to Google.
 *
 * The bytes never pass through our backend: it only opens the session and
 * verifies the result. Google requires every chunk except the last to be a
 * multiple of 256 KB.
 */
export const CHUNK_MULTIPLE = 256 * 1024;
export const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MB, a multiple of 256 KB

/** Network hiccups are retried this many times per chunk before giving up. */
const MAX_CHUNK_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 500;

export class UploadCancelledError extends Error {
  constructor() {
    super('Upload cancelled');
    this.name = 'UploadCancelledError';
  }
}

export class UploadFailedError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'UploadFailedError';
  }
}

export interface UploadProgress {
  bytesSent: number;
  totalBytes: number;
}

export interface ChunkedUploadOptions {
  file: File;
  uploadUrl: string;
  signal: AbortSignal;
  onProgress: (progress: UploadProgress) => void;
}

const sleep = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new UploadCancelledError());
      },
      { once: true },
    );
  });

/**
 * Uploads the whole file and resolves with the Google file id.
 *
 * After any failure it asks Google how many bytes it actually holds rather
 * than assuming, so a retry resumes from the true offset instead of
 * duplicating or skipping data.
 */
export async function uploadFileInChunks({
  file,
  uploadUrl,
  signal,
  onProgress,
}: ChunkedUploadOptions): Promise<string> {
  const total = file.size;
  let offset = 0;

  // A zero-byte file still needs one request to finalise the session.
  do {
    if (signal.aborted) throw new UploadCancelledError();

    const end = Math.min(offset + CHUNK_SIZE, total);
    const chunk = file.slice(offset, end);
    const contentRange =
      total === 0 ? 'bytes */0' : `bytes ${offset}-${end - 1}/${total}`;

    let attempt = 0;
    for (;;) {
      attempt += 1;
      try {
        const response = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Range': contentRange },
          body: total === 0 ? null : chunk,
          signal,
        });

        // Finished: Google returns the file metadata.
        if (response.status === 200 || response.status === 201) {
          const body = (await response.json()) as { id?: string };
          if (!body.id) {
            throw new UploadFailedError(
              'Google finished the upload but returned no file id',
            );
          }
          onProgress({ bytesSent: total, totalBytes: total });
          return body.id;
        }

        // 308 Resume Incomplete: Google tells us what it has so far.
        if (response.status === 308) {
          offset = parseConfirmedOffset(response, offset, end);
          onProgress({ bytesSent: offset, totalBytes: total });
          break;
        }

        // 4xx other than 308 will not improve on retry.
        if (
          response.status >= 400 &&
          response.status < 500 &&
          response.status !== 429
        ) {
          const text = await response.text().catch(() => '');
          throw new UploadFailedError(
            describeFailure(response.status, text),
            response.status,
          );
        }

        throw new UploadFailedError(
          `Google returned ${response.status} while uploading`,
          response.status,
        );
      } catch (error) {
        if (signal.aborted) throw new UploadCancelledError();
        if (error instanceof UploadFailedError && isPermanent(error.status))
          throw error;
        if (attempt >= MAX_CHUNK_ATTEMPTS) {
          throw error instanceof Error
            ? error
            : new UploadFailedError('Upload failed');
        }

        // Backoff, then re-sync with Google before retrying the chunk: the
        // failure may have happened after it stored part of the data.
        await sleep(BASE_RETRY_DELAY_MS * 2 ** (attempt - 1), signal);
        const confirmed = await queryUploadedBytes(uploadUrl, total, signal);
        if (confirmed.completed) {
          onProgress({ bytesSent: total, totalBytes: total });
          return confirmed.fileId;
        }
        offset = confirmed.bytesReceived;
        onProgress({ bytesSent: offset, totalBytes: total });
        break;
      }
    }
  } while (offset < total);

  // The loop only exits here if Google never sent a final 200/201.
  const status = await queryUploadedBytes(uploadUrl, total, signal);
  if (status.completed) return status.fileId;
  throw new UploadFailedError(
    'Upload finished but Google did not confirm the file',
  );
}

interface UploadStatus {
  completed: boolean;
  bytesReceived: number;
  fileId: string;
}

/**
 * Asks Google how much of the file it holds, which is how an interrupted
 * upload finds its true resume point.
 */
export async function queryUploadedBytes(
  uploadUrl: string,
  total: number,
  signal: AbortSignal,
): Promise<UploadStatus> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Range': `bytes */${total}` },
    signal,
  });

  if (response.status === 200 || response.status === 201) {
    const body = (await response.json()) as { id?: string };
    return { completed: true, bytesReceived: total, fileId: body.id ?? '' };
  }

  if (response.status === 308) {
    return {
      completed: false,
      bytesReceived: parseConfirmedOffset(response, 0, 0),
      fileId: '',
    };
  }

  throw new UploadFailedError(
    `Could not read upload status (${response.status})`,
    response.status,
  );
}

/**
 * Reads the confirmed byte count from a 308's Range header, which looks like
 * `bytes=0-262143` and is inclusive. A missing header means Google has
 * nothing yet.
 */
function parseConfirmedOffset(
  response: Response,
  fallbackStart: number,
  fallbackEnd: number,
): number {
  const range = response.headers.get('range');
  if (!range) {
    // No Range header: Google stored nothing from this chunk.
    return fallbackStart;
  }
  const match = /bytes=(\d+)-(\d+)/.exec(range);
  if (!match) return fallbackEnd || fallbackStart;
  return Number(match[2]) + 1;
}

function isPermanent(status: number | undefined): boolean {
  if (status === undefined) return false;
  return status >= 400 && status < 500 && status !== 429 && status !== 408;
}

function describeFailure(status: number, body: string): string {
  if (status === 401 || status === 403) {
    return 'Google rejected the upload session. It may have expired — try again.';
  }
  if (status === 404) {
    return 'The upload session no longer exists. Start the upload again.';
  }
  const detail = body.slice(0, 200);
  return `Google rejected the upload (${status})${detail ? `: ${detail}` : ''}`;
}
