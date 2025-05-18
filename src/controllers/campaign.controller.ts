import { NextFunction, Request, Response } from 'express'
import { CampaignService } from '../services/campaign.service'
import { logger } from '../utils/logger'
import { AuthenticatedRequest } from '../types/user.types'

/**
 * Controller for handling campaigns-related endpoints
 */

export class CampaignController {
  /**
   * Get all campaigns with pagination and filtering
   * @route GET /api/campaigns
   */

  static async getCampaigns(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, sort, status, category, district, search } = req.query

      const result = await CampaignService.getCampaigns({
        page: page ? parseInt(page as string) : undefined,

        limit: limit ? parseInt(limit as string) : undefined,

        sort: sort as string,

        status: status as 'draft' | 'active' | 'completed' | 'archived',

        category: category as string,

        district: district as string,

        search: search as string,
      })

      res.status(200).json(result)
    } catch (error) {
      logger.error('Error in getCampaigns controller:', error)

      next(error)
    }
  } /**

  * Get campaign by ID
  * @route GET /api/campaigns/:id
  */

  static async getCampaignById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params

      const campaign = await CampaignService.getCampaignById(id)

      res.status(200).json({ data: campaign })
    } catch (error) {
      logger.error(`Error in getCampaignById controller for ID ${req.params.id}:`, error)

      next(error)
    }
  } /**

  * Create a new campaign
  * @route POST /api/campaigns
  */

  static async createCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest

    try {
      const userId = authenticatedReq.user._id.toString()

      const campaignData = authenticatedReq.body

      const campaign = await CampaignService.createCampaign(userId, campaignData)

      res.status(201).json({
        message: 'Campaign created successfully',

        data: campaign,
      })
    } catch (error) {
      logger.error('Error in createCampaign controller:', error)

      next(error)
    }
  } /**

  * Support a campaign
  * @route POST /api/campaigns/:id/support
  */

  static async supportCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest

    try {
      const { id } = authenticatedReq.params

      const userId = authenticatedReq.user._id.toString()

      const campaign = await CampaignService.supportCampaign(id, userId)

      res.status(200).json({
        message: 'Campaign supported successfully',

        data: campaign,
      })
    } catch (error) {
      logger.error(
        `Error in supportCampaign controller for ID ${authenticatedReq.params.id}:`,
        error
      )

      next(error)
    }
  } /**

  * Unsupport a campaign
  * @route DELETE /api/campaigns/:id/support
  */

  static async unsupportCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest

    try {
      const { id } = authenticatedReq.params

      const userId = authenticatedReq.user._id.toString()

      const campaign = await CampaignService.unsupportCampaign(id, userId)

      res.status(200).json({
        message: 'Campaign support removed successfully',

        data: campaign,
      })
    } catch (error) {
      logger.error(
        `Error in unsupportCampaign controller for ID ${authenticatedReq.params.id}:`,
        error
      )
      next(error)
    }
  }

  /**
   * Add update to a campaign
   * @route POST /api/campaigns/:id/update
   */
  static async addCampaignUpdate(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const { id } = authenticatedReq.params
      const userId = authenticatedReq.user._id.toString()
      const { content } = authenticatedReq.body

      const result = await CampaignService.addCampaignUpdate(id, userId, content)

      res.status(200).json({
        message: 'Campaign update added successfully',
        data: result.campaign,
        update: result.update,
      })
    } catch (error) {
      logger.error(
        `Error in addCampaignUpdate controller for ID ${authenticatedReq.params.id}:`,
        error
      )
      next(error)
    }
  }

  /**
   * Add discussion to a campaign
   * @route POST /api/campaigns/:id/discussion
   */
  static async addCampaignDiscussion(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const { id } = authenticatedReq.params
      const userId = authenticatedReq.user._id.toString()
      const { content } = authenticatedReq.body

      const result = await CampaignService.addCampaignDiscussion(id, userId, content)

      res.status(200).json({
        message: 'Discussion added successfully',
        data: result.campaign,
        discussion: result.discussion,
      })
    } catch (error) {
      logger.error(
        `Error in addCampaignDiscussion controller for ID ${authenticatedReq.params.id}:`,
        error
      )
      next(error)
    }
  }

  /**
   * Add reply to a discussion
   * @route POST /api/campaigns/:id/discussion/:discussionId/reply
   */
  static async addDiscussionReply(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const { id, discussionId } = authenticatedReq.params
      const userId = authenticatedReq.user._id.toString()
      const { content } = authenticatedReq.body

      const result = await CampaignService.addDiscussionReply(id, discussionId, userId, content)

      res.status(200).json({
        message: 'Reply added successfully',
        data: result.campaign,
        discussion: result.discussion,
        reply: result.reply,
      })
    } catch (error) {
      logger.error(
        `Error in addDiscussionReply controller for campaign ${authenticatedReq.params.id}, discussion ${authenticatedReq.params.discussionId}:`,
        error
      )
      next(error)
    }
  }

  /**
   * Upvote a discussion
   * @route POST /api/campaigns/:id/discussion/:discussionId/upvote
   */
  static async upvoteDiscussion(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const { id, discussionId } = authenticatedReq.params
      const userId = authenticatedReq.user._id.toString()

      const campaign = await CampaignService.upvoteDiscussion(id, discussionId, userId)

      res.status(200).json({
        message: 'Discussion upvoted successfully',
        data: campaign,
      })
    } catch (error) {
      logger.error(
        `Error in upvoteDiscussion controller for campaign ${authenticatedReq.params.id}, discussion ${authenticatedReq.params.discussionId}:`,
        error
      )
      next(error)
    }
  }

  /**
   * Downvote a discussion
   * @route POST /api/campaigns/:id/discussion/:discussionId/downvote
   */
  static async downvoteDiscussion(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const { id, discussionId } = authenticatedReq.params
      const userId = authenticatedReq.user._id.toString()

      const campaign = await CampaignService.downvoteDiscussion(id, discussionId, userId)

      res.status(200).json({
        message: 'Discussion downvoted successfully',
        data: campaign,
      })
    } catch (error) {
      logger.error(
        `Error in downvoteDiscussion controller for campaign ${authenticatedReq.params.id}, discussion ${authenticatedReq.params.discussionId}:`,
        error
      )
      next(error)
    }
  }

  /**
   * Update a campaign
   * @route PUT /api/campaigns/:id
   */
  static async updateCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const { id } = authenticatedReq.params
      const userId = authenticatedReq.user._id.toString()
      const updateData = authenticatedReq.body
      const userRole = authenticatedReq.user.role

      const campaign = await CampaignService.updateCampaign(id, userId, updateData, userRole)

      res.status(200).json({
        message: 'Campaign updated successfully',
        data: campaign,
      })
    } catch (error) {
      logger.error(
        `Error in updateCampaign controller for ID ${authenticatedReq.params.id}:`,
        error
      )
      next(error)
    }
  }

  /**
   * Delete a campaign
   * @route DELETE /api/campaigns/:id
   */
  static async deleteCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const { id } = authenticatedReq.params
      const userId = authenticatedReq.user._id.toString()
      const userRole = authenticatedReq.user.role

      await CampaignService.deleteCampaign(id, userId, userRole)

      res.status(200).json({
        message: 'Campaign deleted successfully',
      })
    } catch (error) {
      logger.error(
        `Error in deleteCampaign controller for ID ${authenticatedReq.params.id}:`,
        error
      )
      next(error)
    }
  }

  /**
   * Get campaign statistics
   * @route GET /api/campaigns/statistics
   */
  static async getCampaignStatistics(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { creatorId, district, category } = req.query

      const statistics = await CampaignService.getCampaignStatistics({
        creatorId: creatorId as string,
        district: district as string,
        category: category as string,
      })

      res.status(200).json({
        data: statistics,
      })
    } catch (error) {
      logger.error('Error in getCampaignStatistics controller:', error)
      next(error)
    }
  }

  /**
   * Get trending campaigns
   * @route GET /api/campaigns/trending
   */
  static async getTrendingCampaigns(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { limit, days } = req.query

      const campaigns = await CampaignService.getTrendingCampaigns({
        limit: limit ? parseInt(limit as string) : undefined,
        days: days ? parseInt(days as string) : undefined,
      })

      res.status(200).json({
        data: campaigns,
      })
    } catch (error) {
      logger.error('Error in getTrendingCampaigns controller:', error)
      next(error)
    }
  }

  /**
   * Get campaigns by category
   * @route GET /api/campaigns/category/:category
   */
  static async getCampaignsByCategory(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { category } = req.params
      const { page, limit, sort, status, district } = req.query

      const result = await CampaignService.getCampaigns({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        sort: sort as string,
        status: status as 'draft' | 'active' | 'completed' | 'archived',
        category,
        district: district as string,
      })

      res.status(200).json(result)
    } catch (error) {
      logger.error(
        `Error in getCampaignsByCategory controller for category ${req.params.category}:`,
        error
      )
      next(error)
    }
  }

  /**
   * Get campaigns by district
   * @route GET /api/campaigns/district/:district
   */
  static async getCampaignsByDistrict(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { district } = req.params
      const { page, limit, sort, status, category } = req.query

      const result = await CampaignService.getCampaigns({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        sort: sort as string,
        status: status as 'draft' | 'active' | 'completed' | 'archived',
        category: category as string,
        district,
      })

      res.status(200).json(result)
    } catch (error) {
      logger.error(
        `Error in getCampaignsByDistrict controller for district ${req.params.district}:`,
        error
      )
      next(error)
    }
  }

  /**
   * Get user's campaigns (created by user)
   * @route GET /api/campaigns/my/created
   */
  static async getUserCreatedCampaigns(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const userId = authenticatedReq.user._id.toString()
      const { page, limit, sort, status } = req.query

      const result = await CampaignService.getCampaigns({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        sort: sort as string,
        status: status as 'draft' | 'active' | 'completed' | 'archived',
      })

      // Filter to only show campaigns created by this user
      const userCampaigns = result.data.filter(
        (campaign) => campaign.creatorId.toString() === userId
      )

      res.status(200).json({
        ...result,
        data: userCampaigns,
        meta: {
          ...result.meta,
          total: userCampaigns.length,
        },
      })
    } catch (error) {
      logger.error('Error in getUserCreatedCampaigns controller:', error)
      next(error)
    }
  }

  /**
   * Get campaigns supported by user
   * @route GET /api/campaigns/my/supported
   */
  static async getUserSupportedCampaigns(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const userId = authenticatedReq.user._id.toString()
      const { page, limit, sort, status } = req.query

      const result = await CampaignService.getCampaigns({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        sort: sort as string,
        status: status as 'draft' | 'active' | 'completed' | 'archived',
      })

      // Filter to only show campaigns supported by this user
      const supportedCampaigns = result.data.filter((campaign) =>
        campaign.supporters.some((supporter) => supporter.toString() === userId)
      )

      res.status(200).json({
        ...result,
        data: supportedCampaigns,
        meta: {
          ...result.meta,
          total: supportedCampaigns.length,
        },
      })
    } catch (error) {
      logger.error('Error in getUserSupportedCampaigns controller:', error)
      next(error)
    }
  }
}
