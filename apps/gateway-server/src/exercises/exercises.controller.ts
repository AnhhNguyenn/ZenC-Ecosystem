import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  Version,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../admin/admin.guard';
import { ExercisesService } from './exercises.service';
import { CreateExerciseDto, SubmitAnswerDto, DailyMixQueryDto } from './exercises.dto';

@Controller('exercises')
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  @Post(':id/submit')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  async submitAnswer(
    @Param('id', ParseUUIDPipe) exerciseId: string,
    @Body() dto: SubmitAnswerDto,
    @Request() req: { user: { sub: string } },
  ) {
    return this.exercisesService.submitAnswer(exerciseId, req.user.sub, dto);
  }

  @Get('daily-mix')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  async getDailyMix(
    @Query() query: DailyMixQueryDto,
    @Request() req: { user: { sub: string } },
  ) {
    return this.exercisesService.getDailyMix(req.user.sub, query.count);
  }

  @Post('admin/create')
  @Version('1')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async createExercise(@Body() dto: CreateExerciseDto) {
    return this.exercisesService.createExercise(dto);
  }
}
