import {
  Controller,
  Get,
  Post,
  Patch,
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
import { LessonsService } from './lessons.service';
import {
  CreateCourseDto,
  UpdateCourseDto,
  CreateUnitDto,
  CreateLessonDto,
  CompleteLessonDto,
  CourseQueryDto,
} from './lessons.dto';

/**
 * LessonsController – REST API for curriculum management.
 *
 * Public endpoints (authenticated users):
 * - GET /courses – list published courses
 * - GET /courses/:id – course detail with units
 * - GET /lessons/:id – lesson with exercises (answers hidden)
 * - POST /lessons/:id/complete – complete a lesson
 *
 * Admin endpoints (UNLIMITED tier):
 * - POST /courses – create course
 * - PATCH /courses/:id – update course
 * - POST /units – create unit
 * - POST /lessons – create lesson
 *
 * Security:
 * - All endpoints require JWT authentication
 * - Admin endpoints additionally require AdminGuard (UNLIMITED tier)
 * - ParseUUIDPipe validates UUID format, preventing SQL injection via path params
 */
@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  // ═══════════════════════════════════════════════════════════
  // PUBLIC (Authenticated User) ENDPOINTS
  // ═══════════════════════════════════════════════════════════

  @Get('courses')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  async listCourses(@Query() query: CourseQueryDto) {
    return this.lessonsService.listCourses(query);
  }

  @Get('courses/:id')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  async getCourse(
    @Param('id', ParseUUIDPipe) courseId: string,
    @Request() req: { user: { sub: string } },
  ) {
    return this.lessonsService.getCourseWithUnits(courseId, req.user.sub);
  }

  @Get(':id')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  async getLesson(
    @Param('id', ParseUUIDPipe) lessonId: string,
    @Request() req: { user: { sub: string } },
  ) {
    return this.lessonsService.getLesson(lessonId, req.user.sub);
  }

  @Post(':id/complete')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  async completeLesson(
    @Param('id', ParseUUIDPipe) lessonId: string,
    @Body() dto: CompleteLessonDto,
    @Request() req: { user: { sub: string } },
  ) {
    return this.lessonsService.completeLesson(lessonId, req.user.sub, dto);
  }

  // ═══════════════════════════════════════════════════════════
  // ADMIN ENDPOINTS
  // ═══════════════════════════════════════════════════════════

  @Post('admin/courses')
  @Version('1')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async createCourse(@Body() dto: CreateCourseDto) {
    return this.lessonsService.createCourse(dto);
  }

  @Patch('admin/courses/:id')
  @Version('1')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateCourse(
    @Param('id', ParseUUIDPipe) courseId: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.lessonsService.updateCourse(courseId, dto);
  }

  @Post('admin/units')
  @Version('1')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async createUnit(@Body() dto: CreateUnitDto) {
    return this.lessonsService.createUnit(dto);
  }

  @Post('admin/lessons')
  @Version('1')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async createLesson(@Body() dto: CreateLessonDto) {
    return this.lessonsService.createLesson(dto);
  }
}
