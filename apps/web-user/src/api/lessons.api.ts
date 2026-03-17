import { apiClient } from "./axios";

export interface LessonDto {
  id: string;
  title: string;
  level: string;
  description: string;
  isCompleted: boolean;
}

export const lessonsApi = {
  getLessonsPath: async (): Promise<LessonDto[]> => {
    const response = await apiClient.get<LessonDto[]>("/lessons/path");
    return response.data;
  },

  getLessonDetail: async (id: string): Promise<LessonDto> => {
    const response = await apiClient.get<LessonDto>(`/lessons/${id}`);
    return response.data;
  },
};
