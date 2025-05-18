import { Types } from 'mongoose'
import { Campaign, User, Activity } from '../models'
import { GamificationService } from './gamification.service'
import { NotificationService } from './notification.service'
import { AppError } from '../middleware/error-handler'
import { logger } from '../utils/logger'

/**
 * Service handling campaigns-related business logic
 */
export class CampaignService {
  /**
   * Get all campaigns with pagination and filtering
   */
  static async getCampaigns(options: {
    page?: number
    limit?: number
    sort?: string
    status?: 'draft' | 'active' | 'completed' | 'archived'
    category?: string
    district?: string
    search?: string
  }) {
    try {
      const {
        page = 1,
        limit = 10,
        sort = '-currentSupport',
        status,
        category,
        district,
        search,
      } = options

      // Build filter
      const filter: any = {}

      if (status) filter.status = status
      if (category) filter.category = category
      if (district) filter.district = district

      // Add search functionality
      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ]
      }

      // Get campaigns with pagination
      const campaigns = await Campaign.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('creatorId', 'firstName lastName')

      // Get total count
      const total = await Campaign.countDocuments(filter)

      // Calculate pagination metadata
      const pages = Math.ceil(total / limit)
      const hasNext = page < pages
      const hasPrev = page > 1

      return {
        data: campaigns,
        meta: {
          total,
          page,
          limit,
          pages,
          hasNext,
          hasPrev,
        },
      }
    } catch (error) {
      logger.error('Error fetching campaigns:', error)
      throw error
    }
  }

  /**
   * Get campaign by ID
   */
  static async getCampaignById(id: string) {
    try {
      // Validate ID
      if (!Types.ObjectId.isValid(id)) {
        throw new AppError(400, 'Invalid campaign ID')
      }

      // Get campaign
      const campaign = await Campaign.findById(id)
        .populate('creatorId', 'firstName lastName')
        .populate('supporters', 'firstName lastName')

      if (!campaign) {
        throw new AppError(404, 'Campaign not found')
      }

      return campaign
    } catch (error) {
      logger.error(`Error fetching campaign with ID ${id}:`, error)
      throw error
    }
  }

  /**
   * Create a new campaign
   */
  static async createCampaign(
    userId: string,
    data: {
      title: string
      description: string
      category: string
      district: string
      goal: number
      image?: string
    }
  ) {
    try {
      // Get user
      const user = await User.findById(userId)

      if (!user) {
        throw new AppError(404, 'User not found')
      }

      // Check if user has enough points to create a campaign (advocate level required)
      if (user.level === 'citizen' && user.impactPoints < 100) {
        throw new AppError(
          403,
          'Insufficient permissions. You need to be an Advocate (100+ points) to create campaigns.'
        )
      }

      // Create new campaign
      const campaign = new Campaign({
        _id: new Types.ObjectId(),
        ...data,
        creatorId: new Types.ObjectId(userId),
        supporters: [new Types.ObjectId(userId)], // Creator automatically supports their campaign
        currentSupport: 1,
        status: 'draft', // New campaigns start as draft
        updates: [],
        discussions: [],
      })

      // Save campaign
      await campaign.save()

      // Create activity
      const activity = new Activity({
        userId: new Types.ObjectId(userId),
        type: 'campaign_created',
        details: {
          campaignId: campaign._id,
          campaignTitle: campaign.title,
          category: campaign.category,
          district: campaign.district,
        },
        relatedId: campaign._id,
        relatedType: 'Campaign',
        pointsEarned: 0, // Will be updated by gamification service
        badgesEarned: [],
      })

      // Award points and badges
      const pointsEarned = await GamificationService.awardPoints(userId, 'CREATE_CAMPAIGN', {
        campaignId: campaign._id,
      })

      const badgesEarned = await GamificationService.checkAndAwardBadges(
        userId,
        'CREATE_CAMPAIGN',
        { campaignId: campaign._id }
      )

      // Update activity record with points and badges
      activity.pointsEarned = pointsEarned
      activity.badgesEarned = badgesEarned
      await activity.save()

      // Send notification for earned badges
      if (badgesEarned.length > 0) {
        await NotificationService.sendBadgeNotification(userId, badgesEarned)
      }

      return campaign
    } catch (error) {
      logger.error('Error creating campaign:', error)
      throw error
    }
  }

  /**
   * Support a campaign
   */
  static async supportCampaign(campaignId: string, userId: string) {
    try {
      // Validate ID
      if (!Types.ObjectId.isValid(campaignId)) {
        throw new AppError(400, 'Invalid campaign ID')
      }

      // Get campaign
      const campaign = await Campaign.findById(campaignId)

      if (!campaign) {
        throw new AppError(404, 'Campaign not found')
      }

      // Check if campaign is active
      if (campaign.status !== 'active') {
        throw new AppError(400, 'Campaign is not active. You can only support active campaigns.')
      }

      // Get user
      const user = await User.findById(userId)

      if (!user) {
        throw new AppError(404, 'User not found')
      }

      // Check if user already supports this campaign
      if (campaign.supporters.some((id) => id.toString() === userId)) {
        throw new AppError(400, 'You already support this campaign')
      }

      // Add user to supporters and increment currentSupport
      campaign.supporters.push(new Types.ObjectId(userId))
      campaign.currentSupport += 1

      // Check if campaign reached its goal
      if (campaign.currentSupport >= campaign.goal && campaign.status === 'active') {
        campaign.status = 'completed'

        // Send notification about campaign completion
        await NotificationService.sendCampaignMilestoneNotification(
          campaignId,
          'Goal Reached',
          campaign.currentSupport
        )

        // Award bonus points to creator for successful campaign
        const creator = await User.findById(campaign.creatorId)
        if (creator) {
          await GamificationService.awardPoints(creator._id.toString(), 'CAMPAIGN_SUCCESS', {
            campaignId,
            supporters: campaign.currentSupport,
          })

          // Check and award badges to creator
          const creatorBadges = await GamificationService.checkAndAwardBadges(
            creator._id.toString(),
            'CAMPAIGN_SUCCESS',
            { campaignId, supporters: campaign.currentSupport }
          )

          if (creatorBadges.length > 0) {
            await NotificationService.sendBadgeNotification(creator._id.toString(), creatorBadges)
          }
        }
      }

      // Save updated campaign
      await campaign.save()

      // Create activity for supporter
      const activity = new Activity({
        userId: new Types.ObjectId(userId),
        type: 'campaign_supported',
        details: {
          campaignId: campaign._id,
          campaignTitle: campaign.title,
          currentSupport: campaign.currentSupport,
          goal: campaign.goal,
        },
        relatedId: campaign._id,
        relatedType: 'Campaign',
        pointsEarned: 0, // Will be updated by gamification service
        badgesEarned: [],
      })

      // Award points and badges to supporter
      const pointsEarned = await GamificationService.awardPoints(userId, 'SUPPORT_CAMPAIGN', {
        campaignId,
      })

      const badgesEarned = await GamificationService.checkAndAwardBadges(
        userId,
        'SUPPORT_CAMPAIGN',
        {
          campaignId,
        }
      )

      // Update activity record with points and badges
      activity.pointsEarned = pointsEarned
      activity.badgesEarned = badgesEarned
      await activity.save()

      // Send notification for earned badges
      if (badgesEarned.length > 0) {
        await NotificationService.sendBadgeNotification(userId, badgesEarned)
      }

      return campaign
    } catch (error) {
      logger.error(`Error supporting campaign ${campaignId}:`, error)
      throw error
    }
  }

  /**
   * Unsupport a campaign (remove support)
   */
  static async unsupportCampaign(campaignId: string, userId: string) {
    try {
      // Validate ID
      if (!Types.ObjectId.isValid(campaignId)) {
        throw new AppError(400, 'Invalid campaign ID')
      }

      // Get campaign
      const campaign = await Campaign.findById(campaignId)

      if (!campaign) {
        throw new AppError(404, 'Campaign not found')
      }

      // Check if user is the creator (creator cannot unsupport their own campaign)
      if (campaign.creatorId.toString() === userId) {
        throw new AppError(400, 'Campaign creators cannot remove their support')
      }

      // Check if user supports this campaign
      const supporterIndex = campaign.supporters.findIndex((id) => id.toString() === userId)

      if (supporterIndex === -1) {
        throw new AppError(400, 'You do not support this campaign')
      }

      // Remove user from supporters and decrement currentSupport
      campaign.supporters.splice(supporterIndex, 1)
      campaign.currentSupport -= 1

      // If campaign was completed but now falls below goal, set back to active
      if (campaign.status === 'completed' && campaign.currentSupport < campaign.goal) {
        campaign.status = 'active'
      }

      // Save updated campaign
      await campaign.save()

      return campaign
    } catch (error) {
      logger.error(`Error unsupporting campaign ${campaignId}:`, error)
      throw error
    }
  }

  /**
   * Add update to a campaign
   */
  static async addCampaignUpdate(campaignId: string, userId: string, content: string) {
    try {
      // Validate ID
      if (!Types.ObjectId.isValid(campaignId)) {
        throw new AppError(400, 'Invalid campaign ID')
      }

      // Get campaign
      const campaign = await Campaign.findById(campaignId)

      if (!campaign) {
        throw new AppError(404, 'Campaign not found')
      }

      // Check if user is the creator
      if (campaign.creatorId.toString() !== userId) {
        throw new AppError(403, 'Only campaign creators can add updates')
      }

      // Create new update
      const update = {
        userId: new Types.ObjectId(userId),
        content,
        createdAt: new Date(),
      }

      // Add update to campaign
      campaign.updates.push(update)

      // Save updated campaign
      await campaign.save()

      // Create activity
      const activity = new Activity({
        userId: new Types.ObjectId(userId),
        type: 'campaign_updated',
        details: {
          campaignId: campaign._id,
          campaignTitle: campaign.title,
          updateContent: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
        },
        relatedId: campaign._id,
        relatedType: 'Campaign',
        pointsEarned: 5, // Small reward for updating supporters
      })

      await activity.save()

      return { campaign, update }
    } catch (error) {
      logger.error(`Error adding update to campaign ${campaignId}:`, error)
      throw error
    }
  }

  /**
   * Add discussion to a campaign
   */
  static async addCampaignDiscussion(campaignId: string, userId: string, content: string) {
    try {
      // Validate ID
      if (!Types.ObjectId.isValid(campaignId)) {
        throw new AppError(400, 'Invalid campaign ID')
      }

      // Get campaign
      const campaign = await Campaign.findById(campaignId)

      if (!campaign) {
        throw new AppError(404, 'Campaign not found')
      }

      // Get user
      const user = await User.findById(userId)

      if (!user) {
        throw new AppError(404, 'User not found')
      }

      // Create new discussion
      const discussion = {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(userId),
        content,
        createdAt: new Date(),
        upvotes: [],
        downvotes: [],
        replies: [],
      }

      // Add discussion to campaign
      campaign.discussions.push(discussion)

      // Save updated campaign
      await campaign.save()

      // Create activity
      const activity = new Activity({
        userId: new Types.ObjectId(userId),
        type: 'discussion_posted',
        details: {
          campaignId: campaign._id,
          campaignTitle: campaign.title,
          discussionContent: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
        },
        relatedId: campaign._id,
        relatedType: 'Campaign',
        pointsEarned: 0, // Will be updated by gamification service
      })

      // Award points
      const pointsEarned = await GamificationService.awardPoints(userId, 'DISCUSSION_POSTED', {
        campaignId,
      })

      // Update activity with points earned
      activity.pointsEarned = pointsEarned
      await activity.save()

      return { campaign, discussion }
    } catch (error) {
      logger.error(`Error adding discussion to campaign ${campaignId}:`, error)
      throw error
    }
  }

  /**
   * Add reply to a discussion
   */
  static async addDiscussionReply(
    campaignId: string,
    discussionId: string,
    userId: string,
    content: string
  ) {
    try {
      // Validate IDs
      if (!Types.ObjectId.isValid(campaignId) || !Types.ObjectId.isValid(discussionId)) {
        throw new AppError(400, 'Invalid campaign or discussion ID')
      }

      // Get campaign
      const campaign = await Campaign.findById(campaignId)

      if (!campaign) {
        throw new AppError(404, 'Campaign not found')
      }

      // Find discussion
      const discussion = campaign.discussions.find((d) => d._id.toString() === discussionId)

      if (!discussion) {
        throw new AppError(404, 'Discussion not found')
      }

      // Get user
      const user = await User.findById(userId)

      if (!user) {
        throw new AppError(404, 'User not found')
      }

      // Create new reply
      const reply = {
        userId: new Types.ObjectId(userId),
        content,
        createdAt: new Date(),
        upvotes: [],
        downvotes: [],
      }

      // Add reply to discussion
      discussion.replies.push(reply)

      // Save updated campaign
      await campaign.markModified('discussions')
      await campaign.save()

      // Create activity
      const activity = new Activity({
        userId: new Types.ObjectId(userId),
        type: 'discussion_reply',
        details: {
          campaignId: campaign._id,
          discussionId: discussion._id,
          replyContent: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
        },
        relatedId: campaign._id,
        relatedType: 'Campaign',
        pointsEarned: 5, // Points for engaging in discussion
      })

      await activity.save()

      return { campaign, discussion, reply }
    } catch (error) {
      logger.error(
        `Error adding reply to discussion ${discussionId} in campaign ${campaignId}:`,
        error
      )
      throw error
    }
  }

  /**
   * Upvote a discussion
   */
  static async upvoteDiscussion(campaignId: string, discussionId: string, userId: string) {
    try {
      // Validate IDs
      if (!Types.ObjectId.isValid(campaignId) || !Types.ObjectId.isValid(discussionId)) {
        throw new AppError(400, 'Invalid campaign or discussion ID')
      }

      // Get campaign
      const campaign = await Campaign.findById(campaignId)

      if (!campaign) {
        throw new AppError(404, 'Campaign not found')
      }

      // Find discussion
      const discussion = campaign.discussions.find((d) => d._id.toString() === discussionId)

      if (!discussion) {
        throw new AppError(404, 'Discussion not found')
      }

      // Check if user has already upvoted
      const upvoteIndex = discussion.upvotes.findIndex((id) => id.toString() === userId)

      if (upvoteIndex !== -1) {
        // Remove upvote (toggle)
        discussion.upvotes.splice(upvoteIndex, 1)
      } else {
        // Add upvote
        discussion.upvotes.push(new Types.ObjectId(userId))

        // Remove downvote if exists
        const downvoteIndex = discussion.downvotes.findIndex((id) => id.toString() === userId)
        if (downvoteIndex !== -1) {
          discussion.downvotes.splice(downvoteIndex, 1)
        }

        // Award points to discussion creator
        await GamificationService.awardPoints(discussion.userId.toString(), 'UPVOTE_RECEIVED', {
          campaignId,
          discussionId,
        })
      }

      // Save updated campaign
      await campaign.markModified('discussions')
      await campaign.save()

      return campaign
    } catch (error) {
      logger.error(`Error upvoting discussion ${discussionId} in campaign ${campaignId}:`, error)
      throw error
    }
  }

  /**
   * Downvote a discussion
   */
  static async downvoteDiscussion(campaignId: string, discussionId: string, userId: string) {
    try {
      // Validate IDs
      if (!Types.ObjectId.isValid(campaignId) || !Types.ObjectId.isValid(discussionId)) {
        throw new AppError(400, 'Invalid campaign or discussion ID')
      }

      // Get campaign
      const campaign = await Campaign.findById(campaignId)

      if (!campaign) {
        throw new AppError(404, 'Campaign not found')
      }

      // Find discussion
      const discussion = campaign.discussions.find((d) => d._id.toString() === discussionId)

      if (!discussion) {
        throw new AppError(404, 'Discussion not found')
      }

      // Check if user has already downvoted
      const downvoteIndex = discussion.downvotes.findIndex((id) => id.toString() === userId)

      if (downvoteIndex !== -1) {
        // Remove downvote (toggle)
        discussion.downvotes.splice(downvoteIndex, 1)
      } else {
        // Add downvote
        discussion.downvotes.push(new Types.ObjectId(userId))

        // Remove upvote if exists
        const upvoteIndex = discussion.upvotes.findIndex((id) => id.toString() === userId)
        if (upvoteIndex !== -1) {
          discussion.upvotes.splice(upvoteIndex, 1)
        }
      }

      // Save updated campaign
      await campaign.markModified('discussions')
      await campaign.save()

      return campaign
    } catch (error) {
      logger.error(`Error downvoting discussion ${discussionId} in campaign ${campaignId}:`, error)
      throw error
    }
  }

  /**
   * Update a campaign (creator or admin only)
   */
  static async updateCampaign(
    campaignId: string,
    userId: string,
    data: {
      title?: string
      description?: string
      category?: string
      district?: string
      goal?: number
      status?: 'draft' | 'active' | 'completed' | 'archived'
      image?: string
    },
    userRole?: string
  ) {
    try {
      // Validate ID
      if (!Types.ObjectId.isValid(campaignId)) {
        throw new AppError(400, 'Invalid campaign ID')
      }

      // Get campaign
      const campaign = await Campaign.findById(campaignId)

      if (!campaign) {
        throw new AppError(404, 'Campaign not found')
      }

      // Check permissions
      const isCreator = campaign.creatorId.toString() === userId
      const isAdmin = userRole && ['admin', 'superadmin'].includes(userRole)

      if (!isCreator && !isAdmin) {
        throw new AppError(403, 'Only campaign creators or admins can update campaigns')
      }

      // If not admin and trying to change status to completed, validate
      if (!isAdmin && data.status === 'completed' && campaign.currentSupport < campaign.goal) {
        throw new AppError(400, 'Campaign cannot be marked as completed without reaching its goal')
      }

      // Update campaign
      const updatedCampaign = await Campaign.findByIdAndUpdate(
        campaignId,
        { $set: data },
        { new: true, runValidators: true }
      )

      return updatedCampaign
    } catch (error) {
      logger.error(`Error updating campaign ${campaignId}:`, error)
      throw error
    }
  }

  /**
   * Delete a campaign (creator or admin only)
   */
  static async deleteCampaign(campaignId: string, userId: string, userRole?: string) {
    try {
      // Validate ID
      if (!Types.ObjectId.isValid(campaignId)) {
        throw new AppError(400, 'Invalid campaign ID')
      }

      // Get campaign
      const campaign = await Campaign.findById(campaignId)

      if (!campaign) {
        throw new AppError(404, 'Campaign not found')
      }

      // Check permissions
      const isCreator = campaign.creatorId.toString() === userId
      const isAdmin = userRole && ['admin', 'superadmin'].includes(userRole)

      if (!isCreator && !isAdmin) {
        throw new AppError(403, 'Only campaign creators or admins can delete campaigns')
      }

      // Prevent deletion of campaigns with supporters (unless admin)
      if (!isAdmin && campaign.supporters.length > 1) {
        throw new AppError(
          400,
          'Cannot delete campaigns that have supporters. Please archive the campaign instead.'
        )
      }

      // Delete campaign
      await Campaign.findByIdAndDelete(campaignId)

      return { success: true }
    } catch (error) {
      logger.error(`Error deleting campaign ${campaignId}:`, error)
      throw error
    }
  }

  /**
   * Get campaign statistics
   */
  static async getCampaignStatistics(filter?: {
    creatorId?: string
    district?: string
    category?: string
  }) {
    try {
      // Build filter
      const queryFilter: any = {}

      if (filter?.creatorId) {
        if (!Types.ObjectId.isValid(filter.creatorId)) {
          throw new AppError(400, 'Invalid creator ID')
        }
        queryFilter.creatorId = new Types.ObjectId(filter.creatorId)
      }

      if (filter?.district) {
        queryFilter.district = filter.district
      }

      if (filter?.category) {
        queryFilter.category = filter.category
      }

      // Get total campaigns count
      const total = await Campaign.countDocuments(queryFilter)

      // Get status breakdown
      const statusAggregation = await Campaign.aggregate([
        { $match: queryFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ])

      const statusBreakdown = {
        draft: 0,
        active: 0,
        completed: 0,
        archived: 0,
      }

      type StatusId = 'draft' | 'active' | 'completed' | 'archived'

      statusAggregation.forEach((status: { _id: StatusId; count: number }) => {
        statusBreakdown[status._id] = status.count
      })

      // Get category breakdown
      const categoryAggregation = await Campaign.aggregate([
        { $match: queryFilter },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ])

      const categoryBreakdown: { [key: string]: number } = {}

      categoryAggregation.forEach((category) => {
        categoryBreakdown[category._id] = category.count
      })

      // Get success rate (completed campaigns vs total non-draft campaigns)
      const nonDraftCampaigns = await Campaign.countDocuments({
        ...queryFilter,
        status: { $ne: 'draft' },
      })
      const completedCampaigns = statusBreakdown.completed
      const successRate = nonDraftCampaigns > 0 ? (completedCampaigns / nonDraftCampaigns) * 100 : 0

      return {
        total,
        statusBreakdown,
        categoryBreakdown,
        successRate: Math.round(successRate * 100) / 100, // Round to 2 decimal places
      }
    } catch (error) {
      logger.error('Error getting campaign statistics:', error)
      throw error
    }
  }

  /**
   * Get trending campaigns (most supported recently)
   */
  static async getTrendingCampaigns(options: { limit?: number; days?: number } = {}) {
    try {
      const { limit = 5, days = 7 } = options

      // Get date range
      const dateFrom = new Date()
      dateFrom.setDate(dateFrom.getDate() - days)

      // Find campaigns that are active and have good support momentum
      const campaigns = await Campaign.find({
        status: 'active',
        createdAt: { $gte: dateFrom },
      })
        .sort({ currentSupport: -1, createdAt: -1 })
        .limit(limit)
        .populate('creatorId', 'firstName lastName')

      return campaigns
    } catch (error) {
      logger.error('Error getting trending campaigns:', error)
      throw error
    }
  }
}
