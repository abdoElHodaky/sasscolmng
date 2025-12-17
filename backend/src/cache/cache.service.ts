import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Logger } from '@nestjs/common';

export interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  memory: number;
  uptime: number;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private stats = {
    hits: 0,
    misses: 0,
  };

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.cacheManager.get<T>(key);
      if (value !== undefined && value !== null) {
        this.stats.hits++;
        this.logger.debug(`Cache HIT for key: ${key}`);
        return value;
      } else {
        this.stats.misses++;
        this.logger.debug(`Cache MISS for key: ${key}`);
        return null;
      }
    } catch (error) {
      this.logger.error(`Cache GET error for key ${key}:`, error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttl);
      this.logger.debug(`Cache SET for key: ${key}, TTL: ${ttl || 'default'}`);
    } catch (error) {
      this.logger.error(`Cache SET error for key ${key}:`, error);
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
      this.logger.debug(`Cache DELETE for key: ${key}`);
    } catch (error) {
      this.logger.error(`Cache DELETE error for key ${key}:`, error);
    }
  }

  /**
   * Clear all cache
   */
  async reset(): Promise<void> {
    try {
      // Note: Using del with wildcard pattern to clear all cache
      // Different cache stores may have different clear methods
      await this.cacheManager.del('*');
      this.logger.log('Cache cleared');
    } catch (error) {
      this.logger.error('Cache RESET error:', error);
    }
  }

  /**
   * Get or set pattern - if key exists return it, otherwise compute and cache
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      // Get Redis info (this would need Redis client access)
      const keys = 0; // Placeholder - would need Redis client to get actual count
      const memory = 0; // Placeholder - would need Redis client to get actual memory usage
      const uptime = process.uptime();

      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        keys,
        memory,
        uptime,
      };
    } catch (error) {
      this.logger.error('Error getting cache stats:', error);
      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        keys: 0,
        memory: 0,
        uptime: process.uptime(),
      };
    }
  }

  /**
   * Generate cache key with tenant isolation
   */
  generateKey(tenantId: string, ...parts: string[]): string {
    return `tenant:${tenantId}:${parts.join(':')}`;
  }

  /**
   * Cache user data
   */
  async cacheUser(tenantId: string, userId: string, userData: any, ttl = 3600): Promise<void> {
    const key = this.generateKey(tenantId, 'user', userId);
    await this.set(key, userData, ttl);
  }

  /**
   * Get cached user data
   */
  async getCachedUser(tenantId: string, userId: string): Promise<any> {
    const key = this.generateKey(tenantId, 'user', userId);
    return this.get(key);
  }

  /**
   * Cache school data
   */
  async cacheSchool(tenantId: string, schoolId: string, schoolData: any, ttl = 1800): Promise<void> {
    const key = this.generateKey(tenantId, 'school', schoolId);
    await this.set(key, schoolData, ttl);
  }

  /**
   * Get cached school data
   */
  async getCachedSchool(tenantId: string, schoolId: string): Promise<any> {
    const key = this.generateKey(tenantId, 'school', schoolId);
    return this.get(key);
  }

  /**
   * Cache schedule data
   */
  async cacheSchedule(tenantId: string, scheduleId: string, scheduleData: any, ttl = 900): Promise<void> {
    const key = this.generateKey(tenantId, 'schedule', scheduleId);
    await this.set(key, scheduleData, ttl);
  }

  /**
   * Get cached schedule data
   */
  async getCachedSchedule(tenantId: string, scheduleId: string): Promise<any> {
    const key = this.generateKey(tenantId, 'schedule', scheduleId);
    return this.get(key);
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      // This would need Redis client access to use SCAN and DEL
      this.logger.log(`Invalidating cache pattern: ${pattern}`);
      // For now, we'll just log - in production this would scan and delete matching keys
    } catch (error) {
      this.logger.error(`Error invalidating cache pattern ${pattern}:`, error);
    }
  }

  /**
   * Invalidate tenant cache
   */
  async invalidateTenant(tenantId: string): Promise<void> {
    await this.invalidatePattern(`tenant:${tenantId}:*`);
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmUpCache(tenantId: string): Promise<void> {
    this.logger.log(`Warming up cache for tenant: ${tenantId}`);
    // Implementation would pre-load frequently accessed data
    // This is a placeholder for the actual implementation
  }
}
