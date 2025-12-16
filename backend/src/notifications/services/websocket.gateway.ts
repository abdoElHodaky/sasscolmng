import {
  WebSocketGateway as WSGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  tenantId?: string;
  role?: string;
}

@WSGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/notifications',
})
export class WebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebSocketGateway.name);
  private connectedUsers = new Map<string, AuthenticatedSocket>();

  handleConnection(client: AuthenticatedSocket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    if (client.userId) {
      this.connectedUsers.delete(client.userId);
    }
  }

  @SubscribeMessage('authenticate')
  async handleAuthentication(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { userId: string; tenantId: string; role: string },
  ) {
    try {
      // In a real implementation, you'd validate the JWT token here
      client.userId = data.userId;
      client.tenantId = data.tenantId;
      client.role = data.role;
      
      this.connectedUsers.set(data.userId, client);
      
      client.emit('authenticated', { status: 'success' });
      this.logger.log(`User authenticated: ${data.userId} (${data.role})`);
    } catch (error) {
      client.emit('authenticated', { status: 'error', message: 'Authentication failed' });
      this.logger.error('Authentication failed:', error);
    }
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { room: string },
  ) {
    if (!client.userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    // Join tenant-specific room
    const room = `tenant:${client.tenantId}:${data.room}`;
    await client.join(room);
    
    client.emit('joined-room', { room: data.room });
    this.logger.log(`User ${client.userId} joined room: ${room}`);
  }

  @SubscribeMessage('leave-room')
  async handleLeaveRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { room: string },
  ) {
    const room = `tenant:${client.tenantId}:${data.room}`;
    await client.leave(room);
    
    client.emit('left-room', { room: data.room });
    this.logger.log(`User ${client.userId} left room: ${room}`);
  }

  // Send notification to specific user
  async sendToUser(userId: string, event: string, data: any) {
    const client = this.connectedUsers.get(userId);
    if (client) {
      client.emit(event, data);
      this.logger.log(`Notification sent to user ${userId}: ${event}`);
      return true;
    }
    return false;
  }

  // Send notification to all users in a tenant
  async sendToTenant(tenantId: string, event: string, data: any) {
    this.server.to(`tenant:${tenantId}`).emit(event, data);
    this.logger.log(`Notification sent to tenant ${tenantId}: ${event}`);
  }

  // Send notification to specific room
  async sendToRoom(tenantId: string, room: string, event: string, data: any) {
    const roomName = `tenant:${tenantId}:${room}`;
    this.server.to(roomName).emit(event, data);
    this.logger.log(`Notification sent to room ${roomName}: ${event}`);
  }

  // Send schedule update notification
  async sendScheduleUpdate(tenantId: string, scheduleId: string, data: any) {
    await this.sendToRoom(tenantId, `schedule:${scheduleId}`, 'schedule-updated', {
      type: 'schedule-update',
      scheduleId,
      timestamp: new Date().toISOString(),
      ...data,
    });
  }

  // Send system notification
  async sendSystemNotification(tenantId: string, data: any) {
    await this.sendToTenant(tenantId, 'system-notification', {
      type: 'system',
      timestamp: new Date().toISOString(),
      ...data,
    });
  }

  // Send conflict alert
  async sendConflictAlert(tenantId: string, conflictData: any) {
    await this.sendToTenant(tenantId, 'conflict-alert', {
      type: 'conflict',
      timestamp: new Date().toISOString(),
      severity: 'high',
      ...conflictData,
    });
  }

  // Get connected users count
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  // Get connected users for a tenant
  getConnectedUsersForTenant(tenantId: string): string[] {
    const users: string[] = [];
    this.connectedUsers.forEach((client, userId) => {
      if (client.tenantId === tenantId) {
        users.push(userId);
      }
    });
    return users;
  }
}

