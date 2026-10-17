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
  accountListSchema,
  accountSchema,
  connectUrlSchema,
  storageSummarySchema,
  successSchema,
  type DriveAccount,
  type StorageSummary,
} from '@/lib/schemas';

export const accountKeys = {
  all: ['accounts'] as const,
  list: ['accounts', 'list'] as const,
  summary: ['storage', 'summary'] as const,
};

export function useAccounts(): UseQueryResult<DriveAccount[], Error> {
  return useQuery({
    queryKey: accountKeys.list,
    queryFn: () => apiRequest('/accounts', accountListSchema),
  });
}

export function useStorageSummary(): UseQueryResult<StorageSummary, Error> {
  return useQuery({
    queryKey: accountKeys.summary,
    queryFn: () => apiRequest('/storage/summary', storageSummarySchema),
  });
}

/**
 * Both linking and reconnecting end in a full-page navigation to Google, so
 * these fetch a URL and then hand the tab over rather than using a router
 * push (the consent screen is not part of this app).
 */
export function useConnectAccount(): UseMutationResult<void, Error, void> {
  return useMutation({
    mutationFn: async () => {
      const { url } = await apiRequest(
        '/accounts/google/connect',
        connectUrlSchema,
      );
      window.location.href = url;
    },
  });
}

export function useReconnectAccount(): UseMutationResult<void, Error, string> {
  return useMutation({
    mutationFn: async (accountId: string) => {
      const { url } = await apiRequest(
        `/accounts/${accountId}/reconnect`,
        connectUrlSchema,
      );
      window.location.href = url;
    },
  });
}

export function useRefreshQuota(): UseMutationResult<
  DriveAccount,
  Error,
  string
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) =>
      apiRequest(`/accounts/${accountId}/refresh-quota`, accountSchema, {
        method: 'POST',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accountKeys.list });
      void queryClient.invalidateQueries({ queryKey: accountKeys.summary });
    },
  });
}

export function useUnlinkAccount(): UseMutationResult<
  { success: boolean },
  Error,
  string
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) =>
      apiRequest(`/accounts/${accountId}`, successSchema, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accountKeys.list });
      void queryClient.invalidateQueries({ queryKey: accountKeys.summary });
    },
  });
}
