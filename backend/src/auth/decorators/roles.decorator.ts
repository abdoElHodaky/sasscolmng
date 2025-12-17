import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Decorator to specify required roles for accessing an endpoint
 * @param roles - Array of UserRole enums that are allowed to access the endpoint
 * 
 * @example
 * ```typescript
 * @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
 * @Get('admin-only')
 * adminOnlyEndpoint() {
 *   return 'Only admins can access this';
 * }
 * ```
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Decorator to mark an endpoint as public (no authentication required)
 * 
 * @example
 * ```typescript
 * @Public()
 * @Get('health')
 * healthCheck() {
 *   return 'OK';
 * }
 * ```
 */
export const Public = () => SetMetadata('isPublic', true);

/**
 * Decorator to get the current user from the request
 * Use this in controller methods to access the authenticated user
 * 
 * @example
 * ```typescript
 * @Get('profile')
 * getProfile(@CurrentUser() user: any) {
 *   return user;
 * }
 * ```
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

/**
 * Decorator to get the current tenant ID from the authenticated user
 * 
 * @example
 * ```typescript
 * @Get('tenant-data')
 * getTenantData(@CurrentTenant() tenantId: string) {
 *   return this.service.getDataForTenant(tenantId);
 * }
 * ```
 */
export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.tenantId;
  },
);

