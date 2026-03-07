import pino, { type Logger, type LoggerOptions } from 'pino'

const baseOptions: LoggerOptions = {
  level: process.env.LOG_LEVEL || 'info',
  base: undefined,
}

const transport =
  process.env.NODE_ENV !== 'production'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined

export const logger: Logger = pino({
  ...baseOptions,
  transport,
})

export const createLogger = (bindings?: Record<string, unknown>): Logger => logger.child(bindings || {})

export default logger
