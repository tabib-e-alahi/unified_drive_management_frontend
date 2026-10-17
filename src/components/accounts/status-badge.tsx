import { AlertTriangle, CheckCircle2, PauseCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DriveAccountStatus } from '@/lib/schemas';

const STATUS: Record<
  DriveAccountStatus,
  { label: string; className: string; Icon: typeof CheckCircle2 }
> = {
  ACTIVE: {
    label: 'Connected',
    className: 'bg-success/10 text-success',
    Icon: CheckCircle2,
  },
  REAUTH_REQUIRED: {
    label: 'Needs reconnect',
    className: 'bg-warning/15 text-warning',
    Icon: AlertTriangle,
  },
  DISABLED: {
    label: 'Disabled',
    className: 'bg-surface-muted text-muted-foreground',
    Icon: PauseCircle,
  },
};

export function StatusBadge({ status }: { status: DriveAccountStatus }) {
  const { label, className, Icon } = STATUS[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}
