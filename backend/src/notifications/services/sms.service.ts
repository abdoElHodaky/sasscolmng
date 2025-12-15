import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// import { Twilio } from 'twilio'; // TODO: Install twilio package

export interface SmsOptions {
  to: string;
  message: string;
  from?: string;
}

export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  // private twilioClient: Twilio; // TODO: Uncomment when twilio is installed
  private readonly isEnabled: boolean;
  private readonly fromNumber: string;

  constructor(private configService: ConfigService) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    this.fromNumber = this.configService.get<string>('TWILIO_FROM_NUMBER') || '';
    
    this.isEnabled = !!(accountSid && authToken && this.fromNumber);
    
    if (this.isEnabled) {
      try {
        // TODO: Initialize Twilio client when package is installed
        // this.twilioClient = new Twilio(accountSid, authToken);
        this.logger.log('SMS service initialized with Twilio');
      } catch (error) {
        this.logger.error('Failed to initialize Twilio client', error);
        // this.isEnabled = false;
      }
    } else {
      this.logger.warn('SMS service disabled - missing Twilio configuration');
    }
  }

  /**
   * Send SMS message via Twilio
   */
  async sendSms(options: SmsOptions): Promise<SmsResult> {
    if (!this.isEnabled) {
      this.logger.warn('SMS service is disabled - skipping SMS send');
      return {
        success: false,
        error: 'SMS service is not configured'
      };
    }

    try {
      // TODO: Implement actual Twilio SMS sending
      // const message = await this.twilioClient.messages.create({
      //   body: options.message,
      //   from: options.from || this.fromNumber,
      //   to: options.to,
      // });

      // For now, simulate SMS sending
      this.logger.log(`[SIMULATED] SMS sent to ${options.to}: ${options.message}`);
      
      return {
        success: true,
        messageId: `sim_${Date.now()}`, // message.sid when real implementation
      };
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${options.to}`, error);
      return {
        success: false,
        error: error.message || 'Failed to send SMS'
      };
    }
  }

  /**
   * Send schedule notification SMS
   */
  async sendScheduleNotification(
    to: string,
    scheduleName: string,
    changes: string[],
    tenantName?: string
  ): Promise<SmsResult> {
    const message = this.formatScheduleMessage(scheduleName, changes, tenantName);
    return this.sendSms({ to, message });
  }

  /**
   * Send welcome SMS
   */
  async sendWelcomeSms(
    to: string,
    userName: string,
    tenantName?: string,
    loginUrl?: string
  ): Promise<SmsResult> {
    const message = this.formatWelcomeMessage(userName, tenantName, loginUrl);
    return this.sendSms({ to, message });
  }

  /**
   * Send verification code SMS
   */
  async sendVerificationCode(
    to: string,
    code: string,
    tenantName?: string
  ): Promise<SmsResult> {
    const message = this.formatVerificationMessage(code, tenantName);
    return this.sendSms({ to, message });
  }

  /**
   * Send urgent alert SMS
   */
  async sendUrgentAlert(
    to: string,
    alertMessage: string,
    tenantName?: string
  ): Promise<SmsResult> {
    const message = this.formatUrgentAlert(alertMessage, tenantName);
    return this.sendSms({ to, message });
  }

  /**
   * Test SMS service connection
   */
  async testConnection(): Promise<boolean> {
    if (!this.isEnabled) {
      return false;
    }

    try {
      // TODO: Implement actual connection test
      // const account = await this.twilioClient.api.accounts(this.twilioClient.accountSid).fetch();
      // return !!account.sid;
      
      // For now, return true if configuration exists
      return true;
    } catch (error) {
      this.logger.error('SMS connection test failed', error);
      return false;
    }
  }

  /**
   * Get SMS service status
   */
  getServiceStatus() {
    return {
      enabled: this.isEnabled,
      provider: 'Twilio',
      fromNumber: this.fromNumber ? `***${this.fromNumber.slice(-4)}` : 'Not configured',
      configured: this.isEnabled,
    };
  }

  /**
   * Format schedule notification message
   */
  private formatScheduleMessage(
    scheduleName: string,
    changes: string[],
    tenantName?: string
  ): string {
    const prefix = tenantName ? `[${tenantName}] ` : '';
    const changeList = changes.slice(0, 3).join(', '); // Limit for SMS length
    const moreChanges = changes.length > 3 ? ` and ${changes.length - 3} more` : '';
    
    return `${prefix}Schedule Update: ${scheduleName} - ${changeList}${moreChanges}. Check the app for details.`;
  }

  /**
   * Format welcome message
   */
  private formatWelcomeMessage(
    userName: string,
    tenantName?: string,
    loginUrl?: string
  ): string {
    const prefix = tenantName ? `Welcome to ${tenantName}! ` : 'Welcome! ';
    const urlPart = loginUrl ? ` Login: ${loginUrl}` : '';
    
    return `${prefix}Hi ${userName}, your account is ready.${urlPart}`;
  }

  /**
   * Format verification code message
   */
  private formatVerificationMessage(code: string, tenantName?: string): string {
    const prefix = tenantName ? `[${tenantName}] ` : '';
    return `${prefix}Your verification code is: ${code}. This code expires in 10 minutes.`;
  }

  /**
   * Format urgent alert message
   */
  private formatUrgentAlert(alertMessage: string, tenantName?: string): string {
    const prefix = tenantName ? `[${tenantName}] ` : '';
    return `${prefix}URGENT: ${alertMessage}`;
  }

  /**
   * Validate phone number format
   */
  validatePhoneNumber(phoneNumber: string): boolean {
    // Basic E.164 format validation
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber);
  }

  /**
   * Format phone number to E.164
   */
  formatPhoneNumber(phoneNumber: string, defaultCountryCode = '+1'): string {
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');
    
    // If it starts with country code, add +
    if (digits.length > 10) {
      return `+${digits}`;
    }
    
    // If it's a 10-digit number, add default country code
    if (digits.length === 10) {
      return `${defaultCountryCode}${digits}`;
    }
    
    // Return as-is if we can't determine format
    return phoneNumber;
  }
}
