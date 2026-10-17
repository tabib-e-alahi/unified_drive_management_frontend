'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { apiRequest, apiUrl } from '@/lib/api';
import {
  fileDetailSchema,
  importResultSchema,
  pickerConfigSchema,
  restoreFileSchema,
  searchResultsSchema,
  successSchema,
  type FileDetail,
  type ImportResult,
  type PickerConfig,
  type SearchHit,
} from '@/lib/schemas';
import { folderKeys } from './use-folders';
import { accountKeys } from './use-accounts';

export const fileKeys = {
  detail: (id: string) => ['files', 'detail', id] as const,
  search: (q: string) => ['files', 'search', q] as const,
  trash: ['trash'] as const,
  pickerConfig: ['files', 'import', 'config'] as const,
};

/** URL the browser loads directly for previews and downloads. */
export const fileStreamUrl = (
  id: string,
  mode: 'preview' | 'download',
): string => apiUrl(`/files/${id}/${mode}`);

/** Small preview image for a grid tile; 404s when Google has none. */
export const fileThumbnailUrl = (id: string): string =>
  apiUrl(`/files/${id}/thumbnail`);

export function useFileDetail(
  fileId: string | null,
): UseQueryResult<FileDetail, Error> {
  return useQuery({
    queryKey: fileKeys.detail(fileId ?? ''),
    queryFn: () => apiRequest(`/files/${fileId}`, fileDetailSchema),
    enabled: fileId !== null,
  });
}

export function useSearchFiles(
  query: string,
): UseQueryResult<SearchHit[], Error> {
  return useQuery({
    queryKey: fileKeys.search(query),
    queryFn: () =>
      apiRequest('/files/search', searchResultsSchema, { query: { q: query } }),
    enabled: query.trim().length > 0,
    staleTime: 15_000,
  });
}

/** Any file change can alter a listing, the trash and the storage figures. */
function useInvalidateEverything(): () => void {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: folderKeys.anyContents });
    void queryClient.invalidateQueries({ queryKey: fileKeys.trash });
    void queryClient.invalidateQueries({ queryKey: ['files', 'search'] });
    void queryClient.invalidateQueries({ queryKey: accountKeys.summary });
    void queryClient.invalidateQueries({ queryKey: accountKeys.list });
  };
}

export function useUpdateFile(): UseMutationResult<
  FileDetail,
  Error,
  { id: string; name?: string; folderId?: string | null }
> {
  const invalidate = useInvalidateEverything();
  return useMutation({
    mutationFn: ({ id, ...changes }) =>
      apiRequest(`/files/${id}`, fileDetailSchema, {
        method: 'PATCH',
        body: changes,
      }),
    onSuccess: invalidate,
  });
}

export function useTrashFile(): UseMutationResult<FileDetail, Error, string> {
  const invalidate = useInvalidateEverything();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/files/${id}/trash`, fileDetailSchema, { method: 'POST' }),
    onSuccess: invalidate,
  });
}

export function useRestoreFile(): UseMutationResult<
  { file: FileDetail; movedToRoot: boolean },
  Error,
  string
> {
  const invalidate = useInvalidateEverything();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/files/${id}/restore`, restoreFileSchema, { method: 'POST' }),
    onSuccess: invalidate,
  });
}

export function useDeleteFile(): UseMutationResult<
  { success: boolean },
  Error,
  string
> {
  const invalidate = useInvalidateEverything();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/files/${id}`, successSchema, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

/** Whether importing from Google Drive is configured, and with what. */
export function usePickerConfig(): UseQueryResult<PickerConfig, Error> {
  return useQuery({
    queryKey: fileKeys.pickerConfig,
    queryFn: () => apiRequest('/files/import/config', pickerConfigSchema),
    // Server configuration; it only changes on a redeploy.
    staleTime: Infinity,
  });
}

export function useImportFiles(): UseMutationResult<
  ImportResult,
  Error,
  { accountId: string; googleFileIds: string[]; folderId: string | null }
> {
  const invalidate = useInvalidateEverything();
  return useMutation({
    mutationFn: (body) =>
      apiRequest('/files/import', importResultSchema, {
        method: 'POST',
        body,
      }),
    onSuccess: invalidate,
  });
}
