'use client';

import Link from 'next/link';
import { ChevronRight, HardDrive } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Breadcrumb } from '@/lib/schemas';

export interface BreadcrumbsProps {
  trail: Breadcrumb[];
  /** Called when a crumb is a drop target for a drag-move. */
  onDropOnFolder?: (folderId: string | null) => void;
  dragActive?: boolean;
}

/**
 * Root is always first and is not part of the API trail, since the root is
 * virtual. Each crumb links to the full ancestor path so browser history and
 * the back button behave.
 */
export function Breadcrumbs({
  trail,
  onDropOnFolder,
  dragActive,
}: BreadcrumbsProps) {
  const hrefFor = (index: number): string =>
    `/drive/${trail
      .slice(0, index + 1)
      .map((crumb) => crumb.id)
      .join('/')}`;

  const dropProps = (folderId: string | null) =>
    onDropOnFolder
      ? {
          onDragOver: (event: React.DragEvent) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
          },
          onDrop: (event: React.DragEvent) => {
            event.preventDefault();
            onDropOnFolder(folderId);
          },
        }
      : {};

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 items-center gap-0.5 text-sm"
    >
      <Link
        href="/drive"
        {...dropProps(null)}
        className={cn(
          'flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 font-medium transition-colors',
          trail.length === 0
            ? 'text-foreground'
            : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
          dragActive && 'ring-primary/40 ring-1',
        )}
      >
        <HardDrive className="size-4" aria-hidden />
        My Drive
      </Link>

      {trail.map((crumb, index) => {
        const isCurrent = index === trail.length - 1;
        return (
          <div key={crumb.id} className="flex min-w-0 items-center">
            <ChevronRight
              className="text-muted-foreground size-4 shrink-0"
              aria-hidden
            />
            <Link
              href={hrefFor(index)}
              aria-current={isCurrent ? 'page' : undefined}
              {...dropProps(crumb.id)}
              className={cn(
                'truncate rounded-md px-2 py-1 transition-colors',
                isCurrent
                  ? 'text-foreground font-medium'
                  : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
                dragActive && !isCurrent && 'ring-primary/40 ring-1',
              )}
            >
              {crumb.name}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
