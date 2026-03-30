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
  submitProgress: async (payload: { lessonId: string; answers: Array<{ exerciseId: string; answer: string; responseTimeMs: number }> }): Promise<any> => {
    // Dynamic import to prevent SSR issues with crypto if run outside browser
    const { generateAntiCheatSignature } = await import('../utils/crypto');

    const timestamp = Date.now();

    // Sort keys deterministically for the answers array so the hash matches the backend
    const sortedAnswers = payload.answers.map(ans => ({
      answer: ans.answer,
      exerciseId: ans.exerciseId,
      responseTimeMs: ans.responseTimeMs
    })).sort((a, b) => a.exerciseId.localeCompare(b.exerciseId));

    const payloadStr = payload.lessonId + JSON.stringify(sortedAnswers);
    const signature = await generateAntiCheatSignature(payloadStr, timestamp);

    const response = await apiClient.post<any>("/progress/submit-answer", {
      lessonId: payload.lessonId,
      answers: payload.answers,
      timestamp,
      signature
    });
    return response.data;
  }
};
