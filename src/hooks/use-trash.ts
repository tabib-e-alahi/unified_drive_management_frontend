'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import {
  emptyTrashSchema,
  restoreFolderSchema,
  trashListingSchema,
  type TrashListing,
} from '@/lib/schemas';
import { folderKeys } from './use-folders';
import { accountKeys } from './use-accounts';
import { fileKeys } from './use-files';

export function useTrash(): UseQueryResult<TrashListing, Error> {
  return useQuery({
    queryKey: fileKeys.trash,
    queryFn: () => apiRequest('/trash', trashListingSchema),
  });
}

function useInvalidateTrash(): () => void {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: fileKeys.trash });
    void queryClient.invalidateQueries({ queryKey: folderKeys.anyContents });
    void queryClient.invalidateQueries({ queryKey: accountKeys.summary });
    void queryClient.invalidateQueries({ queryKey: accountKeys.list });
  };
}

export function useRestoreFolder(): UseMutationResult<
  { restoredFolders: number; restoredFiles: number; movedToRoot: boolean },
  Error,
  string
> {
  const invalidate = useInvalidateTrash();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/folders/${id}/restore`, restoreFolderSchema, {
        method: 'POST',
      }),
    onSuccess: invalidate,
  });
}

export function useEmptyTrash(): UseMutationResult<
  { deletedFiles: number; deletedFolders: number; failed: number },
  Error,
  void
> {
  const invalidate = useInvalidateTrash();
  return useMutation({
    mutationFn: () =>
      apiRequest('/trash', emptyTrashSchema, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}
