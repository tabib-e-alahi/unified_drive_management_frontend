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
  folderContentsSchema,
  folderSummarySchema,
  trashResultSchema,
  type FolderContents,
  type FolderSummary,
  type SortKey,
  type SortOrder,
} from '@/lib/schemas';

export interface ContentsParams {
  /** Null means the root of the drive. */
  folderId: string | null;
  sort: SortKey;
  order: SortOrder;
  page: number;
}

export const folderKeys = {
  all: ['folders'] as const,
  contents: (params: ContentsParams) =>
    [
      'folders',
      'contents',
      params.folderId ?? 'root',
      params.sort,
      params.order,
      params.page,
    ] as const,
  /** Everything under the folders namespace, for blanket invalidation. */
  anyContents: ['folders', 'contents'] as const,
};

export function useFolderContents(
  params: ContentsParams,
): UseQueryResult<FolderContents, Error> {
  return useQuery({
    queryKey: folderKeys.contents(params),
    queryFn: () =>
      apiRequest(
        `/folders/${params.folderId ?? 'root'}/contents`,
        folderContentsSchema,
        {
          query: {
            sort: params.sort,
            order: params.order,
            page: params.page,
          },
        },
      ),
    // Keeps the previous folder on screen while the next one loads, instead
    // of flashing a skeleton on every navigation.
    placeholderData: (previous) => previous,
  });
}

/**
 * Every mutation invalidates the whole contents namespace rather than one
 * key: a move changes two folders' listings, and a rename changes the parent's
 * ordering, so targeted invalidation would leave stale views behind.
 */
function useInvalidateContents(): () => void {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: folderKeys.anyContents });
  };
}

export function useCreateFolder(): UseMutationResult<
  FolderSummary,
  Error,
  { name: string; parentId: string | null }
> {
  const invalidate = useInvalidateContents();
  return useMutation({
    mutationFn: ({ name, parentId }) =>
      apiRequest('/folders', folderSummarySchema, {
        method: 'POST',
        body: { name, ...(parentId ? { parentId } : {}) },
      }),
    onSuccess: invalidate,
  });
}

export function useUpdateFolder(): UseMutationResult<
  FolderSummary,
  Error,
  { id: string; name?: string; parentId?: string | null }
> {
  const invalidate = useInvalidateContents();
  return useMutation({
    mutationFn: ({ id, ...changes }) =>
      apiRequest(`/folders/${id}`, folderSummarySchema, {
        method: 'PATCH',
        body: changes,
      }),
    onSuccess: invalidate,
  });
}

export function useTrashFolder(): UseMutationResult<
  { trashedFolders: number; trashedFiles: number },
  Error,
  string
> {
  const invalidate = useInvalidateContents();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/folders/${id}`, trashResultSchema, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}
