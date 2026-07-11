import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Used solely on the `/auth/refresh` endpoint; validates the refresh
 * token (separate secret/strategy from the access token).
 */
@Injectable()
export class JwtRefreshAuthGuard extends AuthGuard('jwt-refresh') {}
