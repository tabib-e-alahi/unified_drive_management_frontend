'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Download, Eye, FolderInput, Info, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ContextMenuAction {
  id: string;
  label: string;
  Icon: typeof Pencil;
  onSelect: () => void;
  disabled?: boolean;
  disabledReason?: string;
  destructive?: boolean;
}

export interface ItemContextMenuProps {
  x: number;
  y: number;
  actions: ContextMenuAction[];
  onClose: () => void;
}

export const MENU_ICONS = { Pencil, FolderInput, Trash2, Info, Download, Eye };

/**
 * Right-click menu, positioned at the pointer and nudged back inside the
 * viewport when it would overflow.
 */
export function ItemContextMenu({
  x,
  y,
  actions,
  onClose,
}: ItemContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  // Measure after paint so the menu never renders half off-screen.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const { width, height } = element.getBoundingClientRect();
    setPosition({
      left: Math.min(x, window.innerWidth - width - 8),
      top: Math.min(y, window.innerHeight - height - 8),
    });
  }, [x, y]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    // `true` so the menu closes before another handler reopens it.
    document.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', onClose, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      style={{ left: position.left, top: position.top }}
      className="border-border bg-surface fixed z-50 min-w-48 overflow-hidden rounded-lg border py-1 shadow-lg"
    >
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          role="menuitem"
          disabled={action.disabled}
          title={action.disabled ? action.disabledReason : undefined}
          onClick={() => {
            action.onSelect();
            onClose();
          }}
          className={cn(
            'flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors',
            action.disabled
              ? 'text-muted-foreground cursor-not-allowed opacity-50'
              : action.destructive
                ? 'text-danger hover:bg-danger/10'
                : 'hover:bg-surface-muted',
          )}
        >
          <action.Icon className="size-4 shrink-0" aria-hidden />
          {action.label}
        </button>
      ))}
    </div>
  );
}
