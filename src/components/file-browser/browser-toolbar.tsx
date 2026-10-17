'use client';

import {
  ArrowDownAZ,
  ArrowUpAZ,
  FolderPlus,
  LayoutGrid,
  List,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SORT_KEYS, type SortKey, type SortOrder } from '@/lib/schemas';
import { ImportButton } from './import-button';

export type ViewMode = 'grid' | 'list';

const SORT_LABELS: Record<SortKey, string> = {
  name: 'Name',
  size: 'Size',
  date: 'Modified',
};

export interface BrowserToolbarProps {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  sort: SortKey;
  order: SortOrder;
  onSortChange: (sort: SortKey, order: SortOrder) => void;
  onNewFolder: () => void;
  onUpload: () => void;
  selectedCount: number;
  /** Where imported files land; null is the root. */
  folderId: string | null;
}

export function BrowserToolbar({
  view,
  onViewChange,
  sort,
  order,
  onSortChange,
  onNewFolder,
  onUpload,
  selectedCount,
  folderId,
}: BrowserToolbarProps) {
  return (
    <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 sm:px-6">
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onUpload}>
          <Upload className="size-4" aria-hidden />
          Upload
        </Button>
        <ImportButton folderId={folderId} />
        <Button variant="secondary" size="sm" onClick={onNewFolder}>
          <FolderPlus className="size-4" aria-hidden />
          New folder
        </Button>
        {selectedCount > 0 && (
          <span
            className="text-muted-foreground text-sm"
            // Announced so keyboard users hear the selection change.
            aria-live="polite"
          >
            {selectedCount} selected
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="sort-select">
          Sort by
        </label>
        <select
          id="sort-select"
          value={sort}
          onChange={(event) =>
            onSortChange(event.target.value as SortKey, order)
          }
          className="border-border bg-surface h-8 rounded-lg border px-2 text-sm"
        >
          {SORT_KEYS.map((key) => (
            <option key={key} value={key}>
              {SORT_LABELS[key]}
            </option>
          ))}
        </select>

        <Button
          variant="secondary"
          size="sm"
          aria-label={order === 'asc' ? 'Sort descending' : 'Sort ascending'}
          title={order === 'asc' ? 'Ascending' : 'Descending'}
          onClick={() => onSortChange(sort, order === 'asc' ? 'desc' : 'asc')}
        >
          {order === 'asc' ? (
            <ArrowDownAZ className="size-4" aria-hidden />
          ) : (
            <ArrowUpAZ className="size-4" aria-hidden />
          )}
        </Button>

        <div
          role="radiogroup"
          aria-label="View mode"
          className="border-border bg-surface inline-flex items-center gap-0.5 rounded-lg border p-0.5"
        >
          {(
            [
              ['list', List, 'List view'],
              ['grid', LayoutGrid, 'Grid view'],
            ] as const
          ).map(([mode, Icon, label]) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={view === mode}
              aria-label={label}
              title={label}
              onClick={() => onViewChange(mode)}
              className={cn(
                'rounded-md p-1.5 transition-colors',
                view === mode
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
              )}
            >
              <Icon className="size-4" aria-hidden />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
