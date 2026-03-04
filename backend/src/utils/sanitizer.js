"use strict";
/**
 * Input sanitization and validation utilities
 * Prevents XSS, SQL injection, and other injection attacks
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeHTML = sanitizeHTML;
exports.escapeHTML = escapeHTML;
exports.sanitizeString = sanitizeString;
exports.sanitizeEmail = sanitizeEmail;
exports.sanitizeURL = sanitizeURL;
exports.sanitizeNumber = sanitizeNumber;
exports.sanitizeInteger = sanitizeInteger;
exports.sanitizeBoolean = sanitizeBoolean;
exports.sanitizeArray = sanitizeArray;
exports.removeSQLInjectionPatterns = removeSQLInjectionPatterns;
exports.containsXSSPatterns = containsXSSPatterns;
exports.validatePasswordStrength = validatePasswordStrength;
exports.sanitizeFilename = sanitizeFilename;
exports.isAllowedFileType = isAllowedFileType;
exports.sanitizeObject = sanitizeObject;
exports.validateRequestSize = validateRequestSize;
var validator_1 = require("validator");
/**
 * Sanitize HTML content to prevent XSS attacks (simple version)
 */
function sanitizeHTML(dirty) {
    return dirty
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}
/**
 * Escape HTML entities to prevent XSS
 */
function escapeHTML(text) {
    return validator_1.default.escape(text);
}
/**
 * Sanitize string input (trim, remove null bytes, etc.)
 */
function sanitizeString(input) {
    if (typeof input !== 'string') {
        return '';
    }
    return input
        .trim() // Remove whitespace
        .replace(/\0/g, '') // Remove null bytes
        .slice(0, 10000); // Limit length to prevent DoS via large inputs
}
/**
 * Sanitize email address
 */
function sanitizeEmail(email) {
    var sanitized = sanitizeString(email).toLowerCase();
    if (!validator_1.default.isEmail(sanitized)) {
        throw new Error('Invalid email address');
    }
    return sanitized;
}
/**
 * Sanitize URL
 */
function sanitizeURL(url) {
    var sanitized = sanitizeString(url);
    if (!validator_1.default.isURL(sanitized, {
        protocols: ['http', 'https'],
        require_protocol: true,
    })) {
        throw new Error('Invalid URL');
    }
    return sanitized;
}
/**
 * Sanitize numeric input
 */
function sanitizeNumber(input) {
    var parsed = parseFloat(input);
    if (isNaN(parsed) || !isFinite(parsed)) {
        throw new Error('Invalid number');
    }
    return parsed;
}
/**
 * Sanitize integer input
 */
function sanitizeInteger(input) {
    var parsed = parseInt(input, 10);
    if (isNaN(parsed) || !isFinite(parsed)) {
        throw new Error('Invalid integer');
    }
    return parsed;
}
/**
 * Sanitize boolean input
 */
function sanitizeBoolean(input) {
    if (typeof input === 'boolean')
        return input;
    if (typeof input === 'string') {
        return ['true', '1', 'yes', 'on'].includes(input.toLowerCase());
    }
    return Boolean(input);
}
/**
 * Sanitize array input
 */
function sanitizeArray(input, maxLength) {
    if (maxLength === void 0) { maxLength = 100; }
    if (!Array.isArray(input)) {
        return [];
    }
    return input.slice(0, maxLength);
}
/**
 * Remove potential SQL injection attempts
 * Note: Use Prisma parameterized queries as primary defense
 */
function removeSQLInjectionPatterns(input) {
    var sqlPatterns = [
        /(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b)/gi,
        /(--|#|\/\*|\*\/)/g, // SQL comments
        /(\bOR\b|\bAND\b).*=.*['"]/gi, // OR/AND with string comparison
        /([;'])\s*(UNION|SELECT)/gi,
    ];
    for (var _i = 0, sqlPatterns_1 = sqlPatterns; _i < sqlPatterns_1.length; _i++) {
        var pattern = sqlPatterns_1[_i];
        if (pattern.test(input)) {
            return true; // Suspicious pattern detected
        }
    }
    return false;
}
/**
 * Check for XSS attempt patterns
 */
function containsXSSPatterns(input) {
    var xssPatterns = [
        /<script[^>]*>.*?<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi, // Event handlers like onclick=
        /<iframe/gi,
        /<embed/gi,
        /<object/gi,
        /(base64)/gi,
    ];
    for (var _i = 0, xssPatterns_1 = xssPatterns; _i < xssPatterns_1.length; _i++) {
        var pattern = xssPatterns_1[_i];
        if (pattern.test(input)) {
            return true;
        }
    }
    return false;
}
/**
 * Validate password strength
 */
function validatePasswordStrength(password) {
    var errors = [];
    if (password.length < 8) {
        errors.push('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }
    // Check against common passwords
    var commonPasswords = [
        'password',
        '123456',
        'qwerty',
        'abc123',
        'password123',
        'admin',
        'letmein',
    ];
    if (commonPasswords.includes(password.toLowerCase())) {
        errors.push('Password is too common');
    }
    return {
        valid: errors.length === 0,
        errors: errors,
    };
}
/**
 * Sanitize file upload filename
 */
function sanitizeFilename(filename) {
    return filename
        .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace unsafe characters
        .replace(/^\./, '') // Remove leading dots
        .slice(0, 255); // Limit length
}
/**
 * Validate file type
 */
function isAllowedFileType(filename, allowedTypes) {
    var _a;
    if (allowedTypes === void 0) { allowedTypes = ['pdf', 'xlsx', 'csv', 'json']; }
    var extension = (_a = filename.split('.').pop()) === null || _a === void 0 ? void 0 : _a.toLowerCase();
    return extension ? allowedTypes.includes(extension) : false;
}
/**
 * Sanitize object recursively
 */
function sanitizeObject(obj, maxDepth, currentDepth) {
    if (maxDepth === void 0) { maxDepth = 3; }
    if (currentDepth === void 0) { currentDepth = 0; }
    if (currentDepth >= maxDepth) {
        return obj;
    }
    var sanitized = {};
    for (var _i = 0, _a = Object.entries(obj); _i < _a.length; _i++) {
        var _b = _a[_i], key = _b[0], value = _b[1];
        var sanitizedKey = sanitizeString(key);
        if (typeof value === 'string') {
            sanitized[sanitizedKey] = sanitizeString(value);
        }
        else if (typeof value === 'object' && value !== null) {
            if (Array.isArray(value)) {
                sanitized[sanitizedKey] = value.map(function (item) {
                    return typeof item === 'string' ? sanitizeString(item) : item;
                });
            }
            else {
                sanitized[sanitizedKey] = sanitizeObject(value, maxDepth, currentDepth + 1);
            }
        }
        else {
            sanitized[sanitizedKey] = value;
        }
    }
    return sanitized;
}
/**
 * Validate request size
 */
function validateRequestSize(contentLength, maxSize) {
    if (maxSize === void 0) { maxSize = 10 * 1024 * 1024; }
    if (!contentLength)
        return true;
    var size = parseInt(contentLength, 10);
    return size <= maxSize;
}
