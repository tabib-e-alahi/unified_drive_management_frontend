'use client';

import { useCallback, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { itemKey, type BrowserItem } from './types';

export interface SelectionApi {
  selected: ReadonlySet<string>;
  isSelected: (item: BrowserItem) => boolean;
  handleItemMouseDown: (
    event: MouseEvent,
    item: BrowserItem,
    items: BrowserItem[],
  ) => void;
  selectOnly: (item: BrowserItem) => void;
  clear: () => void;
  selectAll: (items: BrowserItem[]) => void;
}

/**
 * Explorer-style selection: plain click replaces, Ctrl/Cmd toggles, Shift
 * extends from the last anchor.
 *
 * The anchor is kept in a ref rather than state because changing it must not
 * cause a render; it only matters at the moment of the next shift-click.
 */
export function useSelection(): SelectionApi {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const anchorRef = useRef<string | null>(null);

  const selectOnly = useCallback((item: BrowserItem) => {
    const key = itemKey(item);
    anchorRef.current = key;
    setSelected(new Set([key]));
  }, []);

  const clear = useCallback(() => {
    anchorRef.current = null;
    setSelected(new Set());
  }, []);

  const selectAll = useCallback((items: BrowserItem[]) => {
    setSelected(new Set(items.map(itemKey)));
  }, []);

  const handleItemMouseDown = useCallback(
    (event: MouseEvent, item: BrowserItem, items: BrowserItem[]) => {
      const key = itemKey(item);

      // Right-clicking an already-selected item keeps the multi-selection, so
      // the context menu can act on the whole group.
      if (event.button === 2 && selected.has(key)) return;

      if (event.shiftKey && anchorRef.current) {
        const keys = items.map(itemKey);
        const from = keys.indexOf(anchorRef.current);
        const to = keys.indexOf(key);
        if (from !== -1 && to !== -1) {
          const [start, end] = from < to ? [from, to] : [to, from];
          setSelected(new Set(keys.slice(start, end + 1)));
          return;
        }
      }

      if (event.ctrlKey || event.metaKey) {
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
        });
        anchorRef.current = key;
        return;
      }

      selectOnly(item);
    },
    [selected, selectOnly],
  );

  return {
    selected,
    isSelected: (item) => selected.has(itemKey(item)),
    handleItemMouseDown,
    selectOnly,
    clear,
    selectAll,
  };
}
