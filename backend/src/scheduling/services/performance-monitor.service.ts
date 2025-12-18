import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../cache/cache.service';

export interface PerformanceMetrics {
  scheduleGenerationTime: number;
  constraintEvaluationTime: number;
  databaseQueryTime: number;
  cacheHitRate: number;
  memoryUsage: number;
  cpuUsage: number;
  totalClasses: number;
  totalConstraints: number;
  solutionQuality: number;
}

export interface PerformanceBenchmark {
  id: string;
  tenantId: string;
  timestamp: Date;
  metrics: PerformanceMetrics;
  scheduleId: string;
  optimizationLevel: 'basic' | 'standard' | 'advanced';
  status: 'success' | 'timeout' | 'error';
  errorMessage?: string;
}

@Injectable()
export class PerformanceMonitorService {
  private readonly logger = new Logger(PerformanceMonitorService.name);
  private performanceHistory: Map<string, PerformanceBenchmark[]> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Start performance monitoring for a scheduling operation
   */
  startMonitoring(tenantId: string, scheduleId: string): string {
    const monitoringId = `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const benchmark: PerformanceBenchmark = {
      id: monitoringId,
      tenantId,
      timestamp: new Date(),
      metrics: {
        scheduleGenerationTime: 0,
        constraintEvaluationTime: 0,
        databaseQueryTime: 0,
        cacheHitRate: 0,
        memoryUsage: process.memoryUsage().heapUsed,
        cpuUsage: process.cpuUsage().user,
        totalClasses: 0,
        totalConstraints: 0,
        solutionQuality: 0,
      },
      scheduleId,
      optimizationLevel: 'standard',
      status: 'success',
    };

    if (!this.performanceHistory.has(tenantId)) {
      this.performanceHistory.set(tenantId, []);
    }
    
    this.performanceHistory.get(tenantId)!.push(benchmark);
    
    this.logger.debug(`Started performance monitoring: ${monitoringId}`);
    return monitoringId;
  }

  /**
   * Record performance metrics during scheduling
   */
  recordMetrics(
    monitoringId: string,
    partialMetrics: Partial<PerformanceMetrics>,
  ): void {
    for (const [tenantId, benchmarks] of this.performanceHistory.entries()) {
      const benchmark = benchmarks.find(b => b.id === monitoringId);
      if (benchmark) {
        benchmark.metrics = { ...benchmark.metrics, ...partialMetrics };
        this.logger.debug(`Updated metrics for ${monitoringId}:`, partialMetrics);
        return;
      }
    }
    
    this.logger.warn(`Performance monitoring session not found: ${monitoringId}`);
  }

  /**
   * Complete performance monitoring and calculate final metrics
   */
  async completeMonitoring(
    monitoringId: string,
    status: 'success' | 'timeout' | 'error',
    errorMessage?: string,
  ): Promise<PerformanceBenchmark | null> {
    for (const [tenantId, benchmarks] of this.performanceHistory.entries()) {
      const benchmarkIndex = benchmarks.findIndex(b => b.id === monitoringId);
      if (benchmarkIndex !== -1) {
        const benchmark = benchmarks[benchmarkIndex];
        
        // Calculate final metrics
        const finalMemory = process.memoryUsage().heapUsed;
        const finalCpu = process.cpuUsage().user;
        
        benchmark.status = status;
        benchmark.errorMessage = errorMessage;
        benchmark.metrics.memoryUsage = finalMemory - benchmark.metrics.memoryUsage;
        benchmark.metrics.cpuUsage = finalCpu - benchmark.metrics.cpuUsage;
        
        // Calculate cache hit rate
        const cacheStats = await this.getCacheStatistics(tenantId);
        benchmark.metrics.cacheHitRate = cacheStats.hitRate;
        
        // Store in cache for quick access
        await this.cacheService.set(
          `performance:${tenantId}:${monitoringId}`,
          benchmark,
          3600, // 1 hour
        );
        
        this.logger.log(`Completed performance monitoring: ${monitoringId}`, {
          status,
          metrics: benchmark.metrics,
        });
        
        return benchmark;
      }
    }
    
    return null;
  }

  /**
   * Get performance statistics for a tenant
   */
  async getPerformanceStats(tenantId: string): Promise<{
    averageGenerationTime: number;
    averageConstraintTime: number;
    averageCacheHitRate: number;
    totalSchedulesGenerated: number;
    successRate: number;
    recentBenchmarks: PerformanceBenchmark[];
  }> {
    const benchmarks = this.performanceHistory.get(tenantId) || [];
    const recentBenchmarks = benchmarks
      .filter(b => Date.now() - b.timestamp.getTime() < 24 * 60 * 60 * 1000) // Last 24 hours
      .slice(-50); // Last 50 benchmarks

    if (recentBenchmarks.length === 0) {
      return {
        averageGenerationTime: 0,
        averageConstraintTime: 0,
        averageCacheHitRate: 0,
        totalSchedulesGenerated: 0,
        successRate: 0,
        recentBenchmarks: [],
      };
    }

    const successfulBenchmarks = recentBenchmarks.filter(b => b.status === 'success');
    
    return {
      averageGenerationTime: this.calculateAverage(
        successfulBenchmarks.map(b => b.metrics.scheduleGenerationTime)
      ),
      averageConstraintTime: this.calculateAverage(
        successfulBenchmarks.map(b => b.metrics.constraintEvaluationTime)
      ),
      averageCacheHitRate: this.calculateAverage(
        successfulBenchmarks.map(b => b.metrics.cacheHitRate)
      ),
      totalSchedulesGenerated: benchmarks.length,
      successRate: (successfulBenchmarks.length / recentBenchmarks.length) * 100,
      recentBenchmarks: recentBenchmarks.slice(-10), // Last 10 for detailed view
    };
  }

  /**
   * Get system-wide performance metrics
   */
  async getSystemPerformanceMetrics(): Promise<{
    totalSchedulesGenerated: number;
    averageGenerationTime: number;
    systemLoad: number;
    memoryUsage: number;
    cacheEfficiency: number;
    errorRate: number;
  }> {
    let totalSchedules = 0;
    let totalGenerationTime = 0;
    let totalErrors = 0;
    let totalCacheHits = 0;
    let totalCacheRequests = 0;

    for (const [tenantId, benchmarks] of this.performanceHistory.entries()) {
      const recentBenchmarks = benchmarks.filter(
        b => Date.now() - b.timestamp.getTime() < 24 * 60 * 60 * 1000
      );
      
      totalSchedules += recentBenchmarks.length;
      totalGenerationTime += recentBenchmarks.reduce(
        (sum, b) => sum + b.metrics.scheduleGenerationTime, 0
      );
      totalErrors += recentBenchmarks.filter(b => b.status === 'error').length;
      
      // Aggregate cache statistics
      const cacheStats = await this.getCacheStatistics(tenantId);
      totalCacheHits += cacheStats.hits;
      totalCacheRequests += cacheStats.requests;
    }

    const memoryUsage = process.memoryUsage();
    
    return {
      totalSchedulesGenerated: totalSchedules,
      averageGenerationTime: totalSchedules > 0 ? totalGenerationTime / totalSchedules : 0,
      systemLoad: process.cpuUsage().user / 1000000, // Convert to seconds
      memoryUsage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
      cacheEfficiency: totalCacheRequests > 0 ? (totalCacheHits / totalCacheRequests) * 100 : 0,
      errorRate: totalSchedules > 0 ? (totalErrors / totalSchedules) * 100 : 0,
    };
  }

  /**
   * Optimize performance based on historical data
   */
  async getOptimizationRecommendations(tenantId: string): Promise<{
    recommendations: string[];
    priority: 'low' | 'medium' | 'high';
    estimatedImprovement: number;
  }> {
    const stats = await this.getPerformanceStats(tenantId);
    const recommendations: string[] = [];
    let priority: 'low' | 'medium' | 'high' = 'low';
    let estimatedImprovement = 0;

    // Analyze generation time
    if (stats.averageGenerationTime > 30000) { // 30 seconds
      recommendations.push('Consider implementing constraint pre-filtering');
      recommendations.push('Enable schedule caching for similar configurations');
      priority = 'high';
      estimatedImprovement += 40;
    } else if (stats.averageGenerationTime > 15000) { // 15 seconds
      recommendations.push('Optimize database queries with better indexing');
      priority = priority === 'low' ? 'medium' : priority;
      estimatedImprovement += 20;
    }

    // Analyze cache hit rate
    if (stats.averageCacheHitRate < 50) {
      recommendations.push('Improve caching strategy for constraint calculations');
      recommendations.push('Implement cache warming for frequently accessed data');
      priority = priority === 'low' ? 'medium' : priority;
      estimatedImprovement += 25;
    }

    // Analyze success rate
    if (stats.successRate < 90) {
      recommendations.push('Review constraint complexity and timeout settings');
      recommendations.push('Implement fallback algorithms for complex schedules');
      priority = 'high';
      estimatedImprovement += 30;
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance is optimal - no immediate optimizations needed');
    }

    return {
      recommendations,
      priority,
      estimatedImprovement: Math.min(estimatedImprovement, 100),
    };
  }

  /**
   * Clean up old performance data
   */
  async cleanupOldData(): Promise<void> {
    const cutoffTime = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days ago
    
    for (const [tenantId, benchmarks] of this.performanceHistory.entries()) {
      const filteredBenchmarks = benchmarks.filter(
        b => b.timestamp.getTime() > cutoffTime
      );
      
      if (filteredBenchmarks.length !== benchmarks.length) {
        this.performanceHistory.set(tenantId, filteredBenchmarks);
        this.logger.debug(`Cleaned up old performance data for tenant: ${tenantId}`);
      }
    }
  }

  /**
   * Export performance data for analysis
   */
  async exportPerformanceData(tenantId: string, format: 'json' | 'csv'): Promise<string> {
    const benchmarks = this.performanceHistory.get(tenantId) || [];
    
    if (format === 'json') {
      return JSON.stringify(benchmarks, null, 2);
    }
    
    // CSV format
    const headers = [
      'id', 'timestamp', 'scheduleId', 'status', 'generationTime',
      'constraintTime', 'cacheHitRate', 'memoryUsage', 'totalClasses'
    ];
    
    const csvRows = benchmarks.map(b => [
      b.id,
      b.timestamp.toISOString(),
      b.scheduleId,
      b.status,
      b.metrics.scheduleGenerationTime,
      b.metrics.constraintEvaluationTime,
      b.metrics.cacheHitRate,
      b.metrics.memoryUsage,
      b.metrics.totalClasses,
    ]);
    
    return [headers, ...csvRows].map(row => row.join(',')).join('\n');
  }

  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  }

  private async getCacheStatistics(tenantId: string): Promise<{
    hits: number;
    requests: number;
    hitRate: number;
  }> {
    // This would integrate with your cache service to get actual statistics
    // For now, return mock data
    const hits = Math.floor(Math.random() * 1000);
    const requests = hits + Math.floor(Math.random() * 200);
    
    return {
      hits,
      requests,
      hitRate: requests > 0 ? (hits / requests) * 100 : 0,
    };
  }
}
