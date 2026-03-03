"use strict";
/**
 * Simple logger utility - stub implementation
 * Provides basic logging methods for the application
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.createLogger = void 0;
class Logger {
    constructor(options = {}) {
        this.level = options.level || 'info';
    }
    info(message, data) {
        console.log(`[INFO] ${message}`, data || '');
    }
    error(message, error) {
        console.error(`[ERROR] ${message}`, error || '');
    }
    warn(message, data) {
        console.warn(`[WARN] ${message}`, data || '');
    }
    debug(message, data) {
        if (this.level === 'debug') {
            console.log(`[DEBUG] ${message}`, data || '');
        }
    }
}
const createLogger = (options) => {
    return new Logger(options);
};
exports.createLogger = createLogger;
exports.logger = new Logger();
exports.default = Logger;
