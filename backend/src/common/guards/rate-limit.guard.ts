import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CacheService } from '../../cache/cache.service';
import { Request } from 'express';

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum number of requests per window
  message?: string; // Custom error message
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

export const RATE_LIMIT_KEY = 'rate-limit';

export const RateLimit = (options: RateLimitOptions) => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      Reflector.createDecorator<RateLimitOptions>()(options)(target, propertyKey, descriptor);
    } else {
      Reflector.createDecorator<RateLimitOptions>()(options)(target);
    }
  };
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly cacheService: CacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const handler = context.getHandler();
    const classRef = context.getClass();

    // Get rate limit options from decorator
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, [
      handler,
      classRef,
    ]);

    if (!options) {
      return true; // No rate limiting configured
    }

    // Generate unique key for this client
    const key = this.generateKey(request, options);
    
    // Get current count from cache
    const current = await this.cacheService.get<number>(key) || 0;

    if (current >= options.max) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: options.message || 'Too many requests',
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Increment counter
    const newCount = current + 1;
    const ttl = Math.ceil(options.windowMs / 1000); // Convert to seconds
    await this.cacheService.set(key, newCount, ttl);

    // Add rate limit headers to response
    const response = context.switchToHttp().getResponse();
    response.setHeader('X-RateLimit-Limit', options.max);
    response.setHeader('X-RateLimit-Remaining', Math.max(0, options.max - newCount));
    response.setHeader('X-RateLimit-Reset', new Date(Date.now() + options.windowMs).toISOString());

    return true;
  }

  private generateKey(request: Request, options: RateLimitOptions): string {
    // Use IP address and user ID (if authenticated) for key generation
    const ip = this.getClientIp(request);
    const userId = (request as any).user?.id || 'anonymous';
    const endpoint = `${request.method}:${request.route?.path || request.path}`;
    
    return `rate-limit:${ip}:${userId}:${endpoint}:${options.windowMs}`;
  }

  private getClientIp(request: Request): string {
    return (
      request.headers['x-forwarded-for'] as string ||
      request.headers['x-real-ip'] as string ||
      request.connection.remoteAddress ||
      request.socket.remoteAddress ||
      'unknown'
    );
  }
}

// Predefined rate limit configurations
export const CommonRateLimits = {
  // Very strict - for sensitive operations
  STRICT: { windowMs: 15 * 60 * 1000, max: 5 }, // 5 requests per 15 minutes
  
  // Authentication endpoints
  AUTH: { windowMs: 15 * 60 * 1000, max: 10 }, // 10 requests per 15 minutes
  
  // Standard API endpoints
  STANDARD: { windowMs: 15 * 60 * 1000, max: 100 }, // 100 requests per 15 minutes
  
  // Generous - for frequent operations
  GENEROUS: { windowMs: 15 * 60 * 1000, max: 1000 }, // 1000 requests per 15 minutes
  
  // File uploads
  UPLOAD: { windowMs: 60 * 60 * 1000, max: 10 }, // 10 uploads per hour
  
  // Bulk operations
  BULK: { windowMs: 60 * 60 * 1000, max: 5 }, // 5 bulk operations per hour
};
