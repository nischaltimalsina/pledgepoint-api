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
   * Standard rate limiter for most API endpoints
   */
  static standardLimiter = rateLimit({
    windowMs: config.security.rateLimits.window * 1000, // Convert to milliseconds
    max: config.security.rateLimits.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests, please try again later.',
    handler: (req: Request, res: Response, next: NextFunction) => {
      next(new AppError(429, 'Too many requests, please try again later.'))
    },
    // Skip rate limiting for whitelisted IPs
    skip: (req: Request) => {
      const whitelist = process.env.RATE_LIMIT_WHITELIST
        ? process.env.RATE_LIMIT_WHITELIST.split(',')
        : []
      return whitelist.includes(req.ip ?? '')
    },
  })

  /**
   * More restrictive rate limiter for authentication routes
   */
  static authLimiter = rateLimit({
    windowMs: config.security.rateLimits.window * 1000,
    max: Math.floor(config.security.rateLimits.max / 2), // More restrictive
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many auth requests, please try again later.',
    handler: (req: Request, res: Response, next: NextFunction) => {
      next(new AppError(429, 'Too many auth requests, please try again later.'))
    },
    // Skip rate limiting for whitelisted IPs
    skip: (req: Request) => {
      const whitelist = process.env.RATE_LIMIT_WHITELIST
        ? process.env.RATE_LIMIT_WHITELIST.split(',')
        : []
      return whitelist.includes(req.ip ?? '')
    },
  })

  /**
   * Rate limiter for API endpoints
   */
  static apiLimiter = rateLimit({
    windowMs: config.security.rateLimits.window * 1000,
    max: config.security.rateLimits.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many API requests, please try again later.',
    handler: (req: Request, res: Response, next: NextFunction) => {
      next(new AppError(429, 'Too many API requests, please try again later.'))
    },
    // Skip rate limiting for whitelisted IPs
    skip: (req: Request) => {
      const whitelist = process.env.RATE_LIMIT_WHITELIST
        ? process.env.RATE_LIMIT_WHITELIST.split(',')
        : []
      return whitelist.includes(req.ip ?? '')
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
