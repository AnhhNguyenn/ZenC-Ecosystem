import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StreaksController } from './streaks.controller';
import { StreaksService } from './streaks.service';
import { Streak, DailyGoal } from '../entities';

@Module({
  imports: [TypeOrmModule.forFeature([Streak, DailyGoal])],
  controllers: [StreaksController],
  providers: [StreaksService],
  exports: [StreaksService],
})
export class StreaksModule {}
