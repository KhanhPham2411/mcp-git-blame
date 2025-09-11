import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

class Logger {
  private logsDir: string;
  private logFile: string;
  private static instance: Logger;

  constructor() {
    // Get the directory of the current module
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    this.logsDir = path.join(__dirname, '..', 'logs');
    this.ensureLogsDirectory();
    this.logFile = path.join(this.logsDir, this.getLogFileName());
  }

  private ensureLogsDirectory(): void {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  private getLogFileName(): string {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    return `server-${dateStr}.log`;
  }

  private formatMessage(level: string, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ' ' + args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ') : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${formattedArgs}`;
  }

  private writeToFile(formattedMessage: string): void {
    try {
      fs.appendFileSync(this.logFile, formattedMessage + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', (error as Error).message);
    }
  }

  private log(level: string, message: string, ...args: any[]): void {
    const formattedMessage = this.formatMessage(level, message, ...args);
    
    // Only write to file to avoid interfering with MCP protocol communication
    // MCP uses stdio for communication, so console output breaks the protocol
    this.writeToFile(formattedMessage);
  }

  info(message: string, ...args: any[]): void {
    this.log('info', message, ...args);
  }

  error(message: string, ...args: any[]): void {
    this.log('error', message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.log('warn', message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    this.log('debug', message, ...args);
  }

  // Additional methods for MCP-specific logging
  logToolCall(toolName: string, params: any): void {
    this.info(`Tool called: ${toolName}`, { params });
  }

  logToolError(toolName: string, error: Error, context?: any): void {
    this.error(`Tool error in ${toolName}`, { 
      error: error.message, 
      stack: error.stack,
      context 
    });
  }

  // Singleton pattern
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }
}

// Create and export a singleton instance
const logger = Logger.getInstance();
export { Logger, logger };
export default logger;
