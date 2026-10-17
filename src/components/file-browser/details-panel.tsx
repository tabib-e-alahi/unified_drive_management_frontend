'use client';

import { CircleAlert, HardDrive, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { formatBytes, formatDateTime } from '@/lib/format';
import { errorMessage } from '@/lib/api';
import { useFileDetail } from '@/hooks/use-files';

/**
 * The one place the app reveals which Google account physically stores a
 * file. The main browser deliberately hides it: the point of the app is that
 * it does not matter.
 */
export function DetailsPanel({
  fileId,
  onClose,
}: {
  fileId: string;
  onClose: () => void;
}) {
  const { data, isLoading, isError, error } = useFileDetail(fileId);

  return (
    <aside
      aria-label="File details"
      className="border-border bg-surface w-72 shrink-0 border-l"
    >
      <header className="border-border flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Details</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Close details"
        >
          <X className="size-4" aria-hidden />
        </Button>
      </header>

      <div className="space-y-4 p-4 text-sm">
        {isLoading && <Spinner label="Loading details" />}
        {isError && <p className="text-danger">{errorMessage(error)}</p>}

        {data && (
          <>
            <div>
              <p className="font-medium break-words">{data.name}</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {data.mimeType}
              </p>
            </div>

            {data.status === 'MISSING' && (
              <div
                role="status"
                className="border-warning/40 bg-warning/10 flex gap-2 rounded-lg border p-3 text-xs"
              >
                <CircleAlert
                  className="text-warning mt-0.5 size-3.5 shrink-0"
                  aria-hidden
                />
                <p>
                  This file is no longer on Google Drive — it was probably
                  deleted there directly. It cannot be opened. Restore it from
                  the Google Drive trash of the account below if you can;
                  otherwise delete it here to tidy up.
                </p>
              </div>
            )}

            <dl className="space-y-2.5">
              <Row label="Size" value={formatBytes(data.size)} />
              <Row label="Added" value={formatDateTime(data.createdAt)} />
              <Row label="Modified" value={formatDateTime(data.updatedAt)} />
            </dl>

            <div className="border-border bg-surface-muted rounded-lg border p-3">
              <div className="flex items-center gap-2 text-xs font-medium">
                <HardDrive
                  className="text-muted-foreground size-3.5"
                  aria-hidden
                />
                Stored on
              </div>
              <p className="text-muted-foreground mt-1 text-xs break-all">
                {data.storedOn.googleEmail}
              </p>
              <p className="text-muted-foreground mt-2 text-xs">
                {data.source === 'IMPORTED'
                  ? 'Imported from this account’s Google Drive, where it stays. Renaming, moving or deleting it here never changes the original.'
                  : 'Which account holds a file is chosen automatically. Moving or renaming it never moves the bytes.'}
              </p>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-right text-xs">{value}</dd>
    </div>
  );
}
