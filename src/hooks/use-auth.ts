'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { ApiError, apiRequest } from '@/lib/api';
import {
  setupStatusSchema,
  successSchema,
  userSchema,
  type Credentials,
  type RegisterInput,
  type User,
} from '@/lib/schemas';

export const authKeys = {
  me: ['auth', 'me'] as const,
  setupStatus: ['auth', 'setup-status'] as const,
};

/**
 * The current session. A 401 is a valid answer ("logged out"), not an error
 * worth retrying, so it resolves to null instead of throwing.
 */
export function useCurrentUser(): UseQueryResult<User | null, Error> {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: async () => {
      try {
        return await apiRequest('/auth/me', userSchema);
      } catch (error) {
        if (error instanceof ApiError && error.isUnauthorized) return null;
        throw error;
      }
    },
    staleTime: 60_000,
    retry: false,
  });
}

export function useSetupStatus(): UseQueryResult<
  { setupRequired: boolean },
  Error
> {
  return useQuery({
    queryKey: authKeys.setupStatus,
    queryFn: () => apiRequest('/auth/setup-status', setupStatusSchema),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useLogin(): UseMutationResult<User, Error, Credentials> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credentials: Credentials) =>
      apiRequest('/auth/login', userSchema, {
        method: 'POST',
        body: credentials,
      }),
    onSuccess: (user) => {
      queryClient.setQueryData(authKeys.me, user);
    },
  });
}

export function useRegister(): UseMutationResult<User, Error, RegisterInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      apiRequest('/auth/register', userSchema, {
        method: 'POST',
        body: input,
      }),
    onSuccess: (user) => {
      queryClient.setQueryData(authKeys.me, user);
      // Setting this directly rather than invalidating avoids a refetch that
      // would race the post-registration redirect.
      queryClient.setQueryData(authKeys.setupStatus, { setupRequired: false });
    },
  });
}

export function useLogout(): UseMutationResult<
  { success: boolean },
  Error,
  void
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest('/auth/logout', successSchema, { method: 'POST' }),
    onSuccess: () => {
      // Drop every cached query: none of it belongs to the next session.
      queryClient.clear();
      queryClient.setQueryData(authKeys.me, null);
    },
  });
}
