import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { Role } from '../../common/enums/role.enum';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const mockedBcrypt = jest.mocked(bcrypt);

// Mirrors the private `AuthService#hashToken` implementation so tests can
// assert against real SHA-256 digests instead of mocking crypto internals.
const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;

  const buildUser = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: 'user-1',
    username: 'jdoe',
    email: 'jdoe@hospital.local',
    password: 'hashed-password',
    fullName: 'Jane Doe',
    role: Role.BIOMEDICAL_ENGINEER,
    departments: [],
    isActive: true,
    refreshTokenHash: undefined as string | undefined,
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByUsernameWithPassword: jest.fn(),
            findByIdWithRefreshHash: jest.fn(),
            setRefreshTokenHash: jest.fn(),
            recordLogin: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn().mockResolvedValue('signed-token') },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('irrelevant') },
        },
      ],
    }).compile();

    authService = module.get(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('login', () => {
    it('throws UnauthorizedException when the user does not exist', async () => {
      usersService.findByUsernameWithPassword.mockResolvedValue(null);

      await expect(
        authService.login({ username: 'nope', password: 'x' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws ForbiddenException when the account is deactivated', async () => {
      usersService.findByUsernameWithPassword.mockResolvedValue(
        buildUser({ isActive: false }) as any,
      );

      await expect(
        authService.login({ username: 'jdoe', password: 'whatever' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws UnauthorizedException when the password does not match', async () => {
      mockedBcrypt.compare.mockResolvedValue(false as never);
      usersService.findByUsernameWithPassword.mockResolvedValue(
        buildUser() as any,
      );

      await expect(
        authService.login({ username: 'jdoe', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('issues a token pair and records the login on success', async () => {
      mockedBcrypt.compare.mockResolvedValue(true as never);
      usersService.findByUsernameWithPassword.mockResolvedValue(
        buildUser() as any,
      );

      const result = await authService.login({
        username: 'jdoe',
        password: 'correct',
      });

      expect(result.accessToken).toBe('signed-token');
      expect(result.refreshToken).toBe('signed-token');
      expect(result.user).toMatchObject({
        username: 'jdoe',
        role: Role.BIOMEDICAL_ENGINEER,
      });
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
      expect(usersService.setRefreshTokenHash).toHaveBeenCalledWith(
        'user-1',
        sha256('signed-token'),
      );
      expect(usersService.recordLogin).toHaveBeenCalledWith('user-1');
    });
  });

  describe('refresh', () => {
    it('throws UnauthorizedException when there is no stored refresh hash', async () => {
      usersService.findByIdWithRefreshHash.mockResolvedValue(
        buildUser({ refreshTokenHash: undefined }) as any,
      );

      await expect(authService.refresh('user-1', 'some-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when the refresh token does not match the stored hash', async () => {
      usersService.findByIdWithRefreshHash.mockResolvedValue(
        buildUser({ refreshTokenHash: sha256('a-different-token') }) as any,
      );

      await expect(
        authService.refresh('user-1', 'stale-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rotates the token pair when the refresh token is valid', async () => {
      usersService.findByIdWithRefreshHash.mockResolvedValue(
        buildUser({ refreshTokenHash: sha256('valid-token') }) as any,
      );

      const tokens = await authService.refresh('user-1', 'valid-token');

      expect(tokens.accessToken).toBe('signed-token');
      expect(usersService.setRefreshTokenHash).toHaveBeenCalledWith(
        'user-1',
        sha256('signed-token'),
      );
    });
  });

  describe('logout', () => {
    it('clears the stored refresh token hash', async () => {
      await authService.logout('user-1');
      expect(usersService.setRefreshTokenHash).toHaveBeenCalledWith(
        'user-1',
        null,
      );
    });
  });
});
