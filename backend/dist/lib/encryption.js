"use strict";
/**
 * Encryption utilities for sensitive data
 * Uses crypto.subtle for modern browser/Node.js compatibility
 * Falls back to crypto for Node.js environments
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptData = encryptData;
exports.decryptData = decryptData;
exports.createHMAC = createHMAC;
exports.verifyHMAC = verifyHMAC;
exports.generateRandomBytes = generateRandomBytes;
exports.generateAPIKey = generateAPIKey;
exports.createSignedToken = createSignedToken;
exports.verifySignedToken = verifySignedToken;
const crypto_1 = __importDefault(require("crypto"));
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default_32_char_key_change_in_prod';
const ALGORITHM = 'aes-256-gcm';
/**
 * Validates encryption key length
 */
function ensureKeyLength() {
    if (ENCRYPTION_KEY.length < 32) {
        console.warn('⚠️ ENCRYPTION_KEY is less than 32 characters. This is insecure. Set ENCRYPTION_KEY env var.');
        // Pad key to 32 bytes for development only 
        return ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32);
    }
    return ENCRYPTION_KEY.substring(0, 32);
}
/**
 * Encrypts sensitive data using AES-256-GCM
 * Returns base64 encoded result with IV and auth tag
 */
function encryptData(plaintext) {
    try {
        const key = Buffer.from(ensureKeyLength());
        const iv = crypto_1.default.randomBytes(12); // GCM standard IV size
        const cipher = crypto_1.default.createCipheriv(ALGORITHM, key, iv);
        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        // Combine IV + encrypted data + auth tag
        const combined = iv.toString('hex') + ':' + encrypted + ':' + authTag.toString('hex');
        return Buffer.from(combined).toString('base64');
    }
    catch (error) {
        console.error('Encryption error:', error);
        throw new Error('Failed to encrypt data');
    }
}
/**
 * Decrypts data encrypted with encryptData
 */
function decryptData(encryptedBase64) {
    try {
        const key = Buffer.from(ensureKeyLength());
        const combined = Buffer.from(encryptedBase64, 'base64').toString('hex');
        const [ivHex, encrypted, authTagHex] = combined.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const decipher = crypto_1.default.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    catch (error) {
        console.error('Decryption error:', error);
        throw new Error('Failed to decrypt data');
    }
}
/**
 * Hash-based MAC for data integrity verification
 * Used for API request signing
 */
function createHMAC(data, secret) {
    const key = secret || ENCRYPTION_KEY;
    return crypto_1.default
        .createHmac('sha256', key)
        .update(data)
        .digest('hex');
}
/**
 * Verify HMAC signature
 */
function verifyHMAC(data, signature, secret) {
    const key = secret || ENCRYPTION_KEY;
    const computed = createHMAC(data, key);
    // Use timing-safe comparison to prevent timing attacks
    return crypto_1.default.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
}
/**
 * Generate cryptographically secure random bytes
 */
function generateRandomBytes(length = 32) {
    return crypto_1.default.randomBytes(length).toString('hex');
}
/**
 * Generate API key with timestamp and signature
 */
function generateAPIKey() {
    const timestamp = Date.now().toString();
    const random = generateRandomBytes(16);
    const key = `aether_${timestamp}${random}`;
    return key;
}
/**
 * Create signed request token for sensitive operations
 */
function createSignedToken(data, expiresIn) {
    const payload = {
        ...data,
        iat: Math.floor(Date.now() / 1000),
    };
    if (expiresIn) {
        payload.exp = Math.floor(Date.now() / 1000) + expiresIn;
    }
    const signature = createHMAC(JSON.stringify(payload));
    return Buffer.from(JSON.stringify({ ...payload, signature })).toString('base64');
}
/**
 * Verify signed token
 */
function verifySignedToken(token) {
    try {
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
        const { signature, ...payload } = decoded;
        const computedSignature = createHMAC(JSON.stringify(payload));
        if (!crypto_1.default.timingSafeEqual(Buffer.from(signature), Buffer.from(computedSignature))) {
            return null;
        }
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            return null;
        }
        return payload;
    }
    catch {
        return null;
    }
}
