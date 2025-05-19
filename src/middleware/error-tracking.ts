import { Request, Response, NextFunction } from 'express'
import {
  ErrorTrackingService,
  ErrorSeverity,
  ErrorCategory,
} from '../services/error-tracking.service'
import { AppError } from './error-handler'
import { logger } from '../utils/logger'

/**
 * Express middleware for automatic error tracking
 */
export const errorTrackingMiddleware = () => {
  return async (err: Error, req: Request, res: Response, next: NextFunction) => {
    try {
      // Determine error severity and category
      const { severity, category } = categorizeError(err)

      // Extract user info if available
      const userId = (req as any).user?._id?.toString()

      // Track the error
      await ErrorTrackingService.trackError({
        error: err,
        severity,
        category,
        userId,
        request: {
          endpoint: req.path,
          method: req.method,
          userAgent: req.get('user-agent'),
          ip: req.ip || req.connection.remoteAddress,
          body: sanitizeRequestBody(req.body),
        },
        response: {
          status: err instanceof AppError ? err.statusCode : 500,
        },
        context: {
          url: req.url,
          params: req.params,
          query: req.query,
          headers: sanitizeHeaders(req.headers),
        },
        tags: generateErrorTags(err, req),
      })
    } catch (trackingError) {
      logger.error('Error in error tracking middleware:', trackingError)
    }

    // Continue with normal error handling
    next(err)
  }
}

/**
 * Categorize error based on type and characteristics
 */
function categorizeError(error: Error): {
  severity: ErrorSeverity
  category: ErrorCategory
} {
  // Default values
  let severity = ErrorSeverity.MEDIUM
  let category = ErrorCategory.SYSTEM

  // Check if it's an AppError with severity info
  if (error instanceof AppError) {
    // Categorize by status code
    if (error.statusCode >= 500) {
      severity = ErrorSeverity.HIGH
    } else if (error.statusCode >= 400) {
      severity = ErrorSeverity.LOW
    }

    // Categorize by status code ranges
    if (error.statusCode === 401 || error.statusCode === 403) {
      category = ErrorCategory.AUTH
    } else if (error.statusCode === 400 || error.statusCode === 422) {
      category = ErrorCategory.VALIDATION
    } else if (error.statusCode >= 500) {
      category = ErrorCategory.SYSTEM
    }
  }

  // Categorize by error name/type
  switch (error.name) {
    case 'ValidationError':
      category = ErrorCategory.VALIDATION
      severity = ErrorSeverity.LOW
      break
    case 'MongoError':
    case 'MongooseError':
      category = ErrorCategory.DATABASE
      severity = ErrorSeverity.HIGH
      break
    case 'JsonWebTokenError':
    case 'TokenExpiredError':
      category = ErrorCategory.AUTH
      severity = ErrorSeverity.MEDIUM
      break
    case 'TypeError':
    case 'ReferenceError':
      category = ErrorCategory.SYSTEM
      severity = ErrorSeverity.HIGH
      break
    case 'SyntaxError':
      category = ErrorCategory.VALIDATION
      severity = ErrorSeverity.MEDIUM
      break
  }

  // Check error message for patterns
  const message = error.message.toLowerCase()

  if (message.includes('timeout') || message.includes('econnrefused')) {
    category = ErrorCategory.NETWORK
    severity = ErrorSeverity.HIGH
  } else if (message.includes('permission denied') || message.includes('unauthorized')) {
    category = ErrorCategory.SECURITY
    severity = ErrorSeverity.HIGH
  } else if (message.includes('database') || message.includes('connection')) {
    category = ErrorCategory.DATABASE
    severity = ErrorSeverity.HIGH
  } else if (message.includes('api') || message.includes('request failed')) {
    category = ErrorCategory.EXTERNAL_API
    severity = ErrorSeverity.MEDIUM
  }

  // Critical errors (system might be unstable)
  if (
    message.includes('out of memory') ||
    message.includes('segmentation fault') ||
    message.includes('cannot read property') ||
    (error.name === 'Error' && message.includes('critical'))
  ) {
    severity = ErrorSeverity.CRITICAL
  }

  return { severity, category }
}

/**
 * Sanitize request body to remove sensitive data
 */
function sanitizeRequestBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body
  }

  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'key',
    'auth',
    'authorization',
    'creditcard',
    'ssn',
    'social',
  ]

  const sanitized = { ...body }

  const sanitizeObject = (obj: any): any => {
    if (!obj || typeof obj !== 'object') {
      return obj
    }

    const result = { ...obj }

    Object.keys(result).forEach((key) => {
      const lowerKey = key.toLowerCase()

      if (sensitiveFields.some((field) => lowerKey.includes(field))) {
        result[key] = '[REDACTED]'
      } else if (typeof result[key] === 'object') {
        result[key] = sanitizeObject(result[key])
      }
    })

    return result
  }

  return sanitizeObject(sanitized)
}

/**
 * Sanitize headers to remove sensitive data
 */
function sanitizeHeaders(headers: any): any {
  const sanitized = { ...headers }

  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token']

  sensitiveHeaders.forEach((header) => {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]'
    }
  })

  return sanitized
}

/**
 * Generate relevant tags for the error
 */
function generateErrorTags(error: Error, req: Request): string[] {
  const tags: string[] = []

  // Add route-based tags
  if (req.path.includes('/api/auth')) {
    tags.push('authentication')
  } else if (req.path.includes('/api/admin')) {
    tags.push('admin')
  } else if (req.path.includes('/api/users')) {
    tags.push('users')
  } else if (req.path.includes('/api/campaigns')) {
    tags.push('campaigns')
  } else if (req.path.includes('/api/officials')) {
    tags.push('officials')
  }

  // Add method-based tags
  tags.push(`method-${req.method.toLowerCase()}`)

  // Add error-type tags
  if (error instanceof AppError) {
    tags.push('app-error')
    if (error.statusCode >= 500) {
      tags.push('server-error')
    } else if (error.statusCode >= 400) {
      tags.push('client-error')
    }
  } else {
    tags.push('system-error')
  }

  // Add environment tag
  tags.push(`env-${process.env.NODE_ENV || 'development'}`)

  return tags
}

/**
 * Express middleware for performance monitoring
 * (Optional: tracks slow requests as potential issues)
 */
export const performanceTrackingMiddleware = (slowThreshold: number = 5000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now()

    // Override res.end to capture response time
    const originalEnd = res.end
    res.end = function (
      chunk?: any,
      encoding?: BufferEncoding | (() => void),
      cb?: () => void
    ): Response<any, Record<string, any>> {
      const duration = Date.now() - startTime

      // Track slow requests as warnings
      if (duration > slowThreshold) {
        ErrorTrackingService.trackError({
          error: new Error(`Slow request: ${duration}ms`),
          severity: ErrorSeverity.LOW,
          category: ErrorCategory.SYSTEM,
          userId: (req as any).user?._id?.toString(),
          request: {
            endpoint: req.path,
            method: req.method,
            userAgent: req.get('user-agent'),
            ip: req.ip,
          },
          response: {
            status: res.statusCode,
          },
          context: {
            duration,
            url: req.url,
          },
          tags: ['performance', 'slow-request'],
        }).catch((err) => {
          logger.error('Error tracking slow request:', err)
        })
      }

      // Call original end method with proper arguments
      return originalEnd.call(this, chunk, encoding as BufferEncoding, cb)
    }

    next()
  }
}

/**
 * Manual error reporting function for use in try-catch blocks
 */
export const reportError = async (
  error: Error,
  context?: {
    userId?: string
    action?: string
    metadata?: Record<string, any>
    severity?: ErrorSeverity
    category?: ErrorCategory
  }
): Promise<void> => {
  try {
    await ErrorTrackingService.trackError({
      error,
      severity: context?.severity || ErrorSeverity.MEDIUM,
      category: context?.category || ErrorCategory.BUSINESS_LOGIC,
      userId: context?.userId,
      context: {
        action: context?.action,
        ...context?.metadata,
      },
      tags: context?.action ? [context.action] : undefined,
    })
  } catch (trackingError) {
    logger.error('Error in manual error reporting:', trackingError)
  }
}

// Export service for direct use
export { ErrorTrackingService, ErrorSeverity, ErrorCategory }
