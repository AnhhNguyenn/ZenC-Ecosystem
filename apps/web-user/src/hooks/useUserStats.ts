import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '@/features/auth/AuthContext';

interface UserStats {
  streak: number;
  totalXp: number;
  currentLeague: string;
  level: string;
}

export function useUserStats() {
  const { token, user } = useAuth();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  const { data, isLoading, error } = useQuery({
    queryKey: ['userStats', user?.id],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      // Fetch user profile and gamification stats
      // Adjust endpoints based on actual backend controller
      const [profileRes, statsRes] = await Promise.all([
        axios.get(`${apiUrl}/users/profile`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${apiUrl}/gamification/stats`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      return {
        ...profileRes.data,
        ...statsRes.data
      } as UserStats;
    },
    enabled: !!token && !!user,
    // Fallback data for now if backend endpoints aren't perfectly aligned yet
    initialData: {
      streak: 0,
      totalXp: 0,
      currentLeague: 'Bronze',
      level: 'A1'
    }
  });

  return { stats: data, isLoading, error };
}
