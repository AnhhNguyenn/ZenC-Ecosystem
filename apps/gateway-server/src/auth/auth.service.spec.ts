import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { User } from '../entities/user.entity';
import { UserProfile } from '../entities/user-profile.entity';
import { RedisService } from '../common/redis.service';
import { RabbitMQService } from '../common/rabbitmq.service';

const prehashPassword = (password: string): string =>
  createHash('sha256').update(password, 'utf8').digest('base64');

describe('AuthService', () => {
  let service: AuthService;

  const mockUserRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockProfileRepo = {
    findOne: jest.fn(),
  };

  const txUserRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const txProfileRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn(async (callback: (manager: { getRepository: (entity: unknown) => unknown }) => Promise<void>) => {
      const manager = {
        getRepository: (entity: unknown) => {
          if (entity === User) return txUserRepo;
          if (entity === UserProfile) return txProfileRepo;
          throw new Error('Unexpected repository request');
        },
      };
      return callback(manager);
    }),
  };

  const mockJwtService = {
    signAsync: jest.fn().mockResolvedValue('mock-token'),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      const config: Record<string, string | number> = {
        BCRYPT_SALT_ROUNDS: 10,
        JWT_SECRET: 'test-secret',
        JWT_REFRESH_SECRET: 'test-refresh-secret',
        JWT_EXPIRATION: '15m',
        JWT_REFRESH_EXPIRATION: '7d',
      };
      return config[key] ?? defaultValue;
    }),
  };

  const mockRedisService = {
    cacheUserProfile: jest.fn().mockResolvedValue(undefined),
    removeActiveSession: jest.fn().mockResolvedValue(undefined),
    ensureAuthVersionPersistent: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    getClient: jest.fn(() => ({
      incr: jest.fn().mockResolvedValue(1),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
    })),
  };

  const mockRabbitMQService = {
    dispatchDeepBrainTask: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(UserProfile), useValue: mockProfileRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: RabbitMQService, useValue: mockRabbitMQService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const registerDto = { email: 'test@zenc.ai', password: 'StrongPass1!' };

    it('should throw ConflictException if email already exists', async () => {
      txUserRepo.findOne.mockResolvedValue({ id: '1', email: registerDto.email });

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });

    it('should register a new user and return userId and email', async () => {
      txUserRepo.findOne.mockResolvedValue(null);
      txUserRepo.create.mockImplementation((value) => value);
      txUserRepo.save.mockResolvedValue({
        id: 'uuid-1',
        email: 'test@zenc.ai',
        tier: 'FREE',
        status: 'UNVERIFIED',
      });
      txProfileRepo.create.mockImplementation((value) => value);
      txProfileRepo.save.mockResolvedValue({});

      const result = await service.register(registerDto);

      expect(result.email).toBe('test@zenc.ai');
      expect(result.userId).toBe('uuid-1');
      expect(txUserRepo.save).toHaveBeenCalled();
      expect(txProfileRepo.save).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const loginDto = { email: 'test@zenc.ai', password: 'StrongPass1!' };

    it('should throw UnauthorizedException if user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if account is banned', async () => {
      const hashedPassword = await bcrypt.hash(prehashPassword(loginDto.password), 10);
      mockUserRepo.findOne.mockResolvedValue({
        id: '1',
        email: loginDto.email,
        status: 'BANNED',
        passwordHash: hashedPassword,
      });

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException on wrong password', async () => {
      const hashedPassword = await bcrypt.hash(prehashPassword('differentPassword'), 10);
      mockUserRepo.findOne.mockResolvedValue({
        id: '1',
        email: loginDto.email,
        status: 'ACTIVE',
        passwordHash: hashedPassword,
      });

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should return tokens on valid credentials', async () => {
      const hashedPassword = await bcrypt.hash(prehashPassword(loginDto.password), 10);
      mockUserRepo.findOne.mockResolvedValue({
        id: '1',
        email: loginDto.email,
        status: 'ACTIVE',
        passwordHash: hashedPassword,
        tier: 'FREE',
      });
      mockProfileRepo.findOne.mockResolvedValue({
        currentLevel: 'A2',
        confidenceScore: 0.6,
        vnSupportEnabled: true,
      });

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe(loginDto.email);
    });
  });
});
