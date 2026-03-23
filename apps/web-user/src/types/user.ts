export type UserRole = "LEARNER" | "ADMIN" | "TEACHER";

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface UserStats {
  userId: string;
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  accuracy: number;
  lessonsCompleted: number;
  league: string;
}
