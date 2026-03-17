import { useQuery } from "@tanstack/react-query";
import { lessonsApi } from "@/api/lessons.api";
import { queryKeys } from "@/config/queryKeys";

export const useLessonsPathQuery = () => {
  return useQuery({
    queryKey: queryKeys.lessons.path,
    queryFn: () => lessonsApi.getLessonsPath(),
    staleTime: 5 * 60 * 1000,
  });
};

export const useLessonDetailQuery = (id: string) => {
  return useQuery({
    queryKey: queryKeys.lessons.detail(id),
    queryFn: () => lessonsApi.getLessonDetail(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
};
