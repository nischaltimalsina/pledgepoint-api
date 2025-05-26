import { Request, Response, NextFunction } from 'express'
import { rateLimit, Options } from 'express-rate-limit'
import { RedisService } from '../services/redis.service'
import { config } from '../config'
import { logger } from '../utils/logger'
import { AppError } from './error-handler'

/**
 * Rate limiter class for different API endpoints
 */
export class RateLimiter {
  /**
   * Enhanced rate limiter with user-based tracking
   */
  static createLimiter(options: {
    windowMs?: number
    max?: number
    message?: string
    keyGenerator?: (req: Request) => string
    skipSuccessfulRequests?: boolean
  }) {
    return rateLimit({
      windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes
      max: options.max || 100,
      message: options.message || 'Too many requests',
      standardHeaders: true,
      legacyHeaders: false,

      // Enhanced key generation
      keyGenerator:
        options.keyGenerator ||
        ((req: Request) => {
          // Combine IP and user ID if authenticated
          const userId = (req as any).user?.id
          const ip = this.getClientIP(req)
          return userId ? `${ip}:${userId}` : ip
        }),

      // Skip successful requests by default
      skipSuccessfulRequests: options.skipSuccessfulRequests ?? true,

      handler: (req: Request, res: Response) => {
        res.status(429).json({
          error: 'Too many requests',
          retryAfter: Math.round(options.windowMs! / 1000) || 900,
        })
      },
      // Skip rate limiting for whitelisted IPs
      skip: (req: Request) => {
        const whitelist = process.env.RATE_LIMIT_WHITELIST
          ? process.env.RATE_LIMIT_WHITELIST.split(',')
          : []
        return whitelist.includes(req.ip ?? '')
      },
    })
  }

  /**
   * Get real client IP with proxy awareness
   */
  private static getClientIP(req: Request): string {
    // Trust specific proxy headers only from trusted proxies
    const trustedProxies = process.env.TRUSTED_PROXIES?.split(',') || []
    const forwarded = req.headers['x-forwarded-for'] as string

    if (forwarded && trustedProxies.length > 0) {
      const ips = forwarded.split(',').map((ip) => ip.trim())
      return ips[0]
    }

    return req.socket.remoteAddress || req.ip || 'unknown'
  }

  /**
   * More restrictive rate limiter for authentication routes
   */
  static authLimiter = this.createLimiter({
    windowMs: config.security.rateLimits.window * 1000,
    max: Math.floor(config.security.rateLimits.max / 2), // More restrictive
    message: 'Too many auth requests, please try again later.',
    skipSuccessfulRequests: false, // Count all auth attempts
  })

  /**
   * Rate limiter for API endpoints
   */
  static apiLimiter = this.createLimiter({
    windowMs: config.security.rateLimits.window * 1000,
    max: config.security.rateLimits.max,
    message: 'Too many API requests, please try again later.',
    keyGenerator: (req: Request) => {
      // Use user ID if authenticated, otherwise IP
      const userId = (req as any).user?.id
      return userId ? `${this.getClientIP(req)}:${userId}` : this.getClientIP(req)
    },
  })

  /**
   * Create a custom rate limiter
   * @param options Rate limiter options
   */
  static createRateLimiter(options: {
    windowMs?: number
    max?: number
    message?: string
    prefix?: string
    skipIf?: (req: Request) => boolean
  }) {
    return rateLimit({
      windowMs: options.windowMs || config.security.rateLimits.window * 1000,
      max: options.max || config.security.rateLimits.max,
      standardHeaders: true,
      legacyHeaders: false,
      message: options.message || 'Too many requests, please try again later.',
      handler: (req: Request, res: Response, next: NextFunction) => {
        next(new AppError(429, options.message || 'Too many requests, please try again later.'))
      },
      skip:
        options.skipIf ||
        ((req: Request) => {
          const whitelist = process.env.RATE_LIMIT_WHITELIST
            ? process.env.RATE_LIMIT_WHITELIST.split(',')
            : []
          return whitelist.includes(req.ip ?? '')
        }),
    })
  }

  /**
   * Check and increment rate limit for user actions
   * @param userId User ID
   * @param action Action type
   * @param limit Maximum attempts allowed
   * @param windowMs Time window in milliseconds
   * @returns Whether the action is allowed
   */
  static async checkUserRateLimit(
    userId: string,
    action: string,
    limit: number,
    windowMs: number = 3600000 // 1 hour default
  ): Promise<boolean> {
    try {
      const redisService = RedisService.getInstance()
      const key = `rate:${action}:${userId}`

      // Get current count
      const countStr = await redisService.get(key)
      const count = countStr ? parseInt(countStr, 10) : 0

      // Check if limit exceeded
      if (count >= limit) {
        return false
      }

      // Increment count
      await redisService.set(
        key,
        (count + 1).toString(),
        Math.ceil(windowMs / 1000) // Convert to seconds for Redis
      )

      return true
    } catch (error) {
      logger.error('Error checking user rate limit:', error)
      // Fail open in case of error
      return true
    }
  }
}
