import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExercisesController } from './exercises.controller';
import { ExercisesService } from './exercises.service';
import { SmartExerciseService } from './smart-exercise.service';
import { Exercise, ExerciseAttempt, DailyGoal, UserMistake } from '../entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([Exercise, ExerciseAttempt, DailyGoal, UserMistake]),
  ],
  controllers: [ExercisesController],
  providers: [ExercisesService, SmartExerciseService],
  exports: [ExercisesService, SmartExerciseService],
})
export class ExercisesModule {}

