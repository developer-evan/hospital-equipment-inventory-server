import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks an endpoint as exempt from the global `JwtAuthGuard`
 * (e.g. login, refresh). See `JwtAuthGuard.canActivate`.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
