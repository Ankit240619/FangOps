import pino from 'pino';

// ============================================
// FangOps Structured Logger
// JSON logging with context (hand, request, correlation)
// ============================================

export interface LogContext {
    handId?: string;
    handName?: string;
    requestId?: string;
    correlationId?: string;
    userId?: string;
    [key: string]: unknown;
}

const isDevelopment = process.env['NODE_ENV'] !== 'production';

/** Root logger instance */
const rootLogger = pino({
    level: process.env['LOG_LEVEL'] ?? (isDevelopment ? 'debug' : 'info'),
    transport: isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'HH:MM:ss.l',
                ignore: 'pid,hostname',
            },
        }
        : undefined,
    // Production: structured JSON output (no transport)
    base: {
        service: 'fangops',
        version: process.env['npm_package_version'] ?? '0.1.0',
    },
});

/**
 * Create a child logger with context.
 * 
 * Usage:
 *   const log = createLogger({ handName: 'sentinel', handId: 'abc123' });
 *   log.info('Alert received');
 *   log.error({ err, alertId: '...' }, 'Failed to process alert');
 */
export function createLogger(context: LogContext): pino.Logger {
    return rootLogger.child(context);
}

/**
 * Get the root logger (for system-level logging).
 */
export function getRootLogger(): pino.Logger {
    return rootLogger;
}

/**
 * Pre-built loggers for common components.
 */
export const loggers = {
    system: createLogger({ component: 'system' }),
    api: createLogger({ component: 'api' }),
    sentinel: createLogger({ component: 'sentinel', handName: 'sentinel' }),
    reporter: createLogger({ component: 'reporter', handName: 'reporter' }),
    resolver: createLogger({ component: 'resolver', handName: 'resolver' }),
    analyst: createLogger({ component: 'analyst', handName: 'analyst' }),
    llm: createLogger({ component: 'llm-gateway' }),
    events: createLogger({ component: 'event-bus' }),
    db: createLogger({ component: 'database' }),
    auth: createLogger({ component: 'auth' }),
};

export type { pino };
