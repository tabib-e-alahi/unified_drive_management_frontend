'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { FullPageSpinner } from '@/components/ui/spinner';
import { useCurrentUser, useSetupStatus } from '@/hooks/use-auth';

/**
 * Client-side gate for the authenticated area. The session cookie is
 * httpOnly, so the browser cannot inspect it directly; asking the API who we
 * are is the authoritative check. Every protected endpoint independently
 * enforces auth, so this only controls what we render, never what we can reach.
 */
export function AuthGuard({ children }: { children: ReactNode }): ReactNode {
  const router = useRouter();
  const { data: user, isLoading, isError } = useCurrentUser();
  const setupStatus = useSetupStatus();

  useEffect(() => {
    if (isLoading) return;
    if (setupStatus.data?.setupRequired) {
      router.replace('/setup');
      return;
    }
    if (!user) router.replace('/login');
  }, [isLoading, user, setupStatus.data, router]);

  if (isLoading) return <FullPageSpinner label="Checking your session" />;

  if (isError) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-2 px-4 text-center">
        <p className="font-medium">Cannot reach the server</p>
        <p className="text-muted-foreground text-sm">
          Make sure the backend is running and NEXT_PUBLIC_API_URL is correct.
        </p>
      </div>
    );
  }

  // Redirecting; render nothing rather than a flash of the app shell.
  if (!user) return <FullPageSpinner label="Redirecting" />;

  return children;
}
