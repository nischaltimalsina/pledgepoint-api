import { createClient } from 'redis'
import { logger } from '../utils/logger'
import { config } from '../config'

/**
 * Redis Service Class for managing cache and other Redis operations
 */
export class RedisService {
  private static instance: RedisService
  private client: ReturnType<typeof createClient>
  private isConnected: boolean = false

  private constructor() {
    // Create Redis client
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      // Additional optional configuration
      socket: {
        reconnectStrategy: (retries) => {
          // Exponential backoff for reconnection
          const delay = Math.min(1000 * 2 ** retries, 30000)
          logger.info(`Redis reconnecting in ${delay}ms...`)
          return delay
        },
      },
    })

    // Set up event handlers
    this.client.on('connect', () => {
      logger.info('Redis client connected')
      this.isConnected = true
    })

    this.client.on('error', (err) => {
      logger.error('Redis client error:', err)
      this.isConnected = false
    })

    this.client.on('reconnecting', () => {
      logger.info('Redis client reconnecting...')
    })

    this.client.on('end', () => {
      logger.info('Redis client connection closed')
      this.isConnected = false
    })

    // Connect to Redis
    this.client.connect().catch((err) => {
      logger.error('Failed to connect to Redis:', err)
    })
  }

  /**
   * Get the Redis service instance (Singleton pattern)
   */
  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService()
    }
    return RedisService.instance
  }

  /**
   * Get the Redis client
   */
  public getClient() {
    return this.client
  }

  /**
   * Check if the client is connected
   */
  public isClientConnected(): boolean {
    return this.isConnected
  }

  /**
   * Set a key-value pair with optional expiration
   */
  public async set(key: string, value: string, expiresInSeconds?: number): Promise<string | null> {
    try {
      if (expiresInSeconds) {
        return await this.client.set(key, value, { EX: expiresInSeconds })
      }
      return await this.client.set(key, value)
    } catch (error) {
      logger.error(`Redis set error for key ${key}:`, error)
      return null
    }
  }

  /**
   * Get a value by key
   */
  public async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key)
    } catch (error) {
      logger.error(`Redis get error for key ${key}:`, error)
      return null
    }
  }

  /**
   * Delete a key
   */
  public async del(key: string): Promise<number> {
    try {
      return await this.client.del(key)
    } catch (error) {
      logger.error(`Redis del error for key ${key}:`, error)
      return 0
    }
  }

  /**
   * Set a key-value pair in a hash
   */
  public async hSet(key: string, field: string, value: string): Promise<number> {
    try {
      return await this.client.hSet(key, field, value)
    } catch (error) {
      logger.error(`Redis hSet error for key ${key}, field ${field}:`, error)
      return 0
    }
  }

  /**
   * Get a value from a hash by key and field
   */
  public async hGet(key: string, field: string): Promise<string | null> {
    try {
      return await this.client.hGet(key, field)
    } catch (error) {
      logger.error(`Redis hGet error for key ${key}, field ${field}:`, error)
      return null
    }
  }

  /**
   * Get all fields and values from a hash
   */
  public async hGetAll(key: string): Promise<Record<string, string>> {
    try {
      const result = await this.client.hGetAll(key)
      return Object.fromEntries(
        Object.entries(result).map(([key, value]) => [key, (value as any).toString()])
      )
    } catch (error) {
      logger.error(`Redis hGetAll error for key ${key}:`, error)
      return {}
    }
  }

  /**
   * Set multiple key-value pairs in a hash
   */
  public async hMSet(key: string, data: Record<string, string>): Promise<string | null> {
    try {
      return (await this.client.hSet(key, data)).toString()
    } catch (error) {
      logger.error(`Redis hMSet error for key ${key}:`, error)
      return null
    }
  }

  /**
   * Delete a field from a hash
   */
  public async hDel(key: string, field: string): Promise<number> {
    try {
      return await this.client.hDel(key, field)
    } catch (error) {
      logger.error(`Redis hDel error for key ${key}, field ${field}:`, error)
      return 0
    }
  }

  /**
   * Add a value to a set
   */
  public async sAdd(key: string, member: string): Promise<number> {
    try {
      return await this.client.sAdd(key, member)
    } catch (error) {
      logger.error(`Redis sAdd error for key ${key}, member ${member}:`, error)
      return 0
    }
  }

  /**
   * Check if a value is in a set
   */
  public async sIsMember(key: string, member: string): Promise<boolean> {
    try {
      return await !!this.client.sIsMember(key, member)
    } catch (error) {
      logger.error(`Redis sIsMember error for key ${key}, member ${member}:`, error)
      return false
    }
  }

  /**
   * Get all members of a set
   */
  public async sMembers(key: string): Promise<string[]> {
    try {
      return await this.client.sMembers(key)
    } catch (error) {
      logger.error(`Redis sMembers error for key ${key}:`, error)
      return []
    }
  }

  /**
   * Remove a member from a set
   */
  public async sRem(key: string, member: string): Promise<number> {
    try {
      return await this.client.sRem(key, member)
    } catch (error) {
      logger.error(`Redis sRem error for key ${key}, member ${member}:`, error)
      return 0
    }
  }

  /**
   * Check if a key exists
   */
  public async exists(key: string): Promise<number> {
    try {
      return await this.client.exists(key)
    } catch (error) {
      logger.error(`Redis exists error for key ${key}:`, error)
      return 0
    }
  }

  /**
   * Set a key's expiration time
   */
  public async expire(key: string, seconds: number): Promise<boolean> {
    try {
      return !!(await this.client.expire(key, seconds))
    } catch (error) {
      logger.error(`Redis expire error for key ${key}:`, error)
      return false
    }
  }

  /**
   * Get the remaining time to live for a key
   */
  public async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key)
    } catch (error) {
      logger.error(`Redis ttl error for key ${key}:`, error)
      return -1
    }
  }

  /**
   * Close the Redis connection
   */
  public async close(): Promise<void> {
    try {
      await this.client.quit()
      this.isConnected = false
      logger.info('Redis connection closed')
    } catch (error) {
      logger.error('Error closing Redis connection:', error)
    }
  }
}

// Export Redis singleton instance
export const redis = RedisService.getInstance().getClient()
