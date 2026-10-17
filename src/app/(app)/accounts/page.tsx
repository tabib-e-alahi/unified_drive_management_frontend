import { Suspense } from 'react';
import { AccountsView } from '@/components/accounts/accounts-view';
import { PageHeader } from '@/components/layout/page-header';

export default function AccountsPage() {
  return (
    // useSearchParams needs a Suspense boundary to avoid opting the whole
    // route out of static rendering.
    <Suspense
      fallback={
        <PageHeader
          title="Accounts"
          description="The Google accounts that physically store your files."
        />
      }
    >
      <AccountsView />
    </Suspense>
  );
}
