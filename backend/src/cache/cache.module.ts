import { Module, Global } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-yet';
import { CacheService } from './cache.service';
import { CacheController } from './cache.controller';

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisHost = configService.get('REDIS_HOST', 'localhost');
        const redisPort = configService.get('REDIS_PORT', 6379);
        const redisPassword = configService.get('REDIS_PASSWORD');
        const redisDb = configService.get('REDIS_DB', 0);

        return {
          store: redisStore,
          host: redisHost,
          port: redisPort,
          password: redisPassword,
          db: redisDb,
          ttl: 300, // 5 minutes default TTL
          max: 1000, // Maximum number of items in cache
          isGlobal: true,
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [CacheService],
  controllers: [CacheController],
  exports: [CacheService, NestCacheModule],
})
export class CacheModule {}
