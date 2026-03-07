"use strict";
// Payment processing for POS system
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePayment = validatePayment;
exports.validateSplitPayment = validateSplitPayment;
exports.calculateChange = calculateChange;
exports.validateGiftCard = validateGiftCard;
exports.validateLoyaltyPointsPayment = validateLoyaltyPointsPayment;
exports.validateStoreCredit = validateStoreCredit;
exports.generatePaymentReference = generatePaymentReference;
/**
 * Validate individual payment
 */
function validatePayment(payment, totalCents, method) {
    // Validate amount
    if (payment.amountCents <= 0) {
        return {
            ...payment,
            isValid: false,
            error: 'Payment amount must be positive',
        };
    }
    // Validate method-specific requirements
    if (payment.method === 'CARD' && !payment.reference) {
        return {
            ...payment,
            isValid: false,
            error: 'Card payment requires reference (last 4 digits)',
        };
    }
    if (payment.method === 'CHECK' && !payment.reference) {
        return {
            ...payment,
            isValid: false,
            error: 'Check payment requires check number',
        };
    }
    if (payment.method === 'CASH') {
        // Calculate change for cash payments
        if (payment.amountCents < totalCents) {
            return {
                ...payment,
                isValid: false,
                error: `Insufficient cash. Need at least $${(totalCents / 100).toFixed(2)}`,
            };
        }
        const changeCents = payment.amountCents - totalCents;
        return {
            method: payment.method,
            amountCents: totalCents,
            changeCents,
            isValid: true,
        };
    }
    return {
        ...payment,
        isValid: true,
    };
}
/**
 * Process split payment (multiple payment methods for one transaction)
 */
function validateSplitPayment(payments, totalCents) {
    if (payments.length === 0) {
        return {
            isValid: false,
            totalCents: 0,
            payments: [],
            error: 'At least one payment method required',
        };
    }
    const processedPayments = [];
    let totalPaid = 0;
    let cashPaymentExists = false;
    for (const payment of payments) {
        // Only last payment can be cash (for change calculation)
        if (payment.method === 'CASH') {
            if (cashPaymentExists) {
                return {
                    isValid: false,
                    totalCents: 0,
                    payments: [],
                    error: 'Only one cash payment allowed',
                };
            }
            cashPaymentExists = true;
        }
        const validated = validatePayment(payment, totalCents);
        if (!validated.isValid) {
            return {
                isValid: false,
                totalCents: 0,
                payments: [],
                error: validated.error,
            };
        }
        processedPayments.push(validated);
        totalPaid += validated.amountCents;
    }
    // For split payments, total must equal sale total
    // (change is only calculated for single cash payment)
    if (!cashPaymentExists && totalPaid !== totalCents) {
        return {
            isValid: false,
            totalCents,
            payments: processedPayments,
            error: `Total payments ($${(totalPaid / 100).toFixed(2)}) must equal sale total ($${(totalCents / 100).toFixed(2)})`,
        };
    }
    // For split payments with cash, cash should cover the difference
    if (cashPaymentExists && totalPaid < totalCents) {
        return {
            isValid: false,
            totalCents,
            payments: processedPayments,
            error: `Insufficient payment. Total payments ($${(totalPaid / 100).toFixed(2)}) less than sale total ($${(totalCents / 100).toFixed(2)})`,
        };
    }
    return {
        isValid: true,
        totalCents: totalPaid,
        payments: processedPayments,
    };
}
/**
 * Calculate change for cash payment
 */
function calculateChange(amountPaidCents, totalCents) {
    if (amountPaidCents < totalCents) {
        return {
            changeCents: 0,
            isValid: false,
        };
    }
    const changeCents = amountPaidCents - totalCents;
    return {
        changeCents,
        isValid: true,
    };
}
/**
 * Validate gift card payment
 * In real implementation, would query gift card service
 */
function validateGiftCard(giftCardId, amountCents) {
    // Placeholder - would connect to gift card service
    // For now, assume it's valid if ID is provided
    return {
        isValid: true,
        availableBalance: amountCents,
    };
}
/**
 * Validate loyalty points payment
 */
function validateLoyaltyPointsPayment(availablePoints, pointValue, // e.g., 100 points = $1 = 100 cents
amountCents) {
    const pointsNeeded = Math.ceil((amountCents / pointValue) * 100);
    if (availablePoints < pointsNeeded) {
        return {
            isValid: false,
            pointsNeeded,
            error: `Insufficient loyalty points. Have ${availablePoints}, need ${pointsNeeded}`,
        };
    }
    return {
        isValid: true,
        pointsNeeded,
    };
}
/**
 * Validate store credit payment
 */
function validateStoreCredit(creditBalance, // in cents
amountCents) {
    if (creditBalance < amountCents) {
        return {
            isValid: false,
            error: `Insufficient store credit. Have $${(creditBalance / 100).toFixed(2)}, need $${(amountCents / 100).toFixed(2)}`,
        };
    }
    return {
        isValid: true,
    };
}
/**
 * Generate payment reference for different methods
 */
function generatePaymentReference(method, input) {
    switch (method) {
        case 'CARD':
            return `CARD-****${input?.cardLast4 || '0000'}`;
        case 'CHECK':
            return `CHECK-${input?.checkNumber || 'UNKNOWN'}`;
        case 'GIFT_CARD':
            return `GC-${input?.giftCardId || 'UNKNOWN'}`;
        case 'LOYALTY_POINTS':
            return 'LP-USED';
        case 'STORE_CREDIT':
            return 'SC-USED';
        case 'CASH':
        default:
            return 'CASH';
    }
}
