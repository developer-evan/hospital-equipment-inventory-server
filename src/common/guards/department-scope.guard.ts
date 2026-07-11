import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Role } from '../enums/role.enum';
import { RequestWithUser } from '../interfaces/request-with-user.interface';

/**
 * Guards routes that carry an explicit `:departmentId` route param
 * (e.g. `GET /equipment/department/:departmentId`). Administrators and
 * store officers bypass the check (store officers register equipment
 * before it belongs to a department's active inventory); department
 * users and biomedical engineers are restricted to their assigned
 * department(s).
 *
 * For list/search endpoints without a route param, scoping is instead
 * applied at the query-building level in the relevant service via
 * `buildDepartmentFilter()` (see `common/utils/department-scope.util.ts`),
 * since the guard alone cannot rewrite query filters safely.
 */
@Injectable()
export class DepartmentScopeGuard implements CanActivate {
  private static readonly UNSCOPED_ROLES = [
    Role.ADMINISTRATOR,
    Role.STORE_OFFICER,
  ];

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user || DepartmentScopeGuard.UNSCOPED_ROLES.includes(user.role)) {
      return true;
    }

    const departmentId = request.params?.departmentId;
    if (!departmentId) {
      return true;
    }

    const allowed = user.departments
      .map((d) => d.toString())
      .includes(departmentId.toString());

    if (!allowed) {
      throw new ForbiddenException('You do not have access to this department');
    }

    return true;
  }
}
