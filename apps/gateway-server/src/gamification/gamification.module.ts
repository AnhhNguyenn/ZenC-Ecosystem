import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GamificationController } from './gamification.controller';
import { GamificationService } from './gamification.service';
import { ConversationMilestoneService } from './conversation-milestone.service';
import {
  Achievement,
  UserAchievement,
  ExerciseAttempt,
  UserVocabulary,
  Streak,
  Notification,
} from '../entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Achievement,
      UserAchievement,
      ExerciseAttempt,
      UserVocabulary,
      Streak,
      Notification,
    ]),
  ],
  controllers: [GamificationController],
  providers: [GamificationService, ConversationMilestoneService],
  exports: [GamificationService, ConversationMilestoneService],
})
export class GamificationModule {}

