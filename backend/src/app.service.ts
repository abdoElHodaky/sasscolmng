import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private configService: ConfigService) {}

  getHealth() {
    return {
      message: 'SaaS School Management API is running!',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: this.configService.get('NODE_ENV') || 'development',
    };
  }

  getStatus() {
    return {
      api: {
        name: 'SaaS School Management API',
        version: '1.0.0',
        description: 'Backend API for school management with smart scheduling',
      },
      environment: this.configService.get('NODE_ENV') || 'development',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      features: {
        multiTenant: true,
        smartScheduling: true,
        notifications: true,
        billing: true,
        authentication: true,
      },
      database: {
        type: 'PostgreSQL',
        connected: true, // This should be checked dynamically
      },
      cache: {
        type: 'Redis',
        connected: true, // This should be checked dynamically
      },
    };
  }
}

