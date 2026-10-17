import type { FileStatus, FileSummary, FolderSummary } from '@/lib/schemas';

/**
 * Folders and files are selected, dragged and acted on together, so the
 * browser works with a single discriminated union rather than two lists.
 */
export type BrowserItem =
  | { kind: 'folder'; id: string; data: FolderSummary }
  | { kind: 'file'; id: string; data: FileSummary };

/** Stable key that cannot collide between a folder and a file. */
export const itemKey = (item: BrowserItem): string => `${item.kind}:${item.id}`;

export function toItems(
  folders: FolderSummary[],
  files: FileSummary[],
): BrowserItem[] {
  // Folders first, matching every file manager people already use.
  return [
    ...folders.map((data): BrowserItem => ({
      kind: 'folder',
      id: data.id,
      data,
    })),
    ...files.map((data): BrowserItem => ({ kind: 'file', id: data.id, data })),
  ];
}

/**
 * Why a file's bytes cannot be opened right now, or null when they can.
 *
 * MISSING is set by the nightly integrity check when the file was deleted
 * on Google Drive directly; the row stays so the user finds out here rather
 * than through a failed download.
 */
export function unavailableReason(status: FileStatus): string | null {
  switch (status) {
    case 'MISSING':
      return 'This file is no longer on Google Drive. It was probably deleted there directly.';
    case 'UPLOADING':
      return 'This file is still uploading.';
    case 'FAILED':
      return 'This upload did not finish.';
    case 'READY':
      return null;
  }
}
