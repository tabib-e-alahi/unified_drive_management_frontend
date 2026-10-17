'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest, errorMessage } from '@/lib/api';
import {
  fileResponseSchema,
  successSchema,
  uploadSessionSchema,
} from '@/lib/schemas';
import { UploadCancelledError, uploadFileInChunks } from '@/lib/upload';
import { folderKeys } from '@/hooks/use-folders';
import { accountKeys } from '@/hooks/use-accounts';

/** Google throttles aggressive parallelism, and 3 keeps the UI responsive. */
const MAX_CONCURRENT_UPLOADS = 3;

/** Speed is averaged over this window so the figure does not jump around. */
const SPEED_WINDOW_MS = 3000;

export type UploadStatus =
  | 'queued'
  | 'starting'
  | 'uploading'
  | 'completing'
  | 'done'
  | 'failed'
  | 'cancelled';

export interface UploadItem {
  id: string;
  name: string;
  size: number;
  status: UploadStatus;
  bytesSent: number;
  /** Bytes per second, or null before enough samples exist. */
  speed: number | null;
  error?: string;
  folderId: string | null;
}

interface UploadContextValue {
  items: UploadItem[];
  enqueue: (files: File[], folderId: string | null) => void;
  cancel: (id: string) => void;
  retry: (id: string) => void;
  clearFinished: () => void;
  activeCount: number;
}

const UploadContext = createContext<UploadContextValue | null>(null);

export function useUploads(): UploadContextValue {
  const context = useContext(UploadContext);
  if (!context)
    throw new Error('useUploads must be used inside <UploadProvider>');
  return context;
}

interface TrackedUpload {
  item: UploadItem;
  file: File;
  controller: AbortController;
  /** Recent (timestamp, bytes) samples, for the rolling speed average. */
  samples: Array<{ at: number; bytes: number }>;
  /** Server-side file row id, needed to complete or cancel. */
  serverFileId: string | null;
}

let nextId = 0;

