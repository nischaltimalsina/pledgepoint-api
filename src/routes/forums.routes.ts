import { Router } from 'express'
import { ForumController } from '../controllers/forum.controller'
import { AuthMiddleware } from '../middleware/auth'
import { validate } from '../middleware/validation'
import { RateLimiter } from '../middleware/rate-limiter'
import { z } from 'zod'

const router = Router()

// Validation schemas
const ForumValidation = {
  create: z.object({
    title: z.string().min(5).max(100),
    description: z.string().min(20).max(1000),
    category: z.enum(['general', 'expert']),
    tags: z.array(z.string()).max(10),
    rules: z.array(z.string()).optional(),
    expertRequirements: z
      .object({
        minimumLevel: z.enum(['advocate', 'leader']),
        requiredBadges: z.array(z.string()).optional(),
        approvalRequired: z.boolean(),
      })
      .optional(),
    socialIssues: z
      .object({
        relatedIssues: z.array(z.string()),
        impactAreas: z.array(z.string()),
        urgencyLevel: z.enum(['low', 'medium', 'high', 'critical']),
      })
      .optional(),
  }),

  addPost: z.object({
    content: z.string().min(10).max(5000),
    attachments: z.array(z.string()).optional(),
  }),

  addReply: z.object({
    content: z.string().min(10).max(5000),
  }),

  addModerator: z.object({
    moderatorId: z.string(),
  }),

  updateForum: z.object({
    title: z.string().min(5).max(100).optional(),
    description: z.string().min(20).max(1000).optional(),
    tags: z.array(z.string()).max(10).optional(),
    rules: z.array(z.string()).optional(),
    expertRequirements: z
      .object({
        minimumLevel: z.enum(['advocate', 'leader']),
        requiredBadges: z.array(z.string()).optional(),
        approvalRequired: z.boolean(),
      })
      .optional(),
    socialIssues: z
      .object({
        relatedIssues: z.array(z.string()),
        impactAreas: z.array(z.string()),
        urgencyLevel: z.enum(['low', 'medium', 'high', 'critical']),
      })
      .optional(),
  }),
}

// Public routes
router.get('/', ForumController.getForums)
router.get('/social-issues', ForumController.getSocialIssuesForums)
router.get('/trending', ForumController.getTrendingForums)
router.get('/search', AuthMiddleware.optionalAuth, ForumController.searchForums)
router.get('/:id', AuthMiddleware.optionalAuth, ForumController.getForumById)
router.get('/:id/statistics', ForumController.getForumStatistics)
router.get('/:id/members', ForumController.getForumMembers)

// Authenticated routes
router.post(
  '/',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  validate(ForumValidation.create),
  ForumController.createForum
)

router.post(
  '/:id/subscribe',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  ForumController.subscribeToForum
)

router.delete(
  '/:id/subscribe',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  ForumController.unsubscribeFromForum
)

router.post(
  '/:id/posts',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  validate(ForumValidation.addPost),
  ForumController.addPost
)

router.post(
  '/:forumId/posts/:postId/replies',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  validate(ForumValidation.addReply),
  ForumController.addReply
)

router.post(
  '/:forumId/posts/:postId/upvote',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  ForumController.upvotePost
)

router.post(
  '/:forumId/posts/:postId/downvote',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  ForumController.downvotePost
)

router.patch(
  '/:forumId/posts/:postId/pin',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  ForumController.togglePinPost
)

router.get(
  '/my',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  ForumController.getUserForums
)

router.post(
  '/:id/moderators',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  validate(ForumValidation.addModerator),
  ForumController.addModerator
)

router.delete(
  '/:id/moderators/:moderatorId',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  ForumController.removeModerator
)

router.put(
  '/:id',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  validate(ForumValidation.updateForum),
  ForumController.updateForum
)

router.delete(
  '/:id',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  ForumController.deleteForum
)

export default router
