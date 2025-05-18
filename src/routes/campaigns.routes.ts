import { Router } from 'express'
import { CampaignController } from '../controllers/campaign.controller'
import { AuthMiddleware } from '../middleware/auth'
import { validate } from '../middleware/validation'
import { ValidationSchemas } from '../middleware/validation'
import { RateLimiter } from '../middleware/rate-limiter'

const router = Router()

// Public routes (no authentication required)

// Get campaign statistics
router.get('/statistics', CampaignController.getCampaignStatistics)

// Get trending campaigns
router.get('/trending', CampaignController.getTrendingCampaigns)

// Get campaigns by category
router.get('/category/:category', CampaignController.getCampaignsByCategory)

// Get campaigns by district
router.get('/district/:district', CampaignController.getCampaignsByDistrict)

// Get all campaigns with pagination and filtering
router.get('/', CampaignController.getCampaigns)

// Get campaign by ID
router.get('/:id', CampaignController.getCampaignById)

// Authenticated routes (require authentication)

// Get user's created campaigns
router.get('/my/created', AuthMiddleware.authenticate, CampaignController.getUserCreatedCampaigns)

// Get user's supported campaigns
router.get(
  '/my/supported',
  AuthMiddleware.authenticate,
  CampaignController.getUserSupportedCampaigns
)

// Create a new campaign (auth required, advocate level or higher)
router.post(
  '/',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  validate(ValidationSchemas.campaign.create),
  CampaignController.createCampaign
)

// Support a campaign (auth required)
router.post(
  '/:id/support',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  CampaignController.supportCampaign
)

// Unsupport a campaign (auth required)
router.delete(
  '/:id/support',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  CampaignController.unsupportCampaign
)

// Add update to a campaign (auth required, creator only)
router.post(
  '/:id/update',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  validate(ValidationSchemas.campaign.addUpdate),
  CampaignController.addCampaignUpdate
)

// Add discussion to a campaign (auth required)
router.post(
  '/:id/discussion',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  validate(ValidationSchemas.campaign.addDiscussion),
  CampaignController.addCampaignDiscussion
)

// Add reply to a discussion (auth required)
router.post(
  '/:id/discussion/:discussionId/reply',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  validate(ValidationSchemas.campaign.addReply),
  CampaignController.addDiscussionReply
)

// Upvote a discussion (auth required)
router.post(
  '/:id/discussion/:discussionId/upvote',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  CampaignController.upvoteDiscussion
)

// Downvote a discussion (auth required)
router.post(
  '/:id/discussion/:discussionId/downvote',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  CampaignController.downvoteDiscussion
)

// Update a campaign (auth required, creator or admin only)
router.put(
  '/:id',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  validate(ValidationSchemas.campaign.update),
  CampaignController.updateCampaign
)

// Delete a campaign (auth required, creator or admin only)
router.delete(
  '/:id',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  CampaignController.deleteCampaign
)

export default router
