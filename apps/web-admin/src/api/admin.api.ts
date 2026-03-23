import { apiClient } from './axios';

export interface AnalyticsOverview {
  totalUsers: number;
  activeUsers24h: number;
  revenueMRR: number;
  growthPercentage: number;
}

export interface WeeklyStatPoint {
  week: string;
  newUsers: number;
  sessions: number;
}

export const adminApi = {
  getAnalyticsOverview: async (): Promise<AnalyticsOverview> => {
    const res = await apiClient.get<{ data: AnalyticsOverview }>('/admin/analytics/overview');
    return res.data.data;
  },

  getWeeklyStats: async (): Promise<WeeklyStatPoint[]> => {
    const res = await apiClient.get<{ data: WeeklyStatPoint[] }>('/admin/analytics/weekly');
    return res.data.data;
  },
};
