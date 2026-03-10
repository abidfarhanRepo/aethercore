"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mfaChallengeBodySchema = exports.mfaVerifyBodySchema = exports.logoutBodySchema = exports.refreshBodySchema = exports.loginBodySchema = exports.registerBodySchema = void 0;
const zod_1 = require("zod");
exports.registerBodySchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
});
exports.loginBodySchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1),
});
exports.refreshBodySchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(1).optional(),
}).optional();
exports.logoutBodySchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(1).optional(),
}).optional();
exports.mfaVerifyBodySchema = zod_1.z.object({
    token: zod_1.z.string().regex(/^\d{6}$/),
});
exports.mfaChallengeBodySchema = zod_1.z.object({
    tempSessionToken: zod_1.z.string().min(1),
    token: zod_1.z.string().regex(/^\d{6}$/).optional(),
    recoveryCode: zod_1.z.string().min(3).optional(),
}).refine((value) => Boolean(value.token || value.recoveryCode), {
    message: 'token or recoveryCode is required',
});
