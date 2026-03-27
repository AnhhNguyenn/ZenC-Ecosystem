import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GdprController } from './gdpr.controller';
import { GdprService } from './gdpr.service';
import {
  User,
  UserProfile,
  Session,
  UserMistake,
  ExerciseAttempt,
  UserVocabulary,
  UserAchievement,
  Streak,
  DailyGoal,
  Notification,
} from '../entities';
import { RabbitMQModule } from '../common/rabbitmq.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserProfile,
      Session,
      UserMistake,
      ExerciseAttempt,
      UserVocabulary,
      UserAchievement,
      Streak,
      DailyGoal,
      Notification,
    ]),
    RabbitMQModule,
  ],
  controllers: [GdprController],
  providers: [GdprService],
  exports: [GdprService],
})
export class GdprModule {}
