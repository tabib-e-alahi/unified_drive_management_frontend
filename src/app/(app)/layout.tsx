import { AuthGuard } from '@/components/layout/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { UploadProvider } from '@/components/upload/upload-manager';
import { UploadPanel } from '@/components/upload/upload-panel';

export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <AuthGuard>
      {/* The queue lives above the shell so uploads survive navigation. */}
      <UploadProvider>
        <AppShell>{children}</AppShell>
        <UploadPanel />
      </UploadProvider>
    </AuthGuard>
  );
}
