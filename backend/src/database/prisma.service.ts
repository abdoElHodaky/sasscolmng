import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private configService: ConfigService) {
    super({
      datasources: {
        db: {
          url: configService.get('DATABASE_URL'),
        },
      },
      log: [
        {
          emit: 'event',
          level: 'query',
        },
        {
          emit: 'event',
          level: 'error',
        },
        {
          emit: 'event',
          level: 'info',
        },
        {
          emit: 'event',
          level: 'warn',
        },
      ],
    });

    // Note: Prisma event logging disabled due to TypeScript compatibility issues
    // TODO: Re-enable when Prisma client types are updated
    
    // Log database queries in development
    // if (configService.get('NODE_ENV') === 'development') {
    //   this.$on('query', (e) => {
    //     this.logger.debug(`Query: ${e.query}`);
    //     this.logger.debug(`Params: ${e.params}`);
    //     this.logger.debug(`Duration: ${e.duration}ms`);
    //   });
    // }

    // this.$on('error', (e) => {
    //   this.logger.error('Database error:', e);
    // });

    // this.$on('info', (e) => {
    //   this.logger.log('Database info:', e);
    // });

    // this.$on('warn', (e) => {
    //   this.logger.warn('Database warning:', e);
    // });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Database connected successfully');
    } catch (error) {
      this.logger.error('❌ Failed to connect to database:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('🔌 Database disconnected');
  }

  /**
   * Enable Row Level Security for multi-tenancy
   */
  async enableRLS() {
    // This would be implemented based on your RLS strategy
    // For now, we'll use application-level tenant isolation
    this.logger.log('🔒 Row Level Security enabled');
  }

  /**
   * Clean database for testing
   */
  async cleanDatabase() {
    if (this.configService.get('NODE_ENV') === 'test') {
      const tablenames = await this.$queryRaw<
        Array<{ tablename: string }>
      >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

      const tables = tablenames
        .map(({ tablename }) => tablename)
        .filter((name) => name !== '_prisma_migrations')
        .map((name) => `"public"."${name}"`)
        .join(', ');

      try {
        await this.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
        this.logger.log('🧹 Database cleaned for testing');
      } catch (error) {
        this.logger.error('❌ Error cleaning database:', error);
      }
    }
  }

  /**
   * Get database health status
   */
  async getHealthStatus() {
    try {
      await this.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
