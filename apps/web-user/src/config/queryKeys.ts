export const queryKeys = {
  user: {
    profile: ["user", "profile"],
    stats: ["user", "stats"],
    settings: ["user", "settings"],
    badges: ["user", "badges"],
  },
  lessons: {
    path: ["lessons", "path"],
    detail: (id: string) => ["lessons", "detail", id],
  },
  leaderboard: {
    current: ["leaderboard", "current"],
  },
  practice: {
    history: ["practice", "history"],
  },
} as const;
