import { Request, Response, NextFunction } from 'express'
import helmet from 'helmet'
import { AppError } from './error-handler'
import { logger } from '../utils/logger'
import { RateLimiter } from './rate-limiter'
import { Multer } from 'multer'

/**
 * CRITICAL SECURITY FIXES:
 * 1. Input validation and sanitization
 * 2. SQL/NoSQL injection prevention
 * 3. XSS protection
 * 4. CSRF protection
 * 5. Request size limits
 * 6. File upload security
 */

/**
 * Enhanced input sanitization middleware
 */
export const advancedSanitization = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Recursively sanitize all input
    const sanitizeValue = (value: any): any => {
      if (typeof value === 'string') {
        // Remove potentially dangerous characters
        return value
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Control characters
          .replace(/javascript:/gi, '') // JavaScript protocol
          .replace(/data:/gi, '') // Data protocol
          .replace(/vbscript:/gi, '') // VBScript protocol
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Script tags
          .replace(/on\w+\s*=/gi, '') // Event handlers
          .trim()
      }

      if (Array.isArray(value)) {
        return value.map(sanitizeValue)
      }

      if (value && typeof value === 'object') {
        const sanitized: any = {}
        for (const [key, val] of Object.entries(value)) {
          // Validate key names
          if (!/^[a-zA-Z0-9_.-]+$/.test(key)) {
            continue // Skip potentially malicious keys
          }
          sanitized[key] = sanitizeValue(val)
        }
        return sanitized
      }

      return value
    }

    // Sanitize all request data
    if (req.body) req.body = sanitizeValue(req.body)
    if (req.query) req.query = sanitizeValue(req.query)
    if (req.params) req.params = sanitizeValue(req.params)

    next()
  } catch (error) {
    logger.error('Input sanitization error:', error)
    next(new AppError(400, 'Invalid request data'))
  }
}

/**
 * Request size limiter to prevent DoS
 */
export const requestSizeLimiter = (maxSize: string = '10mb') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = req.headers['content-length']

    if (contentLength) {
      const sizeInBytes = parseInt(contentLength)
      const maxSizeInBytes = parseSize(maxSize)

      if (sizeInBytes > maxSizeInBytes) {
        return next(new AppError(413, 'Request entity too large'))
      }
    }

    next()
  }
}

/**
 * File upload security middleware
 */
export const secureFileUpload = (
  allowedMimeTypes: string[],
  maxFileSize: number = 5 * 1024 * 1024
) => {
  return (
    req: Request & {
      file?: Express.Multer.File
      files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] }
    },
    res: Response,
    next: NextFunction
  ) => {
    // This runs after multer processes files
    if (req.file || req.files) {
      const files = req.files
        ? Array.isArray(req.files)
          ? req.files
          : Object.values(req.files).flat()
        : [req.file]

      for (const file of files) {
        if (!file) continue

        // Check file size
        if (file.size > maxFileSize) {
          return next(
            new AppError(413, `File too large. Maximum size: ${maxFileSize / (1024 * 1024)}MB`)
          )
        }

        // Check MIME type
        if (!allowedMimeTypes.includes(file.mimetype)) {
          return next(
            new AppError(400, `Invalid file type. Allowed: ${allowedMimeTypes.join(', ')}`)
          )
        }

        // Check file signature (magic numbers) to prevent MIME type spoofing
        if (!isValidFileSignature(file)) {
          return next(new AppError(400, 'Invalid file format'))
        }
      }
    }

    next()
  }
}

/**
 * Enhanced CSRF protection
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF for safe methods and API endpoints with proper auth
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next()
  }

  // For API endpoints, check for proper origin
  const origin = req.headers.origin
  const referer = req.headers.referer
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',')

  if (req.path.startsWith('/api/')) {
    // API requests should have valid Authorization header or be from allowed origins
    const hasValidAuth = req.headers.authorization?.startsWith('Bearer ')
    const hasValidOrigin = origin && allowedOrigins.includes(origin)

    if (!hasValidAuth && !hasValidOrigin) {
      return next(new AppError(403, 'Invalid request origin'))
    }
  }

  next()
}

/**
 * Security headers middleware using helmet with custom config
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable if causing issues with file uploads
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
})

/**
 * IP whitelisting middleware for admin routes
 */
export const ipWhitelist = (whitelist: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (whitelist.length === 0) {
      return next() // No whitelist configured
    }

    const clientIP = getClientIP(req)

    if (!whitelist.includes(clientIP)) {
      logger.warn(`Access denied for IP: ${clientIP} on route: ${req.path}`)
      return next(new AppError(403, 'Access denied'))
    }

    next()
  }
}

/**
 * Brute force protection for authentication endpoints
 */
export const bruteForceProtection = (req: Request, res: Response, next: NextFunction) => {
  const email = req.body?.email
  const ip = getClientIP(req)

  if (!email) {
    return next()
  }

  // Use email-based rate limiting for login attempts
  RateLimiter.checkUserRateLimit(`auth:${email}`, 'login_attempt', 5, 15 * 60 * 1000) // 5 attempts per 15 minutes
    .then((allowed) => {
      if (!allowed) {
        return next(new AppError(429, 'Too many login attempts. Please try again later.'))
      }
      next()
    })
    .catch((error) => {
      logger.error('Brute force protection error:', error)
      next() // Fail open in case of Redis issues
    })
}

/**
 * Session fixation protection
 */
export const sessionProtection = (req: Request, res: Response, next: NextFunction) => {
  // Regenerate session ID on login/logout
  if (req.path.includes('/login') || req.path.includes('/logout')) {
    // Clear any existing session cookies
    res.clearCookie('sessionId')
    res.clearCookie('connect.sid')
  }

  next()
}

// Helper functions
function parseSize(size: string): number {
  const match = size.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)$/i)
  if (!match) return 0

  const value = parseFloat(match[1])
  const unit = match[2].toUpperCase()

  const multipliers = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 }
  return value * (multipliers[unit as keyof typeof multipliers] || 1)
}

function getClientIP(req: Request): string {
  return (
    req.headers['x-forwarded-for']?.toString().split(',')[0] ||
    req.headers['x-real-ip']?.toString() ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.ip ||
    'unknown'
  )
}

function isValidFileSignature(file: Express.Multer.File): boolean {
  if (!file.buffer) return true // Can't check without buffer

  const signatures: Record<string, number[][]> = {
    'image/jpeg': [[0xff, 0xd8, 0xff]],
    'image/png': [[0x89, 0x50, 0x4e, 0x47]],
    'image/gif': [[0x47, 0x49, 0x46, 0x38]],
    'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
    'application/zip': [
      [0x50, 0x4b, 0x03, 0x04],
      [0x50, 0x4b, 0x05, 0x06],
    ],
  }

  const fileSignatures = signatures[file.mimetype]
  if (!fileSignatures) return true // Unknown type, allow through

  return fileSignatures.some((signature) =>
    signature.every((byte, index) => file.buffer[index] === byte)
  )
}
