import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schemas/user.schema';
import { LoginDto } from './dto/login.dto';
import {
  AccessTokenPayload,
  TokenPair,
} from './interfaces/token-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(
    dto: LoginDto,
  ): Promise<TokenPair & { user: Record<string, unknown> }> {
    const user = await this.usersService.findByUsernameWithPassword(
      dto.username,
    );
    if (!user) {
      throw new UnauthorizedException('Invalid username or password');
    }
    if (!user.isActive) {
      throw new ForbiddenException('This account has been deactivated');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const tokens = await this.issueTokenPair(user);
    await this.persistRefreshToken(user.id, tokens.refreshToken);
    await this.usersService.recordLogin(user.id);

    return {
      ...tokens,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        departments: user.departments,
      },
    };
  }

  async refresh(userId: string, refreshToken: string): Promise<TokenPair> {
    const user = await this.usersService.findByIdWithRefreshHash(userId);
    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (!user.isActive) {
      throw new ForbiddenException('This account has been deactivated');
    }

    if (!this.tokenMatchesHash(refreshToken, user.refreshTokenHash)) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.issueTokenPair(user);
    await this.persistRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.setRefreshTokenHash(userId, null);
  }

  private async issueTokenPair(user: UserDocument): Promise<TokenPair> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      departments: user.departments.map((d) => d.toString()),
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('jwt.accessSecret'),
      expiresIn: this.configService.get<string>(
        'jwt.accessExpiresIn',
      ) as unknown as number,
    });

    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, jti: randomUUID() },
      {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>(
          'jwt.refreshExpiresIn',
        ) as unknown as number,
      },
    );

    return { accessToken, refreshToken };
  }

  private async persistRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    await this.usersService.setRefreshTokenHash(
      userId,
      this.hashToken(refreshToken),
    );
  }

  /**
   * Refresh tokens are long, high-entropy JWTs, not low-entropy passwords,
   * so a slow, salted bcrypt hash is unnecessary. It is also unsafe here:
   * bcrypt silently truncates its input at 72 bytes, and JWTs regularly
   * exceed that length with all the entropy (jti/iat/exp/signature) past
   * the cut-off point, which would make every refresh token issued to a
   * user match every other token's stored hash. A plain SHA-256 digest,
   * compared in constant time, avoids that pitfall entirely.
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private tokenMatchesHash(
    token: string,
    storedHash: string | undefined,
  ): boolean {
    if (!storedHash) {
      return false;
    }
    const candidate = Buffer.from(this.hashToken(token));
    const stored = Buffer.from(storedHash);
    return (
      candidate.length === stored.length && timingSafeEqual(candidate, stored)
    );
  }
}
