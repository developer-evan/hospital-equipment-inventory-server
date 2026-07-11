import { Role } from '../enums/role.enum';
import type { AuthenticatedUser } from '../interfaces/request-with-user.interface';

export const UNSCOPED_ROLES = [Role.ADMINISTRATOR, Role.STORE_OFFICER];

export function isDepartmentScopedUser(user: AuthenticatedUser): boolean {
  return !UNSCOPED_ROLES.includes(user.role);
}

/**
 * Returns a Mongo filter fragment that narrows a query to the
 * authenticated user's department(s), or `{}` (no restriction) for
 * roles that are allowed to see all departments.
 */
export function buildDepartmentFilter(
  user: AuthenticatedUser,
  fieldName = 'department',
): Record<string, unknown> {
  if (UNSCOPED_ROLES.includes(user.role)) {
    return {};
  }
  if (!user.departments || user.departments.length === 0) {
    // No department assigned yet -> no visible records.
    return { [fieldName]: { $in: [] } };
  }
  return { [fieldName]: { $in: user.departments } };
}
