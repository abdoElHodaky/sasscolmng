import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Extract tenant ID from request (could be from params, headers, or user)
    const tenantId = request.params?.tenantId || request.headers?.['x-tenant-id'] || user.tenantId;

    if (!tenantId) {
      throw new ForbiddenException('Tenant ID not provided');
    }

    // Verify user belongs to the tenant
    if (user.tenantId !== tenantId) {
      throw new ForbiddenException('Access denied: User does not belong to this tenant');
    }

    // Add tenant ID to request for easy access in controllers
    request.tenantId = tenantId;

    return true;
  }
}
