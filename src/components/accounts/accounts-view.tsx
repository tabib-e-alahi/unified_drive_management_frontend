'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { AccountCard } from './account-card';
import { errorMessage } from '@/lib/api';
import { formatBytes } from '@/lib/format';
import {
  useAccounts,
  useConnectAccount,
  useStorageSummary,
} from '@/hooks/use-accounts';

/** Human wording for the error codes the OAuth callback can redirect with. */
const ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'You cancelled the Google sign-in, so nothing was linked.',
  missing_code_or_state:
    'Google sent an incomplete response. Please try again.',
  link_failed: 'Could not link the account.',
};

function CardSkeleton() {
  return (
    <div className="border-border bg-surface rounded-xl border p-5">
      <div className="flex items-center gap-3">
        <div className="skeleton size-9 rounded-lg" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-48 rounded" />
          <div className="skeleton h-3 w-32 rounded" />
        </div>
      </div>
      <div className="skeleton mt-4 h-2 w-full rounded-full" />
      <div className="skeleton mt-3 h-3 w-2/3 rounded" />
    </div>
  );
}

export function AccountsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const accounts = useAccounts();
  const summary = useStorageSummary();
  const connect = useConnectAccount();

  // The OAuth callback redirects back with a result in the query string.
  // Handle it once, then strip the params so a refresh does not re-toast.
  const handledRef = useRef(false);
  useEffect(() => {
    if (handledRef.current) return;

    const linked = searchParams.get('linked');
    const reconnected = searchParams.get('reconnected');
    const error = searchParams.get('error');
    if (!linked && !reconnected && !error) return;

    handledRef.current = true;

    if (linked) toast.success('Google account linked.');
    else if (reconnected) toast.success('Google account reconnected.');
    else if (error) {
      const detail = searchParams.get('detail');
      toast.error(
        detail ?? ERROR_MESSAGES[error] ?? 'Could not link the account.',
      );
    }

    router.replace('/accounts');
  }, [searchParams, router]);

  const linkButton = (
    <Button
      loading={connect.isPending}
      onClick={() =>
        connect.mutate(undefined, {
          onError: (error) => toast.error(errorMessage(error)),
        })
      }
    >
      <Plus className="size-4" aria-hidden />
      Link Google account
    </Button>
  );

  const list = accounts.data ?? [];
  const total = summary.data?.totalBytes ?? null;
  const used = summary.data?.usedBytes ?? 0n;

  return (
    <>
      <PageHeader
        title="Accounts"
        description={
          summary.data
            ? `${summary.data.activeAccounts} active account${
                summary.data.activeAccounts === 1 ? '' : 's'
              } · ${formatBytes(used)}${
                total === null ? '' : ` of ${formatBytes(total)}`
              } used`
            : 'The Google accounts that physically store your files.'
        }
        actions={linkButton}
      />

      <div className="space-y-4 p-4 sm:p-6">
        {accounts.isError && (
          <div className="border-danger/40 bg-danger/10 text-danger flex items-start gap-2 rounded-lg border p-3 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{errorMessage(accounts.error)}</span>
          </div>
        )}

        {accounts.isLoading && (
          <div className="space-y-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        )}

        {accounts.isSuccess && list.length === 0 && (
          <div className="border-border flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
            <p className="font-medium">No Google accounts linked yet</p>
            <p className="text-muted-foreground max-w-md text-sm">
              Link a Google account to give your unified drive some storage.
              This app only ever sees the files it creates — the rest of your
              Drive stays private.
            </p>
            {linkButton}
          </div>
        )}

        {list.map((account) => (
          <AccountCard key={account.id} account={account} />
        ))}
      </div>
    </>
  );
}
