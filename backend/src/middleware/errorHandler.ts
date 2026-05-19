/**
 * Global error handling middleware
 * Handle all errors and return consistent error response
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

// Custom error class with status code
export class AppError extends Error {
  statusCode: number;
  code: number;
  details?: any;

  constructor(message: string, statusCode: number = 500, code: number = 500, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handling middleware
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log error
  logger.error(`[${req.method}] ${req.path}`, {
    error: err.message,
    stack: err.stack,
    body: req.body,
    query: req.query,
    params: req.params,
  });

  // Default error values
  let statusCode = 500;
  let code = 500;
  let message = 'Internal Server Error';
  let details = undefined;

  // Handle custom AppError
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  }

  // Handle Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    statusCode = 400;
    code = 1001;
    message = 'Database operation failed';
    details = { prismaError: err.message };
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 3001;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 3001;
    message = 'Token expired';
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 1001;
    message = 'Validation failed';
    details = err.message;
  }

  // Send error response
  const errorResponse: any = {
    code,
    message,
  };

  // Include details in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.details = details;
    errorResponse.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  logger.warn(`Route not found: ${req.method} ${req.path}`);

  res.status(404).json({
    code: 1004,
    message: `Route not found: ${req.method} ${req.path}`,
  });
};

export default errorHandler;
