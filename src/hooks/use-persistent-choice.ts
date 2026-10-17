'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * A small preference backed by localStorage, read through
 * useSyncExternalStore so the first client render already reflects the stored
 * value instead of rendering a default and then correcting it in an effect.
 *
 * Only for per-viewer conveniences such as a remembered view mode. The value
 * never leaves the browser and may legitimately come back missing (private
 * windows, cleared site data), so the fallback must always be usable.
 */
export function usePersistentChoice<T extends string>(
  storageKey: string,
  isValid: (value: unknown) => value is T,
  fallback: T,
): [T, (next: T) => void] {
  const eventName = `persistent-choice:${storageKey}`;

  const subscribe = useCallback(
    (onChange: () => void) => {
      // `storage` covers other tabs; the custom event covers this one.
      window.addEventListener('storage', onChange);
      window.addEventListener(eventName, onChange);
      return () => {
        window.removeEventListener('storage', onChange);
        window.removeEventListener(eventName, onChange);
      };
    },
    [eventName],
  );

  const getSnapshot = useCallback((): T => {
    try {
      const stored = localStorage.getItem(storageKey);
      return isValid(stored) ? stored : fallback;
    } catch {
      return fallback;
    }
  }, [storageKey, isValid, fallback]);

  // The server cannot know a browser preference.
  const getServerSnapshot = useCallback((): T => fallback, [fallback]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (next: T) => {
      try {
        localStorage.setItem(storageKey, next);
      } catch {
        // Not persisting is acceptable; the event below still updates the UI.
      }
      window.dispatchEvent(new Event(eventName));
    },
    [storageKey, eventName],
  );

  return [value, setValue];
}
