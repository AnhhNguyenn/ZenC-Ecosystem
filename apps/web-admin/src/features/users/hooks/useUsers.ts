import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/config/queryKeys";

// Mock API Call for execution demonstration. Real code would call userAdmin.api.ts
const fetchUsers = async () => {
  return [
    { id: "1", email: "alice@example.com", fullName: "Alice Smith", role: "LEARNER", createdAt: "2026-03-01T10:00:00Z" },
    { id: "2", email: "bob@example.com", fullName: "Bob Johnson", role: "LEARNER", createdAt: "2026-03-02T11:30:00Z" },
    { id: "3", email: "carol@example.com", fullName: "Carol Williams", role: "TEACHER", createdAt: "2026-03-03T09:15:00Z" },
  ];
};

export const useUsersListQuery = () => {
  return useQuery({
    queryKey: queryKeys.users.list,
    queryFn: fetchUsers,
    staleTime: 60 * 1000,
  });
};
