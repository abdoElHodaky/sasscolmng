import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Services
import { TimeSlotService } from './services/time-slot.service';
import { ScheduleService } from './services/schedule.service';
import { SchedulingEngineService } from './services/scheduling-engine.service';
import { PreferencesService } from './services/preferences.service';
import { ExportService } from './services/export.service';
import { OrToolsService } from './solver/or-tools.service';
import { HardConstraintsService } from './constraints/hard-constraints.service';
import { SoftConstraintsService } from './constraints/soft-constraints.service';

// Processors
import { SchedulingProcessor } from './processors/scheduling.processor';

// Controllers
import { TimeSlotController } from './controllers/time-slot.controller';
import { ScheduleController } from './controllers/schedule.controller';
import { PreferencesController } from './controllers/preferences.controller';
import { ExportController } from './controllers/export.controller';

// Common modules
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    // Bull Queue for background job processing
    BullModule.registerQueueAsync({
      name: 'scheduling',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST') || 'localhost',
          port: configService.get('REDIS_PORT') || 6379,
          password: configService.get('REDIS_PASSWORD'),
          db: configService.get('REDIS_DB') || 0,
        },
        defaultJobOptions: {
          removeOnComplete: 10,
          removeOnFail: 5,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      }),
    }),
  ],
  controllers: [
    TimeSlotController,
    ScheduleController,
    PreferencesController,
    ExportController,
  ],
  providers: [
    // Core services
    TimeSlotService,
    ScheduleService,
    SchedulingEngineService,
    PreferencesService,
    ExportService,
    
    // Solver and constraints
    OrToolsService,
    HardConstraintsService,
    SoftConstraintsService,
    
    // Background job processors
    SchedulingProcessor,
  ],
  exports: [
    TimeSlotService,
    ScheduleService,
    SchedulingEngineService,
    PreferencesService,
    ExportService,
    OrToolsService,
    HardConstraintsService,
    SoftConstraintsService,
  ],
})
export class SchedulingModule {}
