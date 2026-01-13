import { Controller, Get, Post, Body, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody } from '@nestjs/swagger';
import { CurrencyConversionService, CurrencyConversionRequest, CurrencyConversionResult, CurrencyInfo, RegionalTaxInfo } from '../services/currency-conversion.service';
import { PaymentOrchestratorService } from '../services/payment-orchestrator.service';

/**
 * Currency conversion and multi-currency support controller
 * Provides endpoints for currency conversion, exchange rates, and regional tax information
 */

// ==================== DTOs ====================

export class ConvertCurrencyDto {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  tenantId?: string;
  useCache?: boolean;
}

export class CalculateTotalCostDto {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  region?: string;
}

export class CreatePaymentWithConversionDto {
  amount: number;
  currency: string;
  targetCurrency?: string;
  tenantRegion?: string;
  customerId: string;
  tenantId?: string;
  description?: string;
  metadata?: Record<string, any>;
}

// ==================== CONTROLLER ====================

@ApiTags('Currency & Multi-Currency Support')
@Controller('billing/currency')
export class CurrencyController {
  private readonly logger = new Logger(CurrencyController.name);

  constructor(
    private readonly currencyService: CurrencyConversionService,
    private readonly orchestratorService: PaymentOrchestratorService,
  ) {}

  // ==================== CURRENCY CONVERSION ENDPOINTS ====================

