import { Request, Response, NextFunction } from 'express'
import { ForumService } from '../services/forum.service'
import { logger } from '../utils/logger'
import { AuthenticatedRequest, OptionalAuthRequest } from '../types/user.types'

/**
 * Controller for handling forum-related endpoints
 */
export class ForumController {
  /**
   * Get all forums with filtering and pagination
   * @route GET /api/forums
   */
  static async getForums(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, sort, category, tags, search, urgencyLevel } = req.query
      const userId = (req as OptionalAuthRequest).user?._id.toString()

      const result = await ForumService.getForums(
        {
          page: page ? parseInt(page as string) : undefined,
          limit: limit ? parseInt(limit as string) : undefined,
          sort: sort as string,
          category: category as 'general' | 'expert',
          tags: tags ? (Array.isArray(tags) ? (tags as string[]) : [tags as string]) : undefined,
          search: search as string,
          urgencyLevel: urgencyLevel as 'low' | 'medium' | 'high' | 'critical',
        },
        userId
      )

      res.status(200).json(result)
    } catch (error) {
      logger.error('Error in getForums controller:', error)
      next(error)
    }
  }

  /**
   * Get forum by ID
   * @route GET /api/forums/:id
   */
  static async getForumById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const userId = (req as OptionalAuthRequest).user?._id.toString()

      const forum = await ForumService.getForumById(id, userId)

      res.status(200).json({ data: forum })
    } catch (error) {
      logger.error(`Error in getForumById controller for ID ${req.params.id}:`, error)
      next(error)
    }
  }

  /**
   * Create a new forum
   * @route POST /api/forums
   */
  static async createForum(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const userId = authenticatedReq.user._id.toString()
      const forumData = authenticatedReq.body

      const forum = await ForumService.createForum(userId, forumData)

      res.status(201).json({
        message: 'Forum created successfully',
        data: forum,
      })
    } catch (error) {
      logger.error('Error in createForum controller:', error)
      next(error)
    }
  }

  /**
   * Subscribe to a forum
   * @route POST /api/forums/:id/subscribe
   */
  static async subscribeToForum(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const { id } = authenticatedReq.params
      const userId = authenticatedReq.user._id.toString()

      const forum = await ForumService.subscribeToForum(id, userId)

      res.status(200).json({
        message: 'Successfully subscribed to forum',
        data: forum,
      })
    } catch (error) {
      logger.error(
        `Error in subscribeToForum controller for ID ${authenticatedReq.params.id}:`,
        error
      )
      next(error)
    }
  }

  /**
   * Unsubscribe from a forum
   * @route DELETE /api/forums/:id/subscribe
   */
  static async unsubscribeFromForum(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const { id } = authenticatedReq.params
      const userId = authenticatedReq.user._id.toString()

      const forum = await ForumService.unsubscribeFromForum(id, userId)

      res.status(200).json({
        message: 'Successfully unsubscribed from forum',
        data: forum,
      })
    } catch (error) {
      logger.error(
        `Error in unsubscribeFromForum controller for ID ${authenticatedReq.params.id}:`,
        error
      )
      next(error)
    }
  }

  /**
   * Add post to forum
   * @route POST /api/forums/:id/posts
   */
  static async addPost(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const { id } = authenticatedReq.params
      const userId = authenticatedReq.user._id.toString()
      const postData = authenticatedReq.body

      const result = await ForumService.addPost(id, userId, postData)

      res.status(201).json({
        message: 'Post added successfully',
        data: result,
      })
    } catch (error) {
      logger.error(`Error in addPost controller for forum ${authenticatedReq.params.id}:`, error)
      next(error)
    }
  }

  /**
   * Add reply to a post
   * @route POST /api/forums/:forumId/posts/:postId/replies
   */
  static async addReply(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const { forumId, postId } = authenticatedReq.params
      const userId = authenticatedReq.user._id.toString()
      const { content } = authenticatedReq.body

      const result = await ForumService.addReply(forumId, postId, userId, content)

      res.status(201).json({
        message: 'Reply added successfully',
        data: result,
      })
    } catch (error) {
      logger.error(
        `Error in addReply controller for post ${authenticatedReq.params.postId}:`,
        error
      )
      next(error)
    }
  }

  /**
   * Upvote a post
   * @route POST /api/forums/:forumId/posts/:postId/upvote
   */
  static async upvotePost(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const { forumId, postId } = authenticatedReq.params
      const userId = authenticatedReq.user._id.toString()

      const forum = await ForumService.upvotePost(forumId, postId, userId)

      res.status(200).json({
        message: 'Post upvoted successfully',
        data: forum,
      })
    } catch (error) {
      logger.error(
        `Error in upvotePost controller for post ${authenticatedReq.params.postId}:`,
        error
      )
      next(error)
    }
  }

  /**
   * Downvote a post
   * @route POST /api/forums/:forumId/posts/:postId/downvote
   */
  static async downvotePost(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const { forumId, postId } = authenticatedReq.params
      const userId = authenticatedReq.user._id.toString()

      const forum = await ForumService.downvotePost(forumId, postId, userId)

      res.status(200).json({
        message: 'Post downvoted successfully',
        data: forum,
      })
    } catch (error) {
      logger.error(
        `Error in downvotePost controller for post ${authenticatedReq.params.postId}:`,
        error
      )
      next(error)
    }
  }

  /**
   * Pin/unpin a post (moderators only)
   * @route PATCH /api/forums/:forumId/posts/:postId/pin
   */
  static async togglePinPost(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const { forumId, postId } = authenticatedReq.params
      const userId = authenticatedReq.user._id.toString()

      const result = await ForumService.togglePinPost(forumId, postId, userId)

      res.status(200).json({
        message: result.pinned ? 'Post pinned successfully' : 'Post unpinned successfully',
        data: result.forum,
      })
    } catch (error) {
      logger.error(
        `Error in togglePinPost controller for post ${authenticatedReq.params.postId}:`,
        error
      )
      next(error)
    }
  }

  /**
   * Get social issues forums
   * @route GET /api/forums/social-issues
   */
  static async getSocialIssuesForums(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { urgencyLevel, impactArea, limit } = req.query

      const result = await ForumService.getSocialIssuesForums({
        urgencyLevel: urgencyLevel as 'low' | 'medium' | 'high' | 'critical',
        impactArea: impactArea as string,
        limit: limit ? parseInt(limit as string) : undefined,
      })

      res.status(200).json({
        data: result,
      })
    } catch (error) {
      logger.error('Error in getSocialIssuesForums controller:', error)
      next(error)
    }
  }

  /**
   * Get trending forums
   * @route GET /api/forums/trending
   */
  static async getTrendingForums(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit, timeframe } = req.query

      const forums = await ForumService.getTrendingForums({
        limit: limit ? parseInt(limit as string) : undefined,
        timeframe: timeframe as 'day' | 'week' | 'month',
      })

      res.status(200).json({
        data: forums,
      })
    } catch (error) {
      logger.error('Error in getTrendingForums controller:', error)
      next(error)
    }
  }

  /**
   * Get user's forums (created and subscribed)
   * @route GET /api/forums/my
   */
  static async getUserForums(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const userId = authenticatedReq.user._id.toString()
      const { type } = req.query // 'created' | 'subscribed' | 'all'

      const result = await ForumService.getUserForums(userId, {
        type: type as 'created' | 'subscribed' | 'all',
      })

      res.status(200).json({
        data: result,
      })
    } catch (error) {
      logger.error('Error in getUserForums controller:', error)
      next(error)
    }
  }

  /**
   * Get forum statistics
   * @route GET /api/forums/:id/statistics
   */
  static async getForumStatistics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params

      const statistics = await ForumService.getForumStatistics(id)

      res.status(200).json({
        data: statistics,
      })
    } catch (error) {
      logger.error(`Error in getForumStatistics controller for ID ${req.params.id}:`, error)
      next(error)
    }
  }

  /**
   * Add moderator to expert forum (creator only)
   * @route POST /api/forums/:id/moderators
   */
  static async addModerator(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const { id } = authenticatedReq.params
      const userId = authenticatedReq.user._id.toString()
      const { moderatorId } = authenticatedReq.body

      const forum = await ForumService.addModerator(id, userId, moderatorId)

      res.status(200).json({
        message: 'Moderator added successfully',
        data: forum,
      })
    } catch (error) {
      logger.error(
        `Error in addModerator controller for forum ${authenticatedReq.params.id}:`,
        error
      )
      next(error)
    }
  }

  /**
   * Remove moderator from expert forum (creator only)
   * @route DELETE /api/forums/:id/moderators/:moderatorId
   */
  static async removeModerator(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const { id, moderatorId } = authenticatedReq.params
      const userId = authenticatedReq.user._id.toString()

      const forum = await ForumService.removeModerator(id, userId, moderatorId)

      res.status(200).json({
        message: 'Moderator removed successfully',
        data: forum,
      })
    } catch (error) {
      logger.error(
        `Error in removeModerator controller for forum ${authenticatedReq.params.id}:`,
        error
      )
      next(error)
    }
  }

  /**
   * Get forum members (subscribers list)
   * @route GET /api/forums/:id/members
   */
  static async getForumMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const { page, limit } = req.query

      const result = await ForumService.getForumMembers(id, {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      })

      res.status(200).json(result)
    } catch (error) {
      logger.error(`Error in getForumMembers controller for ID ${req.params.id}:`, error)
      next(error)
    }
  }

  /**
   * Search forums
   * @route GET /api/forums/search
   */
  static async searchForums(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q, category, tags, urgencyLevel, limit } = req.query
      const userId = (req as OptionalAuthRequest).user?._id.toString()

      if (!q || (q as string).trim().length < 2) {
        res.status(400).json({
          status: 'fail',
          message: 'Search query must be at least 2 characters',
        })
        return
      }

      const results = await ForumService.searchForums(
        {
          query: q as string,
          category: category as 'general' | 'expert',
          tags: tags ? (Array.isArray(tags) ? (tags as string[]) : [tags as string]) : undefined,
          urgencyLevel: urgencyLevel as 'low' | 'medium' | 'high' | 'critical',
          limit: limit ? parseInt(limit as string) : undefined,
        },
        userId
      )

      res.status(200).json({
        data: results,
      })
    } catch (error) {
      logger.error('Error in searchForums controller:', error)
      next(error)
    }
  }

  /**
   * Update forum (creator/moderator only)
   * @route PUT /api/forums/:id
   */
  static async updateForum(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const { id } = authenticatedReq.params
      const userId = authenticatedReq.user._id.toString()
      const updateData = authenticatedReq.body

      const forum = await ForumService.updateForum(id, userId, updateData)

      res.status(200).json({
        message: 'Forum updated successfully',
        data: forum,
      })
    } catch (error) {
      logger.error(`Error in updateForum controller for ID ${authenticatedReq.params.id}:`, error)
      next(error)
    }
  }

  /**
   * Delete forum (creator only)
   * @route DELETE /api/forums/:id
   */
  static async deleteForum(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const { id } = authenticatedReq.params
      const userId = authenticatedReq.user._id.toString()

      await ForumService.deleteForum(id, userId)

      res.status(200).json({
        message: 'Forum deleted successfully',
      })
    } catch (error) {
      logger.error(`Error in deleteForum controller for ID ${authenticatedReq.params.id}:`, error)
      next(error)
    }
  }
}
