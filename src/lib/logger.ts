/**
 * Simple logger utility with levels and file output capability
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = 'info';
  
  constructor() {
    // Set log level from environment if available
    if (process.env.LOG_LEVEL) {
      this.logLevel = process.env.LOG_LEVEL as LogLevel;
    }
  }
  
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }
  
  private getTimestamp(): string {
    return new Date().toISOString();
  }
  
  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    
    return levels[level] >= levels[this.logLevel];
  }
  
  private formatLog(level: LogLevel, module: string, message: string, data?: any): string {
    const timestamp = this.getTimestamp();
    const logData = data ? ` - ${JSON.stringify(data, this.replacer)}` : '';
    return `[${timestamp}] ${level.toUpperCase()} [${module}] ${message}${logData}`;
  }
  
  // Custom replacer to handle circular references and Function objects
  private replacer(key: string, value: any): any {
    if (typeof value === 'function') {
      return '[Function]';
    }
    
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack
      };
    }

    // Handle circular references
    const seen = new WeakSet();
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    
    return value;
  }
  
  public debug(module: string, message: string, data?: any): void {
    if (this.shouldLog('debug')) {
      const logMessage = this.formatLog('debug', module, message, data);
      console.debug(logMessage);
    }
  }
  
  public info(module: string, message: string, data?: any): void {
    if (this.shouldLog('info')) {
      const logMessage = this.formatLog('info', module, message, data);
      console.info(logMessage);
    }
  }
  
  public warn(module: string, message: string, data?: any): void {
    if (this.shouldLog('warn')) {
      const logMessage = this.formatLog('warn', module, message, data);
      console.warn(logMessage);
    }
  }
  
  public error(module: string, message: string, data?: any): void {
    if (this.shouldLog('error')) {
      const logMessage = this.formatLog('error', module, message, data);
      console.error(logMessage);
    }
  }
}

export const logger = Logger.getInstance();