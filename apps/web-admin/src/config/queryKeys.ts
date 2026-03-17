export const queryKeys = {
  admin: {
    profile: ["admin", "profile"],
    metrics: ["admin", "metrics"],
    settings: ["admin", "settings"],
  },
  users: {
    list: ["users", "list"],
    detail: (id: string) => ["users", "detail", id],
    activity: ["users", "activity"],
  },
  content: {
    list: ["content", "list"],
    ragDocuments: ["content", "rag-documents"],
  },
} as const;
