'use client';

import { cn } from '@/lib/utils';
import { formatBytes, usagePercent } from '@/lib/format';

export interface StorageMeterProps {
  used: bigint;
  total: bigint | null;
  className?: string;
}

/**
 * Combined storage across every ACTIVE account. Until an account is linked
 * this renders the empty state.
 */
export function StorageMeter({ used, total, className }: StorageMeterProps) {
  const percent = usagePercent(used, total);
  const unlimited = total === null;

  const barColor =
    percent >= 90 ? 'bg-danger' : percent >= 75 ? 'bg-warning' : 'bg-primary';

  return (
    <div className={cn('space-y-2', className)}>
      <div
        className="bg-surface-muted h-1.5 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Storage used"
      >
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${unlimited ? 0 : percent}%` }}
        />
      </div>
      <p className="text-muted-foreground text-xs">
        {unlimited ? (
          <>{formatBytes(used)} used</>
        ) : total === 0n ? (
          <>No storage linked yet</>
        ) : (
          <>
            {formatBytes(used)} of {formatBytes(total)} used
          </>
        )}
      </p>
    </div>
  );
}
