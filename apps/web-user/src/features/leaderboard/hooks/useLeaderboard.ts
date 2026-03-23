import { useQuery } from "@tanstack/react-query";
import { leaderboardApi } from "@/api/leaderboard.api";
import { queryKeys } from "@/config/queryKeys";

export const useLeaderboardQuery = () => {
  return useQuery({
    queryKey: queryKeys.leaderboard.current,
    queryFn: () => leaderboardApi.getCurrentLeaderboard(),
    staleTime: 60 * 1000, // 1 minute stale time for rankings
  });
};
