import { Request, Response, NextFunction } from 'express'
import { rateLimit } from 'express-rate-limit'
import { RedisService } from '../services/redis.service'
import { config } from '../config'
import { logger } from '../utils/logger'
import { AppError } from './error-handler'

/**
 * Redis store for rate limiting
 */
class RedisStore {
  private redisService: RedisService
  private prefix: string

  constructor(options: { prefix?: string } = {}) {
    this.redisService = RedisService.getInstance()
    this.prefix = options.prefix || 'rate-limit:'
  }

  /**
   * Method to increment and get the current count for a key
   */
  async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    const redisKey = `${this.prefix}${key}`
    const ttl = config.security.rateLimits.window
    const now = Date.now()
    const resetTime = new Date(now + ttl * 1000)

    try {
      // Get the TTL of the key
      const keyTtl = await this.redisService.ttl(redisKey)

      // If key doesn't exist or has expired, create new
      if (keyTtl <= 0) {
        await this.redisService.set(redisKey, '1', ttl)
        return { totalHits: 1, resetTime }
      }

      // Increment the count
      const count = await this.redisService.getClient().incr(redisKey)

      return { totalHits: count, resetTime }
    } catch (error) {
      logger.error('Redis rate limiter error:', error)
      // Fallback to allow request in case of error
      return { totalHits: 1, resetTime }
    }
  }

  /**
   * Method to decrement the count for a key
   */
  async decrement(key: string): Promise<void> {
    const redisKey = `${this.prefix}${key}`

    try {
      // Decrement count if > 0
      await this.redisService.getClient().exec([
        ['GET', redisKey],
        ['SET', redisKey, '0', 'KEEPTTL', 'NX'],
        ['DECRBY', redisKey, '1', 'GET'],
      ])
    } catch (error) {
      logger.error('Redis rate limiter decrement error:', error)
    }
  }

  /**
   * Method to reset the count for a key
   */
  async resetKey(key: string): Promise<void> {
    const redisKey = `${this.prefix}${key}`

    try {
      await this.redisService.del(redisKey)
    } catch (error) {
      logger.error('Redis rate limiter reset error:', error)
    }
  }
}

/**
 * Create standard rate limiter middleware
 */
export const standardLimiter = rateLimit({
  windowMs: config.security.rateLimits.window * 1000, // Convert to milliseconds
  max: config.security.rateLimits.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please try again later.',
  handler: (req: Request, res: Response, next: NextFunction) => {
    next(new AppError(429, 'Too many requests, please try again later.'))
  },
  // Use Redis store if Redis is enabled
  store: config.env !== 'test' ? new RedisStore() : undefined,
})

/**
 * Create auth rate limiter middleware (more restrictive)
 */
export const authLimiter = rateLimit({
  windowMs: config.security.rateLimits.window * 1000,
  max: Math.floor(config.security.rateLimits.max / 2), // More restrictive
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many auth requests, please try again later.',
  handler: (req: Request, res: Response, next: NextFunction) => {
    next(new AppError(429, 'Too many auth requests, please try again later.'))
  },
  // Use Redis store if Redis is enabled
  store: config.env !== 'test' ? new RedisStore({ prefix: 'rate-limit-auth:' }) : undefined,
})

/**
 * Create API rate limiter middleware for API endpoints
 */
export const apiLimiter = rateLimit({
  windowMs: config.security.rateLimits.window * 1000,
  max: config.security.rateLimits.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many API requests, please try again later.',
  handler: (req: Request, res: Response, next: NextFunction) => {
    next(new AppError(429, 'Too many API requests, please try again later.'))
  },
  // Use Redis store if Redis is enabled
  store: config.env !== 'test' ? new RedisStore({ prefix: 'rate-limit-api:' }) : undefined,
  // Skip rate limiting for whitelisted IPs
  skip: (req: Request) => {
    const whitelist = process.env.RATE_LIMIT_WHITELIST
      ? process.env.RATE_LIMIT_WHITELIST.split(',')
      : []
    return whitelist.includes(req.ip)
  },
})

/**
 * Create custom rate limiter factory
 */
export const createRateLimiter = (options: {
  windowMs?: number
  max?: number
  message?: string
  prefix?: string
  skipIf?: (req: Request) => boolean
}) => {
  return rateLimit({
    windowMs: options.windowMs || config.security.rateLimits.window * 1000,
    max: options.max || config.security.rateLimits.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: options.message || 'Too many requests, please try again later.',
    handler: (req: Request, res: Response, next: NextFunction) => {
      next(new AppError(429, options.message || 'Too many requests, please try again later.'))
    },
    // Use Redis store if Redis is enabled
    store:
      config.env !== 'test'
        ? new RedisStore({ prefix: options.prefix || 'rate-limit-custom:' })
        : undefined,
    // Custom skip function
    skip: options.skipIf,
  })
}
