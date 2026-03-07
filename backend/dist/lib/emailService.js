"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setEmailTransportForTests = setEmailTransportForTests;
exports.createEtherealTransport = createEtherealTransport;
exports.sendReceiptEmail = sendReceiptEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const db_1 = require("../utils/db");
const logger_1 = require("../utils/logger");
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = 2000;
let transport = null;
function setEmailTransportForTests(nextTransport) {
    transport = nextTransport;
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function getTransport() {
    if (transport) {
        return transport;
    }
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    transport = nodemailer_1.default.createTransport({
        host: process.env.SMTP_HOST || 'localhost',
        port,
        secure: port === 465,
        auth: user && pass ? { user, pass } : undefined,
    });
    return transport;
}
async function createEtherealTransport() {
    const account = await nodemailer_1.default.createTestAccount();
    return nodemailer_1.default.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
            user: account.user,
            pass: account.pass,
        },
    });
}
function buildReceiptSubject(receiptId) {
    return `Aether POS Receipt ${receiptId}`;
}
async function queueFailedEmail(to, receiptId, html, error) {
    await db_1.prisma.notificationQueue.create({
        data: {
            type: 'failed_email',
            receiptId,
            recipientEmail: to,
            subject: buildReceiptSubject(receiptId),
            htmlContent: html,
            status: 'pending',
            attempts: MAX_ATTEMPTS,
            error,
        },
    });
}
async function sendReceiptEmail(to, receiptId, receiptHtml) {
    const from = process.env.SMTP_FROM || 'noreply@aether.local';
    const subject = buildReceiptSubject(receiptId);
    let lastError = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        try {
            await getTransport().sendMail({
                from,
                to,
                subject,
                html: receiptHtml,
            });
            logger_1.logger.info({ to, receiptId, attempt }, 'Receipt email sent');
            return;
        }
        catch (error) {
            lastError = error;
            logger_1.logger.warn({
                to,
                receiptId,
                attempt,
                error: error instanceof Error ? error.message : String(error),
            }, 'Receipt email send attempt failed');
            if (attempt < MAX_ATTEMPTS) {
                await sleep(BACKOFF_MS);
            }
        }
    }
    const failureMessage = lastError instanceof Error ? lastError.message : String(lastError);
    logger_1.logger.error({ to, receiptId, error: failureMessage }, 'Receipt email failed after retries');
    try {
        await queueFailedEmail(to, receiptId, receiptHtml, failureMessage);
    }
    catch (queueError) {
        logger_1.logger.error({
            to,
            receiptId,
            error: queueError instanceof Error ? queueError.message : String(queueError),
        }, 'Failed to persist failed email notification');
    }
    throw lastError instanceof Error ? lastError : new Error(failureMessage);
}
