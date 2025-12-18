import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from './cache.service';
import { PrismaService } from '../../database/prisma.service';

export interface ScheduleCacheKey {
  tenantId: string;
  scheduleId?: string;
  constraintHash?: string;
  classIds?: string[];
  timeSlotIds?: string[];
}

export interface CachedScheduleData {
  scheduleId: string;
  generatedAt: Date;
  constraints: any[];
  solution: any;
  metadata: {
    totalClasses: number;
    totalTimeSlots: number;
    generationTime: number;
    solutionQuality: number;
  };
}

export interface CachedConstraintResult {
  constraintType: string;
  result: boolean;
  evaluationTime: number;
  metadata: any;
}

@Injectable()
export class ScheduleCacheService {
  private readonly logger = new Logger(ScheduleCacheService.name);
  private readonly CACHE_TTL = {
    SCHEDULE: 3600, // 1 hour
    CONSTRAINT: 1800, // 30 minutes
    VALIDATION: 900, // 15 minutes
    PERFORMANCE: 7200, // 2 hours
  };

  constructor(
    private readonly cacheService: CacheService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Generate cache key for schedule data
   */
  private generateScheduleKey(key: ScheduleCacheKey): string {
    const parts = [
      'schedule',
      key.tenantId,
      key.scheduleId || 'new',
      key.constraintHash || 'default',
    ];
    
    if (key.classIds?.length) {
      parts.push(`classes:${key.classIds.sort().join(',')}`);
    }
    
    if (key.timeSlotIds?.length) {
      parts.push(`slots:${key.timeSlotIds.sort().join(',')}`);
    }
    
    return parts.join(':');
  }

  /**
   * Generate cache key for constraint results
   */
  private generateConstraintKey(
    tenantId: string,
    constraintType: string,
    parameters: any,
  ): string {
    const paramHash = this.hashObject(parameters);
    return `constraint:${tenantId}:${constraintType}:${paramHash}`;
  }

  /**
   * Cache a complete schedule solution
   */
  async cacheSchedule(
    key: ScheduleCacheKey,
    scheduleData: CachedScheduleData,
  ): Promise<void> {
    const cacheKey = this.generateScheduleKey(key);
    
    try {
      await this.cacheService.set(
        cacheKey,
        scheduleData,
        this.CACHE_TTL.SCHEDULE,
      );
      
      this.logger.debug(`Cached schedule: ${cacheKey}`);
      
      // Also cache performance metrics
      await this.cachePerformanceMetrics(key.tenantId, scheduleData.metadata);
      
    } catch (error) {
      this.logger.error(`Failed to cache schedule: ${cacheKey}`, error);
    }
  }

  /**
   * Retrieve cached schedule
   */
  async getCachedSchedule(key: ScheduleCacheKey): Promise<CachedScheduleData | null> {
    const cacheKey = this.generateScheduleKey(key);
    
    try {
      const cached = await this.cacheService.get<CachedScheduleData>(cacheKey);
      
      if (cached) {
        this.logger.debug(`Cache hit for schedule: ${cacheKey}`);
        return cached;
      }
      
      this.logger.debug(`Cache miss for schedule: ${cacheKey}`);
      return null;
      
    } catch (error) {
      this.logger.error(`Failed to retrieve cached schedule: ${cacheKey}`, error);
      return null;
    }
  }

  /**
   * Cache constraint evaluation result
   */
  async cacheConstraintResult(
    tenantId: string,
    constraintType: string,
    parameters: any,
    result: CachedConstraintResult,
  ): Promise<void> {
    const cacheKey = this.generateConstraintKey(tenantId, constraintType, parameters);
    
    try {
      await this.cacheService.set(
        cacheKey,
        result,
        this.CACHE_TTL.CONSTRAINT,
      );
      
      this.logger.debug(`Cached constraint result: ${cacheKey}`);
      
    } catch (error) {
      this.logger.error(`Failed to cache constraint result: ${cacheKey}`, error);
    }
  }

  /**
   * Retrieve cached constraint result
   */
  async getCachedConstraintResult(
    tenantId: string,
    constraintType: string,
    parameters: any,
  ): Promise<CachedConstraintResult | null> {
    const cacheKey = this.generateConstraintKey(tenantId, constraintType, parameters);
    
    try {
      const cached = await this.cacheService.get<CachedConstraintResult>(cacheKey);
      
      if (cached) {
        this.logger.debug(`Cache hit for constraint: ${cacheKey}`);
        return cached;
      }
      
      return null;
      
    } catch (error) {
      this.logger.error(`Failed to retrieve cached constraint: ${cacheKey}`, error);
      return null;
    }
  }

  /**
   * Cache schedule validation results
   */
  async cacheValidationResult(
    tenantId: string,
    scheduleId: string,
    validationResult: {
      isValid: boolean;
      conflicts: any[];
      warnings: any[];
      validatedAt: Date;
    },
  ): Promise<void> {
    const cacheKey = `validation:${tenantId}:${scheduleId}`;
    
    try {
      await this.cacheService.set(
        cacheKey,
        validationResult,
        this.CACHE_TTL.VALIDATION,
      );
      
      this.logger.debug(`Cached validation result: ${cacheKey}`);
      
    } catch (error) {
      this.logger.error(`Failed to cache validation result: ${cacheKey}`, error);
    }
  }

  /**
   * Retrieve cached validation result
   */
  async getCachedValidationResult(
    tenantId: string,
    scheduleId: string,
  ): Promise<any | null> {
    const cacheKey = `validation:${tenantId}:${scheduleId}`;
    
    try {
      return await this.cacheService.get(cacheKey);
    } catch (error) {
      this.logger.error(`Failed to retrieve cached validation: ${cacheKey}`, error);
      return null;
    }
  }

  /**
   * Warm up cache with frequently accessed schedules
   */
  async warmupCache(tenantId: string): Promise<void> {
    this.logger.log(`Starting cache warmup for tenant: ${tenantId}`);
    
    try {
      // Get frequently accessed schedules from the last 30 days
      const recentSchedules = await this.prisma.schedule.findMany({
        where: {
          tenantId,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
        take: 10, // Top 10 most recent
        include: {
          classes: {
            include: {
              subject: true,
              teacher: true,
              room: true,
            },
          },
          timeSlots: true,
        },
      });

      // Pre-cache schedule data
      for (const schedule of recentSchedules) {
        const cacheKey: ScheduleCacheKey = {
          tenantId,
          scheduleId: schedule.id,
          classIds: schedule.classes.map(c => c.id),
          timeSlotIds: schedule.timeSlots.map(ts => ts.id),
        };

        const scheduleData: CachedScheduleData = {
          scheduleId: schedule.id,
          generatedAt: schedule.createdAt,
          constraints: [], // Would be populated from actual constraint data
          solution: {}, // Would be populated from actual solution data
          metadata: {
            totalClasses: schedule.classes.length,
            totalTimeSlots: schedule.timeSlots.length,
            generationTime: 0, // Would be from performance data
            solutionQuality: 0, // Would be calculated
          },
        };

        await this.cacheSchedule(cacheKey, scheduleData);
      }

      // Pre-cache common constraint evaluations
      await this.warmupConstraintCache(tenantId);
      
      this.logger.log(`Cache warmup completed for tenant: ${tenantId}`);
      
    } catch (error) {
      this.logger.error(`Cache warmup failed for tenant: ${tenantId}`, error);
    }
  }

  /**
   * Warm up constraint cache with common evaluations
   */
  private async warmupConstraintCache(tenantId: string): Promise<void> {
    const commonConstraints = [
      'teacher_conflict',
      'room_conflict',
      'class_conflict',
      'teacher_availability',
      'room_capacity',
      'time_slot_validity',
    ];

    // Get sample data for constraint evaluation
    const teachers = await this.prisma.teacher.findMany({
      where: { tenantId },
      take: 5,
    });

    const rooms = await this.prisma.room.findMany({
      where: { tenantId },
      take: 5,
    });

    const classes = await this.prisma.class.findMany({
      where: { tenantId },
      take: 5,
    });

    // Pre-evaluate common constraint combinations
    for (const constraintType of commonConstraints) {
      for (const teacher of teachers) {
        for (const room of rooms) {
          for (const classItem of classes) {
            const parameters = {
              teacherId: teacher.id,
              roomId: room.id,
              classId: classItem.id,
              timeSlot: { start: '09:00', end: '10:00' },
            };

            // Mock constraint evaluation result
            const result: CachedConstraintResult = {
              constraintType,
              result: Math.random() > 0.3, // 70% success rate
              evaluationTime: Math.random() * 100,
              metadata: parameters,
            };

            await this.cacheConstraintResult(tenantId, constraintType, parameters, result);
          }
        }
      }
    }
  }

  /**
   * Invalidate cache for a specific schedule
   */
  async invalidateScheduleCache(tenantId: string, scheduleId: string): Promise<void> {
    const patterns = [
      `schedule:${tenantId}:${scheduleId}:*`,
      `validation:${tenantId}:${scheduleId}`,
      `constraint:${tenantId}:*`,
    ];

    for (const pattern of patterns) {
      try {
        await this.cacheService.deletePattern(pattern);
        this.logger.debug(`Invalidated cache pattern: ${pattern}`);
      } catch (error) {
        this.logger.error(`Failed to invalidate cache pattern: ${pattern}`, error);
      }
    }
  }

  /**
   * Invalidate all cache for a tenant
   */
  async invalidateTenantCache(tenantId: string): Promise<void> {
    const patterns = [
      `schedule:${tenantId}:*`,
      `constraint:${tenantId}:*`,
      `validation:${tenantId}:*`,
      `performance:${tenantId}:*`,
    ];

    for (const pattern of patterns) {
      try {
        await this.cacheService.deletePattern(pattern);
        this.logger.debug(`Invalidated tenant cache pattern: ${pattern}`);
      } catch (error) {
        this.logger.error(`Failed to invalidate tenant cache pattern: ${pattern}`, error);
      }
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  async getCacheStatistics(tenantId: string): Promise<{
    scheduleHits: number;
    scheduleMisses: number;
    constraintHits: number;
    constraintMisses: number;
    validationHits: number;
    validationMisses: number;
    hitRate: number;
    totalSize: number;
  }> {
    // This would integrate with Redis or your cache implementation
    // to get actual statistics. For now, return mock data.
    const scheduleHits = Math.floor(Math.random() * 1000);
    const scheduleMisses = Math.floor(Math.random() * 200);
    const constraintHits = Math.floor(Math.random() * 2000);
    const constraintMisses = Math.floor(Math.random() * 400);
    const validationHits = Math.floor(Math.random() * 500);
    const validationMisses = Math.floor(Math.random() * 100);

    const totalHits = scheduleHits + constraintHits + validationHits;
    const totalMisses = scheduleMisses + constraintMisses + validationMisses;
    const hitRate = totalHits + totalMisses > 0 ? (totalHits / (totalHits + totalMisses)) * 100 : 0;

    return {
      scheduleHits,
      scheduleMisses,
      constraintHits,
      constraintMisses,
      validationHits,
      validationMisses,
      hitRate,
      totalSize: Math.floor(Math.random() * 1000000), // Mock size in bytes
    };
  }

  /**
   * Cache performance metrics
   */
  private async cachePerformanceMetrics(
    tenantId: string,
    metadata: CachedScheduleData['metadata'],
  ): Promise<void> {
    const cacheKey = `performance:${tenantId}:${Date.now()}`;
    
    try {
      await this.cacheService.set(
        cacheKey,
        metadata,
        this.CACHE_TTL.PERFORMANCE,
      );
    } catch (error) {
      this.logger.error(`Failed to cache performance metrics: ${cacheKey}`, error);
    }
  }

  /**
   * Hash object for consistent cache keys
   */
  private hashObject(obj: any): string {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}
