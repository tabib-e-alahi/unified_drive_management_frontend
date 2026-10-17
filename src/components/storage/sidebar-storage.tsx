'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { StorageMeter } from './storage-meter';
import { useStorageSummary } from '@/hooks/use-accounts';

/**
 * Combined storage across ACTIVE accounts, shown at the bottom of the sidebar.
 */
export function SidebarStorage() {
  const { data, isLoading, isError } = useStorageSummary();

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="skeleton h-1.5 w-full rounded-full" />
        <div className="skeleton h-3 w-32 rounded" />
      </div>
    );
  }

  if (isError || !data) {
    return <p className="text-muted-foreground text-xs">Storage unavailable</p>;
  }

  if (data.activeAccounts === 0) {
    return (
      <Link
        href="/accounts"
        className="text-primary block text-xs underline-offset-2 hover:underline"
      >
        Link a Google account to add storage
      </Link>
    );
  }

  return (
    <div className="space-y-2">
      <StorageMeter used={data.usedBytes} total={data.totalBytes} />
      {data.accountsNeedingReauth > 0 && (
        <Link
          href="/accounts"
          className="text-warning flex items-center gap-1.5 text-xs underline-offset-2 hover:underline"
        >
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
          {data.accountsNeedingReauth === 1
            ? '1 account needs reconnecting'
            : `${data.accountsNeedingReauth} accounts need reconnecting`}
        </Link>
      )}
    </div>
  );
}
