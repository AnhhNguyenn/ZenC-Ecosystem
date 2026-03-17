export interface Badge {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  requirementType: "XP" | "STREAK" | "LESSONS_COMPLETED" | "ACCURACY";
  requirementValue: number;
}

export interface UserBadge {
  userId: string;
  badgeId: string;
  earnedAt: string;
  badge: Badge;
}
