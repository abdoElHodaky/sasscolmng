import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Currency conversion and exchange rate management service
 * Handles multi-currency support for the payment gateway system
 */

// ==================== INTERFACES ====================

export interface ExchangeRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  timestamp: Date;
  source: string; // 'api', 'manual', 'cached'
  validUntil: Date;
}

export interface CurrencyConversionRequest {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  tenantId?: string;
  useCache?: boolean;
}

export interface CurrencyConversionResult {
  originalAmount: number;
  convertedAmount: number;
  fromCurrency: string;
  toCurrency: string;
  exchangeRate: number;
  conversionFee: number;
  totalAmount: number;
  timestamp: Date;
  source: string;
}

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  isSupported: boolean;
  regions: string[];
  gatewaySupport: {
    stripe: boolean;
    paytabs: boolean;
    paymob: boolean;
  };
}

export interface RegionalTaxInfo {
  region: string;
  country: string;
  taxRate: number;
  taxName: string;
  taxType: 'VAT' | 'GST' | 'SALES_TAX' | 'NONE';
  isRequired: boolean;
  exemptionThreshold?: number;
}

export interface CurrencyConversionConfig {
  provider: 'fixer' | 'exchangerate' | 'openexchange' | 'manual';
  apiKey?: string;
  baseUrl?: string;
  cacheDuration: number; // minutes
  fallbackRates: Record<string, number>;
  conversionFeePercentage: number;
  minimumConversionFee: number;
  maximumConversionFee: number;
}

// ==================== SERVICE IMPLEMENTATION ====================

@Injectable()
export class CurrencyConversionService {
  private readonly logger = new Logger(CurrencyConversionService.name);
  private exchangeRateCache = new Map<string, ExchangeRate>();
  private readonly config: CurrencyConversionConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = {
      provider: this.configService.get<string>('CURRENCY_PROVIDER', 'manual') as any,
      apiKey: this.configService.get<string>('CURRENCY_API_KEY'),
      baseUrl: this.configService.get<string>('CURRENCY_API_URL'),
      cacheDuration: this.configService.get<number>('CURRENCY_CACHE_DURATION', 60), // 1 hour
      conversionFeePercentage: this.configService.get<number>('CURRENCY_CONVERSION_FEE', 0.5), // 0.5%
      minimumConversionFee: this.configService.get<number>('CURRENCY_MIN_FEE', 10), // $0.10
      maximumConversionFee: this.configService.get<number>('CURRENCY_MAX_FEE', 1000), // $10.00
      fallbackRates: {
        'USD/EUR': 0.85,
        'USD/GBP': 0.75,
        'USD/SAR': 3.75,
        'USD/AED': 3.67,
        'USD/EGP': 30.85,
        'EUR/USD': 1.18,
        'GBP/USD': 1.33,
        'SAR/USD': 0.27,
        'AED/USD': 0.27,
        'EGP/USD': 0.032,
      },
    };

