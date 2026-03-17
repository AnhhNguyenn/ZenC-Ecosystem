export type LessonDifficulty = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type LessonStatus = "LOCKED" | "ACTIVE" | "COMPLETED";

export interface Lesson {
  id: string;
  title: string;
  description: string;
  difficulty: LessonDifficulty;
  xpReward: number;
  orderIndex: number;
  estimatedMinutes: number;
}

export interface NodePath {
  id: string;
  lessonId: string;
  status: LessonStatus;
  positionX: number;
  positionY: number;
}

export interface PracticeSession {
  id: string;
  userId: string;
  lessonId?: string;
  startedAt: string;
  endedAt?: string;
  accuracyScore?: number;
}
