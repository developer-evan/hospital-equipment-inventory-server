import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type {
  AuthenticatedUser,
  RequestWithUser,
} from '../interfaces/request-with-user.interface';

/**
 * Injects the authenticated user (as attached by `JwtStrategy`) into a
 * controller handler. Usage: `@CurrentUser() user: AuthenticatedUser`.
 * Pass a key to pluck a single field: `@CurrentUser('userId') id: string`.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return data ? request.user?.[data] : request.user;
  },
);
