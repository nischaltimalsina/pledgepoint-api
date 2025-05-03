import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'

/**
 * Custom error class for application errors
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true,
    public data: any = null
  ) {
    super(message)
    Object.setPrototypeOf(this, AppError.prototype)
    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * Handle 404 errors - resources not found
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new AppError(404, `Resource not found - ${req.originalUrl}`)
  next(error)
}

/**
 * Central error handler middleware
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Default error status and message
  let statusCode = 500
  let message = 'Internal Server Error'
  let errorData: any = null
  let isOperational = false

  // Log the error
  logger.error(`Error: ${err.message}`, {
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: (req as any).user?.id || 'unauthenticated',
  })

  // Handle AppError instances
  if (err instanceof AppError) {
    statusCode = err.statusCode
    message = err.message
    errorData = err.data
    isOperational = err.isOperational
  } else {
    // Handle specific error types

    // Mongoose validation errors
    if (err.name === 'ValidationError') {
      statusCode = 400
      message = 'Validation Error'
      errorData = err.message
      isOperational = true
    }

    // JSON parsing errors
    else if (err.name === 'SyntaxError' && (err as any).status === 400) {
      statusCode = 400
      message = 'Invalid JSON'
      isOperational = true
    }

    // JWT errors
    else if (err.name === 'JsonWebTokenError') {
      statusCode = 401
      message = 'Invalid token'
      isOperational = true
    }

    // JWT expiration errors
    else if (err.name === 'TokenExpiredError') {
      statusCode = 401
      message = 'Token expired'
      isOperational = true
    }

    // Mongoose cast errors (e.g., invalid ID format)
    else if (err.name === 'CastError') {
      statusCode = 400
      message = 'Invalid data format'
      errorData = err.message
      isOperational = true
    }

    // Mongoose duplicate key error
    else if (err.name === 'MongoError' && (err as any).code === 11000) {
      statusCode = 409
      message = 'Duplicate key error'
      isOperational = true
    }
  }

  // Send appropriate response based on environment
  if (process.env.NODE_ENV === 'production' && !isOperational) {
    // Don't expose server errors in production
    return res.status(500).json({
      status: 'error',
      message: 'Something went wrong',
    })
  }

  // Development or operational errors can include more details
  return res.status(statusCode).json({
    status: statusCode >= 500 ? 'error' : 'fail',
    message,
    ...(errorData && { data: errorData }),
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  })
}
