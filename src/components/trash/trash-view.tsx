'use client';

import { useState } from 'react';
import { RotateCcw, Trash2, Trash } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { ConfirmDialog } from '@/components/dialogs/confirm-dialog';
import {
  FileTypeIcon,
  FolderTypeIcon,
} from '@/components/file-browser/file-icon';
import { errorMessage } from '@/lib/api';
import { formatBytes, formatRelativeTime } from '@/lib/format';
import { useDeleteFile, useRestoreFile } from '@/hooks/use-files';
import { useEmptyTrash, useRestoreFolder, useTrash } from '@/hooks/use-trash';

export function TrashView() {
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [deletingFile, setDeletingFile] = useState<{
    id: string;
    name: string;
    imported: boolean;
  } | null>(null);

  const trash = useTrash();
  const restoreFile = useRestoreFile();
  const restoreFolder = useRestoreFolder();
  const deleteFile = useDeleteFile();
  const emptyTrash = useEmptyTrash();

  // Items trashed as part of a folder are hidden: restoring the folder brings
  // them back, and listing them separately would imply otherwise.
  const folders = (trash.data?.folders ?? []).filter(
    (folder) => !folder.nested,
  );
  const files = (trash.data?.files ?? []).filter((file) => !file.nested);
  const hiddenCount =
    (trash.data?.folders.length ?? 0) -
    folders.length +
    ((trash.data?.files.length ?? 0) - files.length);
  const isEmpty = folders.length === 0 && files.length === 0;

  return (
    <>
      <PageHeader
        title="Trash"
        description="Items stay here until you delete them permanently."
        actions={
          !isEmpty ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirmEmpty(true)}
              loading={emptyTrash.isPending}
            >
              <Trash className="size-4" aria-hidden />
              Empty trash
            </Button>
          ) : undefined
        }
      />

      <div className="p-4 sm:p-6">
        {trash.isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="skeleton h-12 rounded-lg" />
            ))}
          </div>
        )}

        {trash.isError && (
          <p className="border-danger/40 bg-danger/10 text-danger rounded-lg border p-3 text-sm">
            {errorMessage(trash.error)}
          </p>
        )}

        {trash.isSuccess && isEmpty && (
          <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
            <div className="bg-surface-muted text-muted-foreground rounded-full p-3">
              <Trash2 className="size-6" aria-hidden />
            </div>
            <p className="font-medium">The trash is empty</p>
            <p className="text-muted-foreground max-w-sm text-sm">
              Items you delete appear here first, so nothing is lost by
              accident.
            </p>
          </div>
        )}

        {!isEmpty && (
          <ul className="divide-border border-border divide-y rounded-lg border">
            {folders.map((folder) => (
              <li
                key={folder.id}
                className="flex items-center gap-3 px-3 py-2.5"
              >
                <FolderTypeIcon className="size-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{folder.name}</span>
                  <span className="text-muted-foreground block text-xs">
                    Folder · trashed {formatRelativeTime(folder.trashedAt)}
                  </span>
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={restoreFolder.isPending}
                  onClick={() =>
                    restoreFolder.mutate(folder.id, {
                      onSuccess: (result) =>
                        toast.success(
                          result.movedToRoot
                            ? `Restored "${folder.name}" to My Drive (its old location is gone)`
                            : `Restored "${folder.name}"`,
                        ),
                      onError: (error) => toast.error(errorMessage(error)),
                    })
                  }
                >
                  <RotateCcw className="size-4" aria-hidden />
                  Restore
                </Button>
              </li>
            ))}

            {files.map((file) => (
              <li key={file.id} className="flex items-center gap-3 px-3 py-2.5">
                <FileTypeIcon
                  className="size-4 shrink-0"
                  mimeType={file.mimeType}
                  name={file.name}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{file.name}</span>
                  <span className="text-muted-foreground block text-xs">
                    {formatBytes(file.size)} · trashed{' '}
                    {formatRelativeTime(file.trashedAt)}
                  </span>
                </span>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      restoreFile.mutate(file.id, {
                        onSuccess: (result) =>
                          toast.success(
                            result.movedToRoot
                              ? `Restored "${file.name}" to My Drive (its old folder is gone)`
                              : `Restored "${file.name}"`,
                          ),
                        onError: (error) => toast.error(errorMessage(error)),
                      })
                    }
                  >
                    <RotateCcw className="size-4" aria-hidden />
                    Restore
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Delete ${file.name} permanently`}
                    onClick={() =>
                      setDeletingFile({
                        id: file.id,
                        name: file.name,
                        imported: file.source === 'IMPORTED',
                      })
                    }
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {hiddenCount > 0 && (
          <p className="text-muted-foreground mt-3 text-xs">
            {hiddenCount} item{hiddenCount === 1 ? '' : 's'} inside the folders
            above {hiddenCount === 1 ? 'is' : 'are'} hidden. Restoring a folder
            brings its contents back too.
          </p>
        )}
      </div>

      <ConfirmDialog
        open={confirmEmpty}
        destructive
        title="Empty the trash?"
        description="Every uploaded file in the trash is deleted from Google Drive for good, and the space is returned to your accounts. Imported files are only removed from Unified Drive — the originals stay in your Google Drive. This cannot be undone."
        confirmLabel="Delete everything"
        loading={emptyTrash.isPending}
        onCancel={() => setConfirmEmpty(false)}
        onConfirm={() =>
          emptyTrash.mutate(undefined, {
            onSuccess: (result) => {
              setConfirmEmpty(false);
              toast.success(
                result.failed > 0
                  ? `Deleted ${result.deletedFiles} files; ${result.failed} could not be removed from Google`
                  : `Deleted ${result.deletedFiles} file${result.deletedFiles === 1 ? '' : 's'} and ${result.deletedFolders} folder${result.deletedFolders === 1 ? '' : 's'}`,
              );
            },
            onError: (error) => {
              setConfirmEmpty(false);
              toast.error(errorMessage(error));
            },
          })
        }
      />

      <ConfirmDialog
        open={deletingFile !== null}
        destructive
        title={
          deletingFile?.imported
            ? `Remove "${deletingFile.name}" from Unified Drive?`
            : `Delete "${deletingFile?.name ?? ''}" permanently?`
        }
        description={
          deletingFile?.imported
            ? 'This file was imported from your Google Drive. It is only removed from Unified Drive; the original stays in your Google Drive.'
            : 'The file is removed from Google Drive and its space returned to the account. This cannot be undone.'
        }
        confirmLabel={deletingFile?.imported ? 'Remove' : 'Delete permanently'}
        loading={deleteFile.isPending}
        onCancel={() => setDeletingFile(null)}
        onConfirm={() => {
          if (!deletingFile) return;
          deleteFile.mutate(deletingFile.id, {
            onSuccess: () => {
              toast.success(`Deleted "${deletingFile.name}"`);
              setDeletingFile(null);
            },
            onError: (error) => {
              toast.error(errorMessage(error));
              setDeletingFile(null);
            },
          });
        }}
      />
    </>
  );
}
