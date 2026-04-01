import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProfile } from '../entities/user-profile.entity';
import { User } from '../entities/user.entity';
import { RedisService } from '../common/redis.service';
import { UpdateProfileDto } from './profile.dto';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    @InjectRepository(UserProfile) private readonly profileRepo: Repository<UserProfile>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly redis: RedisService,
  ) {}

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserProfile> {
    const profile = await this.profileRepo.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    if (dto.displayName !== undefined) profile.displayName = dto.displayName;
    if (dto.avatarUrl !== undefined) profile.avatarUrl = dto.avatarUrl;
    if (dto.bio !== undefined) profile.bio = dto.bio;

    const savedProfile = await this.profileRepo.save(profile);

    // Context 10: Denormalization - Sắp xếp lại Leaderboard Info (Name & Avatar) trên Redis
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (user) {
      // Logic for Level calculation matches progress.service.ts
      const level = this._calculateLevel(user.totalXp);
      await this.redis.updateLeaderboardUserInfo(userId, {
        name: savedProfile.displayName || user.email.split('@')[0],
        avatarUrl: savedProfile.avatarUrl || '',
        level,
      });
      this.logger.log(`Updated leaderboard info (denormalized) for user ${userId} on profile change.`);
    }

    return savedProfile;
  }

  private _calculateLevel(totalXp: number): number {
    if (totalXp < 1000) return Math.floor(totalXp / 100) + 1;
    if (totalXp < 4750) return 10 + Math.floor((totalXp - 1000) / 250);
    if (totalXp < 17250) return 25 + Math.floor((totalXp - 4750) / 500);
    return 50 + Math.floor((totalXp - 17250) / 1000);
  }
}
