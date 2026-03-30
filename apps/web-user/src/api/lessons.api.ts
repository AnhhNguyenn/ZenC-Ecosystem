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

  /**
   * ZERO-TRUST CLIENT (Anti-Cheat Mechanism)
   * The client reports progress but signs the payload cryptographically.
   * The server will verify the signature and timestamp to prevent script kids from
   * spoofing 50,000 XP via API replay attacks.
   */
  submitProgress: async (payload: { lessonId: string; correctAnswers: number; totalQuestions: number }): Promise<any> => {
    // Dynamic import to prevent SSR issues with crypto if run outside browser
    const { generateAntiCheatSignature } = await import('../utils/crypto');

    const timestamp = Date.now();
    const payloadStr = JSON.stringify(payload);
    const signature = await generateAntiCheatSignature(payloadStr, timestamp);

    const response = await apiClient.post<any>("/progress/submit-answer", {
      ...payload,
      timestamp,
      signature
    });
    return response.data;
  }
};
