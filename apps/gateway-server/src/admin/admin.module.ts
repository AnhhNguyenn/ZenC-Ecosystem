import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';
import { User } from '../entities/user.entity';
import { Session } from '../entities/session.entity';
import { AdminAuditLog } from '../entities/admin-audit-log.entity';

/**
 * AdminModule – Encapsulates God Mode admin functionality.
 *
 * Provides the AdminGuard and AdminService for managing user tiers,
 * tokens, and account status with full audit logging.
 */
@Module({
  imports: [TypeOrmModule.forFeature([User, Session, AdminAuditLog])],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard],
})
export class AdminModule {}
