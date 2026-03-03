/**
 * Simple logger utility - stub implementation
 * Provides basic logging methods for the application
 */

export interface LogLevel {
  level: string
}

export interface LoggerOptions {
  level?: string
}

class Logger {
  private level: string

  constructor(options: LoggerOptions = {}) {
    this.level = options.level || 'info'
  }

  info(message: string, data?: any) {
    console.log(`[INFO] ${message}`, data || '')
  }

  error(message: string, error?: any) {
    console.error(`[ERROR] ${message}`, error || '')
  }

  warn(message: string, data?: any) {
    console.warn(`[WARN] ${message}`, data || '')
  }

  debug(message: string, data?: any) {
    if (this.level === 'debug') {
      console.log(`[DEBUG] ${message}`, data || '')
    }
  }
}

export const createLogger = (options?: LoggerOptions) => {
  return new Logger(options)
}

export const logger = new Logger()

export default Logger
