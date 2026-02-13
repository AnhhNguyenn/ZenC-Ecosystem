import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessonsController } from './lessons.controller';
import { LessonsService } from './lessons.service';
import {
  Course,
  Unit,
  Lesson,
  ExerciseAttempt,
  DailyGoal,
  Streak,
} from '../entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Course,
      Unit,
      Lesson,
      ExerciseAttempt,
      DailyGoal,
      Streak,
    ]),
  ],
  controllers: [LessonsController],
  providers: [LessonsService],
  exports: [LessonsService],
})
export class LessonsModule {}
