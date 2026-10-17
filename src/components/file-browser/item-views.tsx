'use client';

import type { DragEvent, MouseEvent } from 'react';
import { CircleAlert, LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBytes, formatDateTime, formatRelativeTime } from '@/lib/format';
import { FileTypeIcon, FolderTypeIcon } from './file-icon';
import { FileThumbnail } from './file-thumbnail';
import type { FileStatus } from '@/lib/schemas';
import { itemKey, type BrowserItem } from './types';

export interface ItemViewProps {
  items: BrowserItem[];
  selected: ReadonlySet<string>;
  /** Folder currently hovered during a drag, highlighted as a drop target. */
  dropTargetId: string | null;
  onItemPointerDown: (event: MouseEvent, item: BrowserItem) => void;
  onItemDoubleClick: (item: BrowserItem) => void;
  onItemContextMenu: (event: MouseEvent, item: BrowserItem) => void;
  onDragStart: (event: DragEvent, item: BrowserItem) => void;
  onDragOverFolder: (event: DragEvent, folderId: string) => void;
  onDragLeaveFolder: () => void;
  onDropOnFolder: (event: DragEvent, folderId: string) => void;
}

/** Secondary line: child counts for folders, size for files. */
function subtitleFor(item: BrowserItem): string {
  if (item.kind === 'file') return formatBytes(item.data.size);

  const { childFolderCount, fileCount } = item.data;
  if (childFolderCount === 0 && fileCount === 0) return 'Empty';

  const parts: string[] = [];
  if (childFolderCount > 0) {
    parts.push(
      `${childFolderCount} folder${childFolderCount === 1 ? '' : 's'}`,
    );
  }
  if (fileCount > 0) {
    parts.push(`${fileCount} file${fileCount === 1 ? '' : 's'}`);
  }
  return parts.join(', ');
}

/**
 * A short label for a file that is not simply READY. Shown in both views so
 * a file deleted on Google Drive directly does not masquerade as a normal
 * one until a download fails.
 */
function FileStatusNote({ status }: { status: FileStatus }) {
  if (status === 'MISSING') {
    return (
      <span className="text-warning inline-flex items-center gap-1 text-xs">
        <CircleAlert className="size-3 shrink-0" aria-hidden />
        Missing from Google Drive
      </span>
    );
  }
  if (status === 'UPLOADING') {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
        <LoaderCircle className="size-3 shrink-0 animate-spin" aria-hidden />
        Uploading
      </span>
    );
  }
  return null;
}

/** Files whose bytes cannot be opened are dimmed. */
const isDimmed = (item: BrowserItem): boolean =>
  item.kind === 'file' && item.data.status !== 'READY';

/**
 * Builds the DOM handlers for one row or tile. Deliberately not a hook: it is
 * called once per item inside a map, where hooks are not allowed.
 */
function itemHandlers(props: ItemViewProps, item: BrowserItem) {
  const isFolder = item.kind === 'folder';
  return {
    draggable: true,
    onMouseDown: (event: MouseEvent) => props.onItemPointerDown(event, item),
    onDoubleClick: () => props.onItemDoubleClick(item),
    onContextMenu: (event: MouseEvent) => props.onItemContextMenu(event, item),
    onDragStart: (event: DragEvent) => props.onDragStart(event, item),
    ...(isFolder
      ? {
          onDragOver: (event: DragEvent) =>
            props.onDragOverFolder(event, item.id),
          onDragLeave: props.onDragLeaveFolder,
          onDrop: (event: DragEvent) => props.onDropOnFolder(event, item.id),
        }
      : {}),
  };
}

export function ItemGrid(props: ItemViewProps) {
  return (
    <ul
      className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 sm:p-6 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
      role="listbox"
      aria-multiselectable
      aria-label="Files and folders"
    >
      {props.items.map((item) => {
        const key = itemKey(item);
        const isSelected = props.selected.has(key);
        const isDropTarget = props.dropTargetId === item.id;

        return (
          <li key={key}>
            <div
              role="option"
              aria-selected={isSelected}
              tabIndex={-1}
              {...itemHandlers(props, item)}
              className={cn(
                'group flex cursor-default flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors select-none',
                isSelected
                  ? 'border-primary bg-primary/10'
                  : 'hover:bg-surface-muted border-transparent',
                isDropTarget && 'border-primary ring-primary/40 ring-2',
              )}
            >
              {item.kind === 'folder' ? (
                <div className="flex aspect-[4/3] w-full items-center justify-center">
                  <FolderTypeIcon className="size-10" />
                </div>
              ) : (
                <FileThumbnail
                  file={item.data}
                  className="aspect-[4/3] w-full"
                />
              )}
              <span
                className="line-clamp-2 w-full text-sm break-words"
                title={item.data.name}
              >
                {item.data.name}
              </span>
              {item.kind === 'file' && item.data.status !== 'READY' ? (
                <FileStatusNote status={item.data.status} />
              ) : (
                <span className="text-muted-foreground text-xs">
                  {subtitleFor(item)}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ItemList(props: ItemViewProps) {
  return (
    <div className="px-2 pb-4 sm:px-4">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-border text-muted-foreground border-b text-left text-xs">
            <th scope="col" className="px-3 py-2 font-medium">
              Name
            </th>
            <th
              scope="col"
              className="hidden px-3 py-2 font-medium sm:table-cell"
            >
              Size
            </th>
            <th
              scope="col"
              className="hidden px-3 py-2 font-medium md:table-cell"
            >
              Modified
            </th>
          </tr>
        </thead>
        <tbody>
          {props.items.map((item) => {
            const key = itemKey(item);
            const isSelected = props.selected.has(key);
            const isDropTarget = props.dropTargetId === item.id;

            return (
              <tr
                key={key}
                aria-selected={isSelected}
                {...itemHandlers(props, item)}
                className={cn(
                  'border-border/50 cursor-default border-b transition-colors select-none',
                  isSelected ? 'bg-primary/10' : 'hover:bg-surface-muted',
                  isDropTarget && 'ring-primary/40 ring-2 ring-inset',
                )}
              >
                <td className="px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    {item.kind === 'folder' ? (
                      <FolderTypeIcon className="size-4 shrink-0" />
                    ) : (
                      <FileTypeIcon
                        className={cn(
                          'size-4 shrink-0',
                          isDimmed(item) && 'opacity-40',
                        )}
                        mimeType={item.data.mimeType}
                        name={item.data.name}
                      />
                    )}
                    <span className="truncate" title={item.data.name}>
                      {item.data.name}
                    </span>
                    {item.kind === 'file' && (
                      <span className="shrink-0">
                        <FileStatusNote status={item.data.status} />
                      </span>
                    )}
                  </div>
                </td>
                <td className="text-muted-foreground hidden px-3 py-2 sm:table-cell">
                  {item.kind === 'file' ? formatBytes(item.data.size) : '—'}
                </td>
                <td
                  className="text-muted-foreground hidden px-3 py-2 md:table-cell"
                  title={formatDateTime(item.data.updatedAt)}
                >
                  {formatRelativeTime(item.data.updatedAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
