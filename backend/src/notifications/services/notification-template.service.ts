import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';

export interface NotificationTemplate {
  id: string;
  name: string;
  description: string;
  type: 'email' | 'sms' | 'push' | 'realtime';
  subject?: string; // For email templates
  content: string;
  variables: string[]; // List of available variables like {{name}}, {{school}}
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface TemplateVariable {
  name: string;
  description: string;
  required: boolean;
  defaultValue?: string;
  type: 'string' | 'number' | 'date' | 'boolean';
}

export interface CreateTemplateDto {
  name: string;
  description: string;
  type: 'email' | 'sms' | 'push' | 'realtime';
  subject?: string;
  content: string;
  variables?: string[];
  isActive?: boolean;
  metadata?: Record<string, any>;
}

export interface UpdateTemplateDto {
  name?: string;
  description?: string;
  subject?: string;
  content?: string;
  variables?: string[];
  isActive?: boolean;
  metadata?: Record<string, any>;
}

@Injectable()
export class NotificationTemplateService {
  private readonly logger = new Logger(NotificationTemplateService.name);

  // In-memory storage for templates (in production, this would be a database)
  private templates: Map<string, NotificationTemplate> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
  }

  /**
   * Create a new notification template
   */
  async createTemplate(createTemplateDto: CreateTemplateDto): Promise<NotificationTemplate> {
    try {
      const templateId = `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const template: NotificationTemplate = {
        id: templateId,
        name: createTemplateDto.name,
        description: createTemplateDto.description,
        type: createTemplateDto.type,
        subject: createTemplateDto.subject,
        content: createTemplateDto.content,
        variables: createTemplateDto.variables || this.extractVariables(createTemplateDto.content),
        isActive: createTemplateDto.isActive !== false,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: createTemplateDto.metadata || {}
      };

      this.templates.set(templateId, template);
      
      this.logger.log(`Created template ${template.name} (${templateId})`);
      
      return template;
    } catch (error) {
      this.logger.error('Failed to create template', error);
      throw new BadRequestException('Failed to create template');
    }
  }

  /**
   * Get all templates with optional filtering
   */
  async getTemplates(options: {
    type?: 'email' | 'sms' | 'push' | 'realtime';
    isActive?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    templates: NotificationTemplate[];
    total: number;
    hasMore: boolean;
  }> {
    const { type, isActive, limit = 20, offset = 0 } = options;

    let filteredTemplates = Array.from(this.templates.values());

    // Apply filters
    if (type) {
      filteredTemplates = filteredTemplates.filter(t => t.type === type);
    }
    
    if (isActive !== undefined) {
      filteredTemplates = filteredTemplates.filter(t => t.isActive === isActive);
    }

    // Sort by creation date (newest first)
    filteredTemplates.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination
    const paginatedTemplates = filteredTemplates.slice(offset, offset + limit);

    return {
      templates: paginatedTemplates,
      total: filteredTemplates.length,
      hasMore: offset + limit < filteredTemplates.length
    };
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId: string): Promise<NotificationTemplate> {
    const template = this.templates.get(templateId);
    
    if (!template) {
      throw new NotFoundException(`Template with ID ${templateId} not found`);
    }
    
    return template;
  }

  /**
   * Update existing template
   */
  async updateTemplate(templateId: string, updateTemplateDto: UpdateTemplateDto): Promise<NotificationTemplate> {
    const template = await this.getTemplate(templateId);
    
    // Update fields
    if (updateTemplateDto.name !== undefined) template.name = updateTemplateDto.name;
    if (updateTemplateDto.description !== undefined) template.description = updateTemplateDto.description;
    if (updateTemplateDto.subject !== undefined) template.subject = updateTemplateDto.subject;
    if (updateTemplateDto.content !== undefined) {
      template.content = updateTemplateDto.content;
      // Re-extract variables if content changed
      template.variables = updateTemplateDto.variables || this.extractVariables(updateTemplateDto.content);
    }
    if (updateTemplateDto.variables !== undefined) template.variables = updateTemplateDto.variables;
    if (updateTemplateDto.isActive !== undefined) template.isActive = updateTemplateDto.isActive;
    if (updateTemplateDto.metadata !== undefined) template.metadata = { ...template.metadata, ...updateTemplateDto.metadata };
    
    template.updatedAt = new Date();
    
    this.templates.set(templateId, template);
    
    this.logger.log(`Updated template ${template.name} (${templateId})`);
    
    return template;
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string): Promise<void> {
    const template = await this.getTemplate(templateId);
    
    this.templates.delete(templateId);
    
    this.logger.log(`Deleted template ${template.name} (${templateId})`);
  }

  /**
   * Render template with variables
   */
  async renderTemplate(
    templateId: string,
    variables: Record<string, any>
  ): Promise<{
    subject?: string;
    content: string;
    missingVariables: string[];
  }> {
    const template = await this.getTemplate(templateId);
    
    const missingVariables: string[] = [];
    
    // Check for missing required variables
    template.variables.forEach(variable => {
      if (!(variable in variables)) {
        missingVariables.push(variable);
      }
    });

    // Render content
    let renderedContent = template.content;
    let renderedSubject = template.subject;

    // Replace variables in content
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      renderedContent = renderedContent.replace(regex, String(value));
      
      if (renderedSubject) {
        renderedSubject = renderedSubject.replace(regex, String(value));
      }
    });

    return {
      subject: renderedSubject,
      content: renderedContent,
      missingVariables
    };
  }

  /**
   * Get template by name and type
   */
  async getTemplateByName(name: string, type: 'email' | 'sms' | 'push' | 'realtime'): Promise<NotificationTemplate | null> {
    const templates = Array.from(this.templates.values());
    return templates.find(t => t.name === name && t.type === type && t.isActive) || null;
  }

  /**
   * Get available template variables for a specific type
   */
  getAvailableVariables(type: 'email' | 'sms' | 'push' | 'realtime'): TemplateVariable[] {
    const commonVariables: TemplateVariable[] = [
      {
        name: 'name',
        description: 'User\'s full name',
        required: false,
        type: 'string'
      },
      {
        name: 'firstName',
        description: 'User\'s first name',
        required: false,
        type: 'string'
      },
      {
        name: 'lastName',
        description: 'User\'s last name',
        required: false,
        type: 'string'
      },
      {
        name: 'email',
        description: 'User\'s email address',
        required: false,
        type: 'string'
      },
      {
        name: 'school',
        description: 'School name',
        required: false,
        type: 'string'
      },
      {
        name: 'date',
        description: 'Current date',
        required: false,
        type: 'date',
        defaultValue: new Date().toDateString()
      },
      {
        name: 'time',
        description: 'Current time',
        required: false,
        type: 'string',
        defaultValue: new Date().toTimeString()
      }
    ];

    const typeSpecificVariables: Record<string, TemplateVariable[]> = {
      email: [
        {
          name: 'unsubscribeUrl',
          description: 'URL for unsubscribing from emails',
          required: false,
          type: 'string'
        },
        {
          name: 'companyName',
          description: 'Company name for email footer',
          required: false,
          type: 'string',
          defaultValue: 'SaaS School Management Platform'
        }
      ],
      sms: [
        {
          name: 'shortUrl',
          description: 'Shortened URL for SMS links',
          required: false,
          type: 'string'
        }
      ],
      push: [
        {
          name: 'actionUrl',
          description: 'Deep link URL for push notification action',
          required: false,
          type: 'string'
        },
        {
          name: 'badge',
          description: 'Badge count for push notification',
          required: false,
          type: 'number',
          defaultValue: '1'
        }
      ],
      realtime: [
        {
          name: 'priority',
          description: 'Notification priority level',
          required: false,
          type: 'string',
          defaultValue: 'normal'
        }
      ]
    };

    return [...commonVariables, ...(typeSpecificVariables[type] || [])];
  }

  /**
   * Preview template with sample data
   */
  async previewTemplate(templateId: string): Promise<{
    subject?: string;
    content: string;
    sampleVariables: Record<string, any>;
  }> {
    const template = await this.getTemplate(templateId);
    
    // Generate sample data for all variables
    const sampleVariables: Record<string, any> = {};
    const availableVars = this.getAvailableVariables(template.type);
    
    availableVars.forEach(variable => {
      switch (variable.type) {
        case 'string':
          sampleVariables[variable.name] = variable.defaultValue || `Sample ${variable.name}`;
          break;
        case 'number':
          sampleVariables[variable.name] = variable.defaultValue || 123;
          break;
        case 'date':
          sampleVariables[variable.name] = variable.defaultValue || new Date().toDateString();
          break;
        case 'boolean':
          sampleVariables[variable.name] = variable.defaultValue || true;
          break;
      }
    });

    // Add template-specific sample data
    sampleVariables.name = 'John Doe';
    sampleVariables.firstName = 'John';
    sampleVariables.lastName = 'Doe';
    sampleVariables.email = 'john.doe@example.com';
    sampleVariables.school = 'Sample High School';

    const rendered = await this.renderTemplate(templateId, sampleVariables);
    
    return {
      subject: rendered.subject,
      content: rendered.content,
      sampleVariables
    };
  }

  /**
   * Get template statistics
   */
  async getTemplateStatistics(): Promise<{
    total: number;
    byType: Record<string, number>;
    active: number;
    inactive: number;
  }> {
    const templates = Array.from(this.templates.values());
    
    const stats = {
      total: templates.length,
      byType: {
        email: 0,
        sms: 0,
        push: 0,
        realtime: 0
      },
      active: 0,
      inactive: 0
    };

    templates.forEach(template => {
      stats.byType[template.type]++;
      if (template.isActive) {
        stats.active++;
      } else {
        stats.inactive++;
      }
    });

    return stats;
  }

  /**
   * Private helper methods
   */
  private extractVariables(content: string): string[] {
    const variableRegex = /{{\\s*([a-zA-Z_][a-zA-Z0-9_]*)\\s*}}/g;
    const variables: string[] = [];
    let match;

    while ((match = variableRegex.exec(content)) !== null) {
      const variable = match[1];
      if (!variables.includes(variable)) {
        variables.push(variable);
      }
    }

    return variables;
  }

  private initializeDefaultTemplates(): void {
    // Welcome email template
    this.createTemplate({
      name: 'welcome_email',
      description: 'Welcome email for new users',
      type: 'email',
      subject: 'Welcome to {{school}} - {{name}}!',
      content: `
        <h1>Welcome to {{school}}, {{firstName}}!</h1>
        <p>We're excited to have you join our school management platform.</p>
        <p>Your account has been successfully created with the email: {{email}}</p>
        <p>You can now access all the features available to your role.</p>
        <br>
        <p>Best regards,<br>{{companyName}} Team</p>
        <p><small><a href="{{unsubscribeUrl}}">Unsubscribe</a></small></p>
      `,
      isActive: true
    });

    // Schedule notification SMS
    this.createTemplate({
      name: 'schedule_reminder_sms',
      description: 'SMS reminder for upcoming classes',
      type: 'sms',
      content: 'Hi {{firstName}}! Reminder: You have a class at {{time}} in {{room}}. {{school}}',
      isActive: true
    });

    // Push notification for announcements
    this.createTemplate({
      name: 'announcement_push',
      description: 'Push notification for school announcements',
      type: 'push',
      content: '{{school}}: {{announcement}}',
      isActive: true
    });

    // Real-time notification for urgent messages
    this.createTemplate({
      name: 'urgent_realtime',
      description: 'Real-time notification for urgent messages',
      type: 'realtime',
      content: 'URGENT: {{message}} - {{school}}',
      isActive: true
    });

    this.logger.log('Initialized default notification templates');
  }
}
