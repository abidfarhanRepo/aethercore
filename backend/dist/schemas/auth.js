"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logoutBodySchema = exports.refreshBodySchema = exports.loginBodySchema = exports.registerBodySchema = void 0;
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
