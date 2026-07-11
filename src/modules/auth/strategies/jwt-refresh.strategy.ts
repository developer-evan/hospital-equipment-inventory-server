import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RefreshTokenPayload } from '../interfaces/token-payload.interface';

export interface RefreshRequestUser {
  userId: string;
  refreshToken: string;
}

interface RequestWithRefreshBody extends Request {
  body: { refreshToken?: string };
}

function extractRefreshToken(req: Request): string | null {
  const body = (req as RequestWithRefreshBody).body;
  return body?.refreshToken ?? null;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([extractRefreshToken]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.refreshSecret')!,
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: RefreshTokenPayload): RefreshRequestUser {
    const refreshToken = extractRefreshToken(req) ?? '';
    return { userId: payload.sub, refreshToken };
  }
}
