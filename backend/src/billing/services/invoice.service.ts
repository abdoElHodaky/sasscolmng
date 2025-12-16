import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BillingService, BillingCycle, BillingPlan } from './billing.service';
import { StripeService } from './stripe.service';

export interface Invoice {
  id: string;
  tenantId: string;
  invoiceNumber: string;
  billingCycleId: string;
  issueDate: Date;
  dueDate: Date;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  lineItems: InvoiceLineItem[];
  paymentDetails?: {
    method: string;
    transactionId: string;
    paidAt: Date;
  };
  metadata?: Record<string, any>;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  period?: {
    start: Date;
    end: Date;
  };
}

export interface InvoiceTemplate {
  companyName: string;
  companyAddress: string;
  companyEmail: string;
  companyPhone: string;
  logoUrl?: string;
  footerText: string;
  taxRate: number; // percentage
}

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  private readonly defaultTemplate: InvoiceTemplate = {
    companyName: 'SaaS School Management Platform',
    companyAddress: '123 Education Street, Learning City, LC 12345',
    companyEmail: 'billing@sasscolmng.com',
    companyPhone: '+1 (555) 123-4567',
    footerText: 'Thank you for choosing our school management platform!',
    taxRate: 8.5 // 8.5% tax rate
  };

  constructor(
    private billingService: BillingService,
    private stripeService: StripeService,
  ) {}

  /**
   * Generate invoice from billing cycle
   */
  async generateInvoice(
    tenantId: string,
    billingCycleId: string,
    template?: Partial<InvoiceTemplate>
  ): Promise<Invoice> {
    try {
      // Get billing cycle data
      const billingCycle = await this.getBillingCycleById(billingCycleId);
      const plan = await this.billingService.getPlan(billingCycle.planId);
      
      // Calculate billing details
      const billing = await this.billingService.calculateBillingAmount(
        tenantId,
        billingCycle.planId,
        billingCycle.startDate,
        billingCycle.endDate
      );

      // Generate invoice number
      const invoiceNumber = this.generateInvoiceNumber();
      
      // Create line items from billing breakdown
      const lineItems: InvoiceLineItem[] = billing.breakdown.map((item, index) => ({
        id: `line_${index + 1}`,
        description: `${item.item} - ${item.description}`,
        quantity: 1,
        unitPrice: item.amount,
        totalPrice: item.amount,
        period: {
          start: billingCycle.startDate,
          end: billingCycle.endDate
        }
      }));

      // Calculate tax
      const usedTemplate = { ...this.defaultTemplate, ...template };
      const subtotal = billing.totalAmount;
      const taxAmount = Math.round((subtotal * usedTemplate.taxRate / 100) * 100) / 100;
      const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

      // Create invoice
      const invoice: Invoice = {
        id: `inv_${Date.now()}_${tenantId}`,
        tenantId,
        invoiceNumber,
        billingCycleId,
        issueDate: new Date(),
        dueDate: this.calculateDueDate(new Date()),
        status: 'draft',
        subtotal,
        taxAmount,
        totalAmount,
        currency: billing.currency,
        lineItems,
        metadata: {
          planName: plan.name,
          billingPeriod: `${billingCycle.startDate.toDateString()} - ${billingCycle.endDate.toDateString()}`,
          usage: billingCycle.usage
        }
      };

      this.logger.log(`Generated invoice ${invoice.invoiceNumber} for tenant ${tenantId}`);
      
      return invoice;
    } catch (error) {
      this.logger.error(`Failed to generate invoice for billing cycle ${billingCycleId}`, error);
      throw error;
    }
  }

  /**
   * Get invoice by ID
   */
  async getInvoice(invoiceId: string): Promise<Invoice> {
    // In a real implementation, this would query the database
    // For now, simulate invoice retrieval
    const invoice: Invoice = {
      id: invoiceId,
      tenantId: 'tenant_demo',
      invoiceNumber: 'INV-2024-001',
      billingCycleId: 'cycle_demo',
      issueDate: new Date(),
      dueDate: this.calculateDueDate(new Date()),
      status: 'sent',
      subtotal: 79.99,
      taxAmount: 6.80,
      totalAmount: 86.79,
      currency: 'USD',
      lineItems: [
        {
          id: 'line_1',
          description: 'Professional Plan - Monthly subscription',
          quantity: 1,
          unitPrice: 79.99,
          totalPrice: 79.99,
          period: {
            start: new Date(),
            end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          }
        }
      ],
      metadata: {
        planName: 'Professional',
        billingPeriod: 'December 2024'
      }
    };

    return invoice;
  }

  /**
   * Get invoices for a tenant
   */
  async getInvoicesForTenant(
    tenantId: string,
    options: {
      status?: Invoice['status'];
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{
    invoices: Invoice[];
    total: number;
    hasMore: boolean;
  }> {
    const { status, limit = 10, offset = 0 } = options;

    // In a real implementation, this would query the database
    // For now, generate sample invoices
    const allInvoices: Invoice[] = [];
    
    for (let i = 0; i < 5; i++) {
      const issueDate = new Date();
      issueDate.setMonth(issueDate.getMonth() - i);
      
      const invoice: Invoice = {
        id: `inv_${Date.now() - i * 1000}_${tenantId}`,
        tenantId,
        invoiceNumber: `INV-2024-${String(5 - i).padStart(3, '0')}`,
        billingCycleId: `cycle_${Date.now() - i * 1000}`,
        issueDate,
        dueDate: this.calculateDueDate(issueDate),
        status: i === 0 ? 'sent' : i === 1 ? 'paid' : 'paid',
        subtotal: 79.99,
        taxAmount: 6.80,
        totalAmount: 86.79,
        currency: 'USD',
        lineItems: [
          {
            id: 'line_1',
            description: 'Professional Plan - Monthly subscription',
            quantity: 1,
            unitPrice: 79.99,
            totalPrice: 79.99,
            period: {
              start: issueDate,
              end: new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000)
            }
          }
        ],
        paymentDetails: i > 0 ? {
          method: 'Stripe',
          transactionId: `txn_${Date.now() - i * 1000}`,
          paidAt: new Date(issueDate.getTime() + 5 * 24 * 60 * 60 * 1000)
        } : undefined
      };

      allInvoices.push(invoice);
    }

    // Filter by status if provided
    const filteredInvoices = status 
      ? allInvoices.filter(inv => inv.status === status)
      : allInvoices;

    // Apply pagination
    const paginatedInvoices = filteredInvoices.slice(offset, offset + limit);

    return {
      invoices: paginatedInvoices,
      total: filteredInvoices.length,
      hasMore: offset + limit < filteredInvoices.length
    };
  }

  /**
   * Generate PDF invoice
   */
  async generateInvoicePDF(
    invoiceId: string,
    template?: Partial<InvoiceTemplate>
  ): Promise<{
    pdfBuffer: Buffer;
    filename: string;
  }> {
    const invoice = await this.getInvoice(invoiceId);
    const usedTemplate = { ...this.defaultTemplate, ...template };

    // In a real implementation, this would use a PDF library like puppeteer or pdfkit
    // For now, generate a simple HTML representation that could be converted to PDF
    const htmlContent = this.generateInvoiceHTML(invoice, usedTemplate);
    
    // Simulate PDF generation
    const pdfBuffer = Buffer.from(htmlContent, 'utf-8');
    const filename = `invoice-${invoice.invoiceNumber}.pdf`;

    this.logger.log(`Generated PDF for invoice ${invoice.invoiceNumber}`);

    return {
      pdfBuffer,
      filename
    };
  }

  /**
   * Send invoice via email
   */
  async sendInvoiceEmail(
    invoiceId: string,
    recipientEmail: string,
    template?: Partial<InvoiceTemplate>
  ): Promise<{
    success: boolean;
    message: string;
    emailId?: string;
  }> {
    try {
      const invoice = await this.getInvoice(invoiceId);
      const { pdfBuffer, filename } = await this.generateInvoicePDF(invoiceId, template);

      // In a real implementation, this would integrate with the email service
      // For now, simulate email sending
      const emailId = `email_${Date.now()}`;
      
      this.logger.log(`Sent invoice ${invoice.invoiceNumber} to ${recipientEmail}`);

      // Update invoice status
      invoice.status = 'sent';

      return {
        success: true,
        message: `Invoice ${invoice.invoiceNumber} sent successfully`,
        emailId
      };
    } catch (error) {
      this.logger.error(`Failed to send invoice ${invoiceId}`, error);
      return {
        success: false,
        message: `Failed to send invoice: ${error.message}`
      };
    }
  }

  /**
   * Mark invoice as paid
   */
  async markInvoiceAsPaid(
    invoiceId: string,
    paymentDetails: {
      method: string;
      transactionId: string;
      paidAt?: Date;
    }
  ): Promise<Invoice> {
    const invoice = await this.getInvoice(invoiceId);
    
    invoice.status = 'paid';
    invoice.paymentDetails = {
      ...paymentDetails,
      paidAt: paymentDetails.paidAt || new Date()
    };

    this.logger.log(`Marked invoice ${invoice.invoiceNumber} as paid`);
    
    return invoice;
  }

  /**
   * Get invoice statistics for a tenant
   */
  async getInvoiceStatistics(tenantId: string): Promise<{
    totalInvoices: number;
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
    overdueAmount: number;
    currency: string;
    statusBreakdown: Record<Invoice['status'], number>;
  }> {
    const { invoices } = await this.getInvoicesForTenant(tenantId, { limit: 100 });

    const stats = {
      totalInvoices: invoices.length,
      totalAmount: 0,
      paidAmount: 0,
      pendingAmount: 0,
      overdueAmount: 0,
      currency: 'USD',
      statusBreakdown: {
        draft: 0,
        sent: 0,
        paid: 0,
        overdue: 0,
        cancelled: 0
      } as Record<Invoice['status'], number>
    };

    invoices.forEach(invoice => {
      stats.totalAmount += invoice.totalAmount;
      stats.statusBreakdown[invoice.status]++;

      if (invoice.status === 'paid') {
        stats.paidAmount += invoice.totalAmount;
      } else if (invoice.status === 'overdue') {
        stats.overdueAmount += invoice.totalAmount;
      } else if (invoice.status === 'sent') {
        // Check if overdue
        if (new Date() > invoice.dueDate) {
          stats.overdueAmount += invoice.totalAmount;
        } else {
          stats.pendingAmount += invoice.totalAmount;
        }
      }
    });

    // Round amounts
    stats.totalAmount = Math.round(stats.totalAmount * 100) / 100;
    stats.paidAmount = Math.round(stats.paidAmount * 100) / 100;
    stats.pendingAmount = Math.round(stats.pendingAmount * 100) / 100;
    stats.overdueAmount = Math.round(stats.overdueAmount * 100) / 100;

    return stats;
  }

  /**
   * Private helper methods
   */
  private generateInvoiceNumber(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const timestamp = now.getTime().toString().slice(-6);
    
    return `INV-${year}${month}-${timestamp}`;
  }

  private calculateDueDate(issueDate: Date, daysToAdd = 30): Date {
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + daysToAdd);
    return dueDate;
  }

  private async getBillingCycleById(billingCycleId: string): Promise<BillingCycle> {
    // In a real implementation, this would query the database
    // For now, create a mock billing cycle
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return {
      id: billingCycleId,
      tenantId: 'tenant_demo',
      planId: 'professional',
      startDate,
      endDate,
      status: 'active',
      usage: {
        tenantId: 'tenant_demo',
        schools: 2,
        users: 45,
        students: 350,
        apiCalls: 2500,
        storage: 8,
        lastUpdated: new Date()
      },
      amount: 79.99,
      currency: 'USD'
    };
  }

  private generateInvoiceHTML(invoice: Invoice, template: InvoiceTemplate): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Invoice ${invoice.invoiceNumber}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
        .company-info { float: left; }
        .invoice-info { float: right; text-align: right; }
        .clear { clear: both; }
        .line-items { margin: 30px 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        .total-section { margin-top: 30px; text-align: right; }
        .footer { margin-top: 50px; text-align: center; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <div class="company-info">
            <h1>${template.companyName}</h1>
            <p>${template.companyAddress}</p>
            <p>Email: ${template.companyEmail}</p>
            <p>Phone: ${template.companyPhone}</p>
        </div>
        <div class="invoice-info">
            <h2>INVOICE</h2>
            <p><strong>Invoice #:</strong> ${invoice.invoiceNumber}</p>
            <p><strong>Issue Date:</strong> ${invoice.issueDate.toDateString()}</p>
            <p><strong>Due Date:</strong> ${invoice.dueDate.toDateString()}</p>
            <p><strong>Status:</strong> ${invoice.status.toUpperCase()}</p>
        </div>
        <div class="clear"></div>
    </div>

    <div class="line-items">
        <table>
            <thead>
                <tr>
                    <th>Description</th>
                    <th>Period</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                ${invoice.lineItems.map(item => `
                    <tr>
                        <td>${item.description}</td>
                        <td>${item.period ? `${item.period.start.toDateString()} - ${item.period.end.toDateString()}` : '-'}</td>
                        <td>${item.quantity}</td>
                        <td>${invoice.currency} ${item.unitPrice.toFixed(2)}</td>
                        <td>${invoice.currency} ${item.totalPrice.toFixed(2)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="total-section">
        <p><strong>Subtotal: ${invoice.currency} ${invoice.subtotal.toFixed(2)}</strong></p>
        <p><strong>Tax (${template.taxRate}%): ${invoice.currency} ${invoice.taxAmount.toFixed(2)}</strong></p>
        <h3><strong>Total: ${invoice.currency} ${invoice.totalAmount.toFixed(2)}</strong></h3>
    </div>

    ${invoice.paymentDetails ? `
        <div class="payment-info">
            <h3>Payment Information</h3>
            <p><strong>Payment Method:</strong> ${invoice.paymentDetails.method}</p>
            <p><strong>Transaction ID:</strong> ${invoice.paymentDetails.transactionId}</p>
            <p><strong>Paid Date:</strong> ${invoice.paymentDetails.paidAt.toDateString()}</p>
        </div>
    ` : ''}

    <div class="footer">
        <p>${template.footerText}</p>
    </div>
</body>
</html>
    `;
  }
}
