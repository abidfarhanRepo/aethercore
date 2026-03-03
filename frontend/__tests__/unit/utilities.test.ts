import { describe, it, expect } from '@jest/globals';

/**
 * Utilities Unit Tests
 * Currency formatting, tax calculations, email validation, date parsing
 */
describe('Utility Functions - Unit Tests', () => {
  // Utility Functions
  const formatCurrency = (amount: number, currency = 'USD'): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const calculateTax = (subtotal: number, taxRate: number): number => {
    return Math.round(subtotal * taxRate * 100) / 100;
  };

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const parseDate = (dateString: string, format = 'YYYY-MM-DD'): Date | null => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return null;
      return date;
    } catch {
      return null;
    }
  };

  describe('formatCurrency', () => {
    it('should format numbers as USD currency', () => {
      expect(formatCurrency(100)).toBe('$100.00');
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
      expect(formatCurrency(1000000)).toBe('$1,000,000.00');
    });

    it('should handle cents correctly', () => {
      expect(formatCurrency(10.5)).toBe('$10.50');
      expect(formatCurrency(10.05)).toBe('$10.05');
      expect(formatCurrency(10.99)).toBe('$10.99');
    });

    it('should format zero', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('should handle negative currency', () => {
      const result = formatCurrency(-100);
      expect(result).toContain('100.00');
    });

    it('should support different currencies', () => {
      const eur = formatCurrency(100, 'EUR');
      const gbp = formatCurrency(100, 'GBP');
      expect(eur).toContain('100');
      expect(gbp).toContain('100');
    });

    it('should add thousand separators', () => {
      expect(formatCurrency(1000)).toContain(',');
      expect(formatCurrency(1000000)).toContain(',');
    });

    it('should handle very large numbers', () => {
      const result = formatCurrency(9999999.99);
      expect(result).toContain('9');
    });

    it('should handle very small numbers', () => {
      expect(formatCurrency(0.01)).toBe('$0.01');
      expect(formatCurrency(0.001)).toBe('$0.00');
    });

    it('should round to 2 decimal places', () => {
      expect(formatCurrency(10.999)).toBe('$11.00');
      expect(formatCurrency(10.994)).toBe('$10.99');
    });
  });

  describe('calculateTax', () => {
    it('should calculate 10% tax correctly', () => {
      const tax = calculateTax(100, 0.1);
      expect(tax).toBe(10);
    });

    it('should calculate 8% tax correctly', () => {
      const tax = calculateTax(100, 0.08);
      expect(tax).toBe(8);
    });

    it('should calculate tax on decimal amounts', () => {
      const tax = calculateTax(99.99, 0.1);
      expect(tax).toBe(10);
    });

    it('should handle zero subtotal', () => {
      const tax = calculateTax(0, 0.1);
      expect(tax).toBe(0);
    });

    it('should handle zero tax rate', () => {
      const tax = calculateTax(100, 0);
      expect(tax).toBe(0);
    });

    it('should round correctly for precision', () => {
      const tax = calculateTax(33.33, 0.1);
      expect(typeof tax).toBe('number');
      expect(tax).toBeLessThan(3.34);
      expect(tax).toBeGreaterThan(3.32);
    });

    it('should calculate high tax rates', () => {
      const tax = calculateTax(100, 0.5);
      expect(tax).toBe(50);
    });

    it('should handle very small amounts', () => {
      const tax = calculateTax(0.01, 0.1);
      expect(tax).toBe(0);
    });

    it('should handle fractional percentages', () => {
      const tax = calculateTax(100, 0.075);
      expect(tax).toBe(7.5);
    });
  });

  describe('validateEmail', () => {
    it('should validate correct email format', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@example.co.uk')).toBe(true);
      expect(validateEmail('user+tag@example.com')).toBe(true);
    });

    it('should reject email without @', () => {
      expect(validateEmail('testexample.com')).toBe(false);
    });

    it('should reject email without domain', () => {
      expect(validateEmail('test@')).toBe(false);
    });

    it('should reject email with space', () => {
      expect(validateEmail('test @example.com')).toBe(false);
    });

    it('should reject empty email', () => {
      expect(validateEmail('')).toBe(false);
    });

    it('should reject multiple @ symbols', () => {
      expect(validateEmail('test@@example.com')).toBe(false);
    });

    it('should accept numbers in email', () => {
      expect(validateEmail('user123@example.com')).toBe(true);
    });

    it('should accept dots in local part', () => {
      expect(validateEmail('first.last@example.com')).toBe(true);
    });

    it('should accept hyphens in domain', () => {
      expect(validateEmail('user@example-domain.com')).toBe(true);
    });

    it('should handle case insensitive validation', () => {
      expect(validateEmail('Test@Example.COM')).toBe(true);
    });
  });

  describe('parseDate', () => {
    it('should parse valid date string', () => {
      const date = parseDate('2024-03-04');
      expect(date).not.toBeNull();
      expect(date?.getFullYear()).toBe(2024);
    });

    it('should parse ISO 8601 format', () => {
      const date = parseDate('2024-03-04T10:30:00Z');
      expect(date).not.toBeNull();
      expect(date?.getDate()).toBe(4);
    });

    it('should return null for invalid date string', () => {
      const date = parseDate('invalid-date');
      expect(date).toBeNull();
    });

    it('should handle empty string', () => {
      const date = parseDate('');
      expect(date).toBeNull();
    });

    it('should parse month correctly', () => {
      const date = parseDate('2024-03-15');
      expect(date?.getMonth()).toBe(2); // March is 2 (0-indexed)
    });

    it('should parse year correctly', () => {
      const date = parseDate('2024-01-01');
      expect(date?.getFullYear()).toBe(2024);
    });

    it('should handle leap year date', () => {
      const date = parseDate('2024-02-29');
      expect(date).not.toBeNull();
    });

    it('should handle end of year', () => {
      const date = parseDate('2024-12-31');
      expect(date?.getMonth()).toBe(11);
    });

    it('should return Date object', () => {
      const date = parseDate('2024-03-04');
      expect(date instanceof Date).toBe(true);
    });

    it('should handle different formats', () => {
      const iso = parseDate('2024-03-04T00:00:00Z');
      const simple = parseDate('2024-03-04');
      expect(iso).not.toBeNull();
      expect(simple).not.toBeNull();
    });
  });

  describe('Discount Calculations', () => {
    const calculateDiscount = (subtotal: number, type: string, value: number): number => {
      if (type === 'percentage') {
        return Math.round(subtotal * (value / 100) * 100) / 100;
      } else if (type === 'fixed') {
        return Math.min(value, subtotal); // Can't discount more than subtotal
      }
      return 0;
    };

    it('should calculate percentage discount', () => {
      const discount = calculateDiscount(100, 'percentage', 10);
      expect(discount).toBe(10);
    });

    it('should calculate fixed discount', () => {
      const discount = calculateDiscount(100, 'fixed', 15);
      expect(discount).toBe(15);
    });

    it('should prevent discount exceeding subtotal', () => {
      const discount = calculateDiscount(50, 'fixed', 100);
      expect(discount).toBe(50);
    });

    it('should handle decimal discount', () => {
      const discount = calculateDiscount(99.99, 'percentage', 10);
      expect(discount).toBeCloseTo(10, 1);
    });
  });

  describe('Total Calculations', () => {
    const calculateTotal = (subtotal: number, discount: number, tax: number): number => {
      return Math.round((subtotal - discount + tax) * 100) / 100;
    };

    it('should calculate correct total', () => {
      const total = calculateTotal(100, 10, 9);
      expect(total).toBe(99);
    });

    it('should handle no discount', () => {
      const total = calculateTotal(100, 0, 10);
      expect(total).toBe(110);
    });

    it('should handle no tax', () => {
      const total = calculateTotal(100, 10, 0);
      expect(total).toBe(90);
    });

    it('should handle decimal values', () => {
      const total = calculateTotal(99.99, 5.00, 7.49);
      expect(total).toBeCloseTo(102.48, 1);
    });
  });

  describe('Change Calculation', () => {
    const calculateChange = (total: number, paid: number): number => {
      return Math.round((paid - total) * 100) / 100;
    };

    it('should calculate correct change', () => {
      const change = calculateChange(99.99, 100);
      expect(change).toBeCloseTo(0.01, 2);
    });

    it('should return zero for exact payment', () => {
      const change = calculateChange(100, 100);
      expect(change).toBe(0);
    });

    it('should handle larger payments', () => {
      const change = calculateChange(99.99, 150);
      expect(change).toBeCloseTo(50.01, 1);
    });

    it('should be negative for underpayment', () => {
      const change = calculateChange(100, 50);
      expect(change).toBe(-50);
    });
  });

  describe('Number Formatting', () => {
    const formatNumber = (num: number, decimals: number): number => {
      return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
    };

    it('should format to 2 decimals', () => {
      expect(formatNumber(10.999, 2)).toBe(11);
      expect(formatNumber(10.994, 2)).toBe(10.99);
    });

    it('should format to 0 decimals', () => {
      expect(formatNumber(10.5, 0)).toBe(10);
      expect(formatNumber(10.6, 0)).toBe(11);
    });
  });
});
