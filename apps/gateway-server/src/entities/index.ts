/**
 * Entity barrel export – Single import point for all TypeORM entities.
 *
 * IMPORTANT: Keep this file in sync when adding new entities.
 * The AllEntities array is used in TypeOrmModule.forRoot() configuration.
 */
export { User } from './user.entity';
export { UserProfile } from './user-profile.entity';
export { Session } from './session.entity';
export { UserMistake } from './user-mistake.entity';
export { AdminAuditLog } from './admin-audit-log.entity';
export { Course } from './course.entity';
export { Unit } from './unit.entity';
export { Lesson } from './lesson.entity';
export { Exercise } from './exercise.entity';
export { ExerciseAttempt } from './exercise-attempt.entity';
export { Vocabulary } from './vocabulary.entity';
export { UserVocabulary } from './user-vocabulary.entity';
export { Achievement } from './achievement.entity';
export { UserAchievement } from './user-achievement.entity';
export { Streak } from './streak.entity';
export { DailyGoal } from './daily-goal.entity';
export { Notification } from './notification.entity';
export { Conversation } from './conversation.entity';

import { User } from './user.entity';
import { UserProfile } from './user-profile.entity';
import { Session } from './session.entity';
import { UserMistake } from './user-mistake.entity';
import { AdminAuditLog } from './admin-audit-log.entity';
import { Course } from './course.entity';
import { Unit } from './unit.entity';
import { Lesson } from './lesson.entity';
import { Exercise } from './exercise.entity';
import { ExerciseAttempt } from './exercise-attempt.entity';
import { Vocabulary } from './vocabulary.entity';
import { UserVocabulary } from './user-vocabulary.entity';
import { Achievement } from './achievement.entity';
import { UserAchievement } from './user-achievement.entity';
import { Streak } from './streak.entity';
import { DailyGoal } from './daily-goal.entity';
import { Notification } from './notification.entity';
import { Conversation } from './conversation.entity';

/** Explicit entity array for TypeOrmModule configuration */
export const AllEntities = [
  User,
  UserProfile,
  Session,
  UserMistake,
  AdminAuditLog,
  Course,
  Unit,
  Lesson,
  Exercise,
  ExerciseAttempt,
  Vocabulary,
  UserVocabulary,
  Achievement,
  UserAchievement,
  Streak,
  DailyGoal,
  Notification,
  Conversation,
];
