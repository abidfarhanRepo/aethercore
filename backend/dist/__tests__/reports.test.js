"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const axios_1 = __importDefault(require("axios"));
const API_URL = 'http://localhost:4000';
const api = axios_1.default.create({ baseURL: API_URL });
(0, globals_1.describe)('Reports API Endpoints', () => {
    const dateFrom = '2026-02-01';
    const dateTo = '2026-03-03';
    (0, globals_1.describe)('Sales Reports', () => {
        (0, globals_1.test)('GET /reports/sales-summary should return daily/weekly/monthly sales', async () => {
            const response = await api.get('/reports/sales-summary', {
                params: { dateFrom, dateTo, groupBy: 'day' },
            });
            (0, globals_1.expect)(response.status).toBe(200);
            (0, globals_1.expect)(Array.isArray(response.data)).toBe(true);
            if (response.data.length > 0) {
                (0, globals_1.expect)(response.data[0]).toHaveProperty('date');
                (0, globals_1.expect)(response.data[0]).toHaveProperty('revenue');
                (0, globals_1.expect)(response.data[0]).toHaveProperty('sales');
            }
        });
        (0, globals_1.test)('GET /reports/sales-by-product should return sales by product', async () => {
            const response = await api.get('/reports/sales-by-product', {
                params: { dateFrom, dateTo },
            });
            (0, globals_1.expect)(response.status).toBe(200);
            (0, globals_1.expect)(Array.isArray(response.data)).toBe(true);
            if (response.data.length > 0) {
                (0, globals_1.expect)(response.data[0]).toHaveProperty('productName');
                (0, globals_1.expect)(response.data[0]).toHaveProperty('qty');
                (0, globals_1.expect)(response.data[0]).toHaveProperty('totalRevenue');
            }
        });
        (0, globals_1.test)('GET /reports/sales-by-category should return sales breakdown by category', async () => {
            const response = await api.get('/reports/sales-by-category', {
                params: { dateFrom, dateTo },
            });
            (0, globals_1.expect)(response.status).toBe(200);
            (0, globals_1.expect)(Array.isArray(response.data)).toBe(true);
            if (response.data.length > 0) {
                (0, globals_1.expect)(response.data[0]).toHaveProperty('category');
                (0, globals_1.expect)(response.data[0]).toHaveProperty('revenue');
            }
        });
        (0, globals_1.test)('GET /reports/top-products should return top selling products', async () => {
            const response = await api.get('/reports/top-products', {
                params: { limit: 10, dateFrom, dateTo },
            });
            (0, globals_1.expect)(response.status).toBe(200);
            (0, globals_1.expect)(Array.isArray(response.data)).toBe(true);
            (0, globals_1.expect)(response.data.length).toBeLessThanOrEqual(10);
        });
        (0, globals_1.test)('GET /reports/revenue-analysis should return revenue metrics', async () => {
            const response = await api.get('/reports/revenue-analysis', {
                params: { dateFrom, dateTo },
            });
            (0, globals_1.expect)(response.status).toBe(200);
            (0, globals_1.expect)(response.data).toHaveProperty('totalSales');
            (0, globals_1.expect)(response.data).toHaveProperty('totalRevenue');
            (0, globals_1.expect)(response.data).toHaveProperty('totalDiscount');
            (0, globals_1.expect)(response.data).toHaveProperty('totalTax');
            (0, globals_1.expect)(typeof response.data.totalRevenue).toBe('number');
        });
        (0, globals_1.test)('GET /reports/payment-methods should return payment breakdown', async () => {
            const response = await api.get('/reports/payment-methods', {
                params: { dateFrom, dateTo },
            });
            (0, globals_1.expect)(response.status).toBe(200);
            (0, globals_1.expect)(Array.isArray(response.data)).toBe(true);
            if (response.data.length > 0) {
                (0, globals_1.expect)(response.data[0]).toHaveProperty('method');
                (0, globals_1.expect)(response.data[0]).toHaveProperty('amount');
                (0, globals_1.expect)(response.data[0]).toHaveProperty('percentage');
            }
        });
        (0, globals_1.test)('GET /reports/hourly-sales should return hourly breakdown', async () => {
            const response = await api.get('/reports/hourly-sales', {
                params: { date: '2026-03-03' },
            });
            (0, globals_1.expect)(response.status).toBe(200);
            (0, globals_1.expect)(Array.isArray(response.data)).toBe(true);
            (0, globals_1.expect)(response.data.length).toBeLessThanOrEqual(24);
        });
    });
    (0, globals_1.describe)('Inventory Reports', () => {
        (0, globals_1.test)('GET /reports/inventory-valuation should return inventory value', async () => {
            const response = await api.get('/reports/inventory-valuation');
            (0, globals_1.expect)(response.status).toBe(200);
            (0, globals_1.expect)(response.data).toHaveProperty('items');
            (0, globals_1.expect)(response.data).toHaveProperty('totals');
            (0, globals_1.expect)(response.data.totals).toHaveProperty('totalQty');
            (0, globals_1.expect)(response.data.totals).toHaveProperty('totalRetailValue');
        });
        (0, globals_1.test)('GET /reports/inventory-movement should return turnover data', async () => {
            const response = await api.get('/reports/inventory-movement');
            (0, globals_1.expect)(response.status).toBe(200);
            (0, globals_1.expect)(Array.isArray(response.data)).toBe(true);
            if (response.data.length > 0) {
                (0, globals_1.expect)(response.data[0]).toHaveProperty('name');
                (0, globals_1.expect)(response.data[0]).toHaveProperty('turnoverRate');
                (0, globals_1.expect)(response.data[0]).toHaveProperty('currentQty');
            }
        });
        (0, globals_1.test)('GET /reports/low-stock should return low stock items', async () => {
            const response = await api.get('/reports/low-stock');
            (0, globals_1.expect)(response.status).toBe(200);
            (0, globals_1.expect)(Array.isArray(response.data)).toBe(true);
            // Low stock items may be empty if no items are below threshold
            response.data.forEach((item) => {
                (0, globals_1.expect)(item).toHaveProperty('productName');
                (0, globals_1.expect)(item).toHaveProperty('currentQty');
                (0, globals_1.expect)(item).toHaveProperty('minThreshold');
            });
        });
    });
    (0, globals_1.describe)('Customer Reports', () => {
        (0, globals_1.test)('GET /reports/customer-analytics should return customer data', async () => {
            const response = await api.get('/reports/customer-analytics', {
                params: { dateFrom, dateTo },
            });
            (0, globals_1.expect)(response.status).toBe(200);
            (0, globals_1.expect)(response.data).toHaveProperty('topCustomers');
            (0, globals_1.expect)(response.data).toHaveProperty('repeatCustomers');
            (0, globals_1.expect)(response.data).toHaveProperty('totalCustomers');
            (0, globals_1.expect)(response.data).toHaveProperty('avgCustomerValue');
        });
    });
    (0, globals_1.describe)('Financial Reports', () => {
        (0, globals_1.test)('GET /reports/discounts-impact should return discount metrics', async () => {
            const response = await api.get('/reports/discounts-impact', {
                params: { dateFrom, dateTo },
            });
            (0, globals_1.expect)(response.status).toBe(200);
            (0, globals_1.expect)(response.data).toHaveProperty('byReason');
            (0, globals_1.expect)(response.data).toHaveProperty('totalDiscount');
            (0, globals_1.expect)(Array.isArray(response.data.byReason)).toBe(true);
        });
        (0, globals_1.test)('GET /reports/profit-margins should return margin analysis', async () => {
            const response = await api.get('/reports/profit-margins', {
                params: { dateFrom, dateTo },
            });
            (0, globals_1.expect)(response.status).toBe(200);
            (0, globals_1.expect)(Array.isArray(response.data)).toBe(true);
            if (response.data.length > 0) {
                (0, globals_1.expect)(response.data[0]).toHaveProperty('productName');
                (0, globals_1.expect)(response.data[0]).toHaveProperty('marginPercent');
                (0, globals_1.expect)(response.data[0]).toHaveProperty('revenueTotal');
            }
        });
        (0, globals_1.test)('GET /reports/tax-summary should return tax data', async () => {
            const response = await api.get('/reports/tax-summary', {
                params: { dateFrom, dateTo },
            });
            (0, globals_1.expect)(response.status).toBe(200);
            (0, globals_1.expect)(response.data).toHaveProperty('totalSales');
            (0, globals_1.expect)(response.data).toHaveProperty('totalTax');
            (0, globals_1.expect)(response.data).toHaveProperty('totalTaxableAmount');
            (0, globals_1.expect)(response.data).toHaveProperty('effectiveTaxRate');
        });
    });
    (0, globals_1.describe)('Employee Reports', () => {
        (0, globals_1.test)('GET /reports/employee-performance should return employee data', async () => {
            const response = await api.get('/reports/employee-performance', {
                params: { dateFrom, dateTo },
            });
            (0, globals_1.expect)(response.status).toBe(200);
            (0, globals_1.expect)(Array.isArray(response.data)).toBe(true);
            if (response.data.length > 0) {
                (0, globals_1.expect)(response.data[0]).toHaveProperty('name');
                (0, globals_1.expect)(response.data[0]).toHaveProperty('totalSales');
                (0, globals_1.expect)(response.data[0]).toHaveProperty('transactionCount');
            }
        });
    });
    (0, globals_1.describe)('Data Export', () => {
        (0, globals_1.test)('GET /reports/export/csv should return CSV data', async () => {
            const response = await api.get('/reports/export/csv', {
                params: { type: 'sales-summary', dateFrom, dateTo },
                responseType: 'blob',
            });
            (0, globals_1.expect)(response.status).toBe(200);
            (0, globals_1.expect)(response.headers['content-type']).toContain('text/csv');
        });
    });
    (0, globals_1.describe)('Inventory Adjustments', () => {
        (0, globals_1.test)('GET /reports/inventory-adjustments should return adjustment history', async () => {
            const response = await api.get('/reports/inventory-adjustments', {
                params: { dateFrom, dateTo },
            });
            (0, globals_1.expect)(response.status).toBe(200);
            (0, globals_1.expect)(Array.isArray(response.data)).toBe(true);
            // May be empty if no adjustments
            response.data.forEach((item) => {
                (0, globals_1.expect)(item).toHaveProperty('productSku');
                (0, globals_1.expect)(item).toHaveProperty('qtyDelta');
                (0, globals_1.expect)(item).toHaveProperty('reason');
            });
        });
    });
});
