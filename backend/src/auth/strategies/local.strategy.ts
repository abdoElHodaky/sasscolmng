import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      usernameField: 'email', // Use email instead of username
      passwordField: 'password',
      passReqToCallback: true, // Pass request to validate method
    });
  }

  async validate(req: any, email: string, password: string): Promise<any> {
    try {
      // Extract tenant ID from request body if provided
      const tenantId = req.body?.tenantId;
      
      const user = await this.authService.validateUser(email, password, tenantId);
      
      if (!user) {
        throw new UnauthorizedException('Invalid email or password');
      }

      if (!user.isActive) {
        throw new UnauthorizedException('User account is deactivated');
      }

      return user;
    } catch (error) {
      throw new UnauthorizedException('Authentication failed');
    }
  }
}

