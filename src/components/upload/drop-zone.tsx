'use client';

import {
  useCallback,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from 'react';
import { UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DropZoneProps {
  onFiles: (files: File[]) => void;
  children: ReactNode;
  className?: string;
}

/**
 * Wraps the browser so files dragged from the desktop upload into the
 * current folder.
 *
 * dragenter/dragleave fire for every child element, so a counter tracks
 * whether the pointer is genuinely still inside; otherwise the overlay
 * flickers as the cursor crosses rows.
 */
export function DropZone({ onFiles, children, className }: DropZoneProps) {
  const [active, setActive] = useState(false);
  const depth = useRef(0);

  const carriesFiles = (event: DragEvent): boolean =>
    Array.from(event.dataTransfer.types).includes('Files');

  const onDragEnter = useCallback((event: DragEvent) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    depth.current += 1;
    setActive(true);
  }, []);

  const onDragLeave = useCallback((event: DragEvent) => {
    if (!carriesFiles(event)) return;
    depth.current -= 1;
    if (depth.current <= 0) {
      depth.current = 0;
      setActive(false);
    }
  }, []);

  const onDragOver = useCallback((event: DragEvent) => {
    if (!carriesFiles(event)) return;
    // Without this the browser navigates to the dropped file.
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      depth.current = 0;
      setActive(false);

      // Directories arrive as entries with no size and cannot be read this
      // way, so only real files are taken.
      const files = Array.from(event.dataTransfer.files);
      if (files.length > 0) onFiles(files);
    },
    [onFiles],
  );

  return (
    <div
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn('relative', className)}
    >
      {children}

      {active && (
        <div className="bg-primary/10 pointer-events-none absolute inset-0 z-30 flex items-center justify-center backdrop-blur-[1px]">
          <div className="border-primary bg-surface/90 flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-8 py-6 text-center">
            <UploadCloud className="text-primary size-8" aria-hidden />
            <p className="font-medium">Drop files to upload</p>
            <p className="text-muted-foreground text-sm">
              They go into the folder you are viewing
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
