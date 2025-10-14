/**
 * Logger utility for structured logging throughout the application
 * 
 * Usage:
 * ```typescript
 * import { Logger } from './utils/logger';
 * 
 * const log = Logger.create('MySystem');
 * log.info('System initialized', { config: myConfig });
 * log.warn('Potential issue detected', { value: problematicValue });
 * log.error('Operation failed', error);
 * ```
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  context: string;
  message: string;
  data?: any;
}

export type LogHandler = (entry: LogEntry) => void;

class LoggerInstance {
  private level: LogLevel = LogLevel.INFO;
  private handlers: LogHandler[] = [];
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  /**
   * Log a debug message (verbose, for development only)
   */
  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Log an informational message
   */
  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Log a warning message
   */
  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: any): void {
    this.log(LogLevel.ERROR, message, error);
  }

  private log(level: LogLevel, message: string, data?: any): void {
    if (level < Logger.globalLevel) return;

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      context: this.context,
      message,
      data,
    };

    // Call all registered handlers
    for (const handler of Logger.globalHandlers) {
      try {
        handler(entry);
      } catch (err) {
        // Prevent handler errors from breaking logging
        console.error('[Logger] Handler error:', err);
      }
    }

    // Default console output if no handlers
    if (Logger.globalHandlers.length === 0) {
      this.defaultConsoleOutput(entry);
    }
  }

  private defaultConsoleOutput(entry: LogEntry): void {
    const time = new Date(entry.timestamp).toISOString().substr(11, 12);
    const levelStr = LogLevel[entry.level].padEnd(5);
    const prefix = `[${time}] [${levelStr}] [${entry.context}]`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(prefix, entry.message, entry.data || '');
        break;
      case LogLevel.INFO:
        console.info(prefix, entry.message, entry.data || '');
        break;
      case LogLevel.WARN:
        console.warn(prefix, entry.message, entry.data || '');
        break;
      case LogLevel.ERROR:
        console.error(prefix, entry.message, entry.data || '');
        break;
    }
  }
}

/**
 * Global Logger class for creating context-specific loggers
 */
export class Logger {
  static globalLevel: LogLevel = LogLevel.INFO;
  static globalHandlers: LogHandler[] = [];

  /**
   * Create a logger for a specific context (e.g., system name, class name)
   */
  static create(context: string): LoggerInstance {
    return new LoggerInstance(context);
  }

  /**
   * Set the global log level (affects all loggers)
   */
  static setLevel(level: LogLevel): void {
    Logger.globalLevel = level;
  }

  /**
   * Add a custom log handler (e.g., for sending logs to a service)
   */
  static addHandler(handler: LogHandler): void {
    Logger.globalHandlers.push(handler);
  }

  /**
   * Remove all custom handlers
   */
  static clearHandlers(): void {
    Logger.globalHandlers = [];
  }

  /**
   * Configure logger from environment or config
   */
  static configure(config: { level?: LogLevel; debug?: boolean }): void {
    if (config.debug) {
      Logger.setLevel(LogLevel.DEBUG);
    } else if (config.level !== undefined) {
      Logger.setLevel(config.level);
    }
  }
}

/**
 * Helper to create a performance measurement logger
 */
export function measurePerformance<T>(
  context: string,
  operation: string,
  fn: () => T
): T {
  const log = Logger.create(context);
  const start = performance.now();
  try {
    const result = fn();
    const duration = performance.now() - start;
    log.debug(`${operation} completed`, { durationMs: duration.toFixed(2) });
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    log.error(`${operation} failed after ${duration.toFixed(2)}ms`, error);
    throw error;
  }
}

// Export a default instance for quick logging
export default Logger;
