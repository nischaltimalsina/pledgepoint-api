import { Router } from 'express'
import { AdminController } from '../controllers/admin.controller'
import { AuthMiddleware } from '../middleware/auth'
import { RateLimiter } from '../middleware/rate-limiter'
import { validate } from '../middleware/validation'
import { ValidationSchemas } from '../middleware/validation'

const router = Router()

// All admin routes require authentication and admin role
router.use(AuthMiddleware.authenticate)
router.use(AuthMiddleware.authorize(['admin', 'superadmin']))

// Dashboard and Analytics
router.get('/dashboard', AdminController.getDashboardStats)
router.get('/analytics', AdminController.getAnalytics)

// User Management
router.get('/users', AdminController.getUsers)
router.patch(
  '/users/:id',
  RateLimiter.apiLimiter,
  validate(ValidationSchemas.common.id, 'params'),
  AdminController.updateUser
)
router.patch('/users/bulk', RateLimiter.apiLimiter, AdminController.bulkUpdateUsers)
router.get(
  '/users/:id/activity',
  validate(ValidationSchemas.common.id, 'params'),
  AdminController.getUserActivity
)

// Content Moderation
router.get('/moderation', AdminController.getPendingModeration)
router.patch('/moderate/:type/:id', RateLimiter.apiLimiter, AdminController.moderateContent)

// System Health and Monitoring
router.get('/health', AdminController.getSystemHealth)
router.get('/audit-logs', AdminController.getAuditLogs)

// Reports
router.get('/reports/:type', AdminController.generateReport)

// Configuration Management
router.get('/config', AdminController.getConfiguration)
router.patch('/config', RateLimiter.apiLimiter, AdminController.updateConfiguration)

// Performance Analytics
router.get('/top-performers', AdminController.getTopPerformers)

// Notifications
router.post('/notifications', RateLimiter.apiLimiter, AdminController.sendNotification)

// Badge Management
router.get('/badges', AdminController.getBadges)
router.post('/badges', RateLimiter.apiLimiter, AdminController.createBadge)
router.put(
  '/badges/:id',
  RateLimiter.apiLimiter,
  validate(ValidationSchemas.common.id, 'params'),
  AdminController.updateBadge
)
router.delete(
  '/badges/:id',
  RateLimiter.apiLimiter,
  validate(ValidationSchemas.common.id, 'params'),
  AdminController.deleteBadge
)

// Cache Management
router.post('/cache/clear', RateLimiter.apiLimiter, AdminController.clearCache)

export default router
