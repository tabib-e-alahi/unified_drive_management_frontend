'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronRight, HardDrive, Folder, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/utils';
import { folderContentsSchema, type FolderSummary } from '@/lib/schemas';

interface NodeState {
  expanded: boolean;
  loading: boolean;
  children: FolderSummary[] | null;
}

export interface FolderPickerDialogProps {
  open: boolean;
  title: string;
  /** Folders being moved; they and their subtrees are not valid targets. */
  excludeIds: ReadonlySet<string>;
  /** Where the items are now, so it can be shown as the current location. */
  currentParentId: string | null;
  loading?: boolean;
  onConfirm: (destinationId: string | null) => void;
  onCancel: () => void;
}

/**
 * Lazily-loaded folder tree for choosing a move destination.
 *
 * Children are fetched per node on expand rather than pulling the whole tree
 * up front, which keeps this usable on a drive with many folders.
 *
 * Note this only hides the folders being moved and any descendants it has
 * actually loaded; the server independently rejects an illegal move, so a
 * descendant the user expands to cannot produce a broken tree.
 */
export function FolderPickerDialog({
  open,
  title,
  excludeIds,
  currentParentId,
  loading = false,
  onConfirm,
  onCancel,
}: FolderPickerDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [nodes, setNodes] = useState<Record<string, NodeState>>({});
  const [roots, setRoots] = useState<FolderSummary[] | null>(null);
  const [rootLoading, setRootLoading] = useState(false);

  const loadChildren = async (
    folderId: string | null,
  ): Promise<FolderSummary[]> => {
    const contents = await queryClient.fetchQuery({
      queryKey: ['folder-picker', folderId ?? 'root'],
      queryFn: () =>
        apiRequest(
          `/folders/${folderId ?? 'root'}/contents`,
          folderContentsSchema,
          {
            query: { sort: 'name', order: 'asc', limit: 1 },
          },
        ),
      staleTime: 30_000,
    });
    return contents.folders;
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      setSelected(null);
      setNodes({});
      setRootLoading(true);
      void loadChildren(null)
        .then(setRoots)
        .finally(() => setRootLoading(false));
    }
    if (!open && dialog.open) dialog.close();
    // loadChildren is stable enough for this dialog's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (folderId: string) => {
    const existing = nodes[folderId];
    if (existing?.expanded) {
      setNodes((prev) => ({
        ...prev,
        [folderId]: { ...existing, expanded: false },
      }));
      return;
    }
    if (existing?.children) {
      setNodes((prev) => ({
        ...prev,
        [folderId]: { ...existing, expanded: true },
      }));
      return;
    }

    setNodes((prev) => ({
      ...prev,
      [folderId]: { expanded: true, loading: true, children: null },
    }));
    void loadChildren(folderId).then((children) => {
      setNodes((prev) => ({
        ...prev,
        [folderId]: { expanded: true, loading: false, children },
      }));
    });
  };

  const renderLevel = (folders: FolderSummary[], depth: number) => (
    <ul className={cn(depth > 0 && 'border-border ml-4 border-l pl-1')}>
      {folders
        .filter((folder) => !excludeIds.has(folder.id))
        .map((folder) => {
          const node = nodes[folder.id];
          const hasChildren = folder.childFolderCount > 0;
          return (
            <li key={folder.id}>
              <div
                className={cn(
                  'flex items-center gap-1 rounded-md pr-1',
                  selected === folder.id && 'bg-primary/10',
                )}
              >
                <button
                  type="button"
                  aria-label={node?.expanded ? 'Collapse' : 'Expand'}
                  disabled={!hasChildren}
                  onClick={() => toggle(folder.id)}
                  className="text-muted-foreground rounded p-1 disabled:opacity-0"
                >
                  {node?.loading ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <ChevronRight
                      className={cn(
                        'size-3.5 transition-transform',
                        node?.expanded && 'rotate-90',
                      )}
                      aria-hidden
                    />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(folder.id)}
                  onDoubleClick={() => toggle(folder.id)}
                  className="hover:bg-surface-muted flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left text-sm"
                >
                  <Folder
                    className="text-primary size-4 shrink-0"
                    aria-hidden
                  />
                  <span className="truncate">{folder.name}</span>
                </button>
              </div>
              {node?.expanded &&
                node.children &&
                renderLevel(node.children, depth + 1)}
            </li>
          );
        })}
    </ul>
  );

  const destinationUnchanged = selected === currentParentId;

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        if (!loading) onCancel();
      }}
      onClose={onCancel}
      className="border-border bg-surface text-foreground m-auto w-[min(30rem,calc(100vw-2rem))] rounded-xl border p-0 backdrop:bg-black/50"
    >
      <div className="p-5">
        <h2 className="mb-3 text-base font-semibold">{title}</h2>

        <div className="border-border max-h-72 overflow-auto rounded-lg border p-2">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className={cn(
              'hover:bg-surface-muted flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
              selected === null && 'bg-primary/10',
            )}
          >
            <HardDrive className="text-primary size-4 shrink-0" aria-hidden />
            My Drive
          </button>

          {rootLoading && (
            <p className="text-muted-foreground px-2 py-3 text-sm">
              Loading folders…
            </p>
          )}
          {roots && roots.length === 0 && (
            <p className="text-muted-foreground px-2 py-3 text-sm">
              No other folders yet.
            </p>
          )}
          {roots && roots.length > 0 && renderLevel(roots, 0)}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(selected)}
            loading={loading}
            disabled={destinationUnchanged}
            title={destinationUnchanged ? 'Already in this folder' : undefined}
          >
            Move here
          </Button>
        </div>
      </div>
    </dialog>
  );
}