export function UploadProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<UploadItem[]>([]);
  const tracked = useRef(new Map<string, TrackedUpload>());
  const running = useRef(0);
  const pump = useRef<() => void>(() => undefined);

  const patch = useCallback((id: string, changes: Partial<UploadItem>) => {
    const entry = tracked.current.get(id);
    if (entry) entry.item = { ...entry.item, ...changes };
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  }, []);

  const refreshViews = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: folderKeys.anyContents });
    void queryClient.invalidateQueries({ queryKey: accountKeys.summary });
    void queryClient.invalidateQueries({ queryKey: accountKeys.list });
  }, [queryClient]);

  const runUpload = useCallback(
    async (id: string) => {
      const entry = tracked.current.get(id);
      if (!entry) return;

      running.current += 1;
      patch(id, { status: 'starting', error: undefined });

      try {
        const session = await apiRequest(
          '/files/upload-session',
          uploadSessionSchema,
          {
            method: 'POST',
            body: {
              name: entry.file.name,
              size: entry.file.size,
              mimeType: entry.file.type || 'application/octet-stream',
              folderId: entry.item.folderId,
            },
            signal: entry.controller.signal,
          },
        );

        entry.serverFileId = session.fileId;
        patch(id, { status: 'uploading' });

        const googleFileId = await uploadFileInChunks({
          file: entry.file,
          uploadUrl: session.uploadUrl,
          signal: entry.controller.signal,
          onProgress: ({ bytesSent }) => {
            const now = Date.now();
            entry.samples.push({ at: now, bytes: bytesSent });
            while (
              entry.samples.length > 1 &&
              now - entry.samples[0]!.at > SPEED_WINDOW_MS
            ) {
              entry.samples.shift();
            }
            patch(id, { bytesSent, speed: computeSpeed(entry.samples) });
          },
        });

        patch(id, { status: 'completing', bytesSent: entry.file.size });

        await apiRequest(
          `/files/${session.fileId}/complete`,
          fileResponseSchema,
          {
            method: 'POST',
            body: { googleFileId },
          },
        );

        patch(id, { status: 'done', speed: null });
        refreshViews();
      } catch (error) {
        if (
          error instanceof UploadCancelledError ||
          entry.controller.signal.aborted
        ) {
          patch(id, { status: 'cancelled', speed: null });
          await releaseServerSide(entry);
        } else {
          patch(id, {
            status: 'failed',
            speed: null,
            error: errorMessage(error),
          });
          await releaseServerSide(entry);
        }
        refreshViews();
      } finally {
        running.current -= 1;
        pump.current();
      }
    },
    [patch, refreshViews],
  );

  /**
   * Starts queued uploads up to the concurrency limit. Called whenever work
   * is added or a slot frees up.
   */
  const startNext = useCallback(() => {
    for (const entry of tracked.current.values()) {
      if (running.current >= MAX_CONCURRENT_UPLOADS) return;
      if (entry.item.status !== 'queued') continue;
      void runUpload(entry.item.id);
    }
  }, [runUpload]);

  /*
   * `runUpload` needs to start the next queued upload when a slot frees up,
   * but `startNext` depends on `runUpload`. The ref breaks that cycle. It is
   * assigned in an effect rather than during render; by the time any upload
   * finishes and reads it, the effect has long since run.
   */
  useEffect(() => {
    pump.current = startNext;
  }, [startNext]);

  const enqueue = useCallback(
    (files: File[], folderId: string | null) => {
      const created: UploadItem[] = [];

      for (const file of files) {
        const id = `upload-${(nextId += 1)}`;
        const item: UploadItem = {
          id,
          name: file.name,
          size: file.size,
          status: 'queued',
          bytesSent: 0,
          speed: null,
          folderId,
        };
        tracked.current.set(id, {
          item,
          file,
          controller: new AbortController(),
          samples: [],
          serverFileId: null,
        });
        created.push(item);
      }

      setItems((current) => [...current, ...created]);
      startNext();
    },
    [startNext],
  );

  const cancel = useCallback(
    (id: string) => {
      const entry = tracked.current.get(id);
      if (!entry) return;
      // A queued upload has no request to abort; mark it directly.
      if (entry.item.status === 'queued') {
        patch(id, { status: 'cancelled' });
        return;
      }
      entry.controller.abort();
    },
    [patch],
  );

  const retry = useCallback(
    (id: string) => {
      const entry = tracked.current.get(id);
      if (!entry) return;
      // A fresh controller: the old one is already aborted or spent.
      entry.controller = new AbortController();
      entry.samples = [];
      entry.serverFileId = null;
      patch(id, {
        status: 'queued',
        bytesSent: 0,
        error: undefined,
        speed: null,
      });
      startNext();
    },
    [patch, startNext],
  );

  const clearFinished = useCallback(() => {
    for (const [id, entry] of tracked.current) {
      if (['done', 'cancelled', 'failed'].includes(entry.item.status)) {
        tracked.current.delete(id);
      }
    }
    setItems((current) =>
      current.filter(
        (item) => !['done', 'cancelled', 'failed'].includes(item.status),
      ),
    );
  }, []);

  const value = useMemo<UploadContextValue>(
    () => ({
      items,
      enqueue,
      cancel,
      retry,
      clearFinished,
      activeCount: items.filter((item) =>
        ['queued', 'starting', 'uploading', 'completing'].includes(item.status),
      ).length,
    }),
    [items, enqueue, cancel, retry, clearFinished],
  );

  return (
    <UploadContext.Provider value={value}>{children}</UploadContext.Provider>
  );
}

/**
 * Tells the server to drop a half-finished upload so its reserved bytes come
 * back immediately rather than waiting for the cleanup cron.
 */
async function releaseServerSide(entry: TrackedUpload): Promise<void> {
  if (!entry.serverFileId) return;
  try {
    await apiRequest(`/files/${entry.serverFileId}/upload`, successSchema, {
      method: 'DELETE',
    });
  } catch {
    // The cron is the backstop; a failure here is not worth surfacing.
  }
}

function computeSpeed(
  samples: Array<{ at: number; bytes: number }>,
): number | null {
  if (samples.length < 2) return null;
  const first = samples[0]!;
  const last = samples[samples.length - 1]!;
  const seconds = (last.at - first.at) / 1000;
  if (seconds <= 0) return null;
  return (last.bytes - first.bytes) / seconds;
}
