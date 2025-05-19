import mongoose, { Document, Schema } from 'mongoose'
import { logger } from '../utils/logger'
import { RedisService } from './redis.service'

/**
 * Interface for configuration document
 */
interface IConfiguration extends Document {
  key: string
  value: any
  category: string
  description?: string
  isActive: boolean
  lastModified: Date
  modifiedBy: string
}

/**
 * Configuration schema
 */
const configurationSchema = new Schema<IConfiguration>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    value: {
      type: Schema.Types.Mixed,
      required: true,
    },
    category: {
      type: String,
      required: true,
      index: true,
    },
    description: String,
    isActive: {
      type: Boolean,
      default: true,
    },
    lastModified: {
      type: Date,
      default: Date.now,
    },
    modifiedBy: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
)

const Configuration = mongoose.model<IConfiguration>('Configuration', configurationSchema)

/**
 * Configuration service for managing platform settings
 */
export class ConfigurationService {
  private static readonly CACHE_PREFIX = 'config:'
  private static readonly CACHE_TTL = 3600 // 1 hour

  /**
   * Get configuration by key
   */
  static async getConfig(key: string): Promise<any> {
    try {
      const redis = RedisService.getInstance()
      const cacheKey = `${this.CACHE_PREFIX}${key}`

      // Try cache first
      const cached = await redis.get(cacheKey)
      if (cached) {
        return JSON.parse(cached)
      }

      // Fetch from database
      const config = await Configuration.findOne({ key, isActive: true })
      if (!config) {
        return null
      }

      // Cache the result
      await redis.set(cacheKey, JSON.stringify(config.value), this.CACHE_TTL)

      return config.value
    } catch (error) {
      logger.error(`Error getting config for key ${key}:`, error)
      return null
    }
  }

  /**
   * Set configuration value
   */
  static async setConfig(
    key: string,
    value: any,
    category: string,
    modifiedBy: string,
    description?: string
  ): Promise<boolean> {
    try {
      const config = await Configuration.findOneAndUpdate(
        { key },
        {
          value,
          category,
          description,
          lastModified: new Date(),
          modifiedBy,
          isActive: true,
        },
        { upsert: true, new: true }
      )

      // Update cache
      const redis = RedisService.getInstance()
      const cacheKey = `${this.CACHE_PREFIX}${key}`
      await redis.set(cacheKey, JSON.stringify(value), this.CACHE_TTL)

      logger.info(`Configuration updated: ${key} by ${modifiedBy}`)
      return true
    } catch (error) {
      logger.error(`Error setting config for key ${key}:`, error)
      return false
    }
  }

  /**
   * Get all configurations by category
   */
  static async getConfigsByCategory(category: string): Promise<Record<string, any>> {
    try {
      const configs = await Configuration.find({ category, isActive: true })
      const result: Record<string, any> = {}

      configs.forEach((config) => {
        result[config.key] = config.value
      })

      return result
    } catch (error) {
      logger.error(`Error getting configs for category ${category}:`, error)
      return {}
    }
  }

  /**
   * Get all configurations
   */
  static async getAllConfigs(): Promise<Record<string, any>> {
    try {
      const configs = await Configuration.find({ isActive: true })
      const result: Record<string, any> = {}

      configs.forEach((config) => {
        if (!result[config.category]) {
          result[config.category] = {}
        }
        result[config.category][config.key] = config.value
      })

      return result
    } catch (error) {
      logger.error('Error getting all configs:', error)
      return {}
    }
  }

  /**
   * Initialize default configurations
   */
  static async initializeDefaults(): Promise<void> {
    try {
      const defaults = [
        {
          key: 'platform.maintenanceMode',
          value: false,
          category: 'platform',
          description: 'Enable/disable maintenance mode',
        },
        {
          key: 'platform.registrationOpen',
          value: true,
          category: 'platform',
          description: 'Allow new user registrations',
        },
        {
          key: 'platform.emailVerificationRequired',
          value: true,
          category: 'platform',
          description: 'Require email verification for new accounts',
        },
        {
          key: 'gamification.pointsEnabled',
          value: true,
          category: 'gamification',
          description: 'Enable point system',
        },
        {
          key: 'gamification.badgesEnabled',
          value: true,
          category: 'gamification',
          description: 'Enable badge system',
        },
        {
          key: 'gamification.leaderboardEnabled',
          value: true,
          category: 'gamification',
          description: 'Enable leaderboards',
        },
        {
          key: 'moderation.autoApproveRatings',
          value: false,
          category: 'moderation',
          description: 'Automatically approve user ratings',
        },
        {
          key: 'moderation.autoApproveCampaigns',
          value: true,
          category: 'moderation',
          description: 'Automatically approve user campaigns',
        },
        {
          key: 'notifications.emailNotifications',
          value: true,
          category: 'notifications',
          description: 'Enable email notifications',
        },
        {
          key: 'notifications.weeklyDigest',
          value: true,
          category: 'notifications',
          description: 'Send weekly digest emails',
        },
      ]

      for (const config of defaults) {
        const existing = await Configuration.findOne({ key: config.key })
        if (!existing) {
          await Configuration.create({
            ...config,
            modifiedBy: 'system',
            isActive: true,
          })
        }
      }

      logger.info('Default configurations initialized')
    } catch (error) {
      logger.error('Error initializing default configurations:', error)
    }
  }

  /**
   * Clear configuration cache
   */
  static async clearCache(pattern?: string): Promise<void> {
    try {
      const redis = RedisService.getInstance()

      if (pattern) {
        const keys = await redis.getClient().keys(`${this.CACHE_PREFIX}${pattern}*`)
        if (keys.length > 0) {
          await redis.getClient().del(keys)
        }
      } else {
        // Clear all config cache
        const keys = await redis.getClient().keys(`${this.CACHE_PREFIX}*`)
        if (keys.length > 0) {
          await redis.getClient().del(keys)
        }
      }

      logger.info(`Configuration cache cleared: ${pattern || 'all'}`)
    } catch (error) {
      logger.error('Error clearing configuration cache:', error)
    }
  }
}
