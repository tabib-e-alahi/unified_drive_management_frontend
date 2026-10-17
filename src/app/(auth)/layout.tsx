import { HardDrive } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center px-4 py-10">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="bg-primary text-primary-foreground mb-3 rounded-xl p-2.5">
            <HardDrive className="size-6" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold">Unified Drive</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Several Google Drive accounts, one storage space.
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