  @Post('convert')
  @ApiOperation({ 
    summary: 'Convert amount between currencies',
    description: 'Converts an amount from one currency to another using current exchange rates'
  })
  @ApiBody({
    type: ConvertCurrencyDto,
    description: 'Currency conversion request',
    examples: {
      'USD to EUR': {
        value: {
          amount: 10000,
          fromCurrency: 'USD',
          toCurrency: 'EUR',
          useCache: true
        }
      },
      'SAR to USD': {
        value: {
          amount: 37500,
          fromCurrency: 'SAR',
          toCurrency: 'USD',
          tenantId: 'tenant_123'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Currency conversion successful',
    schema: {
      type: 'object',
      properties: {
        originalAmount: { type: 'number', example: 10000 },
        convertedAmount: { type: 'number', example: 8500 },
        fromCurrency: { type: 'string', example: 'USD' },
        toCurrency: { type: 'string', example: 'EUR' },
        exchangeRate: { type: 'number', example: 0.85 },
        conversionFee: { type: 'number', example: 50 },
        totalAmount: { type: 'number', example: 8550 },
        timestamp: { type: 'string', format: 'date-time' },
        source: { type: 'string', example: 'fixer' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid conversion request' })
  async convertCurrency(@Body() request: ConvertCurrencyDto): Promise<CurrencyConversionResult> {
    this.logger.log(`Converting ${request.amount} ${request.fromCurrency} to ${request.toCurrency}`);
    
    return await this.currencyService.convertCurrency(request);
  }

  @Get('exchange-rate')
  @ApiOperation({ 
    summary: 'Get exchange rate between two currencies',
    description: 'Retrieves the current exchange rate between two currencies'
  })
  @ApiQuery({ name: 'from', description: 'Source currency code', example: 'USD' })
  @ApiQuery({ name: 'to', description: 'Target currency code', example: 'EUR' })
  @ApiQuery({ name: 'useCache', description: 'Use cached rate if available', required: false, example: true })
  @ApiResponse({ 
    status: 200, 
    description: 'Exchange rate retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        rate: { type: 'number', example: 0.85 },
        source: { type: 'string', example: 'fixer' },
        timestamp: { type: 'string', format: 'date-time' },
        validUntil: { type: 'string', format: 'date-time' }
      }
    }
  })
  async getExchangeRate(
    @Query('from') fromCurrency: string,
    @Query('to') toCurrency: string,
    @Query('useCache') useCache: boolean = true,
  ): Promise<{
    rate: number;
    source: string;
    timestamp: Date;
    validUntil: Date;
  }> {
    this.logger.log(`Getting exchange rate: ${fromCurrency} to ${toCurrency}`);
    
    return await this.orchestratorService.getExchangeRate(fromCurrency, toCurrency);
  }

  @Post('calculate-total-cost')
  @ApiOperation({ 
    summary: 'Calculate total cost with conversion and taxes',
    description: 'Calculates the total cost including currency conversion fees and regional taxes'
  })
  @ApiBody({
    type: CalculateTotalCostDto,
    description: 'Total cost calculation request',
    examples: {
      'USD to EUR with EU tax': {
        value: {
          amount: 10000,
          fromCurrency: 'USD',
          toCurrency: 'EUR',
          region: 'EU'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Total cost calculated successfully',
    schema: {
      type: 'object',
      properties: {
        originalAmount: { type: 'number', example: 10000 },
        convertedAmount: { type: 'number', example: 8500 },
        conversionFee: { type: 'number', example: 50 },
        taxAmount: { type: 'number', example: 1710 },
        totalAmount: { type: 'number', example: 10260 },
        breakdown: {
          type: 'object',
          properties: {
            baseAmount: { type: 'number', example: 8500 },
            conversionFee: { type: 'number', example: 50 },
            taxAmount: { type: 'number', example: 1710 },
            total: { type: 'number', example: 10260 }
          }
        },
        currency: { type: 'string', example: 'EUR' }
      }
    }
  })
  async calculateTotalCost(@Body() request: CalculateTotalCostDto): Promise<{
    originalAmount: number;
    convertedAmount: number;
    conversionFee: number;
    taxAmount: number;
    totalAmount: number;
    breakdown: {
      baseAmount: number;
      conversionFee: number;
      taxAmount: number;
      total: number;
    };
    currency: string;
  }> {
    this.logger.log(`Calculating total cost: ${request.amount} ${request.fromCurrency} to ${request.toCurrency} in ${request.region}`);
    
    return await this.orchestratorService.calculateTotalCost(
      request.amount,
      request.fromCurrency,
      request.toCurrency,
      request.region
    );
  }

  // ==================== PAYMENT WITH CONVERSION ENDPOINTS ====================

  @Post('create-payment-with-conversion')
  @ApiOperation({ 
    summary: 'Create payment intent with currency conversion',
    description: 'Creates a payment intent with automatic currency conversion and tax calculation'
  })
  @ApiBody({
    type: CreatePaymentWithConversionDto,
    description: 'Payment creation with conversion request',
    examples: {
      'USD payment converted to EUR': {
        value: {
          amount: 10000,
          currency: 'USD',
          targetCurrency: 'EUR',
          tenantRegion: 'EU',
          customerId: 'cus_123',
          description: 'Subscription payment with conversion'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Payment intent created successfully with conversion',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'pi_123' },
            amount: { type: 'number', example: 10260 },
            currency: { type: 'string', example: 'EUR' },
            status: { type: 'string', example: 'requires_payment_method' },
            clientSecret: { type: 'string', example: 'pi_123_secret' },
            conversionDetails: {
              type: 'object',
              properties: {
                originalAmount: { type: 'number', example: 10000 },
                convertedAmount: { type: 'number', example: 8500 },
                exchangeRate: { type: 'number', example: 0.85 },
                conversionFee: { type: 'number', example: 50 }
              }
            }
          }
        }
      }
    }
  })
  async createPaymentWithConversion(@Body() request: CreatePaymentWithConversionDto) {
    this.logger.log(`Creating payment with conversion: ${request.amount} ${request.currency} to ${request.targetCurrency}`);
    
    return await this.orchestratorService.createPaymentIntentWithConversion(request);
  }

  // ==================== CURRENCY INFORMATION ENDPOINTS ====================

  @Get('supported-currencies')
  @ApiOperation({ 
    summary: 'Get all supported currencies',
    description: 'Retrieves list of all supported currencies with gateway information'
  })
  @ApiQuery({ name: 'gateway', description: 'Filter by specific gateway', required: false, enum: ['STRIPE', 'PAYTABS', 'PAYMOB'] })
  @ApiResponse({ 
    status: 200, 
    description: 'Supported currencies retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code: { type: 'string', example: 'USD' },
          name: { type: 'string', example: 'US Dollar' },
          symbol: { type: 'string', example: '$' },
          decimalPlaces: { type: 'number', example: 2 },
          isSupported: { type: 'boolean', example: true },
          regions: { type: 'array', items: { type: 'string' }, example: ['US', 'Global'] },
          gatewaySupport: {
            type: 'object',
            properties: {
              stripe: { type: 'boolean', example: true },
              paytabs: { type: 'boolean', example: true },
              paymob: { type: 'boolean', example: false }
            }
          }
        }
      }
    }
  })
  async getSupportedCurrencies(@Query('gateway') gateway?: string): Promise<CurrencyInfo[] | string[]> {
    this.logger.log(`Getting supported currencies${gateway ? ` for ${gateway}` : ''}`);
    
    if (gateway) {
      return await this.orchestratorService.getSupportedCurrencies(gateway as any);
    }
    
    return this.currencyService.getSupportedCurrencies();
  }

  @Get('currency-info/:code')
  @ApiOperation({ 
    summary: 'Get currency information',
    description: 'Retrieves detailed information about a specific currency'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Currency information retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'USD' },
        name: { type: 'string', example: 'US Dollar' },
        symbol: { type: 'string', example: '$' },
        decimalPlaces: { type: 'number', example: 2 },
        isSupported: { type: 'boolean', example: true },
        regions: { type: 'array', items: { type: 'string' }, example: ['US', 'Global'] },
        gatewaySupport: {
          type: 'object',
          properties: {
            stripe: { type: 'boolean', example: true },
            paytabs: { type: 'boolean', example: true },
            paymob: { type: 'boolean', example: false }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Currency not found' })
  async getCurrencyInfo(@Query('code') currencyCode: string): Promise<CurrencyInfo | null> {
    this.logger.log(`Getting currency info for: ${currencyCode}`);
    
    return this.orchestratorService.getCurrencyInfo(currencyCode);
  }

  @Get('optimal-gateway')
  @ApiOperation({ 
    summary: 'Get optimal gateway for currency and region',
    description: 'Determines the best payment gateway for a specific currency and region'
  })
  @ApiQuery({ name: 'currency', description: 'Currency code', example: 'USD' })
  @ApiQuery({ name: 'region', description: 'Region code', required: false, example: 'US' })
  @ApiQuery({ name: 'amount', description: 'Payment amount for optimization', required: false, example: 10000 })
  @ApiResponse({ 
    status: 200, 
    description: 'Optimal gateway determined successfully',
    schema: {
      type: 'object',
      properties: {
        gateway: { type: 'string', example: 'STRIPE' },
        reasoning: { type: 'string', example: 'Best success rate for USD payments in US region' },
        alternatives: { type: 'array', items: { type: 'string' }, example: ['PAYTABS'] }
      }
    }
  })
  async getOptimalGateway(
    @Query('currency') currency: string,
    @Query('region') region?: string,
    @Query('amount') amount?: number,
  ): Promise<{
    gateway: string;
    reasoning: string;
    alternatives: string[];
  }> {
    this.logger.log(`Getting optimal gateway for: ${currency} in ${region}`);
    
    return await this.orchestratorService.getOptimalGatewayForCurrency(currency, region, amount);
  }

  // ==================== TAX INFORMATION ENDPOINTS ====================

  @Get('regional-tax-info')
  @ApiOperation({ 
    summary: 'Get regional tax information',
    description: 'Retrieves tax information for all supported regions'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Regional tax information retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          region: { type: 'string', example: 'US' },
          country: { type: 'string', example: 'United States' },
          taxRate: { type: 'number', example: 0.0 },
          taxName: { type: 'string', example: 'Sales Tax' },
          taxType: { type: 'string', example: 'SALES_TAX' },
          isRequired: { type: 'boolean', example: false },
          exemptionThreshold: { type: 'number', example: 10000 }
        }
      }
    }
  })
  async getRegionalTaxInfo(): Promise<RegionalTaxInfo[]> {
    this.logger.log('Getting regional tax information');
    
    return this.orchestratorService.getRegionalTaxInfo();
  }

  @Get('calculate-tax')
  @ApiOperation({ 
    summary: 'Calculate tax for amount and region',
    description: 'Calculates tax amount for a specific amount, currency, and region'
  })
  @ApiQuery({ name: 'amount', description: 'Amount to calculate tax for', example: 10000 })
  @ApiQuery({ name: 'currency', description: 'Currency code', example: 'USD' })
  @ApiQuery({ name: 'region', description: 'Region code', example: 'EU' })
  @ApiResponse({ 
    status: 200, 
    description: 'Tax calculated successfully',
    schema: {
      type: 'object',
      properties: {
        taxAmount: { type: 'number', example: 2000 },
        taxRate: { type: 'number', example: 0.20 },
        taxName: { type: 'string', example: 'VAT' },
        isRequired: { type: 'boolean', example: true },
        exemptionApplied: { type: 'boolean', example: false }
      }
    }
  })
  async calculateTax(
    @Query('amount') amount: number,
    @Query('currency') currency: string,
    @Query('region') region: string,
  ): Promise<{
    taxAmount: number;
    taxRate: number;
    taxName: string;
    isRequired: boolean;
    exemptionApplied: boolean;
  }> {
    this.logger.log(`Calculating tax: ${amount} ${currency} in ${region}`);
    
    return this.currencyService.calculateTax(amount, currency, region);
  }

  // ==================== UTILITY ENDPOINTS ====================

  @Post('format-amount')
  @ApiOperation({ 
    summary: 'Format amount according to currency rules',
    description: 'Formats an amount according to the specified currency formatting rules'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        amount: { type: 'number', example: 10000 },
        currency: { type: 'string', example: 'USD' }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Amount formatted successfully',
    schema: {
      type: 'object',
      properties: {
        formattedAmount: { type: 'string', example: '$100.00' }
      }
    }
  })
  async formatAmount(@Body() request: { amount: number; currency: string }): Promise<{ formattedAmount: string }> {
    this.logger.log(`Formatting amount: ${request.amount} ${request.currency}`);
    
    const formattedAmount = this.orchestratorService.formatAmount(request.amount, request.currency);
    
    return { formattedAmount };
  }

  @Post('clear-cache')
  @ApiOperation({ 
    summary: 'Clear currency conversion cache',
    description: 'Clears the currency conversion cache to force fresh exchange rate fetching'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Cache cleared successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Currency conversion cache cleared' }
      }
    }
  })
  async clearCache(): Promise<{ success: boolean; message: string }> {
    this.logger.log('Clearing currency conversion cache');
    
    this.orchestratorService.clearCurrencyCache();
    
    return {
      success: true,
      message: 'Currency conversion cache cleared',
    };
  }

  @Get('cache-stats')
  @ApiOperation({ 
    summary: 'Get currency conversion cache statistics',
    description: 'Retrieves statistics about the currency conversion cache'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Cache statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        size: { type: 'number', example: 5 },
        entries: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string', example: 'USD/EUR' },
              rate: { type: 'number', example: 0.85 },
              validUntil: { type: 'string', format: 'date-time' },
              source: { type: 'string', example: 'fixer' }
            }
          }
        }
      }
    }
  })
  async getCacheStats(): Promise<{
    size: number;
    entries: Array<{ key: string; rate: number; validUntil: Date; source: string }>;
  }> {
    this.logger.log('Getting currency conversion cache statistics');
    
    return this.orchestratorService.getCurrencyCacheStats();
  }
}
