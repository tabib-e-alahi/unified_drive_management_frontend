'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HardDrive, LogOut, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { SidebarStorage } from '@/components/storage/sidebar-storage';
import { useCurrentUser, useLogout } from '@/hooks/use-auth';

const NAV_ITEMS = [
  { href: '/drive', label: 'My Drive', Icon: HardDrive },
  { href: '/trash', label: 'Trash', Icon: Trash2 },
  { href: '/accounts', label: 'Accounts', Icon: Users },
] as const;

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useLogout();
  const { data: user } = useCurrentUser();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="bg-primary text-primary-foreground rounded-lg p-1.5">
          <HardDrive className="size-4" aria-hidden />
        </div>
        <span className="font-semibold">Unified Drive</span>
      </div>

      <nav className="flex-1 space-y-0.5 px-2" aria-label="Main">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-border space-y-3 border-t p-4">
        <SidebarStorage />

        <div className="flex items-center justify-between gap-2">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            loading={logout.isPending}
            onClick={() =>
              logout.mutate(undefined, {
                onSuccess: () => router.replace('/login'),
                onError: (error) => toast.error(errorMessage(error)),
              })
            }
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="size-4" aria-hidden />
          </Button>
        </div>

        {user && (
          <p
            className="text-muted-foreground truncate text-xs"
            title={user.email}
          >
            {user.email}
          </p>
        )}
      </div>
    </div>
  );
}
