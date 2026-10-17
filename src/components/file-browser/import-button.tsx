'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, HardDriveDownload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/api';
import {
  PickerCancelled,
  isGooglePickerLoaded,
  pickDriveFiles,
  preloadGooglePicker,
} from '@/lib/google-picker';
import type { DriveAccount, ImportResult } from '@/lib/schemas';
import { useAccounts } from '@/hooks/use-accounts';
import { useImportFiles, usePickerConfig } from '@/hooks/use-files';

/**
 * "Import from Drive": opens the Google Picker on one linked account and
 * adds the chosen files to the current folder. Nothing is copied — the
 * files stay where they are in that Drive.
 *
 * Renders nothing unless the server has the Picker configured.
 */
export function ImportButton({ folderId }: { folderId: string | null }) {
  const config = usePickerConfig();
  const accounts = useAccounts();
  const importFiles = useImportFiles();
  const [menuOpen, setMenuOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const enabled = config.data?.enabled === true;
  const active = (accounts.data ?? []).filter((a) => a.status === 'ACTIVE');

  // Load Google's scripts ahead of the click: the sign-in popup has to open
  // synchronously inside it, or the browser blocks it.
  useEffect(() => {
    if (enabled) preloadGooglePicker().catch(() => undefined);
  }, [enabled]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  if (!config.data?.enabled) return null;
  const picker = config.data;

  /** Called straight from a click, so Google's popup is allowed to open. */
  const start = (account: DriveAccount) => {
    setMenuOpen(false);
    if (!isGooglePickerLoaded()) {
      toast.info('Google’s picker is still loading. Try again in a moment.');
      preloadGooglePicker().catch((error: unknown) =>
        toast.error(errorMessage(error)),
      );
      return;
    }

    setPicking(true);
    pickDriveFiles({
      clientId: picker.clientId,
      apiKey: picker.apiKey,
      appId: picker.appId,
      accountEmail: account.googleEmail,
    })
      .then((googleFileIds) =>
        importFiles.mutateAsync({
          accountId: account.id,
          googleFileIds,
          folderId,
        }),
      )
      .then(reportResult)
      .catch((error: unknown) => {
        if (!(error instanceof PickerCancelled)) {
          toast.error(errorMessage(error));
        }
      })
      .finally(() => setPicking(false));
  };

  const busy = picking || importFiles.isPending;
  const noAccounts = active.length === 0;

  return (
    <div ref={menuRef} className="relative">
      <Button
        variant="secondary"
        size="sm"
        loading={busy}
        disabled={noAccounts}
        title={
          noAccounts
            ? 'Link a Google account first'
            : 'Add files already in your Google Drive'
        }
        aria-haspopup={active.length > 1 ? 'menu' : undefined}
        aria-expanded={active.length > 1 ? menuOpen : undefined}
        onClick={() => {
          if (active.length === 1) start(active[0]!);
          else setMenuOpen((open) => !open);
        }}
      >
        {!busy && <HardDriveDownload className="size-4" aria-hidden />}
        Import from Drive
        {active.length > 1 && <ChevronDown className="size-3.5" aria-hidden />}
      </Button>

      {menuOpen && (
        <div
          role="menu"
          aria-label="Choose a Google account"
          className="border-border bg-surface absolute left-0 z-40 mt-1 min-w-56 overflow-hidden rounded-lg border py-1 shadow-lg"
        >
          <p className="text-muted-foreground px-3 pt-1 pb-1.5 text-xs">
            Import from which account?
          </p>
          {active.map((account) => (
            <button
              key={account.id}
              type="button"
              role="menuitem"
              onClick={() => start(account)}
              className="hover:bg-surface-muted block w-full truncate px-3 py-1.5 text-left text-sm"
            >
              {account.googleEmail}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function reportResult({ imported, folders, skipped }: ImportResult): void {
  const plural = (n: number, word: string) =>
    `${n} ${word}${n === 1 ? '' : 's'}`;
  const count = imported.length;
  const what =
    folders > 0
      ? `${plural(count, 'file')} in ${plural(folders, 'folder')}`
      : plural(count, 'file');

  if (skipped.length === 0) {
    toast.success(`Imported ${what}`);
    return;
  }

  // Group identical reasons so ten skipped Docs read as one line.
  const reasons = [...new Set(skipped.map((entry) => entry.reason))];
  const summary =
    count > 0
      ? `Imported ${what}; skipped ${skipped.length}`
      : `Nothing imported; skipped ${plural(skipped.length, 'item')}`;

  (count > 0 ? toast.warning : toast.error)(summary, {
    description: reasons.slice(0, 3).join(' '),
    duration: 10_000,
  });
}
