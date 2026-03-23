import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi, LoginRequestDto, LoginResponseDto } from "../api/auth.api";
import { setAccessToken } from "../api/axios";
import { queryKeys } from "../config/queryKeys";

export const useLoginMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: LoginRequestDto) => authApi.login(data),
    onSuccess: (data: LoginResponseDto) => {
      // Rule: Set Access Token strictly in memory
      setAccessToken(data.accessToken);
      // Rule: Hydrate React Query cache immediately to prevent redundant fetching
      queryClient.setQueryData(queryKeys.user.profile, data.user);
    },
  });
};

export const useLogoutMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      // Clear memory token and heavily invalidate all caches
      setAccessToken(null);
      queryClient.clear();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    },
  });
};

export const useUserQuery = () => {
  return useQuery({
    queryKey: queryKeys.user.profile,
    queryFn: () => authApi.getCurrentUser(),
    retry: false, // Prevents React Query from aggressively hitting 401s if unauthenticated
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
