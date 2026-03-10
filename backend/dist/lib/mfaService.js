"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateMfaEnrollment = generateMfaEnrollment;
exports.verifyTotpToken = verifyTotpToken;
exports.generateRecoveryCodes = generateRecoveryCodes;
exports.consumeRecoveryCode = consumeRecoveryCode;
const crypto_1 = __importDefault(require("crypto"));
const speakeasy_1 = __importDefault(require("speakeasy"));
const qrcode_1 = __importDefault(require("qrcode"));
async function generateMfaEnrollment(email) {
    const secret = speakeasy_1.default.generateSecret({
        name: `Aether POS (${email})`,
        issuer: 'Aether POS',
        length: 32,
    });
    const otpAuthUrl = secret.otpauth_url || '';
    const qrCodeBase64 = await qrcode_1.default.toDataURL(otpAuthUrl).then((dataUrl) => {
        return dataUrl.replace(/^data:image\/png;base64,/, '');
    });
    return {
        secret: secret.base32,
        otpAuthUrl,
        qrCodeBase64,
        recoveryCodes: generateRecoveryCodes(),
    };
}
function verifyTotpToken(secret, token) {
    const normalizedToken = token.trim();
    if (!/^\d{6}$/.test(normalizedToken)) {
        return false;
    }
    return speakeasy_1.default.totp.verify({
        secret,
        encoding: 'base32',
        token: normalizedToken,
        window: 1,
    });
}
function generateRecoveryCodes(count = 8) {
    return Array.from({ length: count }, () => {
        const part1 = crypto_1.default.randomBytes(2).toString('hex').toUpperCase();
        const part2 = crypto_1.default.randomBytes(2).toString('hex').toUpperCase();
        return `${part1}-${part2}`;
    });
}
function consumeRecoveryCode(storedCodes, providedCode) {
    const normalized = providedCode.trim().toUpperCase();
    const index = storedCodes.findIndex((code) => code.toUpperCase() === normalized);
    if (index === -1) {
        return { isValid: false, remainingCodes: storedCodes };
    }
    const remainingCodes = storedCodes.filter((_, codeIndex) => codeIndex !== index);
    return { isValid: true, remainingCodes };
}
