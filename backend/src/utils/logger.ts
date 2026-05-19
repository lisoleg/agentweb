/**
 * Logger utility using Winston
 * Provides structured logging with rotation and multiple transports
 */

import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logDir = process.env.LOG_DIR || './logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logLevel = process.env.LOG_LEVEL || 'info';
const isProduction = process.env.NODE_ENV === 'production';

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = JSON.stringify(meta, null, 2);
    }
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// Create Winston logger instance
const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  transports: [
    // Error log file
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: parseSize(process.env.LOG_FILE_MAX_SIZE || '10m'),
      maxFiles: process.env.LOG_FILE_MAX_FILES || '14d',
    }),
    // Combined log file
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: parseSize(process.env.LOG_FILE_MAX_SIZE || '10m'),
      maxFiles: process.env.LOG_FILE_MAX_FILES || '14d',
    }),
  ],
});

// Add console transport in non-production
if (!isProduction) {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

// Helper to parse size strings like '10m', '1g'
function parseSize(size: string): number {
  const match = size.match(/^(\d+)([kmg]?)$/i);
  if (!match) return 10 * 1024 * 1024; // Default 10MB

  const num = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 'k':
      return num * 1024;
    case 'm':
      return num * 1024 * 1024;
    case 'g':
      return num * 1024 * 1024 * 1024;
    default:
      return num;
  }
}

// Create child logger with context
export const createLogger = (context: string) => {
  return logger.child({ context });
};

// Export pre-configured loggers for common modules
export const authLogger = createLogger('auth');
export const apiLogger = createLogger('api');
export const didLogger = createLogger('did');
export const vcLogger = createLogger('vc');
export const phiLogger = createLogger('phi');
export const agentLogger = createLogger('agent');
export const blockchainLogger = createLogger('blockchain');
export const bsvLogger = createLogger('bsv');

export default logger;
