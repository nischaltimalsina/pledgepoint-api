import { Router } from 'express'
import { PromiseController } from '../controllers/promise.controller'
import { AuthMiddleware } from '../middleware/auth'
import { validate } from '../middleware/validation'
import { ValidationSchemas } from '../middleware/validation'
import { RateLimiter } from '../middleware/rate-limiter'

const router = Router()

// Get promise statistics
router.get('/statistics', PromiseController.getPromiseStatistics)

// Get promises by official ID
router.get('/official/:officialId', PromiseController.getPromisesByOfficial)

// Get all promises with pagination and filtering
router.get('/', PromiseController.getPromises)

// Get promise by ID
router.get('/:id', PromiseController.getPromiseById)

// Create a new promise (auth required)
router.post(
  '/',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  validate(ValidationSchemas.promise.create),
  PromiseController.createPromise
)

// Add evidence to a promise (auth required)
router.post(
  '/:id/evidence',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  validate(ValidationSchemas.promise.addEvidence),
  PromiseController.addEvidence
)

// Add comment to a promise (auth required)
router.post(
  '/:id/comment',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  validate(ValidationSchemas.promise.addComment),
  PromiseController.addComment
)

// Upvote evidence (auth required)
router.post(
  '/:id/evidence/:evidenceIndex/upvote',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  PromiseController.upvoteEvidence
)

// Downvote evidence (auth required)
router.post(
  '/:id/evidence/:evidenceIndex/downvote',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  PromiseController.downvoteEvidence
)

// Update a promise (admin only)
router.put(
  '/:id',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['admin', 'superadmin']),
  validate(ValidationSchemas.promise.update),
  PromiseController.updatePromise
)

// Delete a promise (admin only)
router.delete(
  '/:id',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['admin', 'superadmin']),
  PromiseController.deletePromise
)

export default router
