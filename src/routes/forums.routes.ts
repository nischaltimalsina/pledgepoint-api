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
}

// Public routes
router.get('/', ForumController.getForums)
router.get('/social-issues', ForumController.getSocialIssuesForums)
router.get('/:id', AuthMiddleware.optionalAuth, ForumController.getForumById)

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

router.post(
  '/:id/posts',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  validate(ForumValidation.addPost),
  ForumController.addPost
)

router.post(
  '/:forumId/posts/:postId/upvote',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  ForumController.upvotePost
)

export default router
