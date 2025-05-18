import { Router } from 'express'
import { LearningController } from '../controllers/learning.controller'
import { AuthMiddleware } from '../middleware/auth'
import { validate } from '../middleware/validation'
import { ValidationSchemas } from '../middleware/validation'
import { RateLimiter } from '../middleware/rate-limiter'

const router = Router()

// Public routes (no authentication required)

// Get learning statistics
router.get('/statistics', LearningController.getLearningStatistics)

// Get all categories
router.get('/categories', LearningController.getCategories)

// Get all regions
router.get('/regions', LearningController.getRegions)

// Get all learning modules with pagination and filtering
router.get('/modules', LearningController.getLearningModules)

// Get learning module by ID (optional auth to include user progress)
router.get('/modules/:id', AuthMiddleware.optionalAuth, LearningController.getLearningModuleById)

// Get modules by category (optional auth to include user progress)
router.get(
  '/modules/category/:category',
  AuthMiddleware.optionalAuth,
  LearningController.getModulesByCategory
)

// Get modules by region (optional auth to include user progress)
router.get(
  '/modules/region/:region',
  AuthMiddleware.optionalAuth,
  LearningController.getModulesByRegion
)

// Authenticated routes (require authentication)

// Get learning path recommendations
router.get('/recommendations', AuthMiddleware.authenticate, LearningController.getRecommendations)

// Get user's learning progress
router.get('/progress/user', AuthMiddleware.authenticate, LearningController.getUserProgress)

// Get user's completed modules
router.get(
  '/progress/completed',
  AuthMiddleware.authenticate,
  LearningController.getCompletedModules
)

// Get user's in-progress modules
router.get(
  '/progress/in-progress',
  AuthMiddleware.authenticate,
  LearningController.getInProgressModules
)

// Start or update module progress
router.post(
  '/progress',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  validate(ValidationSchemas.learning.updateProgress),
  LearningController.updateProgress
)

// Submit quiz answers
router.post(
  '/quiz/:moduleId',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  validate(ValidationSchemas.learning.submitQuiz),
  LearningController.submitQuiz
)

// Admin-only routes

// Create a new learning module (admin only)
router.post(
  '/modules',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['admin', 'superadmin']),
  validate(ValidationSchemas.learning.createModule),
  LearningController.createLearningModule
)

// Update a learning module (admin only)
router.put(
  '/modules/:id',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['admin', 'superadmin']),
  validate(ValidationSchemas.learning.createModule), // Same validation as create
  LearningController.updateLearningModule
)

// Delete a learning module (admin only)
router.delete(
  '/modules/:id',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['admin', 'superadmin']),
  LearningController.deleteLearningModule
)

export default router
