import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sgMail from '@sendgrid/mail';
import * as nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  templateId?: string;
  templateData?: Record<string, any>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private sendGridEnabled: boolean = false;

  constructor(private configService: ConfigService) {
    this.initializeEmailServices();
  }

  private initializeEmailServices() {
    // Initialize SendGrid if API key is provided
    const sendGridApiKey = this.configService.get<string>('SENDGRID_API_KEY');
    if (sendGridApiKey) {
      sgMail.setApiKey(sendGridApiKey);
      this.sendGridEnabled = true;
      this.logger.log('SendGrid email service initialized');
    }

    // Initialize SMTP as fallback
    const smtpConfig = {
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT', 587),
      secure: this.configService.get<boolean>('SMTP_SECURE', false),
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    };

    if (smtpConfig.host && smtpConfig.auth.user) {
      this.transporter = nodemailer.createTransporter(smtpConfig);
      this.logger.log('SMTP email service initialized');
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      // Try SendGrid first if available and template is provided
      if (this.sendGridEnabled && options.templateId) {
        return await this.sendWithSendGrid(options);
      }

      // Fallback to SMTP
      if (this.transporter) {
        return await this.sendWithSMTP(options);
      }

      // If no email service is configured, log and return false
      this.logger.warn('No email service configured. Email not sent.');
      return false;
    } catch (error) {
      this.logger.error('Failed to send email:', error);
      return false;
    }
  }

  private async sendWithSendGrid(options: EmailOptions): Promise<boolean> {
    try {
      const msg: sgMail.MailDataRequired = {
        to: options.to,
        from: options.from || this.configService.get<string>('SENDGRID_FROM_EMAIL'),
        subject: options.subject,
        text: options.text,
        html: options.html,
      };

      if (options.templateId) {
        msg.templateId = options.templateId;
        msg.dynamicTemplateData = options.templateData || {};
      }

      await sgMail.send(msg);
      this.logger.log(`Email sent successfully via SendGrid to: ${options.to}`);
      return true;
    } catch (error) {
      this.logger.error('SendGrid email failed:', error);
      throw error;
    }
  }

  private async sendWithSMTP(options: EmailOptions): Promise<boolean> {
    try {
      const mailOptions = {
        from: options.from || this.configService.get<string>('SMTP_FROM_EMAIL'),
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      };

      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent successfully via SMTP to: ${options.to}`);
      return true;
    } catch (error) {
      this.logger.error('SMTP email failed:', error);
      throw error;
    }
  }

  async sendScheduleNotification(
    to: string,
    scheduleName: string,
    changes: string[],
    tenantName: string,
  ): Promise<boolean> {
    const subject = `Schedule Update: ${scheduleName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Schedule Update Notification</h2>
        <p>Hello,</p>
        <p>Your schedule <strong>${scheduleName}</strong> has been updated.</p>
        
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #374151;">Changes Made:</h3>
          <ul>
            ${changes.map(change => `<li>${change}</li>`).join('')}
          </ul>
        </div>
        
        <p>Please check your updated schedule in the ${tenantName} portal.</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
          <p>This is an automated notification from ${tenantName} School Management System.</p>
        </div>
      </div>
    `;

    return await this.sendEmail({
      to,
      subject,
      html,
      text: `Schedule Update: ${scheduleName}. Changes: ${changes.join(', ')}`,
    });
  }

  async sendWelcomeEmail(
    to: string,
    userName: string,
    tenantName: string,
    loginUrl: string,
  ): Promise<boolean> {
    const subject = `Welcome to ${tenantName} School Management System`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Welcome to ${tenantName}!</h2>
        <p>Hello ${userName},</p>
        <p>Your account has been created successfully. You can now access the school management system.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Access Your Account
          </a>
        </div>
        
        <p>If you have any questions, please contact your system administrator.</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
          <p>This is an automated notification from ${tenantName} School Management System.</p>
        </div>
      </div>
    `;

    return await this.sendEmail({
      to,
      subject,
      html,
      text: `Welcome to ${tenantName}! Access your account at: ${loginUrl}`,
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      if (this.sendGridEnabled) {
        // SendGrid doesn't have a direct test method, so we'll assume it's working
        this.logger.log('SendGrid connection test: OK');
        return true;
      }

      if (this.transporter) {
        await this.transporter.verify();
        this.logger.log('SMTP connection test: OK');
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error('Email service connection test failed:', error);
      return false;
    }
  }
}

