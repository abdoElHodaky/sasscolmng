import { Controller, Get, Delete, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CacheService, CacheStats } from './cache.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Cache Management')
@ApiBearerAuth()
@Controller('cache')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CacheController {
  constructor(private readonly cacheService: CacheService) {}

  @Get('stats')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Get cache statistics' })
  @ApiResponse({
    status: 200,
    description: 'Cache statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        hits: { type: 'number', description: 'Number of cache hits' },
        misses: { type: 'number', description: 'Number of cache misses' },
        keys: { type: 'number', description: 'Number of keys in cache' },
        memory: { type: 'number', description: 'Memory usage in bytes' },
        uptime: { type: 'number', description: 'Cache uptime in seconds' },
        hitRate: { type: 'number', description: 'Cache hit rate percentage' },
      },
    },
  })
  async getStats(): Promise<CacheStats & { hitRate: number }> {
    const stats = await this.cacheService.getStats();
    const total = stats.hits + stats.misses;
    const hitRate = total > 0 ? (stats.hits / total) * 100 : 0;

    return {
      ...stats,
      hitRate: Math.round(hitRate * 100) / 100, // Round to 2 decimal places
    };
  }

  @Delete('clear')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Clear all cache' })
  @ApiResponse({
    status: 200,
    description: 'Cache cleared successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        timestamp: { type: 'string' },
      },
    },
  })
  async clearCache(): Promise<{ message: string; timestamp: string }> {
    await this.cacheService.reset();
    return {
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Delete('tenant/:tenantId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Clear cache for specific tenant' })
  @ApiResponse({
    status: 200,
    description: 'Tenant cache cleared successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        tenantId: { type: 'string' },
        timestamp: { type: 'string' },
      },
    },
  })
  async clearTenantCache(
    @Param('tenantId') tenantId: string,
  ): Promise<{ message: string; tenantId: string; timestamp: string }> {
    await this.cacheService.invalidateTenant(tenantId);
    return {
      message: 'Tenant cache cleared successfully',
      tenantId,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('warmup/:tenantId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Warm up cache for specific tenant' })
  @ApiResponse({
    status: 200,
    description: 'Cache warmed up successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        tenantId: { type: 'string' },
        timestamp: { type: 'string' },
      },
    },
  })
  async warmUpCache(
    @Param('tenantId') tenantId: string,
  ): Promise<{ message: string; tenantId: string; timestamp: string }> {
    await this.cacheService.warmUpCache(tenantId);
    return {
      message: 'Cache warmed up successfully',
      tenantId,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Check cache health' })
  @ApiResponse({
    status: 200,
    description: 'Cache health status',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['healthy', 'unhealthy'] },
        timestamp: { type: 'string' },
        details: {
          type: 'object',
          properties: {
            connected: { type: 'boolean' },
            responseTime: { type: 'number' },
          },
        },
      },
    },
  })
  async checkHealth(): Promise<{
    status: string;
    timestamp: string;
    details: { connected: boolean; responseTime: number };
  }> {
    const startTime = Date.now();
    
    try {
      // Test cache connectivity by setting and getting a test value
      const testKey = 'health-check';
      const testValue = 'ok';
      
      await this.cacheService.set(testKey, testValue, 10); // 10 seconds TTL
      const result = await this.cacheService.get(testKey);
      await this.cacheService.del(testKey);
      
      const responseTime = Date.now() - startTime;
      const connected = result === testValue;

      return {
        status: connected ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        details: {
          connected,
          responseTime,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        details: {
          connected: false,
          responseTime,
        },
      };
    }
  }
}
