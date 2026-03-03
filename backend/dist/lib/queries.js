"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findProductsOptimized = findProductsOptimized;
exports.batchLoadProductInventory = batchLoadProductInventory;
exports.findSalesOptimized = findSalesOptimized;
exports.findUserWithRelations = findUserWithRelations;
exports.countRecords = countRecords;
exports.analyzeQueryPerformance = analyzeQueryPerformance;
exports.getIndexStatistics = getIndexStatistics;
exports.explainQuery = explainQuery;
const db_1 = require("../utils/db");
const logger_1 = require("../utils/logger");
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 500;
/**
 * Get paginated products with all necessary related data
 * Single efficient query with proper select/include
 */
async function findProductsOptimized(options = {}) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(options.limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const skip = (page - 1) * limit;
    const startTime = process.hrtime.bigint();
    try {
        // Use Promise.all to fetch count and items in parallel
        const [items, total] = await Promise.all([
            db_1.prisma.product.findMany({
                skip,
                take: limit,
                select: {
                    id: true,
                    name: true,
                    sku: true,
                    price: true,
                    cost: true,
                    description: true,
                    category: true,
                    isActive: true,
                    createdAt: true,
                    updatedAt: true,
                    // Include inventory with single relation (no N+1)
                    inventory: {
                        select: {
                            id: true,
                            locationId: true,
                            qty: true,
                            warehouseCode: true,
                        },
                        orderBy: { createdAt: 'desc' },
                        take: 1, // Get most recent location only
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
            db_1.prisma.product.count(),
        ]);
        const queryTime = Number(process.hrtime.bigint() - startTime) / 1000000; // Convert to ms
        return {
            data: items,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
            metrics: {
                queryTime,
                rowsReturned: items.length,
                cacheHit: false,
            },
        };
    }
    catch (error) {
        logger_1.logger.error('Error fetching products:', error);
        throw error;
    }
}
/**
 * Batch load related data efficiently
 * Avoid N+1: Load all related items in a single query
 */
async function batchLoadProductInventory(productIds) {
    if (productIds.length === 0)
        return [];
    const startTime = process.hrtime.bigint();
    try {
        const inventory = await db_1.prisma.inventoryLocation.findMany({
            where: {
                productId: {
                    in: productIds,
                },
            },
            select: {
                id: true,
                productId: true,
                locationId: true,
                qty: true,
                warehouseCode: true,
            },
        });
        const queryTime = Number(process.hrtime.bigint() - startTime) / 1000000;
        // Group by productId for easier access
        const grouped = {};
        inventory.forEach((item) => {
            if (!grouped[item.productId]) {
                grouped[item.productId] = [];
            }
            grouped[item.productId].push(item);
        });
        return {
            data: inventory,
            grouped,
            metrics: {
                queryTime,
                rowsReturned: inventory.length,
            },
        };
    }
    catch (error) {
        logger_1.logger.error('Error batch loading inventory:', error);
        throw error;
    }
}
/**
 * Get sales with all required data in single query
 * Most called query - highly optimized
 */
async function findSalesOptimized(options = {}) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(options.limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const skip = (page - 1) * limit;
    const startTime = process.hrtime.bigint();
    try {
        const [items, total] = await Promise.all([
            db_1.prisma.sale.findMany({
                skip,
                take: limit,
                select: {
                    id: true,
                    reference: true,
                    total: true,
                    tax: true,
                    discount: true,
                    paymentMethod: true,
                    status: true,
                    createdAt: true,
                    userId: true,
                    user: {
                        select: {
                            id: true,
                            email: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                    items: {
                        select: {
                            id: true,
                            productId: true,
                            qty: true,
                            unitPrice: true,
                            discount: true,
                            product: {
                                select: {
                                    id: true,
                                    name: true,
                                    sku: true,
                                },
                            },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                // Add index hint if supported (depends on DB)
            }),
            db_1.prisma.sale.count(),
        ]);
        const queryTime = Number(process.hrtime.bigint() - startTime) / 1000000;
        return {
            data: items,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
            metrics: {
                queryTime,
                rowsReturned: items.length,
                cacheHit: false,
            },
        };
    }
    catch (error) {
        logger_1.logger.error('Error fetching sales:', error);
        throw error;
    }
}
/**
 * Get user with all related data efficiently
 */
async function findUserWithRelations(userId) {
    const startTime = process.hrtime.bigint();
    try {
        const user = await db_1.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                isActive: true,
                department: true,
                lastLogin: true,
                createdAt: true,
                updatedAt: true,
                userRoles: {
                    select: {
                        roleId: true,
                        role: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
            },
        });
        const queryTime = Number(process.hrtime.bigint() - startTime) / 1000000;
        return {
            data: user,
            metrics: {
                queryTime,
                cacheHit: false,
            },
        };
    }
    catch (error) {
        logger_1.logger.error('Error fetching user:', error);
        throw error;
    }
}
/**
 * Count with efficient filtering
 */
async function countRecords(model, where) {
    const startTime = process.hrtime.bigint();
    try {
        let count = 0;
        switch (model) {
            case 'product':
                count = await db_1.prisma.product.count({ where });
                break;
            case 'sale':
                count = await db_1.prisma.sale.count({ where });
                break;
            case 'user':
                count = await db_1.prisma.user.count({ where });
                break;
            case 'inventory':
                count = await db_1.prisma.inventoryLocation.count({ where });
                break;
        }
        const queryTime = Number(process.hrtime.bigint() - startTime) / 1000000;
        return {
            count,
            metrics: { queryTime },
        };
    }
    catch (error) {
        logger_1.logger.error(`Error counting ${model}:`, error);
        throw error;
    }
}
/**
 * Analyze slow queries and suggest optimizations
 * Call with metrics from actual queries
 */
function analyzeQueryPerformance(queryTime) {
    if (queryTime < 100) {
        return { status: 'FAST', recommendation: 'Query is well optimized' };
    }
    else if (queryTime < 500) {
        return {
            status: 'SLOW',
            recommendation: 'Consider adding indexes or using pagination',
        };
    }
    else {
        return {
            status: 'CRITICAL',
            recommendation: 'Query is critical - needs immediate optimization',
        };
    }
}
/**
 * Get index usage statistics
 * Run after complex queries to verify index usage
 */
async function getIndexStatistics() {
    try {
        const result = await db_1.prisma.$queryRaw `
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_scan as scans,
        idx_tup_read as tuples_read,
        idx_tup_fetch as tuples_fetched
      FROM pg_stat_user_indexes
      ORDER BY idx_scan DESC;
    `;
        return result;
    }
    catch (error) {
        logger_1.logger.error('Error fetching index statistics:', error);
        return null;
    }
}
/**
 * Explain query plan (for debugging)
 */
async function explainQuery(query) {
    try {
        const result = await db_1.prisma.$queryRawUnsafe(`EXPLAIN ANALYZE ${query}`);
        return result;
    }
    catch (error) {
        logger_1.logger.error('Error explaining query:', error);
        return null;
    }
}
