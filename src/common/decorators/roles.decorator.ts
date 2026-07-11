import { SetMetadata } from '@nestjs/common';
import { Role } from '../enums/role.enum';

export const ROLES_KEY = 'roles';

/**
 * Restricts an endpoint to the given roles. Must be combined with
 * `JwtAuthGuard` + `RolesGuard` (see `common/guards`).
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
