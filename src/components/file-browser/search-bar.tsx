'use client';

import { useEffect, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBytes, formatRelativeTime } from '@/lib/format';
import { errorMessage } from '@/lib/api';
import { useSearchFiles } from '@/hooks/use-files';
import { FileTypeIcon } from './file-icon';
import type { SearchHit } from '@/lib/schemas';

export interface SearchBarProps {
  onOpenFile: (hit: SearchHit) => void;
}

/** Waiting this long after the last keystroke keeps the API calls sane. */
const DEBOUNCE_MS = 300;

export function SearchBar({ onOpenFile }: SearchBarProps) {
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term]);

  const results = useSearchFiles(debounced);
  const showPanel = open && debounced.trim().length > 0;

  return (
    <div className="relative min-w-0 flex-1 sm:max-w-md">
      <label htmlFor="file-search" className="sr-only">
        Search files
      </label>
      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
          aria-hidden
        />
        <input
          id="file-search"
          type="search"
          value={term}
          placeholder="Search all files"
          onChange={(event) => setTerm(event.target.value)}
          onFocus={() => setOpen(true)}
          // A click inside the results list must land before this closes.
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="border-border bg-surface placeholder:text-muted-foreground h-8 w-full rounded-lg border pr-8 pl-8 text-sm"
        />
        {term.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setTerm('');
              setDebounced('');
            }}
            aria-label="Clear search"
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        )}
      </div>

      {showPanel && (
        <div className="border-border bg-surface absolute top-10 right-0 left-0 z-40 max-h-80 overflow-auto rounded-lg border shadow-lg">
          {results.isFetching && (
            <p className="text-muted-foreground flex items-center gap-2 px-3 py-3 text-sm">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Searching…
            </p>
          )}

          {results.isError && (
            <p className="text-danger px-3 py-3 text-sm">
              {errorMessage(results.error)}
            </p>
          )}

          {results.isSuccess && results.data.length === 0 && (
            <p className="text-muted-foreground px-3 py-3 text-sm">
              Nothing matches “{debounced}”.
            </p>
          )}

          {results.data?.map((hit) => (
            <button
              key={hit.id}
              type="button"
              onClick={() => {
                onOpenFile(hit);
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors',
                'hover:bg-surface-muted',
              )}
            >
              <FileTypeIcon
                className="size-4 shrink-0"
                mimeType={hit.mimeType}
                name={hit.name}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{hit.name}</span>
                <span className="text-muted-foreground block truncate text-xs">
                  {hit.folderPath} · {formatBytes(hit.size)} ·{' '}
                  {formatRelativeTime(hit.updatedAt)}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
