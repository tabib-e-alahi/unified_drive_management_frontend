'use client';

import { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  RotateCw,
  X,
} from 'lucide-react';
import { formatBytes } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { useUploads, type UploadItem } from './upload-manager';

/** Bottom-right queue: progress, speed, retry and cancel per file. */
export function UploadPanel() {
  const { items, cancel, retry, clearFinished, activeCount } = useUploads();
  const [collapsed, setCollapsed] = useState(false);

  if (items.length === 0) return null;

  const done = items.filter((item) => item.status === 'done').length;
  const failed = items.filter((item) => item.status === 'failed').length;

  const heading =
    activeCount > 0
      ? `Uploading ${activeCount} file${activeCount === 1 ? '' : 's'}`
      : failed > 0
        ? `${failed} upload${failed === 1 ? '' : 's'} failed`
        : `${done} upload${done === 1 ? '' : 's'} complete`;

  return (
    <section
      aria-label="Uploads"
      className="border-border bg-surface fixed right-4 bottom-4 z-40 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border shadow-xl"
    >
      <header className="border-border flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {activeCount > 0 && (
            <Loader2
              className="text-primary size-4 shrink-0 animate-spin"
              aria-hidden
            />
          )}
          <h2 className="truncate text-sm font-medium">{heading}</h2>
        </div>
        <div className="flex items-center gap-0.5">
          {activeCount === 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFinished}
              aria-label="Clear finished uploads"
              title="Clear"
            >
              <X className="size-4" aria-hidden />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed((value) => !value)}
            aria-expanded={!collapsed}
            aria-label={
              collapsed ? 'Expand upload list' : 'Collapse upload list'
            }
          >
            {collapsed ? (
              <ChevronUp className="size-4" aria-hidden />
            ) : (
              <ChevronDown className="size-4" aria-hidden />
            )}
          </Button>
        </div>
      </header>

      {!collapsed && (
        <ul className="max-h-72 overflow-auto">
          {items.map((item) => (
            <UploadRow
              key={item.id}
              item={item}
              onCancel={cancel}
              onRetry={retry}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function UploadRow({
  item,
  onCancel,
  onRetry,
}: {
  item: UploadItem;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const percent =
    item.size === 0
      ? item.status === 'done'
        ? 100
        : 0
      : Math.min(100, Math.round((item.bytesSent / item.size) * 100));

  const inFlight = ['queued', 'starting', 'uploading', 'completing'].includes(
    item.status,
  );

  return (
    <li className="border-border/60 border-b px-3 py-2 last:border-b-0">
      <div className="flex items-center gap-2">
        <StatusIcon status={item.status} />
        <span className="min-w-0 flex-1 truncate text-sm" title={item.name}>
          {item.name}
        </span>

        {inFlight ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCancel(item.id)}
            aria-label={`Cancel upload of ${item.name}`}
            title="Cancel"
          >
            <X className="size-4" aria-hidden />
          </Button>
        ) : item.status === 'failed' || item.status === 'cancelled' ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRetry(item.id)}
            aria-label={`Retry upload of ${item.name}`}
            title="Retry"
          >
            <RotateCw className="size-4" aria-hidden />
          </Button>
        ) : null}
      </div>

      {inFlight && item.status !== 'queued' && (
        <div
          className="bg-surface-muted mt-1.5 h-1 w-full overflow-hidden rounded-full"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Upload progress for ${item.name}`}
        >
          <div
            className="bg-primary h-full rounded-full transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      <p className="text-muted-foreground mt-1 truncate text-xs">
        <StatusText item={item} percent={percent} />
      </p>
    </li>
  );
}

function StatusIcon({ status }: { status: UploadItem['status'] }) {
  if (status === 'done') {
    return (
      <CheckCircle2 className="text-success size-4 shrink-0" aria-hidden />
    );
  }
  if (status === 'failed') {
    return <AlertCircle className="text-danger size-4 shrink-0" aria-hidden />;
  }
  if (status === 'cancelled') {
    return <X className="text-muted-foreground size-4 shrink-0" aria-hidden />;
  }
  if (status === 'queued') {
    return (
      <span
        className="border-border size-4 shrink-0 rounded-full border"
        aria-hidden
      />
    );
  }
  return (
    <Loader2
      className="text-primary size-4 shrink-0 animate-spin"
      aria-hidden
    />
  );
}

function StatusText({ item, percent }: { item: UploadItem; percent: number }) {
  switch (item.status) {
    case 'queued':
      return <>Waiting · {formatBytes(item.size)}</>;
    case 'starting':
      return <>Preparing…</>;
    case 'completing':
      return <>Verifying with Google…</>;
    case 'done':
      return <>Uploaded · {formatBytes(item.size)}</>;
    case 'cancelled':
      return <>Cancelled</>;
    case 'failed':
      return (
        <span className="text-danger">{item.error ?? 'Upload failed'}</span>
      );
    default:
      return (
        <>
          {percent}% of {formatBytes(item.size)}
          {item.speed !== null && item.speed > 0 && (
            <> · {formatBytes(item.speed)}/s</>
          )}
        </>
      );
  }
}
