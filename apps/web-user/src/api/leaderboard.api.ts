import { apiClient } from "./axios";

export interface LeaderboardEntryDto {
  rank: number;
  name: string;
  xp: number;
  streak: number;
  isCurrentUser: boolean;
}

export const leaderboardApi = {
  getCurrentLeaderboard: async (): Promise<LeaderboardEntryDto[]> => {
    const response = await apiClient.get<LeaderboardEntryDto[]>("/leaderboard/current");
    return response.data;
  },
};
