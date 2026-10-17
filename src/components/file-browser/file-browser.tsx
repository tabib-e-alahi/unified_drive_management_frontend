'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent, MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FolderOpen, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/dialogs/confirm-dialog';
import { PromptDialog } from '@/components/dialogs/prompt-dialog';
import { FolderPickerDialog } from '@/components/dialogs/folder-picker';
import { errorMessage } from '@/lib/api';
import {
  useCreateFolder,
  useFolderContents,
  useTrashFolder,
  useUpdateFolder,
} from '@/hooks/use-folders';
import type { SortKey, SortOrder } from '@/lib/schemas';
import { Breadcrumbs } from './breadcrumbs';
import { BrowserToolbar, type ViewMode } from './browser-toolbar';
import { ItemGrid, ItemList } from './item-views';
import {
  ItemContextMenu,
  MENU_ICONS,
  type ContextMenuAction,
} from './item-context-menu';
import { useSelection } from './use-selection';
import { DropZone } from '@/components/upload/drop-zone';
import { useUploads } from '@/components/upload/upload-manager';
import { PreviewModal } from '@/components/preview/preview-modal';
import { DetailsPanel } from './details-panel';
import { SearchBar } from './search-bar';
import { fileStreamUrl, useTrashFile, useUpdateFile } from '@/hooks/use-files';
import { usePersistentChoice } from '@/hooks/use-persistent-choice';
import { itemKey, toItems, unavailableReason, type BrowserItem } from './types';

const VIEW_STORAGE_KEY = 'unified-drive-view';
const DRAG_MIME = 'application/x-unified-drive-items';

const isViewMode = (value: unknown): value is ViewMode =>
  value === 'grid' || value === 'list';

export interface FileBrowserProps {
  /** Ancestor ids from the URL; the last one is the folder being viewed. */
  path: string[];
}

