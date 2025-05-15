import { Router } from 'express'
import { OfficialController } from '../controllers/official.controller'
import { AuthMiddleware } from '../middleware/auth'
import { validate } from '../middleware/validation'
import { ValidationSchemas } from '../middleware/validation'
import { RateLimiter } from '../middleware/rate-limiter'

const router = Router()

// Get all officials with pagination and filtering
router.get('/', OfficialController.getOfficials)

// Get official by ID
router.get('/:id', OfficialController.getOfficialById)

// Get top rated officials
router.get('/top-rated', OfficialController.getTopRatedOfficials)

// Create a new official (admin only)
router.post(
  '/',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['admin', 'superadmin']),
  validate(ValidationSchemas.official.create),
  OfficialController.createOfficial
)

// Rate an official (auth required)
router.post(
  '/:id/rate',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  validate(ValidationSchemas.official.rate),
  OfficialController.rateOfficial
)

// Upvote a rating (auth required)
router.post(
  '/ratings/:id/upvote',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  OfficialController.upvoteRating
)

// Downvote a rating (auth required)
router.post(
  '/ratings/:id/downvote',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  OfficialController.downvoteRating
)

// Update an official (admin only)
router.put(
  '/:id',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['admin', 'superadmin']),
  validate(ValidationSchemas.official.update),
  OfficialController.updateOfficial
)

// Delete an official (admin only)
router.delete(
  '/:id',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['admin', 'superadmin']),
  OfficialController.deleteOfficial
)

export default router
