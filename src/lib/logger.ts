/**
 * Centralized logging utility for the application.
 * Provides consistent logging with levels and context.
 * Prepared for integration with external monitoring services.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
  timestamp: string;
  userId?: string;
}

class Logger {
  private isDev = import.meta.env.DEV;
  private userId: string | null = null;

  /**
   * Set the current user ID for log context
   */
  setUserId(userId: string | null) {
    this.userId = userId;
  }

  private log(level: LogLevel, message: string, context?: LogContext) {
    const entry: LogEntry = {
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
      userId: this.userId || undefined,
    };

    // Always log to console in development
    if (this.isDev) {
      const prefix = `[${level.toUpperCase()}]`;
      const contextStr = context ? ` ${JSON.stringify(context)}` : '';
      
      switch (level) {
        case 'error':
          console.error(prefix, message, contextStr);
          break;
        case 'warn':
          console.warn(prefix, message, contextStr);
          break;
        case 'debug':
          console.debug(prefix, message, contextStr);
          break;
        default:
          console.log(prefix, message, contextStr);
      }
    }

    // In production, send errors and warnings to external service
    if (!this.isDev && (level === 'error' || level === 'warn')) {
      this.sendToExternalService(entry);
    }
  }

  /**
   * Placeholder for external monitoring service integration
   * (Sentry, LogRocket, Datadog, etc.)
   */
  private sendToExternalService(_entry: LogEntry) {
    // Future implementation:
    // Sentry.captureMessage(entry.message, {
    //   level: entry.level,
    //   extra: entry.context,
    //   user: { id: entry.userId },
    // });
  }

  /**
   * Log debug messages (development only)
   */
  debug(message: string, context?: LogContext) {
    this.log('debug', message, context);
  }

  /**
   * Log informational messages
   */
  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  /**
   * Log warning messages
   */
  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }

  /**
   * Log error messages with optional Error object
   */
  error(message: string, error?: Error | unknown, context?: LogContext) {
    const errorContext: LogContext = { ...context };
    
    if (error instanceof Error) {
      errorContext.errorMessage = error.message;
      errorContext.errorStack = error.stack;
      errorContext.errorName = error.name;
    } else if (error) {
      errorContext.error = String(error);
    }

    this.log('error', message, errorContext);
  }

  /**
   * Log performance timing
   */
  timing(operation: string, durationMs: number, context?: LogContext) {
    this.info(`[TIMING] ${operation}: ${durationMs.toFixed(2)}ms`, context);
  }
}

export const logger = new Logger();
export default logger;
