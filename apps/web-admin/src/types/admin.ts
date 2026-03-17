export interface AdminProfile {
  id: string;
  email: string;
  fullName: string;
  role: "ADMIN" | "SUPER_ADMIN";
  avatarUrl?: string;
  lastLoginAt: string;
}

export interface SystemMetrics {
  totalUsers: number;
  activeUsers24h: number;
  totalLessonsCompleted: number;
  revenueMRR: number;
  growthPercentage: number;
}
