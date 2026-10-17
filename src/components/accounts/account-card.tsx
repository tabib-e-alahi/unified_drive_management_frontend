'use client';

import { useState } from 'react';
import { HardDrive, Link2, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/dialogs/confirm-dialog';
import { StatusBadge } from './status-badge';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/lib/api';
import { formatBytes, formatRelativeTime, usagePercent } from '@/lib/format';
import {
  useReconnectAccount,
  useRefreshQuota,
  useUnlinkAccount,
} from '@/hooks/use-accounts';
import type { DriveAccount } from '@/lib/schemas';

export function AccountCard({ account }: { account: DriveAccount }) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const refreshQuota = useRefreshQuota();
  const unlink = useUnlinkAccount();
  const reconnect = useReconnectAccount();

  const unlimited = account.quotaTotal === null;
  const percent = usagePercent(account.quotaUsed, account.quotaTotal);
  const holdsFiles = account.fileCount > 0;

  const barColor =
    percent >= 90 ? 'bg-danger' : percent >= 75 ? 'bg-warning' : 'bg-primary';

  return (
    <div className="border-border bg-surface rounded-xl border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="bg-surface-muted text-muted-foreground rounded-lg p-2">
            <HardDrive className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium" title={account.googleEmail}>
              {account.googleEmail}
            </p>
            <p className="text-muted-foreground text-xs">
              {account.lastSyncedAt
                ? `Quota checked ${formatRelativeTime(account.lastSyncedAt)}`
                : 'Quota not checked yet'}
            </p>
          </div>
        </div>
        <StatusBadge status={account.status} />
      </div>

      <div className="mt-4 space-y-2">
        <div
          className="bg-surface-muted h-2 w-full overflow-hidden rounded-full"
          role="progressbar"
          aria-valuenow={Math.round(percent)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Storage used on ${account.googleEmail}`}
        >
          <div
            className={cn('h-full rounded-full transition-all', barColor)}
            style={{ width: `${unlimited ? 0 : percent}%` }}
          />
        </div>

        <div className="text-muted-foreground flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs">
          <span>
            {unlimited ? (
              <>{formatBytes(account.quotaUsed)} used · no storage limit</>
            ) : (
              <>
                {formatBytes(account.quotaUsed)} of{' '}
                {formatBytes(account.quotaTotal ?? 0n)} used
              </>
            )}
          </span>
          <span>
            {account.freeBytes === null
              ? 'unlimited free'
              : `${formatBytes(account.freeBytes)} free`}
          </span>
        </div>

        <p className="text-muted-foreground text-xs">
          This app stores {formatBytes(account.appStoredBytes)} here across{' '}
          {account.fileCount} file{account.fileCount === 1 ? '' : 's'}.
          {account.reservedBytes > 0n && (
            <>
              {' '}
              {formatBytes(account.reservedBytes)} reserved for uploads in
              progress.
            </>
          )}
        </p>
      </div>

      {account.status === 'REAUTH_REQUIRED' && (
        <p className="bg-warning/10 text-warning mt-3 rounded-lg px-3 py-2 text-xs">
          Google rejected the stored credentials for this account. Reconnect it
          to resume uploads and downloads. Your files are untouched.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          loading={refreshQuota.isPending}
          onClick={() =>
            refreshQuota.mutate(account.id, {
              onSuccess: () => toast.success('Quota updated'),
              onError: (error) => toast.error(errorMessage(error)),
            })
          }
        >
          <RefreshCw className="size-4" aria-hidden />
          Refresh quota
        </Button>

        {account.status === 'REAUTH_REQUIRED' && (
          <Button
            size="sm"
            loading={reconnect.isPending}
            onClick={() =>
              reconnect.mutate(account.id, {
                onError: (error) => toast.error(errorMessage(error)),
              })
            }
          >
            <Link2 className="size-4" aria-hidden />
            Reconnect
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          disabled={holdsFiles}
          title={
            holdsFiles
              ? `This account still stores ${account.fileCount} file${
                  account.fileCount === 1 ? '' : 's'
                }. Move or delete them first.`
              : 'Remove this account'
          }
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 className="size-4" aria-hidden />
          Remove
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        destructive
        title={`Remove ${account.googleEmail}?`}
        description="This unlinks the Google account and revokes this app's access to it. The UnifiedStorage folder and anything in it stays on Google Drive."
        confirmLabel="Remove account"
        loading={unlink.isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() =>
          unlink.mutate(account.id, {
            onSuccess: () => {
              setConfirmOpen(false);
              toast.success(`Removed ${account.googleEmail}`);
            },
            onError: (error) => {
              setConfirmOpen(false);
              toast.error(errorMessage(error));
            },
          })
        }
      />
    </div>
  );
}
