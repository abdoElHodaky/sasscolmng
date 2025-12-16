import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { NotificationService } from './services/notification.service';
import { EmailService } from './services/email.service';
import { SmsService } from './services/sms.service';
import { PushService } from './services/push.service';
import { NotificationTemplateService } from './services/notification-template.service';
import { WebSocketGateway } from './services/websocket.gateway';
import { NotificationController } from './controllers/notification.controller';
import { NotificationProcessor } from './services/notification.processor';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    BullModule.registerQueue({
      name: 'notifications',
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD,
      },
    }),
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    EmailService,
    SmsService,
    PushService,
    NotificationTemplateService,
    WebSocketGateway,
    NotificationProcessor,
  ],
  exports: [NotificationService, EmailService, SmsService, PushService, NotificationTemplateService],
})
export class NotificationsModule {}
