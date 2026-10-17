'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FullPageSpinner } from '@/components/ui/spinner';
import { useCurrentUser, useSetupStatus } from '@/hooks/use-auth';

/**
 * Entry point: sends a first-time visitor to setup, a signed-out visitor to
 * login, and everyone else into the drive.
 */
export default function HomePage() {
  const router = useRouter();
  const setupStatus = useSetupStatus();
  const currentUser = useCurrentUser();

  const setupRequired = setupStatus.data?.setupRequired;
  const user = currentUser.data;
  const ready = setupStatus.isSuccess && currentUser.isSuccess;

  useEffect(() => {
    if (!ready) return;
    if (setupRequired) router.replace('/setup');
    else if (user) router.replace('/drive');
    else router.replace('/login');
  }, [ready, setupRequired, user, router]);

  return <FullPageSpinner label="Starting Unified Drive" />;
}
