import mongoose, { Document, Schema } from 'mongoose'
import { logger as winstonLogger } from '../utils/logger'
import { RedisService } from './redis.service'
import { EmailService } from './email.service'

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Error category types
 */
export enum ErrorCategory {
  AUTH = 'authentication',
  DATABASE = 'database',
  EXTERNAL_API = 'external_api',
  VALIDATION = 'validation',
  BUSINESS_LOGIC = 'business_logic',
  SYSTEM = 'system',
  NETWORK = 'network',
  SECURITY = 'security',
}

/**
 * Interface for error tracking document
 */
interface IErrorLog extends Document {
  _id: mongoose.Types.ObjectId
  errorId: string
  message: string
  stack?: string
  severity: ErrorSeverity
  category: ErrorCategory
  userId?: mongoose.Types.ObjectId
  endpoint?: string
  method?: string
  userAgent?: string
  ip?: string
  requestBody?: any
  responseStatus?: number
  context?: Record<string, any>
  fingerprint: string
  count: number
  firstOccurrence: Date
  lastOccurrence: Date
  resolved: boolean
  resolvedAt?: Date
  resolvedBy?: mongoose.Types.ObjectId
  resolution?: string
  tags: string[]
  environment: string
  version?: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Error log schema
 */
const errorLogSchema = new Schema<IErrorLog>(
  {
    errorId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    message: {
      type: String,
      required: true,
      index: true,
    },
    stack: String,
    severity: {
      type: String,
      enum: Object.values(ErrorSeverity),
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: Object.values(ErrorCategory),
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    endpoint: String,
    method: String,
    userAgent: String,
    ip: String,
    requestBody: Schema.Types.Mixed,
    responseStatus: Number,
    context: Schema.Types.Mixed,
    fingerprint: {
      type: String,
      required: true,
      index: true,
    },
    count: {
      type: Number,
      default: 1,
    },
    firstOccurrence: {
      type: Date,
      default: Date.now,
    },
    lastOccurrence: {
      type: Date,
      default: Date.now,
    },
    resolved: {
      type: Boolean,
      default: false,
      index: true,
    },
    resolvedAt: Date,
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    resolution: String,
    tags: [
      {
        type: String,
        index: true,
      },
    ],
    environment: {
      type: String,
      required: true,
      default: process.env.NODE_ENV || 'development',
    },
    version: String,
  },
  {
    timestamps: true,
  }
)

// Compound indexes for efficient queries
errorLogSchema.index({ severity: 1, createdAt: -1 })
errorLogSchema.index({ category: 1, resolved: 1 })
errorLogSchema.index({ fingerprint: 1, environment: 1 })

const ErrorLog = mongoose.model<IErrorLog>('ErrorLog', errorLogSchema)

/**
 * Error tracking and monitoring service
 */
export class ErrorTrackingService {
  private static readonly ALERT_REDIS_KEY = 'error_alerts:'
  private static readonly RATE_LIMIT_WINDOW = 300 // 5 minutes
  private static readonly MAX_ERRORS_PER_WINDOW = 50

  /**
   * Track an error occurrence
   */
  static async trackError(error: {
    error: Error
    severity?: ErrorSeverity
    category?: ErrorCategory
    userId?: string
    request?: {
      endpoint?: string
      method?: string
      userAgent?: string
      ip?: string
      body?: any
    }
    response?: {
      status?: number
    }
    context?: Record<string, any>
    tags?: string[]
  }): Promise<void> {
    try {
      const {
        error: errorObj,
        severity = ErrorSeverity.MEDIUM,
        category = ErrorCategory.SYSTEM,
        userId,
        request,
        response,
        context,
        tags = [],
      } = error

      // Generate error fingerprint for deduplication
      const fingerprint = this.generateFingerprint(errorObj, request?.endpoint)

      // Check if this error already exists
      const existingError = await ErrorLog.findOne({
        fingerprint,
        environment: process.env.NODE_ENV || 'development',
      })

      if (existingError) {
        // Update existing error
        existingError.count += 1
        existingError.lastOccurrence = new Date()
        existingError.severity = this.getHigherSeverity(existingError.severity, severity)

        // Update context and tags if provided
        if (context) {
          existingError.context = { ...existingError.context, ...context }
        }
        if (tags.length > 0) {
          existingError.tags = [...new Set([...existingError.tags, ...tags])]
        }

        await existingError.save()
      } else {
        // Create new error log
        const errorLog = new ErrorLog({
          errorId: this.generateErrorId(),
          message: errorObj.message,
          stack: errorObj.stack,
          severity,
          category,
          userId: userId ? new mongoose.Types.ObjectId(userId) : undefined,
          endpoint: request?.endpoint,
          method: request?.method,
          userAgent: request?.userAgent,
          ip: request?.ip,
          requestBody: request?.body,
          responseStatus: response?.status,
          context,
          fingerprint,
          tags,
          environment: process.env.NODE_ENV || 'development',
          version: process.env.APP_VERSION || '1.0.0',
        })

        await errorLog.save()
      }

      // Log to Winston as well
      winstonLogger.error('Error tracked', {
        fingerprint,
        message: errorObj.message,
        severity,
        category,
        userId,
        endpoint: request?.endpoint,
      })

      // Check for alert conditions
      await this.checkAlertConditions(errorObj, severity, category)
    } catch (trackingError) {
      winstonLogger.error('Error in error tracking service:', trackingError)
    }
  }

  /**
   * Generate error fingerprint for deduplication
   */
  private static generateFingerprint(error: Error, endpoint?: string): string {
    const crypto = require('crypto')

    // Create a stable fingerprint based on error characteristics
    const components = [
      error.message,
      error.stack?.split('\n')[0] || '', // First line of stack trace
      endpoint || '',
      error.name || 'Error',
    ].join('|')

    return crypto.createHash('sha256').update(components).digest('hex').substring(0, 16)
  }

  /**
   * Generate unique error ID
   */
  private static generateErrorId(): string {
    const timestamp = Date.now().toString(36)
    const randomPart = Math.random().toString(36).substring(2, 8)
    return `err_${timestamp}_${randomPart}`
  }

  /**
   * Get higher severity between two levels
   */
  private static getHigherSeverity(
    existing: ErrorSeverity,
    incoming: ErrorSeverity
  ): ErrorSeverity {
    const severityOrder = {
      [ErrorSeverity.LOW]: 1,
      [ErrorSeverity.MEDIUM]: 2,
      [ErrorSeverity.HIGH]: 3,
      [ErrorSeverity.CRITICAL]: 4,
    }

    return severityOrder[incoming] > severityOrder[existing] ? incoming : existing
  }

  /**
   * Check if alert conditions are met
   */
  private static async checkAlertConditions(
    error: Error,
    severity: ErrorSeverity,
    category: ErrorCategory
  ): Promise<void> {
    try {
      const redis = RedisService.getInstance()
      const now = Date.now()
      const windowStart = now - this.RATE_LIMIT_WINDOW * 1000

      // Check for critical errors (immediate alert)
      if (severity === ErrorSeverity.CRITICAL) {
        await this.sendAlert({
          type: 'critical_error',
          message: `Critical error detected: ${error.message}`,
          severity,
          category,
          error,
        })
        return
      }

      // Check for error rate threshold
      const errorCountKey = `${this.ALERT_REDIS_KEY}rate:${category}`
      const currentCount = await redis.get(errorCountKey)
      const count = currentCount ? parseInt(currentCount) : 0

      if (count === 0) {
        // Set initial count with expiration
        await redis.set(errorCountKey, '1', this.RATE_LIMIT_WINDOW)
      } else {
        await redis.set(errorCountKey, (count + 1).toString(), this.RATE_LIMIT_WINDOW)
      }

      // Alert if threshold exceeded
      if (count + 1 >= this.MAX_ERRORS_PER_WINDOW) {
        await this.sendAlert({
          type: 'error_rate_exceeded',
          message: `Error rate threshold exceeded for ${category}: ${count + 1} errors in ${this.RATE_LIMIT_WINDOW / 60} minutes`,
          severity,
          category,
          error,
          count: count + 1,
        })
      }

      // Check for new error patterns
      await this.checkNewErrorPattern(error, category)
    } catch (alertError) {
      winstonLogger.error('Error checking alert conditions:', alertError)
    }
  }

  /**
   * Check for new error patterns
   */
  private static async checkNewErrorPattern(error: Error, category: ErrorCategory): Promise<void> {
    try {
      const redis = RedisService.getInstance()
      const patternKey = `${this.ALERT_REDIS_KEY}pattern:${category}:${error.name}`
      const lastSeen = await redis.get(patternKey)

      // If this error pattern hasn't been seen in the last hour, it's considered new
      if (!lastSeen) {
        await redis.set(patternKey, Date.now().toString(), 3600) // Cache for 1 hour

        await this.sendAlert({
          type: 'new_error_pattern',
          message: `New error pattern detected in ${category}: ${error.name} - ${error.message}`,
          severity: ErrorSeverity.MEDIUM,
          category,
          error,
        })
      }
    } catch (error) {
      winstonLogger.error('Error checking new error pattern:', error)
    }
  }

  /**
   * Send alert notification
   */
  private static async sendAlert(alert: {
    type: string
    message: string
    severity: ErrorSeverity
    category: ErrorCategory
    error: Error
    count?: number
  }): Promise<void> {
    try {
      // In production, you might want to send to multiple channels
      // For now, we'll log and optionally send email

      winstonLogger.error(`ALERT [${alert.type}]:`, {
        message: alert.message,
        severity: alert.severity,
        category: alert.category,
        stack: alert.error.stack,
        count: alert.count,
      })

      // Send email alert for critical errors
      if (alert.severity === ErrorSeverity.CRITICAL) {
        const adminEmails = process.env.ADMIN_ALERT_EMAILS?.split(',') || []

        for (const email of adminEmails) {
          try {
            await EmailService.sendAlertEmail(email.trim(), alert)
          } catch (emailError) {
            winstonLogger.error('Failed to send alert email:', emailError)
          }
        }
      }

      // Here you could integrate with services like:
      // - Slack webhook
      // - PagerDuty
      // - Discord webhook
      // - SMS service
      // - Push notifications
    } catch (error) {
      winstonLogger.error('Error sending alert:', error)
    }
  }

  /**
   * Get error statistics
   */
  static async getErrorStats(
    options: {
      startDate?: Date
      endDate?: Date
      category?: ErrorCategory
      severity?: ErrorSeverity
      environment?: string
    } = {}
  ): Promise<{
    total: number
    byCategory: Record<string, number>
    bySeverity: Record<string, number>
    recentTrends: Array<{ date: string; count: number }>
    topErrors: Array<{ message: string; count: number; fingerprint: string }>
  }> {
    try {
      const {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        endDate = new Date(),
        category,
        severity,
        environment = process.env.NODE_ENV || 'development',
      } = options

      const matchQuery: any = {
        createdAt: { $gte: startDate, $lte: endDate },
        environment,
      }

      if (category) matchQuery.category = category
      if (severity) matchQuery.severity = severity

      // Get total count
      const total = await ErrorLog.countDocuments(matchQuery)

      // Get stats by category
      const categoryStats = await ErrorLog.aggregate([
        { $match: matchQuery },
        { $group: { _id: '$category', count: { $sum: '$count' } } },
      ])

      const byCategory: Record<string, number> = {}
      categoryStats.forEach((stat) => {
        byCategory[stat._id] = stat.count
      })

      // Get stats by severity
      const severityStats = await ErrorLog.aggregate([
        { $match: matchQuery },
        { $group: { _id: '$severity', count: { $sum: '$count' } } },
      ])

      const bySeverity: Record<string, number> = {}
      severityStats.forEach((stat) => {
        bySeverity[stat._id] = stat.count
      })

      // Get recent trends (last 7 days)
      const trendsMatch = {
        ...matchQuery,
        createdAt: {
          $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          $lte: endDate,
        },
      }

      const trends = await ErrorLog.aggregate([
        { $match: trendsMatch },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: '$count' },
          },
        },
        { $sort: { _id: 1 } },
      ])

      const recentTrends = trends.map((trend) => ({
        date: trend._id,
        count: trend.count,
      }))

      // Get top errors
      const topErrors = await ErrorLog.find(matchQuery)
        .sort({ count: -1 })
        .limit(10)
        .select('message count fingerprint')

      return {
        total,
        byCategory,
        bySeverity,
        recentTrends,
        topErrors: topErrors.map((error) => ({
          message: error.message,
          count: error.count,
          fingerprint: error.fingerprint,
        })),
      }
    } catch (error) {
      winstonLogger.error('Error getting error stats:', error)
      throw error
    }
  }

  /**
   * Resolve an error
   */
  static async resolveError(
    errorId: string,
    resolvedBy: string,
    resolution: string
  ): Promise<void> {
    try {
      await ErrorLog.findOneAndUpdate(
        { errorId },
        {
          resolved: true,
          resolvedAt: new Date(),
          resolvedBy: new mongoose.Types.ObjectId(resolvedBy),
          resolution,
        }
      )

      winstonLogger.info(`Error resolved: ${errorId} by ${resolvedBy}`)
    } catch (error) {
      winstonLogger.error('Error resolving error:', error)
      throw error
    }
  }

  /**
   * Get recent errors for admin dashboard
   */
  static async getRecentErrors(
    limit: number = 50,
    filters: {
      severity?: ErrorSeverity
      category?: ErrorCategory
      resolved?: boolean
    } = {}
  ): Promise<IErrorLog[]> {
    try {
      const query: any = {
        environment: process.env.NODE_ENV || 'development',
        ...filters,
      }

      return await ErrorLog.find(query)
        .sort({ lastOccurrence: -1 })
        .limit(limit)
        .populate('userId', 'firstName lastName email')
        .populate('resolvedBy', 'firstName lastName email')
    } catch (error) {
      winstonLogger.error('Error getting recent errors:', error)
      throw error
    }
  }

  /**
   * Clean up old resolved errors
   */
  static async cleanupOldErrors(daysToKeep: number = 90): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000)

      const result = await ErrorLog.deleteMany({
        resolved: true,
        resolvedAt: { $lt: cutoffDate },
      })

      winstonLogger.info(`Cleaned up ${result.deletedCount} old resolved errors`)
    } catch (error) {
      winstonLogger.error('Error cleaning up old errors:', error)
    }
  }
}