    this.logger.log(`Currency conversion service initialized with provider: ${this.config.provider}`);
  }

  // ==================== PUBLIC METHODS ====================

  /**
   * Convert amount from one currency to another
   */
  async convertCurrency(request: CurrencyConversionRequest): Promise<CurrencyConversionResult> {
    const { amount, fromCurrency, toCurrency, useCache = true } = request;

    this.logger.log(`Converting ${amount} ${fromCurrency} to ${toCurrency}`);

    // If same currency, return as-is
    if (fromCurrency === toCurrency) {
      return {
        originalAmount: amount,
        convertedAmount: amount,
        fromCurrency,
        toCurrency,
        exchangeRate: 1.0,
        conversionFee: 0,
        totalAmount: amount,
        timestamp: new Date(),
        source: 'same_currency',
      };
    }

    try {
      // Get exchange rate
      const exchangeRate = await this.getExchangeRate(fromCurrency, toCurrency, useCache);
      
      // Calculate converted amount
      const convertedAmount = Math.round(amount * exchangeRate.rate);
      
      // Calculate conversion fee
      const conversionFee = this.calculateConversionFee(convertedAmount);
      
      // Total amount including fee
      const totalAmount = convertedAmount + conversionFee;

      const result: CurrencyConversionResult = {
        originalAmount: amount,
        convertedAmount,
        fromCurrency,
        toCurrency,
        exchangeRate: exchangeRate.rate,
        conversionFee,
        totalAmount,
        timestamp: new Date(),
        source: exchangeRate.source,
      };

      this.logger.log(`Conversion result: ${amount} ${fromCurrency} = ${totalAmount} ${toCurrency} (rate: ${exchangeRate.rate}, fee: ${conversionFee})`);
      
      return result;
    } catch (error) {
      this.logger.error(`Currency conversion failed:`, error);
      throw new Error(`Failed to convert ${fromCurrency} to ${toCurrency}: ${error.message}`);
    }
  }

  /**
   * Get exchange rate between two currencies
   */
  async getExchangeRate(fromCurrency: string, toCurrency: string, useCache: boolean = true): Promise<ExchangeRate> {
    const cacheKey = `${fromCurrency}/${toCurrency}`;
    
    // Check cache first
    if (useCache && this.exchangeRateCache.has(cacheKey)) {
      const cachedRate = this.exchangeRateCache.get(cacheKey)!;
      if (cachedRate.validUntil > new Date()) {
        this.logger.log(`Using cached exchange rate for ${cacheKey}: ${cachedRate.rate}`);
        return cachedRate;
      }
    }

    try {
      // Fetch fresh rate
      const rate = await this.fetchExchangeRate(fromCurrency, toCurrency);
      
      // Cache the rate
      if (useCache) {
        const validUntil = new Date();
        validUntil.setMinutes(validUntil.getMinutes() + this.config.cacheDuration);
        
        const exchangeRate: ExchangeRate = {
          fromCurrency,
          toCurrency,
          rate,
          timestamp: new Date(),
          source: this.config.provider,
          validUntil,
        };
        
        this.exchangeRateCache.set(cacheKey, exchangeRate);
        this.logger.log(`Cached exchange rate for ${cacheKey}: ${rate} (valid until ${validUntil})`);
        
        return exchangeRate;
      }

      return {
        fromCurrency,
        toCurrency,
        rate,
        timestamp: new Date(),
        source: this.config.provider,
        validUntil: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to fetch exchange rate for ${cacheKey}:`, error);
      
      // Try fallback rate
      const fallbackRate = this.getFallbackRate(fromCurrency, toCurrency);
      if (fallbackRate) {
        this.logger.warn(`Using fallback rate for ${cacheKey}: ${fallbackRate}`);
        return {
          fromCurrency,
          toCurrency,
          rate: fallbackRate,
          timestamp: new Date(),
          source: 'fallback',
          validUntil: new Date(),
        };
      }
      
      throw new Error(`No exchange rate available for ${fromCurrency} to ${toCurrency}`);
    }
  }

  /**
   * Get supported currencies with gateway information
   */
  getSupportedCurrencies(): CurrencyInfo[] {
    return [
      // Major Global Currencies
      {
        code: 'USD',
        name: 'US Dollar',
        symbol: '$',
        decimalPlaces: 2,
        isSupported: true,
        regions: ['US', 'Global'],
        gatewaySupport: { stripe: true, paytabs: true, paymob: true },
      },
      {
        code: 'EUR',
        name: 'Euro',
        symbol: '€',
        decimalPlaces: 2,
        isSupported: true,
        regions: ['EU', 'Global'],
        gatewaySupport: { stripe: true, paytabs: true, paymob: true },
      },
      {
        code: 'GBP',
        name: 'British Pound',
        symbol: '£',
        decimalPlaces: 2,
        isSupported: true,
        regions: ['GB', 'Global'],
        gatewaySupport: { stripe: true, paytabs: true, paymob: false },
      },
      // Middle East Currencies
      {
        code: 'SAR',
        name: 'Saudi Riyal',
        symbol: 'ر.س',
        decimalPlaces: 2,
        isSupported: true,
        regions: ['SA', 'MENA'],
        gatewaySupport: { stripe: true, paytabs: true, paymob: false },
      },
      {
        code: 'AED',
        name: 'UAE Dirham',
        symbol: 'د.إ',
        decimalPlaces: 2,
        isSupported: true,
        regions: ['AE', 'MENA'],
        gatewaySupport: { stripe: true, paytabs: true, paymob: false },
      },
      {
        code: 'KWD',
        name: 'Kuwaiti Dinar',
        symbol: 'د.ك',
        decimalPlaces: 3,
        isSupported: true,
        regions: ['KW', 'MENA'],
        gatewaySupport: { stripe: true, paytabs: true, paymob: false },
      },
      {
        code: 'QAR',
        name: 'Qatari Riyal',
        symbol: 'ر.ق',
        decimalPlaces: 2,
        isSupported: true,
        regions: ['QA', 'MENA'],
        gatewaySupport: { stripe: true, paytabs: true, paymob: false },
      },
      {
        code: 'BHD',
        name: 'Bahraini Dinar',
        symbol: '.د.ب',
        decimalPlaces: 3,
        isSupported: true,
        regions: ['BH', 'MENA'],
        gatewaySupport: { stripe: true, paytabs: true, paymob: false },
      },
      // Egypt & MENA
      {
        code: 'EGP',
        name: 'Egyptian Pound',
        symbol: 'ج.م',
        decimalPlaces: 2,
        isSupported: true,
        regions: ['EG', 'MENA'],
        gatewaySupport: { stripe: true, paytabs: false, paymob: true },
      },
      // Other Major Currencies
      {
        code: 'CAD',
        name: 'Canadian Dollar',
        symbol: 'C$',
        decimalPlaces: 2,
        isSupported: true,
        regions: ['CA', 'Global'],
        gatewaySupport: { stripe: true, paytabs: false, paymob: false },
      },
      {
        code: 'AUD',
        name: 'Australian Dollar',
        symbol: 'A$',
        decimalPlaces: 2,
        isSupported: true,
        regions: ['AU', 'Global'],
        gatewaySupport: { stripe: true, paytabs: false, paymob: false },
      },
      {
        code: 'JPY',
        name: 'Japanese Yen',
        symbol: '¥',
        decimalPlaces: 0,
        isSupported: true,
        regions: ['JP', 'Global'],
        gatewaySupport: { stripe: true, paytabs: false, paymob: false },
      },
    ];
  }

  /**
   * Get regional tax information
   */
  getRegionalTaxInfo(): RegionalTaxInfo[] {
    return [
      // United States
      {
        region: 'US',
        country: 'United States',
        taxRate: 0.0, // Varies by state, handled separately
        taxName: 'Sales Tax',
        taxType: 'SALES_TAX',
        isRequired: false, // Depends on nexus
      },
      // European Union
      {
        region: 'EU',
        country: 'European Union',
        taxRate: 0.20, // Average VAT rate
        taxName: 'VAT',
        taxType: 'VAT',
        isRequired: true,
        exemptionThreshold: 10000, // €100.00
      },
      // United Kingdom
      {
        region: 'GB',
        country: 'United Kingdom',
        taxRate: 0.20,
        taxName: 'VAT',
        taxType: 'VAT',
        isRequired: true,
        exemptionThreshold: 8500, // £85.00
      },
      // Saudi Arabia
      {
        region: 'SA',
        country: 'Saudi Arabia',
        taxRate: 0.15,
        taxName: 'VAT',
        taxType: 'VAT',
        isRequired: true,
        exemptionThreshold: 37500, // 375 SAR
      },
      // UAE
      {
        region: 'AE',
        country: 'United Arab Emirates',
        taxRate: 0.05,
        taxName: 'VAT',
        taxType: 'VAT',
        isRequired: true,
        exemptionThreshold: 18350, // 183.50 AED
      },
      // Egypt
      {
        region: 'EG',
        country: 'Egypt',
        taxRate: 0.14,
        taxName: 'VAT',
        taxType: 'VAT',
        isRequired: true,
        exemptionThreshold: 500000, // 5000 EGP
      },
      // Canada
      {
        region: 'CA',
        country: 'Canada',
        taxRate: 0.13, // Average HST/GST+PST
        taxName: 'HST/GST',
        taxType: 'GST',
        isRequired: true,
        exemptionThreshold: 3000, // CAD 30.00
      },
      // Australia
      {
        region: 'AU',
        country: 'Australia',
        taxRate: 0.10,
        taxName: 'GST',
        taxType: 'GST',
        isRequired: true,
        exemptionThreshold: 7500, // AUD 75.00
      },
    ];
  }

  /**
   * Calculate tax for a given amount and region
   */
  calculateTax(amount: number, currency: string, region: string): {
    taxAmount: number;
    taxRate: number;
    taxName: string;
    isRequired: boolean;
    exemptionApplied: boolean;
  } {
    const taxInfo = this.getRegionalTaxInfo().find(info => info.region === region);
    
    if (!taxInfo || !taxInfo.isRequired) {
      return {
        taxAmount: 0,
        taxRate: 0,
        taxName: 'None',
        isRequired: false,
        exemptionApplied: false,
      };
    }

    // Check exemption threshold
    const exemptionApplied = taxInfo.exemptionThreshold && amount < taxInfo.exemptionThreshold;
    
    if (exemptionApplied) {
      return {
        taxAmount: 0,
        taxRate: taxInfo.taxRate,
        taxName: taxInfo.taxName,
        isRequired: true,
        exemptionApplied: true,
      };
    }

    const taxAmount = Math.round(amount * taxInfo.taxRate);

    return {
      taxAmount,
      taxRate: taxInfo.taxRate,
      taxName: taxInfo.taxName,
      isRequired: true,
      exemptionApplied: false,
    };
  }

  /**
   * Get currency information by code
   */
  getCurrencyInfo(currencyCode: string): CurrencyInfo | null {
    return this.getSupportedCurrencies().find(currency => currency.code === currencyCode) || null;
  }

  /**
   * Format amount according to currency rules
   */
  formatAmount(amount: number, currencyCode: string): string {
    const currencyInfo = this.getCurrencyInfo(currencyCode);
    if (!currencyInfo) {
      return `${amount / 100} ${currencyCode}`;
    }

    const divisor = Math.pow(10, currencyInfo.decimalPlaces);
    const formattedAmount = (amount / divisor).toFixed(currencyInfo.decimalPlaces);
    
    return `${currencyInfo.symbol}${formattedAmount}`;
  }

  /**
   * Clear exchange rate cache
   */
  clearCache(): void {
    this.exchangeRateCache.clear();
    this.logger.log('Exchange rate cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    entries: Array<{ key: string; rate: number; validUntil: Date; source: string }>;
  } {
    const entries = Array.from(this.exchangeRateCache.entries()).map(([key, rate]) => ({
      key,
      rate: rate.rate,
      validUntil: rate.validUntil,
      source: rate.source,
    }));

    return {
      size: this.exchangeRateCache.size,
      entries,
    };
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Fetch exchange rate from external API or fallback
   */
  private async fetchExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
    switch (this.config.provider) {
      case 'fixer':
        return await this.fetchFromFixerAPI(fromCurrency, toCurrency);
      case 'exchangerate':
        return await this.fetchFromExchangeRateAPI(fromCurrency, toCurrency);
      case 'openexchange':
        return await this.fetchFromOpenExchangeAPI(fromCurrency, toCurrency);
      case 'manual':
      default:
        return this.getFallbackRate(fromCurrency, toCurrency) || 1.0;
    }
  }

  /**
   * Fetch from Fixer.io API
   */
  private async fetchFromFixerAPI(fromCurrency: string, toCurrency: string): Promise<number> {
    // TODO: Implement actual API call when API key is configured
    this.logger.log(`[SIMULATED] Fetching ${fromCurrency}/${toCurrency} from Fixer.io`);
    
    // Simulate API response
    const fallbackRate = this.getFallbackRate(fromCurrency, toCurrency);
    if (fallbackRate) {
      // Add some realistic variation (±2%)
      const variation = (Math.random() - 0.5) * 0.04;
      return fallbackRate * (1 + variation);
    }
    
    throw new Error('No rate available from Fixer.io');
  }

  /**
   * Fetch from ExchangeRate-API
   */
  private async fetchFromExchangeRateAPI(fromCurrency: string, toCurrency: string): Promise<number> {
    // TODO: Implement actual API call
    this.logger.log(`[SIMULATED] Fetching ${fromCurrency}/${toCurrency} from ExchangeRate-API`);
    
    const fallbackRate = this.getFallbackRate(fromCurrency, toCurrency);
    if (fallbackRate) {
      const variation = (Math.random() - 0.5) * 0.03;
      return fallbackRate * (1 + variation);
    }
    
    throw new Error('No rate available from ExchangeRate-API');
  }

  /**
   * Fetch from Open Exchange Rates API
   */
  private async fetchFromOpenExchangeAPI(fromCurrency: string, toCurrency: string): Promise<number> {
    // TODO: Implement actual API call
    this.logger.log(`[SIMULATED] Fetching ${fromCurrency}/${toCurrency} from Open Exchange Rates`);
    
    const fallbackRate = this.getFallbackRate(fromCurrency, toCurrency);
    if (fallbackRate) {
      const variation = (Math.random() - 0.5) * 0.025;
      return fallbackRate * (1 + variation);
    }
    
    throw new Error('No rate available from Open Exchange Rates');
  }

  /**
   * Get fallback exchange rate
   */
  private getFallbackRate(fromCurrency: string, toCurrency: string): number | null {
    const key = `${fromCurrency}/${toCurrency}`;
    const reverseKey = `${toCurrency}/${fromCurrency}`;
    
    if (this.config.fallbackRates[key]) {
      return this.config.fallbackRates[key];
    }
    
    if (this.config.fallbackRates[reverseKey]) {
      return 1 / this.config.fallbackRates[reverseKey];
    }
    
    return null;
  }

  /**
   * Calculate conversion fee
   */
  private calculateConversionFee(amount: number): number {
    const feeAmount = Math.round(amount * (this.config.conversionFeePercentage / 100));
    
    // Apply minimum and maximum fee limits
    return Math.max(
      this.config.minimumConversionFee,
      Math.min(feeAmount, this.config.maximumConversionFee)
    );
  }
}
