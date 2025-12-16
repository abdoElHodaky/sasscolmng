import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

import { PrismaService } from '../database/prisma.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    
    if (user && (await bcrypt.compare(password, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Update last login
    await this.usersService.updateLastLogin(user.id);

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      schoolId: user.schoolId,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.generateRefreshToken(user.id);

    this.logger.log(`User ${user.email} logged in successfully`);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
        schoolId: user.schoolId,
      },
      accessToken,
      refreshToken,
    };
  }

  async register(registerDto: RegisterDto) {
    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(
      registerDto.password,
      this.configService.get('BCRYPT_ROUNDS') || 12,
    );

    // Create user
    const user = await this.usersService.create({
      ...registerDto,
      password: hashedPassword,
    });

    this.logger.log(`New user registered: ${user.email}`);

    // Auto-login after registration
    return this.login({
      email: registerDto.email,
      password: registerDto.password,
    });
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    const { refreshToken } = refreshTokenDto;

    // Find refresh token in database
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if token is expired
    if (tokenRecord.expiresAt < new Date()) {
      // Remove expired token
      await this.prisma.refreshToken.delete({
        where: { id: tokenRecord.id },
      });
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = tokenRecord.user;

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Generate new access token
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      schoolId: user.schoolId,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
        schoolId: user.schoolId,
      },
    };
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      // Remove specific refresh token
      await this.prisma.refreshToken.deleteMany({
        where: {
          userId,
          token: refreshToken,
        },
      });
    } else {
      // Remove all refresh tokens for user (logout from all devices)
      await this.prisma.refreshToken.deleteMany({
        where: { userId },
      });
    }

    this.logger.log(`User ${userId} logged out`);
    return { message: 'Logged out successfully' };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.usersService.findById(userId);
    
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(
      newPassword,
      this.configService.get('BCRYPT_ROUNDS') || 12,
    );

    // Update password
    await this.usersService.updatePassword(userId, hashedNewPassword);

    // Invalidate all refresh tokens (force re-login on all devices)
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });

    this.logger.log(`Password changed for user ${userId}`);
    return { message: 'Password changed successfully' };
  }

  private async generateRefreshToken(userId: string): Promise<string> {
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(
      expiresAt.getDate() +
        parseInt(this.configService.get('JWT_REFRESH_EXPIRES_IN') || '7'),
    );

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    });

    return token;
  }

  async validateJwtPayload(payload: any) {
    const user = await this.usersService.findById(payload.sub);
    
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      schoolId: user.schoolId,
    };
  }
}

