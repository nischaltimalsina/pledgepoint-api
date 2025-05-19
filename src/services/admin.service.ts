import { Types } from 'mongoose'
import {
  User,
  Official,
  Campaign,
  Rating,
  Promise as PromiseModel,
  Activity,
  Badge,
} from '../models'
import { AppError } from '../middleware/error-handler'
import { logger } from '../utils/logger'
import { RedisService } from './redis.service'
import { NotificationService } from './notification.service'
import { ErrorCategory, ErrorSeverity, ErrorTrackingService } from './error-tracking.service'
import { ConfigurationService } from './configuration.service'

/**
 * Service handling admin-related business logic
 */
export class AdminService {
  /**
   * Get dashboard statistics
   */
  static async getDashboardStatistics(options: { timeRange?: 'week' | 'month' | 'year' }) {
    try {
      const { timeRange = 'month' } = options

      // Calculate date range
      const now = new Date()
      let startDate: Date

      switch (timeRange) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        case 'year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
          break
      }

      // Get total counts
      const [
        totalUsers,
        activeUsers,
        totalOfficials,
        totalCampaigns,
        activeCampaigns,
        totalRatings,
        pendingRatings,
        totalPromises,
        totalBadges,
      ] = await Promise.all([
        User.countDocuments({ active: true }),
        User.countDocuments({
          active: true,
          lastLogin: { $gte: startDate },
        }),
        Official.countDocuments(),
        Campaign.countDocuments(),
        Campaign.countDocuments({ status: 'active' }),
        Rating.countDocuments(),
        Rating.countDocuments({ status: 'pending' }),
        PromiseModel.countDocuments(),
        Badge.countDocuments(),
      ])

      // Get registration trends
      const registrationTrend = await User.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt',
              },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])

      // Get engagement metrics
      const engagementMetrics = await Activity.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
          },
        },
      ])

      // Get top districts by activity
      const topDistricts = await Activity.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
        {
          $group: {
            _id: '$user.district',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ])

      return {
        overview: {
          totalUsers,
          activeUsers,
          totalOfficials,
          totalCampaigns,
          activeCampaigns,
          totalRatings,
          pendingRatings,
          totalPromises,
          totalBadges,
        },
        trends: {
          registrations: registrationTrend,
          engagement: engagementMetrics,
        },
        insights: {
          topDistricts,
          userRetention: activeUsers > 0 ? (activeUsers / totalUsers) * 100 : 0,
          campaignSuccessRate:
            totalCampaigns > 0
              ? ((await Campaign.countDocuments({ status: 'completed' })) / totalCampaigns) * 100
              : 0,
        },
      }
    } catch (error) {
      logger.error('Error getting dashboard statistics:', error)
      throw error
    }
  }

  /**
   * Get analytics data
   */
  static async getAnalytics(options: {
    metric: 'users' | 'officials' | 'campaigns' | 'engagement'
    timeRange?: 'week' | 'month' | 'year'
    district?: string
    category?: string
  }) {
    try {
      const { metric, timeRange = 'month', district, category } = options

      // Calculate date range
      const now = new Date()
      let startDate: Date

      switch (timeRange) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        case 'year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
          break
      }

      let analytics: any = {}

      switch (metric) {
        case 'users':
          analytics = await this.getUserAnalytics(startDate, district)
          break
        case 'officials':
          analytics = await this.getOfficialAnalytics(startDate, district)
          break
        case 'campaigns':
          analytics = await this.getCampaignAnalytics(startDate, district, category)
          break
        case 'engagement':
          analytics = await this.getEngagementAnalytics(startDate, district)
          break
      }

      return analytics
    } catch (error) {
      logger.error('Error getting analytics:', error)
      throw error
    }
  }

  /**
   * Get users with advanced filtering
   */
  static async getUsers(options: {
    page?: number
    limit?: number
    sort?: string
    role?: string
    level?: string
    accountStatus?: string
    district?: string
    search?: string
    verified?: boolean
    active?: boolean
  }) {
    try {
      const {
        page = 1,
        limit = 20,
        sort = '-createdAt',
        role,
        level,
        accountStatus,
        district,
        search,
        verified,
        active,
      } = options

      // Build filter
      const filter: any = {}

      if (role) filter.role = role
      if (level) filter.level = level
      if (accountStatus) filter.accountStatus = accountStatus
      if (district) filter.district = district
      if (verified !== undefined) filter.isEmailVerified = verified
      if (active !== undefined) filter.active = active

      // Add search functionality
      if (search) {
        filter.$or = [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ]
      }

      // Get users with pagination
      const users = await User.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-password -refreshToken -twoFactorSecret -backupCodes')

      // Get total count
      const total = await User.countDocuments(filter)

      return {
        data: users,
        meta: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      }
    } catch (error) {
      logger.error('Error getting users:', error)
      throw error
    }
  }

  /**
   * Update user (admin function)
   */
  static async updateUser(
    userId: string,
    updates: {
      role?: string
      accountStatus?: string
      level?: string
      impactPoints?: number
      active?: boolean
    }
  ) {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw new AppError(400, 'Invalid user ID')
      }

      const user = await User.findByIdAndUpdate(
        userId,
        { $set: updates },
        { new: true, runValidators: true }
      ).select('-password -refreshToken -twoFactorSecret -backupCodes')

      if (!user) {
        throw new AppError(404, 'User not found')
      }

      // Log admin action
      await this.logAdminAction('user_updated', userId, updates)

      return user
    } catch (error) {
      logger.error(`Error updating user ${userId}:`, error)
      throw error
    }
  }

  /**
   * Bulk update users
   */
  static async bulkUpdateUsers(userIds: string[], updates: object) {
    try {
      const validUserIds = userIds.filter((id) => Types.ObjectId.isValid(id))

      if (validUserIds.length === 0) {
        throw new AppError(400, 'No valid user IDs provided')
      }

      const result = await User.updateMany(
        { _id: { $in: validUserIds.map((id) => new Types.ObjectId(id)) } },
        { $set: updates }
      )

      // Log bulk action
      await this.logAdminAction('users_bulk_updated', null, {
        count: result.modifiedCount,
        updates,
      })

      return {
        matched: result.matchedCount,
        modified: result.modifiedCount,
      }
    } catch (error) {
      logger.error('Error bulk updating users:', error)
      throw error
    }
  }

  /**
   * Get content pending moderation
   */
  static async getPendingModeration(options: {
    type?: 'ratings' | 'campaigns' | 'all'
    page?: number
    limit?: number
    sort?: string
  }) {
    try {
      const { type = 'all', page = 1, limit = 20, sort = '-createdAt' } = options

      let result: any = {}

      if (type === 'ratings' || type === 'all') {
        const ratings = await Rating.find({ status: 'pending' })
          .sort(sort)
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('userId', 'firstName lastName email')
          .populate('officialId', 'name position district')

        const ratingsTotal = await Rating.countDocuments({ status: 'pending' })

        result.ratings = {
          data: ratings,
          total: ratingsTotal,
        }
      }

      if (type === 'campaigns' || type === 'all') {
        // Assuming campaigns might need moderation when reported
        const campaigns = await Campaign.find({
          status: 'active',
          // Add reported flag or similar logic
        })
          .sort(sort)
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('creatorId', 'firstName lastName email')

        result.campaigns = {
          data: campaigns,
          total: campaigns.length,
        }
      }

      return result
    } catch (error) {
      logger.error('Error getting pending moderation:', error)
      throw error
    }
  }

  /**
   * Moderate content
   */
  static async moderateContent(
    type: 'rating' | 'campaign',
    contentId: string,
    action: 'approve' | 'reject',
    moderatorId: string,
    reason?: string
  ) {
    try {
      if (!Types.ObjectId.isValid(contentId)) {
        throw new AppError(400, 'Invalid content ID')
      }

      let result: any

      if (type === 'rating') {
        const status = action === 'approve' ? 'approved' : 'rejected'

        result = await Rating.findByIdAndUpdate(
          contentId,
          {
            status,
            moderatorNote: reason,
            moderatedBy: new Types.ObjectId(moderatorId),
            moderatedAt: new Date(),
          },
          { new: true }
        )

        if (!result) {
          throw new AppError(404, 'Rating not found')
        }

        // Notify user about moderation result
        await NotificationService.sendRatingModerationNotification(
          result.userId.toString(),
          'Official', // Would need to get actual official name
          action === 'approve',
          reason
        )
      } else if (type === 'campaign') {
        // Handle campaign moderation
        const updateData: any = {
          moderatedBy: new Types.ObjectId(moderatorId),
          moderatedAt: new Date(),
        }

        if (action === 'reject') {
          updateData.status = 'archived'
          updateData.moderatorNote = reason
        }

        result = await Campaign.findByIdAndUpdate(contentId, updateData, { new: true })

        if (!result) {
          throw new AppError(404, 'Campaign not found')
        }
      }

      // Log moderation action
      await this.logAdminAction(`${type}_${action}`, contentId, { reason })

      return result
    } catch (error) {
      logger.error(`Error moderating ${type} ${contentId}:`, error)
      throw error
    }
  }

  /**
   * Get audit logs
   */
  static async getAuditLogs(options: {
    page?: number
    limit?: number
    userId?: string
    action?: string
    startDate?: Date
    endDate?: Date
  }) {
    try {
      const { page = 1, limit = 50, userId, action, startDate, endDate } = options

      // Build filter
      const filter: any = {}

      if (userId) filter.userId = new Types.ObjectId(userId)
      if (action) filter.action = action
      if (startDate || endDate) {
        filter.createdAt = {}
        if (startDate) filter.createdAt.$gte = startDate
        if (endDate) filter.createdAt.$lte = endDate
      }

      // Get audit logs (using Activity model as audit log)
      const logs = await Activity.find(filter)
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('userId', 'firstName lastName email')

      const total = await Activity.countDocuments(filter)

      return {
        data: logs,
        meta: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      logger.error('Error getting audit logs:', error)
      throw error
    }
  }

  /**
   * Generate reports
   */
  static async generateReport(options: {
    type: 'users' | 'officials' | 'campaigns' | 'engagement'
    startDate?: Date
    endDate?: Date
    district?: string
    format?: 'json' | 'csv'
  }) {
    try {
      const { type, startDate, endDate, district, format = 'json' } = options

      let data: any

      switch (type) {
        case 'users':
          data = await this.generateUserReport(startDate, endDate, district)
          break
        case 'officials':
          data = await this.generateOfficialReport(startDate, endDate, district)
          break
        case 'campaigns':
          data = await this.generateCampaignReport(startDate, endDate, district)
          break
        case 'engagement':
          data = await this.generateEngagementReport(startDate, endDate, district)
          break
      }

      if (format === 'csv') {
        return this.convertToCSV(data)
      }

      return data
    } catch (error) {
      logger.error(`Error generating ${options.type} report:`, error)
      throw error
    }
  }

  // Replace the existing getConfiguration method (around line 650)
  /**
   * Get platform configuration
   */
  static async getConfiguration(): Promise<any> {
    try {
      return await ConfigurationService.getAllConfigs()
    } catch (error) {
      logger.error('Error getting configuration:', error)
      throw error
    }
  }

  // Replace the existing updateConfiguration method (around line 670)
  /**
   * Update platform configuration
   */
  static async updateConfiguration(updates: Record<string, any>, adminId: string): Promise<any> {
    try {
      const results: Record<string, boolean> = {}

      // Process each configuration update
      for (const [key, value] of Object.entries(updates)) {
        // Parse the key to extract category (format: category.key)
        const keyParts = key.split('.')
        if (keyParts.length !== 2) {
          throw new AppError(400, `Invalid configuration key format: ${key}`)
        }

        const [category, configKey] = keyParts
        const success = await ConfigurationService.setConfig(
          key,
          value,
          category,
          adminId,
          `Updated via admin panel`
        )

        results[key] = success
      }

      // Clear configuration cache
      await ConfigurationService.clearCache()

      // Log configuration changes
      await this.logAdminAction('config_updated', null, { updates, results, adminId })

      // Get updated configuration
      const updatedConfig = await ConfigurationService.getAllConfigs()

      return {
        success: true,
        updated: Object.keys(updates).length,
        results,
        config: updatedConfig,
      }
    } catch (error) {
      logger.error('Error updating configuration:', error)
      throw error
    }
  }

  /**
   * Get error dashboard statistics
   */

  static async getErrorStatistics(
    options: {
      startDate?: Date
      endDate?: Date
      category?: ErrorCategory
      severity?: ErrorSeverity
      environment?: string
    } = {}
  ): Promise<any> {
    try {
      return await ErrorTrackingService.getErrorStats(options)
    } catch (error) {
      logger.error('Error getting error statistics:', error)
      throw error
    }
  }

  // Add this new method after getErrorStatistics
  /**
   * Get recent errors for admin dashboard
   */
  static async getRecentErrors(
    options: {
      limit?: number
      severity?: string
      category?: string
      resolved?: boolean
    } = {}
  ): Promise<any> {
    try {
      const { limit = 50, severity, category, resolved } = options

      const filters: any = {}
      if (severity) filters.severity = severity
      if (category) filters.category = category
      if (resolved !== undefined) filters.resolved = resolved

      return await ErrorTrackingService.getRecentErrors(limit, filters)
    } catch (error) {
      logger.error('Error getting recent errors:', error)
      throw error
    }
  }

  // Add this new method after getRecentErrors
  /**
   * Resolve an error
   */
  static async resolveError(
    errorId: string,
    resolvedBy: string,
    resolution: string
  ): Promise<void> {
    try {
      await ErrorTrackingService.resolveError(errorId, resolvedBy, resolution)

      // Log admin action
      await this.logAdminAction('error_resolved', errorId, { resolution, resolvedBy })
    } catch (error) {
      logger.error(`Error resolving error ${errorId}:`, error)
      throw error
    }
  }

  // Add this new method after resolveError
  /**
   * Clean up old resolved errors
   */
  static async cleanupOldErrors(daysToKeep: number = 90): Promise<{ cleaned: number }> {
    try {
      await ErrorTrackingService.cleanupOldErrors(daysToKeep)

      // Log admin action
      await this.logAdminAction('errors_cleaned_up', null, { daysToKeep })

      return { cleaned: daysToKeep }
    } catch (error) {
      logger.error('Error cleaning up old errors:', error)
      throw error
    }
  }

  // Replace the existing getSystemHealth method (around line 600)
  /**
   * Get system health status
   */
  static async getSystemHealth(): Promise<any> {
    try {
      // Check database connectivity
      const dbStatus = await this.checkDatabaseHealth()

      // Check Redis connectivity
      const redisStatus = await this.checkRedisHealth()

      // Get system metrics
      const metrics = {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
      }

      // Get recent error statistics
      const errorStats = await ErrorTrackingService.getErrorStats({
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      })

      // Get critical errors count
      const criticalErrors = await ErrorTrackingService.getRecentErrors(10, {
        severity: 'critical' as ErrorSeverity,
        resolved: false,
      })

      return {
        status: dbStatus.connected && redisStatus.connected ? 'healthy' : 'unhealthy',
        services: {
          database: dbStatus,
          redis: redisStatus,
        },
        metrics,
        errors: {
          total24h: errorStats.total,
          byCategory: errorStats.byCategory,
          bySeverity: errorStats.bySeverity,
          criticalCount: criticalErrors.length,
          recentTrends: errorStats.recentTrends,
        },
      }
    } catch (error) {
      logger.error('Error getting system health:', error)
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Get user activity
   */
  static async getUserActivity(
    userId: string,
    options: {
      page?: number
      limit?: number
      type?: string
      startDate?: Date
      endDate?: Date
    }
  ) {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw new AppError(400, 'Invalid user ID')
      }

      const { page = 1, limit = 20, type, startDate, endDate } = options

      // Build filter
      const filter: any = { userId: new Types.ObjectId(userId) }

      if (type) filter.type = type
      if (startDate || endDate) {
        filter.createdAt = {}
        if (startDate) filter.createdAt.$gte = startDate
        if (endDate) filter.createdAt.$lte = endDate
      }

      const activities = await Activity.find(filter)
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(limit)

      const total = await Activity.countDocuments(filter)

      return {
        data: activities,
        meta: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      logger.error(`Error getting user activity for ${userId}:`, error)
      throw error
    }
  }

  /**
   * Get top performers
   */
  static async getTopPerformers(options: {
    category: 'users' | 'officials' | 'campaigns'
    metric?: string
    timeRange?: 'week' | 'month' | 'year'
    limit?: number
  }) {
    try {
      const { category, metric, timeRange = 'month', limit = 10 } = options

      // Calculate date range
      const now = new Date()
      let startDate: Date

      switch (timeRange) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        case 'year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
          break
      }

      let performers: any

      switch (category) {
        case 'users':
          performers = await User.find()
            .sort({ impactPoints: -1 })
            .limit(limit)
            .select('firstName lastName impactPoints level badges')
          break

        case 'officials':
          performers = await Official.find()
            .sort({ 'averageRating.overall': -1 })
            .limit(limit)
            .select('name position district averageRating totalRatings')
          break

        case 'campaigns':
          performers = await Campaign.find({ status: 'completed' })
            .sort({ currentSupport: -1 })
            .limit(limit)
            .populate('creatorId', 'firstName lastName')
            .select('title currentSupport goal creatorId')
          break
      }

      return performers
    } catch (error) {
      logger.error('Error getting top performers:', error)
      throw error
    }
  }

  /**
   * Send notification to users
   */
  static async sendNotification(options: {
    recipients: 'all' | 'role' | 'level' | 'specific'
    title: string
    message: string
    type: 'info' | 'warning' | 'error' | 'success'
    filters?: object
    adminId: string
  }) {
    try {
      const { recipients, title, message, type, filters, adminId } = options

      let targetUsers: any[]

      switch (recipients) {
        case 'all':
          targetUsers = await User.find({ active: true }).select('email firstName')
          break
        case 'role':
        case 'level':
        case 'specific':
          targetUsers = await User.find({ ...filters, active: true }).select('email firstName')
          break
        default:
          throw new AppError(400, 'Invalid recipient type')
      }

      // In a real implementation, this would send actual notifications
      // For now, we'll just log the action

      await this.logAdminAction('notification_sent', null, {
        title,
        type,
        recipientCount: targetUsers.length,
        adminId,
      })

      return {
        sent: targetUsers.length,
        title,
        type,
      }
    } catch (error) {
      logger.error('Error sending notification:', error)
      throw error
    }
  }

  /**
   * Get badges
   */
  static async getBadges(options: {
    page?: number
    limit?: number
    category?: string
    active?: boolean
  }) {
    try {
      const { page = 1, limit = 20, category, active } = options

      const filter: any = {}
      if (category) filter.category = category
      if (active !== undefined) filter.active = active

      const badges = await Badge.find(filter)
        .sort('category order')
        .skip((page - 1) * limit)
        .limit(limit)

      const total = await Badge.countDocuments(filter)

      return {
        data: badges,
        meta: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      logger.error('Error getting badges:', error)
      throw error
    }
  }

  /**
   * Create badge
   */
  static async createBadge(badgeData: any) {
    try {
      const badge = new Badge({
        _id: new Types.ObjectId(),
        ...badgeData,
      })

      await badge.save()

      await this.logAdminAction('badge_created', badge._id.toString(), badgeData)

      return badge
    } catch (error) {
      logger.error('Error creating badge:', error)
      throw error
    }
  }

  /**
   * Update badge
   */
  static async updateBadge(badgeId: string, updateData: any) {
    try {
      if (!Types.ObjectId.isValid(badgeId)) {
        throw new AppError(400, 'Invalid badge ID')
      }

      const badge = await Badge.findByIdAndUpdate(
        badgeId,
        { $set: updateData },
        { new: true, runValidators: true }
      )

      if (!badge) {
        throw new AppError(404, 'Badge not found')
      }

      await this.logAdminAction('badge_updated', badgeId, updateData)

      return badge
    } catch (error) {
      logger.error(`Error updating badge ${badgeId}:`, error)
      throw error
    }
  }

  /**
   * Delete badge
   */
  static async deleteBadge(badgeId: string) {
    try {
      if (!Types.ObjectId.isValid(badgeId)) {
        throw new AppError(400, 'Invalid badge ID')
      }

      const badge = await Badge.findByIdAndDelete(badgeId)

      if (!badge) {
        throw new AppError(404, 'Badge not found')
      }

      await this.logAdminAction('badge_deleted', badgeId, { name: badge.name })

      return { success: true }
    } catch (error) {
      logger.error(`Error deleting badge ${badgeId}:`, error)
      throw error
    }
  }

  /**
   * Clear cache
   */
  static async clearCache(pattern?: string) {
    try {
      const redis = RedisService.getInstance()

      if (pattern) {
        // Clear specific pattern
        // This is a simplified implementation
        const keys = await redis.getClient().keys(pattern)
        if (keys.length > 0) {
          await redis.getClient().del(keys)
        }

        await this.logAdminAction('cache_cleared', null, { pattern, keysCleared: keys.length })

        return {
          pattern,
          cleared: keys.length,
        }
      } else {
        // Clear all cache
        await redis.getClient().flushAll()

        await this.logAdminAction('cache_cleared', null, { type: 'all' })

        return {
          type: 'all',
          cleared: true,
        }
      }
    } catch (error) {
      logger.error('Error clearing cache:', error)
      throw error
    }
  }

  /**
   * Private helper methods
   */

  private static async getUserAnalytics(startDate: Date, district?: string) {
    const filter: any = { createdAt: { $gte: startDate } }
    if (district) filter.district = district

    const [registrations, levels, districts] = await Promise.all([
      User.aggregate([
        { $match: filter },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      User.aggregate([{ $match: filter }, { $group: { _id: '$level', count: { $sum: 1 } } }]),
      User.aggregate([
        { $match: filter },
        { $group: { _id: '$district', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
    ])

    return { registrations, levels, districts }
  }

  private static async getOfficialAnalytics(startDate: Date, district?: string) {
    const filter: any = {}
    if (district) filter.district = district

    const [ratings, topRated, categories] = await Promise.all([
      Official.aggregate([
        { $match: filter },
        { $unwind: '$ratings' },
        { $match: { 'ratings.createdAt': { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$ratings.createdAt' } },
            count: { $sum: 1 },
            avgRating: { $avg: '$ratings.overall' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Official.find(filter)
        .sort({ 'averageRating.overall': -1 })
        .limit(10)
        .select('name position averageRating totalRatings'),
      Official.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$position',
            count: { $sum: 1 },
            avgRating: { $avg: '$averageRating.overall' },
          },
        },
      ]),
    ])

    return { ratings, topRated, categories }
  }

  private static async getCampaignAnalytics(startDate: Date, district?: string, category?: string) {
    const filter: any = { createdAt: { $gte: startDate } }
    if (district) filter.district = district
    if (category) filter.category = category

    const [campaigns, success, categories] = await Promise.all([
      Campaign.aggregate([
        { $match: filter },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Campaign.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
      Campaign.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            avgSupport: { $avg: '$currentSupport' },
          },
        },
      ]),
    ])

    return { campaigns, success, categories }
  }

  private static async getEngagementAnalytics(startDate: Date, district?: string) {
    const userFilter: any = {}
    if (district) userFilter.district = district

    const activityFilter: any = { createdAt: { $gte: startDate } }

    let activities = await Activity.aggregate([
      { $match: activityFilter },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      ...(district ? [{ $match: { 'user.district': district } }] : []),
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            type: '$type',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.date': 1 } },
    ])

    const userEngagement = await Activity.aggregate([
      { $match: activityFilter },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      ...(district ? [{ $match: { 'user.district': district } }] : []),
      {
        $group: {
          _id: '$userId',
          activityCount: { $sum: 1 },
          pointsEarned: { $sum: '$pointsEarned' },
          user: { $first: '$user' },
        },
      },
      { $sort: { activityCount: -1 } },
      { $limit: 10 },
    ])

    return { activities, userEngagement }
  }

  private static async checkDatabaseHealth() {
    try {
      await User.findOne().limit(1)
      return { connected: true, status: 'healthy' }
    } catch (error) {
      return {
        connected: false,
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  private static async checkRedisHealth() {
    try {
      const redis = RedisService.getInstance()
      await redis.getClient().ping()
      return { connected: true, status: 'healthy' }
    } catch (error) {
      return {
        connected: false,
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  private static async generateUserReport(startDate?: Date, endDate?: Date, district?: string) {
    const filter: any = {}
    if (startDate && endDate) {
      filter.createdAt = { $gte: startDate, $lte: endDate }
    }
    if (district) filter.district = district

    return await User.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          verifiedUsers: { $sum: { $cond: ['$isEmailVerified', 1, 0] } },
          activeUsers: { $sum: { $cond: ['$active', 1, 0] } },
          avgImpactPoints: { $avg: '$impactPoints' },
          levelBreakdown: {
            $push: '$level',
          },
        },
      },
      {
        $project: {
          totalUsers: 1,
          verifiedUsers: 1,
          activeUsers: 1,
          avgImpactPoints: { $round: ['$avgImpactPoints', 2] },
          verificationRate: {
            $round: [{ $multiply: [{ $divide: ['$verifiedUsers', '$totalUsers'] }, 100] }, 2],
          },
          activeRate: {
            $round: [{ $multiply: [{ $divide: ['$activeUsers', '$totalUsers'] }, 100] }, 2],
          },
        },
      },
    ])
  }

  private static async generateOfficialReport(startDate?: Date, endDate?: Date, district?: string) {
    const filter: any = {}
    if (district) filter.district = district

    const ratingFilter: any = {}
    if (startDate && endDate) {
      ratingFilter.createdAt = { $gte: startDate, $lte: endDate }
    }

    return await Official.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: 'ratings',
          localField: '_id',
          foreignField: 'officialId',
          as: 'allRatings',
        },
      },
      {
        $project: {
          name: 1,
          position: 1,
          district: 1,
          party: 1,
          totalRatings: 1,
          averageRating: 1,
          ratingsInPeriod: {
            $size: {
              $filter: {
                input: '$allRatings',
                cond:
                  startDate && endDate
                    ? {
                        $and: [
                          { $gte: ['$this.createdAt', startDate] },
                          { $lte: ['$this.createdAt', endDate] },
                        ],
                      }
                    : true,
              },
            },
          },
        },
      },
      { $sort: { 'averageRating.overall': -1 } },
    ])
  }

  private static async generateCampaignReport(startDate?: Date, endDate?: Date, district?: string) {
    const filter: any = {}
    if (startDate && endDate) {
      filter.createdAt = { $gte: startDate, $lte: endDate }
    }
    if (district) filter.district = district

    return await Campaign.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalSupport: { $sum: '$currentSupport' },
          avgSupport: { $avg: '$currentSupport' },
          successRate: {
            $avg: {
              $cond: [{ $gte: ['$currentSupport', '$goal'] }, 1, 0],
            },
          },
        },
      },
      {
        $project: {
          status: '$_id',
          count: 1,
          totalSupport: 1,
          avgSupport: { $round: ['$avgSupport', 2] },
          successRate: { $round: [{ $multiply: ['$successRate', 100] }, 2] },
        },
      },
    ])
  }

  private static async generateEngagementReport(
    startDate?: Date,
    endDate?: Date,
    district?: string
  ) {
    const filter: any = {}
    if (startDate && endDate) {
      filter.createdAt = { $gte: startDate, $lte: endDate }
    }

    let pipeline: any[] = [
      { $match: filter },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
    ]

    if (district) {
      pipeline.push({ $match: { 'user.district': district } })
    }

    pipeline.push(
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
          totalPoints: { $sum: '$pointsEarned' },
        },
      },
      {
        $project: {
          activityType: '$_id',
          count: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
          totalPoints: 1,
          avgPointsPerActivity: {
            $round: [{ $divide: ['$totalPoints', '$count'] }, 2],
          },
        },
      }
    )

    return await Activity.aggregate(pipeline)
  }

  private static convertToCSV(data: any[]): string {
    if (!data || data.length === 0) return ''

    const headers = Object.keys(data[0])
    const csvLines = [headers.join(',')]

    for (const row of data) {
      const values = headers.map((header) => {
        const value = row[header]
        // Handle values that might contain commas
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`
        }
        return value
      })
      csvLines.push(values.join(','))
    }

    return csvLines.join('\n')
  }

  private static async logAdminAction(action: string, targetId: string | null, details: any) {
    try {
      const activity = new Activity({
        userId: new Types.ObjectId(), // This should be the admin user ID
        type: 'admin_action',
        details: {
          action,
          targetId,
          ...details,
        },
        pointsEarned: 0,
      })

      await activity.save()
    } catch (error) {
      logger.error('Error logging admin action:', error)
    }
  }
}
