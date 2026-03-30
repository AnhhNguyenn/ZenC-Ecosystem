import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';
import { ExerciseAttempt, UserVocabulary, Session, DailyGoal, Streak, UserMistake, Exercise } from '../entities';
import { RedisModule } from '../common/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExerciseAttempt, UserVocabulary, Session, DailyGoal, Streak, UserMistake, Exercise]),
    RedisModule,
  ],
  controllers: [ProgressController],
  providers: [ProgressService],
  exports: [ProgressService],
})
export class ProgressModule {}
