import { Request, Response, NextFunction } from 'express'
import { AdminService } from '../services/admin.service'
import { logger } from '../utils/logger'
import { AuthenticatedRequest } from '../types/user.types'

/**
 * Controller for handling admin-related endpoints
 */
export class AdminController {
  /**
   * Get platform dashboard statistics
   * @route GET /api/admin/dashboard
   */
  static async getDashboardStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { timeRange } = req.query

      const stats = await AdminService.getDashboardStatistics({
        timeRange: timeRange as 'week' | 'month' | 'year',
      })

      res.status(200).json({
        data: stats,
      })
    } catch (error) {
      logger.error('Error in getDashboardStats controller:', error)
      next(error)
    }
  }

  /**
   * Get platform analytics
   * @route GET /api/admin/analytics
   */
  static async getAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { metric, timeRange, district, category } = req.query

      const analytics = await AdminService.getAnalytics({
        metric: metric as 'users' | 'officials' | 'campaigns' | 'engagement',
        timeRange: timeRange as 'week' | 'month' | 'year',
        district: district as string,
        category: category as string,
      })

      res.status(200).json({
        data: analytics,
      })
    } catch (error) {
      logger.error('Error in getAnalytics controller:', error)
      next(error)
    }
  }

  /**
   * Get all users with advanced filtering (admin view)
   * @route GET /api/admin/users
   */
  static async getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, sort, role, level, accountStatus, district, search, verified, active } =
        req.query

      const result = await AdminService.getUsers({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        sort: sort as string,
        role: role as string,
        level: level as string,
        accountStatus: accountStatus as string,
        district: district as string,
        search: search as string,
        verified: verified === 'true' ? true : verified === 'false' ? false : undefined,
        active: active === 'true' ? true : active === 'false' ? false : undefined,
      })

      res.status(200).json(result)
    } catch (error) {
      logger.error('Error in getUsers controller:', error)
      next(error)
    }
  }

  /**
   * Update user role or status
   * @route PATCH /api/admin/users/:id
   */
  static async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const { role, accountStatus, level, impactPoints, active } = req.body

      const user = await AdminService.updateUser(id, {
        role,
        accountStatus,
        level,
        impactPoints,
        active,
      })

      res.status(200).json({
        message: 'User updated successfully',
        data: user,
      })
    } catch (error) {
      logger.error(`Error in updateUser controller for ID ${req.params.id}:`, error)
      next(error)
    }
  }

  /**
   * Bulk update users
   * @route PATCH /api/admin/users/bulk
   */
  static async bulkUpdateUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userIds, updates } = req.body

      const result = await AdminService.bulkUpdateUsers(userIds, updates)

      res.status(200).json({
        message: 'Bulk update completed',
        data: result,
      })
    } catch (error) {
      logger.error('Error in bulkUpdateUsers controller:', error)
      next(error)
    }
  }

  /**
   * Get content pending moderation
   * @route GET /api/admin/moderation
   */
  static async getPendingModeration(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { type, page, limit, sort } = req.query

      const result = await AdminService.getPendingModeration({
        type: type as 'ratings' | 'campaigns' | 'all',
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        sort: sort as string,
      })

      res.status(200).json(result)
    } catch (error) {
      logger.error('Error in getPendingModeration controller:', error)
      next(error)
    }
  }

  /**
   * Moderate content (approve/reject)
   * @route PATCH /api/admin/moderate/:type/:id
   */
  static async moderateContent(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const { type, id } = authenticatedReq.params
      const { action, reason } = authenticatedReq.body
      const moderatorId = authenticatedReq.user._id.toString()

      const result = await AdminService.moderateContent(
        type as 'rating' | 'campaign',
        id,
        action as 'approve' | 'reject',
        moderatorId,
        reason
      )

      res.status(200).json({
        message: `Content ${action}ed successfully`,
        data: result,
      })
    } catch (error) {
      logger.error(
        `Error in moderateContent controller for ${authenticatedReq.params.type} ${authenticatedReq.params.id}:`,
        error
      )
      next(error)
    }
  }

  /**
   * Get system health status
   * @route GET /api/admin/health
   */
  static async getSystemHealth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const health = await AdminService.getSystemHealth()

      res.status(200).json({
        data: health,
      })
    } catch (error) {
      logger.error('Error in getSystemHealth controller:', error)
      next(error)
    }
  }

  /**
   * Get audit logs
   * @route GET /api/admin/audit-logs
   */
  static async getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, userId, action, startDate, endDate } = req.query

      const result = await AdminService.getAuditLogs({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        userId: userId as string,
        action: action as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      })

      res.status(200).json(result)
    } catch (error) {
      logger.error('Error in getAuditLogs controller:', error)
      next(error)
    }
  }

  /**
   * Generate platform report
   * @route GET /api/admin/reports/:type
   */
  static async generateReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type } = req.params
      const { startDate, endDate, district, format } = req.query

      const report = await AdminService.generateReport({
        type: type as 'users' | 'officials' | 'campaigns' | 'engagement',
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        district: district as string,
        format: format as 'json' | 'csv',
      })

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv')
        res.setHeader('Content-Disposition', `attachment; filename="${type}-report.csv"`)
        res.status(200).send(report)
      } else {
        res.status(200).json({
          data: report,
        })
      }
    } catch (error) {
      logger.error(`Error in generateReport controller for type ${req.params.type}:`, error)
      next(error)
    }
  }

  /**
   * Get platform configuration
   * @route GET /api/admin/config
   */
  static async getConfiguration(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = await AdminService.getConfiguration()

      res.status(200).json({
        data: config,
      })
    } catch (error) {
      logger.error('Error in getConfiguration controller:', error)
      next(error)
    }
  }

  /**
   * Update platform configuration
   * @route PATCH /api/admin/config
   */
  static async updateConfiguration(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const configUpdates = req.body

      const config = await AdminService.updateConfiguration(
        configUpdates,
        authenticatedReq.user._id.toString()
      )

      res.status(200).json({
        message: 'Configuration updated successfully',
        data: config,
      })
    } catch (error) {
      logger.error('Error in updateConfiguration controller:', error)
      next(error)
    }
  }

  /**
   * Get user activity feed (for admin view)
   * @route GET /api/admin/users/:id/activity
   */
  static async getUserActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const { page, limit, type, startDate, endDate } = req.query

      const result = await AdminService.getUserActivity(id, {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        type: type as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      })

      res.status(200).json(result)
    } catch (error) {
      logger.error(`Error in getUserActivity controller for ID ${req.params.id}:`, error)
      next(error)
    }
  }

  /**
   * Get top performers (users, officials, campaigns)
   * @route GET /api/admin/top-performers
   */
  static async getTopPerformers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { category, metric, timeRange, limit } = req.query

      const performers = await AdminService.getTopPerformers({
        category: category as 'users' | 'officials' | 'campaigns',
        metric: metric as string,
        timeRange: timeRange as 'week' | 'month' | 'year',
        limit: limit ? parseInt(limit as string) : undefined,
      })

      res.status(200).json({
        data: performers,
      })
    } catch (error) {
      logger.error('Error in getTopPerformers controller:', error)
      next(error)
    }
  }

  /**
   * Send notification to users
   * @route POST /api/admin/notifications
   */
  static async sendNotification(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const { recipients, title, message, type, filters } = authenticatedReq.body
      const adminId = authenticatedReq.user._id.toString()

      const result = await AdminService.sendNotification({
        recipients,
        title,
        message,
        type,
        filters,
        adminId,
      })

      res.status(200).json({
        message: 'Notification sent successfully',
        data: result,
      })
    } catch (error) {
      logger.error('Error in sendNotification controller:', error)
      next(error)
    }
  }

  /**
   * Manage badges (create, update, list)
   * @route GET /api/admin/badges
   */
  static async getBadges(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, category, active } = req.query

      const result = await AdminService.getBadges({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        category: category as string,
        active: active === 'true' ? true : active === 'false' ? false : undefined,
      })

      res.status(200).json(result)
    } catch (error) {
      logger.error('Error in getBadges controller:', error)
      next(error)
    }
  }

  /**
   * Create a new badge
   * @route POST /api/admin/badges
   */
  static async createBadge(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const badgeData = req.body

      const badge = await AdminService.createBadge(badgeData)

      res.status(201).json({
        message: 'Badge created successfully',
        data: badge,
      })
    } catch (error) {
      logger.error('Error in createBadge controller:', error)
      next(error)
    }
  }

  /**
   * Update a badge
   * @route PUT /api/admin/badges/:id
   */
  static async updateBadge(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const updateData = req.body

      const badge = await AdminService.updateBadge(id, updateData)

      res.status(200).json({
        message: 'Badge updated successfully',
        data: badge,
      })
    } catch (error) {
      logger.error(`Error in updateBadge controller for ID ${req.params.id}:`, error)
      next(error)
    }
  }

  /**
   * Delete a badge
   * @route DELETE /api/admin/badges/:id
   */
  static async deleteBadge(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params

      await AdminService.deleteBadge(id)

      res.status(200).json({
        message: 'Badge deleted successfully',
      })
    } catch (error) {
      logger.error(`Error in deleteBadge controller for ID ${req.params.id}:`, error)
      next(error)
    }
  }

  /**
   * Clear cache (performance management)
   * @route POST /api/admin/cache/clear
   */
  static async clearCache(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { pattern } = req.body

      const result = await AdminService.clearCache(pattern)

      res.status(200).json({
        message: 'Cache cleared successfully',
        data: result,
      })
    } catch (error) {
      logger.error('Error in clearCache controller:', error)
      next(error)
    }
  }
}