export function FileBrowser({ path }: FileBrowserProps) {
  const router = useRouter();
  const folderId = path.length > 0 ? (path[path.length - 1] ?? null) : null;

  const [view, setView] = usePersistentChoice<ViewMode>(
    VIEW_STORAGE_KEY,
    isViewMode,
    'list',
  );
  const [sort, setSort] = useState<SortKey>('name');
  const [order, setOrder] = useState<SortOrder>('asc');
  const [page, setPage] = useState(1);

  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    item: BrowserItem;
  } | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [renaming, setRenaming] = useState<BrowserItem | null>(null);
  const [moving, setMoving] = useState<BrowserItem[] | null>(null);
  const [deleting, setDeleting] = useState<BrowserItem[] | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const [previewing, setPreviewing] = useState<BrowserItem | null>(null);
  const [detailsFileId, setDetailsFileId] = useState<string | null>(null);

  const selection = useSelection();
  const uploads = useUploads();
  const filePickerRef = useRef<HTMLInputElement>(null);
  const contents = useFolderContents({ folderId, sort, order, page });
  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();
  const trashFolder = useTrashFolder();
  const updateFile = useUpdateFile();
  const trashFile = useTrashFile();

  const items = useMemo(
    () => toItems(contents.data?.folders ?? [], contents.data?.files ?? []),
    [contents.data],
  );

  /*
   * Selection and pagination belong to the folder being viewed. Resetting
   * them during render, rather than in an effect, avoids rendering the new
   * folder once with the previous folder's selection still highlighted.
   * This is React's documented "adjust state when a prop changes" pattern.
   */
  const [renderedFolderId, setRenderedFolderId] = useState(folderId);
  if (renderedFolderId !== folderId) {
    setRenderedFolderId(folderId);
    setPage(1);
    selection.clear();
  }

  const openFolder = useCallback(
    (id: string) => {
      router.push(`/drive/${[...path, id].join('/')}`);
    },
    [router, path],
  );

  /** A folder navigates; a file previews, unless its bytes are unavailable. */
  const openItem = useCallback(
    (item: BrowserItem) => {
      if (item.kind === 'folder') {
        openFolder(item.id);
        return;
      }
      const reason = unavailableReason(item.data.status);
      if (reason) toast.warning(reason);
      else setPreviewing(item);
    },
    [openFolder],
  );

  /**
   * Downloads by clicking a temporary link rather than fetching the bytes:
   * the browser then streams straight to disk and shows its own progress,
   * instead of buffering the whole file in memory first.
   */
  const triggerDownload = useCallback((item: BrowserItem) => {
    const link = document.createElement('a');
    link.href = fileStreamUrl(item.id, 'download');
    link.download = item.data.name;
    document.body.append(link);
    link.click();
    link.remove();
  }, []);

  const startUploads = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      uploads.enqueue(files, folderId);
      toast.success(
        files.length === 1
          ? `Uploading "${files[0]!.name}"`
          : `Uploading ${files.length} files`,
      );
    },
    [uploads, folderId],
  );

  const selectedItems = useMemo(
    () => items.filter((item) => selection.selected.has(itemKey(item))),
    [items, selection.selected],
  );

  // ------------------------------------------------------------------
  // Mutations
  // ------------------------------------------------------------------

  const runRename = (item: BrowserItem, name: string) => {
    const options = {
      onSuccess: () => {
        setRenaming(null);
        toast.success(`Renamed to "${name}"`);
      },
      onError: (error: Error) => toast.error(errorMessage(error)),
    };

    if (item.kind === 'folder')
      updateFolder.mutate({ id: item.id, name }, options);
    else updateFile.mutate({ id: item.id, name }, options);
  };

  const runMove = (targets: BrowserItem[], destinationId: string | null) => {
    if (targets.length === 0) {
      setMoving(null);
      return;
    }

    Promise.allSettled(
      targets.map((item) =>
        item.kind === 'folder'
          ? updateFolder.mutateAsync({ id: item.id, parentId: destinationId })
          : updateFile.mutateAsync({ id: item.id, folderId: destinationId }),
      ),
    )
      .then((results) => {
        const failed = results.filter((r) => r.status === 'rejected');
        setMoving(null);
        setDropTargetId(null);
        selection.clear();

        if (failed.length === 0) {
          toast.success(
            targets.length === 1 ? 'Moved' : `${targets.length} items moved`,
          );
          return;
        }
        // Report the first real reason rather than a generic count.
        const reason = errorMessage(
          (failed[0] as PromiseRejectedResult).reason,
        );
        toast.error(
          failed.length === results.length
            ? reason
            : `${failed.length} could not be moved: ${reason}`,
        );
      })
      .catch(() => setMoving(null));
  };

  const runTrash = (targets: BrowserItem[]) => {
    if (targets.length === 0) {
      setDeleting(null);
      return;
    }

    Promise.allSettled(
      targets.map((item) =>
        item.kind === 'folder'
          ? trashFolder.mutateAsync(item.id)
          : trashFile.mutateAsync(item.id),
      ),
    )
      .then((results) => {
        const failed = results.filter((r) => r.status === 'rejected');
        setDeleting(null);
        selection.clear();

        if (failed.length > 0) {
          toast.error(
            errorMessage((failed[0] as PromiseRejectedResult).reason),
          );
          return;
        }
        // A folder delete reports how much went with it; a file is just one.
        const totals = results.reduce(
          (sum, result, index) => {
            if (result.status !== 'fulfilled') return sum;
            if (targets[index]?.kind === 'file') {
              return { ...sum, files: sum.files + 1 };
            }
            const counts = result.value as unknown as {
              trashedFolders: number;
              trashedFiles: number;
            };
            return {
              folders: sum.folders + counts.trashedFolders,
              files: sum.files + counts.trashedFiles,
            };
          },
          { folders: 0, files: 0 },
        );
        toast.success(
          totals.files > 0
            ? `Moved ${totals.folders} folder${totals.folders === 1 ? '' : 's'} and ${totals.files} file${totals.files === 1 ? '' : 's'} to trash`
            : `Moved ${totals.folders} folder${totals.folders === 1 ? '' : 's'} to trash`,
        );
      })
      .catch(() => setDeleting(null));
  };

  // ------------------------------------------------------------------
  // Keyboard shortcuts
  // ------------------------------------------------------------------

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Never hijack typing in a dialog or input.
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          'input, textarea, select, [contenteditable="true"], dialog',
        )
      ) {
        return;
      }

      if (event.key === 'Escape') {
        selection.clear();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        selection.selectAll(items);
        return;
      }

      if (selectedItems.length === 0) return;

      if (event.key === 'F2') {
        event.preventDefault();
        const first = selectedItems[0];
        if (first) setRenaming(first);
        return;
      }

      if (event.key === 'Delete') {
        event.preventDefault();
        setDeleting(selectedItems);
        return;
      }

      // Enter opens: a folder navigates, a file previews.
      if (event.key === 'Enter' && selectedItems.length === 1) {
        event.preventDefault();
        openItem(selectedItems[0]!);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [items, selectedItems, selection, openItem]);

  // ------------------------------------------------------------------
  // Drag and drop (moving folders onto folders)
  // ------------------------------------------------------------------

  const onDragStart = (event: DragEvent, item: BrowserItem) => {
    // Dragging an unselected item makes it the selection first, so the drag
    // matches what the user sees highlighted.
    const dragged = selection.selected.has(itemKey(item))
      ? selectedItems
      : [item];
    if (!selection.selected.has(itemKey(item))) selection.selectOnly(item);

    setDragging(true);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(DRAG_MIME, dragged.map(itemKey).join(','));
  };

  const onDragOverFolder = (event: DragEvent, targetId: string) => {
    if (!event.dataTransfer.types.includes(DRAG_MIME)) return;
    // Cannot drop a folder onto itself.
    if (selectedItems.some((item) => item.id === targetId)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropTargetId(targetId);
  };

  const onDropOnFolder = (event: DragEvent, targetId: string) => {
    event.preventDefault();
    setDropTargetId(null);
    setDragging(false);
    if (selectedItems.some((item) => item.id === targetId)) return;
    runMove(selectedItems, targetId);
  };

  useEffect(() => {
    const stop = () => {
      setDragging(false);
      setDropTargetId(null);
    };
    window.addEventListener('dragend', stop);
    window.addEventListener('drop', stop);
    return () => {
      window.removeEventListener('dragend', stop);
      window.removeEventListener('drop', stop);
    };
  }, []);

  // ------------------------------------------------------------------
  // Context menu
  // ------------------------------------------------------------------

  const menuActions = (item: BrowserItem): ContextMenuAction[] => {
    const targets = selection.selected.has(itemKey(item))
      ? selectedItems
      : [item];
    const isFolder = item.kind === 'folder';
    const unavailable =
      item.kind === 'file' ? unavailableReason(item.data.status) : null;

    return [
      ...(isFolder
        ? [
            {
              id: 'open',
              label: 'Open',
              Icon: MENU_ICONS.FolderInput,
              onSelect: () => openFolder(item.id),
            },
          ]
        : []),
      ...(item.kind === 'file'
        ? [
            {
              id: 'preview',
              label: 'Preview',
              Icon: MENU_ICONS.Eye,
              disabled: unavailable !== null,
              disabledReason: unavailable ?? undefined,
              onSelect: () => setPreviewing(item),
            },
            {
              id: 'download',
              label: 'Download',
              Icon: MENU_ICONS.Download,
              disabled: unavailable !== null,
              disabledReason: unavailable ?? undefined,
              onSelect: () => triggerDownload(item),
            },
          ]
        : []),
      {
        id: 'rename',
        label: 'Rename',
        Icon: MENU_ICONS.Pencil,
        disabled: targets.length > 1,
        disabledReason: 'Select a single item to rename',
        onSelect: () => setRenaming(item),
      },
      {
        id: 'move',
        label:
          targets.length > 1 ? `Move ${targets.length} items…` : 'Move to…',
        Icon: MENU_ICONS.FolderInput,
        onSelect: () => setMoving(targets),
      },
      ...(item.kind === 'file'
        ? [
            {
              id: 'details',
              label: 'Details',
              Icon: MENU_ICONS.Info,
              onSelect: () => setDetailsFileId(item.id),
            },
          ]
        : []),
      {
        id: 'trash',
        label:
          targets.length > 1
            ? `Move ${targets.length} to trash`
            : 'Move to trash',
        Icon: MENU_ICONS.Trash2,
        destructive: true,
        onSelect: () => setDeleting(targets),
      },
    ];
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  const trail = contents.data?.breadcrumbs ?? [];
  const pagination = contents.data?.pagination;
  const isEmpty = contents.isSuccess && items.length === 0;

  const viewProps = {
    items,
    selected: selection.selected,
    dropTargetId,
    onItemPointerDown: (event: MouseEvent, item: BrowserItem) =>
      selection.handleItemMouseDown(event, item, items),
    onItemDoubleClick: openItem,
    onItemContextMenu: (event: MouseEvent, item: BrowserItem) => {
      event.preventDefault();
      selection.handleItemMouseDown(event, item, items);
      setMenu({ x: event.clientX, y: event.clientY, item });
    },
    onDragStart,
    onDragOverFolder,
    onDragLeaveFolder: () => setDropTargetId(null),
    onDropOnFolder,
  };

  return (
    <DropZone onFiles={startUploads} className="flex min-h-full flex-col">
      <div
        className="flex min-h-full flex-col"
        // Clicking empty space clears the selection, as in any file manager.
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) selection.clear();
        }}
      >
        <div className="border-border flex flex-wrap items-center gap-2 border-b px-4 py-3 sm:px-6">
          <Breadcrumbs
            trail={trail}
            dragActive={dragging}
            onDropOnFolder={(destination) => {
              if (selectedItems.length > 0) runMove(selectedItems, destination);
            }}
          />
          <SearchBar
            onOpenFile={(hit) =>
              setPreviewing({
                kind: 'file',
                id: hit.id,
                data: {
                  id: hit.id,
                  name: hit.name,
                  mimeType: hit.mimeType,
                  size: hit.size,
                  folderId: hit.folderId,
                  // Search only returns READY files.
                  status: 'READY',
                  source: hit.source,
                  createdAt: hit.updatedAt,
                  updatedAt: hit.updatedAt,
                },
              })
            }
          />
        </div>

        <BrowserToolbar
          view={view}
          onViewChange={setView}
          sort={sort}
          order={order}
          onSortChange={(nextSort, nextOrder) => {
            setSort(nextSort);
            setOrder(nextOrder);
            setPage(1);
          }}
          onNewFolder={() => setNewFolderOpen(true)}
          onUpload={() => filePickerRef.current?.click()}
          selectedCount={selection.selected.size}
          folderId={folderId}
        />

        {/* The visible control is the toolbar button; this input does the work. */}
        <input
          ref={filePickerRef}
          type="file"
          multiple
          hidden
          onChange={(event) => {
            startUploads(Array.from(event.target.files ?? []));
            // Reset so picking the same file twice still fires a change event.
            event.target.value = '';
          }}
        />

        {contents.isError && (
          <div className="border-danger/40 bg-danger/10 text-danger m-4 rounded-lg border p-3 text-sm sm:m-6">
            {errorMessage(contents.error)}
          </div>
        )}

        {contents.isLoading && <BrowserSkeleton view={view} />}

        {isEmpty && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-20 text-center">
            <div className="bg-surface-muted text-muted-foreground rounded-full p-3">
              <FolderOpen className="size-6" aria-hidden />
            </div>
            <p className="font-medium">This folder is empty</p>
            <p className="text-muted-foreground max-w-sm text-sm">
              Drag files here to upload them, or create a folder to organise
              your drive.
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => filePickerRef.current?.click()}>
                <Upload className="size-4" aria-hidden />
                Upload files
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setNewFolderOpen(true)}
              >
                New folder
              </Button>
            </div>
          </div>
        )}

        {!contents.isLoading && items.length > 0 && (
          <div className="flex min-h-0 flex-1">
            <div className="min-w-0 flex-1">
              {view === 'grid' ? (
                <ItemGrid {...viewProps} />
              ) : (
                <ItemList {...viewProps} />
              )}
            </div>
            {detailsFileId && (
              <div className="hidden lg:block">
                <DetailsPanel
                  fileId={detailsFileId}
                  onClose={() => setDetailsFileId(null)}
                />
              </div>
            )}
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="border-border flex items-center justify-center gap-3 border-t px-4 py-3">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              Previous
            </Button>
            <span className="text-muted-foreground text-sm">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        )}

        {menu && (
          <ItemContextMenu
            x={menu.x}
            y={menu.y}
            actions={menuActions(menu.item)}
            onClose={() => setMenu(null)}
          />
        )}

        <PromptDialog
          open={newFolderOpen}
          title="New folder"
          label="Folder name"
          placeholder="Untitled folder"
          confirmLabel="Create"
          loading={createFolder.isPending}
          onCancel={() => setNewFolderOpen(false)}
          onSubmit={(name) =>
            createFolder.mutate(
              { name, parentId: folderId },
              {
                onSuccess: () => {
                  setNewFolderOpen(false);
                  toast.success(`Created "${name}"`);
                },
                onError: (error) => toast.error(errorMessage(error)),
              },
            )
          }
        />

        <PromptDialog
          open={renaming !== null}
          title="Rename folder"
          label="Folder name"
          initialValue={renaming?.data.name ?? ''}
          confirmLabel="Rename"
          loading={updateFolder.isPending}
          onCancel={() => setRenaming(null)}
          onSubmit={(name) => renaming && runRename(renaming, name)}
        />

        <FolderPickerDialog
          open={moving !== null}
          title={
            moving && moving.length > 1
              ? `Move ${moving.length} folders to…`
              : 'Move folder to…'
          }
          excludeIds={new Set((moving ?? []).map((item) => item.id))}
          currentParentId={folderId}
          loading={updateFolder.isPending}
          onCancel={() => setMoving(null)}
          onConfirm={(destination) => moving && runMove(moving, destination)}
        />

        <ConfirmDialog
          open={deleting !== null}
          destructive
          title={
            deleting && deleting.length > 1
              ? `Move ${deleting.length} folders to trash?`
              : `Move "${deleting?.[0]?.data.name ?? ''}" to trash?`
          }
          description="Everything inside goes to the trash too. Nothing is deleted from Google Drive yet — you can restore it from the Trash."
          confirmLabel="Move to trash"
          loading={trashFolder.isPending}
          onCancel={() => setDeleting(null)}
          onConfirm={() => deleting && runTrash(deleting)}
        />

        <PreviewModal
          file={previewing?.kind === 'file' ? previewing.data : null}
          onClose={() => setPreviewing(null)}
        />
      </div>
    </DropZone>
  );
}

function BrowserSkeleton({ view }: { view: ViewMode }) {
  if (view === 'grid') {
    return (
      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 sm:p-6 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }, (_, index) => (
          <div
            key={index}
            className="flex flex-col items-center gap-2 rounded-xl p-3"
          >
            <div className="skeleton size-10 rounded-lg" />
            <div className="skeleton h-3 w-20 rounded" />
            <div className="skeleton h-2.5 w-12 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1 p-4 sm:px-6">
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="flex items-center gap-3 py-2">
          <div className="skeleton size-4 rounded" />
          <div className="skeleton h-3 max-w-64 flex-1 rounded" />
          <div className="skeleton h-3 w-16 rounded" />
        </div>
      ))}
    </div>
  );
}
