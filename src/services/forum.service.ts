import { Types } from 'mongoose'
import { Forum, User, Activity } from '../models'
import { GamificationService } from './gamification.service'
import { NotificationService } from './notification.service'
import { AppError } from '../middleware/error-handler'
import { logger } from '../utils/logger'

export class ForumService {
  /**
   * Get all forums with filtering and pagination
   */
  static async getForums(
    options: {
      page?: number
      limit?: number
      sort?: string
      category?: 'general' | 'expert'
      tags?: string[]
      search?: string
      urgencyLevel?: 'low' | 'medium' | 'high' | 'critical'
    },
    userId?: string
  ) {
    try {
      const {
        page = 1,
        limit = 10,
        sort = '-lastActivity',
        category,
        tags,
        search,
        urgencyLevel,
      } = options

      // Build filter
      const filter: any = { isActive: true }

      if (category) filter.category = category
      if (tags && tags.length > 0) filter.tags = { $in: tags }
      if (urgencyLevel) filter['socialIssues.urgencyLevel'] = urgencyLevel

      // Add search functionality
      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { tags: { $regex: search, $options: 'i' } },
        ]
      }

      // Get forums with pagination
      let forums = await Forum.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('creatorId', 'firstName lastName level badges')
        .populate('moderators', 'firstName lastName level')

      // Filter expert forums based on user access if userId provided
      if (userId) {
        const user = await User.findById(userId)
        if (user) {
          forums = forums.filter((forum) => forum.canUserAccess(user))
        }
      }

      const total = forums.length

      return {
        data: forums,
        meta: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      }
    } catch (error) {
      logger.error('Error fetching forums:', error)
      throw error
    }
  }

  /**
   * Get forum by ID with access check
   */
  static async getForumById(id: string, userId?: string) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new AppError(400, 'Invalid forum ID')
      }

      const forum = await Forum.findById(id)
        .populate('creatorId', 'firstName lastName level badges')
        .populate('moderators', 'firstName lastName level')
        .populate('posts.userId', 'firstName lastName level badges')
        .populate('posts.replies.userId', 'firstName lastName level')

      if (!forum) {
        throw new AppError(404, 'Forum not found')
      }

      // Check access for expert forums
      if (userId && forum.category === 'expert') {
        const user = await User.findById(userId)
        if (user && !forum.canUserAccess(user)) {
          throw new AppError(403, 'Access denied to expert forum')
        }
      }

      return forum
    } catch (error) {
      logger.error(`Error fetching forum with ID ${id}:`, error)
      throw error
    }
  }

  /**
   * Create a new forum
   */
  static async createForum(
    userId: string,
    data: {
      title: string
      description: string
      category: 'general' | 'expert'
      tags: string[]
      rules?: string[]
      expertRequirements?: {
        minimumLevel: 'advocate' | 'leader'
        requiredBadges?: string[]
        approvalRequired: boolean
      }
      socialIssues?: {
        relatedIssues: string[]
        impactAreas: string[]
        urgencyLevel: 'low' | 'medium' | 'high' | 'critical'
      }
    }
  ) {
    try {
      // Get user and validate permissions
      const user = await User.findById(userId)
      if (!user) {
        throw new AppError(404, 'User not found')
      }

      // Check if user can create forums (advocate level or higher)
      if (user.level === 'citizen') {
        throw new AppError(403, 'Only advocates and leaders can create forums')
      }

      // For expert forums, require leader level
      if (data.category === 'expert' && user.level !== 'leader') {
        throw new AppError(403, 'Only leaders can create expert forums')
      }

      // Create forum
      const forum = new Forum({
        _id: new Types.ObjectId(),
        ...data,
        creatorId: new Types.ObjectId(userId),
        moderators: data.category === 'expert' ? [new Types.ObjectId(userId)] : [],
        subscribers: [new Types.ObjectId(userId)], // Creator auto-subscribes
        posts: [],
        memberCount: 1,
        postCount: 0,
        lastActivity: new Date(),
      })

      await forum.save()

      // Create activity
      const activity = new Activity({
        userId: new Types.ObjectId(userId),
        type: 'forum_created',
        details: {
          forumId: forum._id,
          forumTitle: forum.title,
          category: forum.category,
        },
        relatedId: forum._id,
        relatedType: 'Forum',
        pointsEarned: 0,
        badgesEarned: [],
      })

      // Award points and badges
      const pointsEarned = await GamificationService.awardPoints(userId, 'CREATE_FORUM', {
        category: data.category,
      })

      const badgesEarned = await GamificationService.checkAndAwardBadges(userId, 'CREATE_FORUM', {
        category: data.category,
      })

      activity.pointsEarned = pointsEarned
      activity.badgesEarned = badgesEarned
      await activity.save()

      // Send notifications for badges
      if (badgesEarned.length > 0) {
        await NotificationService.sendBadgeNotification(userId, badgesEarned)
      }

      return forum
    } catch (error) {
      logger.error('Error creating forum:', error)
      throw error
    }
  }

  /**
   * Subscribe to forum
   */
  static async subscribeToForum(forumId: string, userId: string) {
    try {
      if (!Types.ObjectId.isValid(forumId)) {
        throw new AppError(400, 'Invalid forum ID')
      }

      const forum = await Forum.findById(forumId)
      if (!forum) {
        throw new AppError(404, 'Forum not found')
      }

      // Check access
      const user = await User.findById(userId)
      if (user && !forum.canUserAccess(user)) {
        throw new AppError(403, 'Access denied to this forum')
      }

      // Check if already subscribed
      if (forum.subscribers.some((id) => id.toString() === userId)) {
        throw new AppError(400, 'Already subscribed to this forum')
      }

      forum.subscribers.push(new Types.ObjectId(userId))
      await forum.save()

      return forum
    } catch (error) {
      logger.error(`Error subscribing to forum ${forumId}:`, error)
      throw error
    }
  }

  /**
   * Add post to forum
   */
  static async addPost(
    forumId: string,
    userId: string,
    data: {
      content: string
      attachments?: string[]
    }
  ) {
    try {
      if (!Types.ObjectId.isValid(forumId)) {
        throw new AppError(400, 'Invalid forum ID')
      }

      const forum = await Forum.findById(forumId)
      if (!forum) {
        throw new AppError(404, 'Forum not found')
      }

      // Check access
      const user = await User.findById(userId)
      if (!user || !forum.canUserAccess(user)) {
        throw new AppError(403, 'Access denied to this forum')
      }

      // Add post using forum method
      await forum.addPost(userId, data.content, data.attachments)

      // Create activity
      const activity = new Activity({
        userId: new Types.ObjectId(userId),
        type: 'forum_post_created',
        details: {
          forumId: forum._id,
          forumTitle: forum.title,
          postContent: data.content.substring(0, 100),
        },
        relatedId: forum._id,
        relatedType: 'Forum',
        pointsEarned: 0,
        badgesEarned: [],
      })

      // Award points
      const pointsEarned = await GamificationService.awardPoints(userId, 'FORUM_POST', {
        forumId,
        category: forum.category,
      })

      activity.pointsEarned = pointsEarned
      await activity.save()

      return forum
    } catch (error) {
      logger.error(`Error adding post to forum ${forumId}:`, error)
      throw error
    }
  }

  /**
   * Get social issues forums with urgency levels
   */
  static async getSocialIssuesForums(
    options: {
      urgencyLevel?: 'low' | 'medium' | 'high' | 'critical'
      impactArea?: string
      limit?: number
    } = {}
  ) {
    try {
      const { urgencyLevel, impactArea, limit = 20 } = options

      const filter: any = {
        isActive: true,
        'socialIssues.relatedIssues': { $exists: true, $ne: [] },
      }

      if (urgencyLevel) {
        filter['socialIssues.urgencyLevel'] = urgencyLevel
      }

      if (impactArea) {
        filter['socialIssues.impactAreas'] = { $in: [impactArea] }
      }

      const forums = await Forum.find(filter)
        .sort({ 'socialIssues.urgencyLevel': -1, lastActivity: -1 })
        .limit(limit)
        .populate('creatorId', 'firstName lastName level')

      // Group by urgency level for better organization
      const groupedForums = {
        critical: forums.filter((f) => f.socialIssues?.urgencyLevel === 'critical'),
        high: forums.filter((f) => f.socialIssues?.urgencyLevel === 'high'),
        medium: forums.filter((f) => f.socialIssues?.urgencyLevel === 'medium'),
        low: forums.filter((f) => f.socialIssues?.urgencyLevel === 'low'),
      }

      return { forums, groupedForums }
    } catch (error) {
      logger.error('Error fetching social issues forums:', error)
      throw error
    }
  }

  /**
   * Upvote a post
   */
  static async upvotePost(forumId: string, postId: string, userId: string) {
    try {
      const forum = await Forum.findById(forumId)
      if (!forum) {
        throw new AppError(404, 'Forum not found')
      }

      const post = forum.posts.find((p) => p._id.toString() === postId)
      if (!post) {
        throw new AppError(404, 'Post not found')
      }

      const userObjId = new Types.ObjectId(userId)

      // Toggle upvote
      if (post.upvotes.some((id) => id.toString() === userId)) {
        post.upvotes = post.upvotes.filter((id) => id.toString() !== userId)
      } else {
        post.upvotes.push(userObjId)
        // Remove downvote if exists
        post.downvotes = post.downvotes.filter((id) => id.toString() !== userId)

        // Award points to post creator
        await GamificationService.awardPoints(post.userId.toString(), 'UPVOTE_RECEIVED', {
          forumId,
          postId,
        })
      }

      await forum.save()
      return forum
    } catch (error) {
      logger.error(`Error upvoting post ${postId}:`, error)
      throw error
    }
  }

  /**
   * Downvote a post
   */
  static async downvotePost(forumId: string, postId: string, userId: string) {
    try {
      const forum = await Forum.findById(forumId)
      if (!forum) {
        throw new AppError(404, 'Forum not found')
      }

      const post = forum.posts.find((p) => p._id.toString() === postId)
      if (!post) {
        throw new AppError(404, 'Post not found')
      }

      const userObjId = new Types.ObjectId(userId)

      // Toggle downvote
      if (post.downvotes.some((id) => id.toString() === userId)) {
        post.downvotes = post.downvotes.filter((id) => id.toString() !== userId)
      } else {
        post.downvotes.push(userObjId)
        // Remove upvote if exists
        post.upvotes = post.upvotes.filter((id) => id.toString() !== userId)
      }

      await forum.save()
      return forum
    } catch (error) {
      logger.error(`Error downvoting post ${postId}:`, error)
      throw error
    }
  }

  /**
   * Unsubscribe from forum
   */
  static async unsubscribeFromForum(forumId: string, userId: string) {
    try {
      if (!Types.ObjectId.isValid(forumId)) {
        throw new AppError(400, 'Invalid forum ID')
      }

      const forum = await Forum.findById(forumId)
      if (!forum) {
        throw new AppError(404, 'Forum not found')
      }

      // Check if subscribed
      if (!forum.subscribers.some((id) => id.toString() === userId)) {
        throw new AppError(400, 'Not subscribed to this forum')
      }

      // Cannot unsubscribe if you're the creator
      if (forum.creatorId.toString() === userId) {
        throw new AppError(400, 'Forum creator cannot unsubscribe')
      }

      forum.subscribers = forum.subscribers.filter((id) => id.toString() !== userId)
      await forum.save()

      return forum
    } catch (error) {
      logger.error(`Error unsubscribing from forum ${forumId}:`, error)
      throw error
    }
  }

  /**
   * Add reply to a post
   */
  static async addReply(forumId: string, postId: string, userId: string, content: string) {
    try {
      if (!Types.ObjectId.isValid(forumId)) {
        throw new AppError(400, 'Invalid forum ID')
      }

      const forum = await Forum.findById(forumId)
      if (!forum) {
        throw new AppError(404, 'Forum not found')
      }

      const post = forum.posts.find((p) => p._id.toString() === postId)
      if (!post) {
        throw new AppError(404, 'Post not found')
      }

      // Check access
      const user = await User.findById(userId)
      if (!user || !forum.canUserAccess(user)) {
        throw new AppError(403, 'Access denied to this forum')
      }

      const reply = {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(userId),
        content,
        upvotes: [],
        downvotes: [],
        createdAt: new Date(),
      }

      post.replies.push(reply)
      forum.lastActivity = new Date()
      await forum.save()

      // Create activity and award points
      const activity = new Activity({
        userId: new Types.ObjectId(userId),
        type: 'forum_reply_created',
        details: {
          forumId: forum._id,
          postId,
          replyContent: content.substring(0, 100),
        },
        relatedId: forum._id,
        relatedType: 'Forum',
        pointsEarned: 0,
      })

      const pointsEarned = await GamificationService.awardPoints(userId, 'FORUM_REPLY', {
        forumId,
        postId,
      })

      activity.pointsEarned = pointsEarned
      await activity.save()

      return { forum, reply }
    } catch (error) {
      logger.error(`Error adding reply to post ${postId}:`, error)
      throw error
    }
  }

  /**
   * Toggle pin status of a post (moderators only)
   */
  static async togglePinPost(forumId: string, postId: string, userId: string) {
    try {
      const forum = await Forum.findById(forumId)
      if (!forum) {
        throw new AppError(404, 'Forum not found')
      }

      const post = forum.posts.find((p) => p._id.toString() === postId)
      if (!post) {
        throw new AppError(404, 'Post not found')
      }

      // Check if user is creator or moderator
      const isCreator = forum.creatorId.toString() === userId
      const isModerator = forum.moderators.some((mod) => mod.toString() === userId)

      if (!isCreator && !isModerator) {
        throw new AppError(403, 'Only forum creators and moderators can pin posts')
      }

      post.pinned = !post.pinned
      await forum.save()

      return { forum, pinned: post.pinned }
    } catch (error) {
      logger.error(`Error toggling pin for post ${postId}:`, error)
      throw error
    }
  }

  /**
   * Get trending forums
   */
  static async getTrendingForums(
    options: {
      limit?: number
      timeframe?: 'day' | 'week' | 'month'
    } = {}
  ) {
    try {
      const { limit = 10, timeframe = 'week' } = options

      // Calculate date range
      const now = new Date()
      const timeRanges = {
        day: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000,
      }
      const startDate = new Date(now.getTime() - timeRanges[timeframe])

      const forums = await Forum.find({
        isActive: true,
        lastActivity: { $gte: startDate },
      })
        .sort({ postCount: -1, memberCount: -1, lastActivity: -1 })
        .limit(limit)
        .populate('creatorId', 'firstName lastName level')

      return forums
    } catch (error) {
      logger.error('Error getting trending forums:', error)
      throw error
    }
  }

  /**
   * Get user's forums (created and subscribed)
   */
  static async getUserForums(
    userId: string,
    options: {
      type?: 'created' | 'subscribed' | 'all'
    } = {}
  ) {
    try {
      const { type = 'all' } = options

      let filter: any = { isActive: true }

      if (type === 'created') {
        filter.creatorId = new Types.ObjectId(userId)
      } else if (type === 'subscribed') {
        filter.subscribers = { $in: [new Types.ObjectId(userId)] }
      } else {
        filter.$or = [
          { creatorId: new Types.ObjectId(userId) },
          { subscribers: { $in: [new Types.ObjectId(userId)] } },
        ]
      }

      const forums = await Forum.find(filter)
        .sort({ lastActivity: -1 })
        .populate('creatorId', 'firstName lastName level')

      // Separate into created and subscribed
      const created = forums.filter((f) => f.creatorId._id.toString() === userId)
      const subscribed = forums.filter(
        (f) =>
          f.subscribers.some((s) => s.toString() === userId) &&
          f.creatorId._id.toString() !== userId
      )

      return {
        created,
        subscribed,
        all: forums,
      }
    } catch (error) {
      logger.error(`Error getting user forums for ${userId}:`, error)
      throw error
    }
  }

  /**
   * Get forum statistics
   */
  static async getForumStatistics(forumId: string) {
    try {
      if (!Types.ObjectId.isValid(forumId)) {
        throw new AppError(400, 'Invalid forum ID')
      }

      const forum = await Forum.findById(forumId)
      if (!forum) {
        throw new AppError(404, 'Forum not found')
      }

      // Calculate post engagement
      const totalUpvotes = forum.posts.reduce((sum, post) => sum + post.upvotes.length, 0)
      const totalDownvotes = forum.posts.reduce((sum, post) => sum + post.downvotes.length, 0)
      const totalReplies = forum.posts.reduce((sum, post) => sum + post.replies.length, 0)

      // Get active users (posted in last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const recentPosts = forum.posts.filter((post) => post.createdAt >= thirtyDaysAgo)
      const activeUsers = new Set(recentPosts.map((post) => post.userId.toString())).size

      return {
        memberCount: forum.memberCount,
        postCount: forum.postCount,
        totalReplies,
        totalUpvotes,
        totalDownvotes,
        activeUsers,
        lastActivity: forum.lastActivity,
        averageEngagement:
          forum.postCount > 0
            ? (totalUpvotes + totalDownvotes + totalReplies) / forum.postCount
            : 0,
      }
    } catch (error) {
      logger.error(`Error getting forum statistics for ${forumId}:`, error)
      throw error
    }
  }

  /**
   * Add moderator to expert forum
   */
  static async addModerator(forumId: string, userId: string, moderatorId: string) {
    try {
      const forum = await Forum.findById(forumId)
      if (!forum) {
        throw new AppError(404, 'Forum not found')
      }

      // Only creator can add moderators
      if (forum.creatorId.toString() !== userId) {
        throw new AppError(403, 'Only forum creator can add moderators')
      }

      // Only expert forums can have moderators
      if (forum.category !== 'expert') {
        throw new AppError(400, 'Only expert forums can have moderators')
      }

      // Check if already a moderator
      if (forum.moderators.some((mod) => mod.toString() === moderatorId)) {
        throw new AppError(400, 'User is already a moderator')
      }

      // Validate the new moderator
      const moderator = await User.findById(moderatorId)
      if (!moderator) {
        throw new AppError(404, 'Moderator user not found')
      }

      // Check if moderator meets forum requirements
      if (!forum.canUserAccess(moderator)) {
        throw new AppError(403, 'User does not meet forum requirements to be a moderator')
      }

      forum.moderators.push(new Types.ObjectId(moderatorId))
      await forum.save()

      return forum
    } catch (error) {
      logger.error(`Error adding moderator to forum ${forumId}:`, error)
      throw error
    }
  }

  /**
   * Remove moderator from expert forum
   */
  static async removeModerator(forumId: string, userId: string, moderatorId: string) {
    try {
      const forum = await Forum.findById(forumId)
      if (!forum) {
        throw new AppError(404, 'Forum not found')
      }

      // Only creator can remove moderators
      if (forum.creatorId.toString() !== userId) {
        throw new AppError(403, 'Only forum creator can remove moderators')
      }

      // Cannot remove creator as moderator
      if (forum.creatorId.toString() === moderatorId) {
        throw new AppError(400, 'Cannot remove forum creator as moderator')
      }

      forum.moderators = forum.moderators.filter((mod) => mod.toString() !== moderatorId)
      await forum.save()

      return forum
    } catch (error) {
      logger.error(`Error removing moderator from forum ${forumId}:`, error)
      throw error
    }
  }

  /**
   * Get forum members
   */
  static async getForumMembers(
    forumId: string,
    options: {
      page?: number
      limit?: number
    } = {}
  ) {
    try {
      const { page = 1, limit = 20 } = options

      const forum = await Forum.findById(forumId).populate({
        path: 'subscribers',
        select: 'firstName lastName level badges',
        options: {
          skip: (page - 1) * limit,
          limit,
        },
      })

      if (!forum) {
        throw new AppError(404, 'Forum not found')
      }

      const total = forum.memberCount

      return {
        data: forum.subscribers,
        meta: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      }
    } catch (error) {
      logger.error(`Error getting forum members for ${forumId}:`, error)
      throw error
    }
  }

  /**
   * Search forums
   */
  static async searchForums(
    options: {
      query: string
      category?: 'general' | 'expert'
      tags?: string[]
      urgencyLevel?: 'low' | 'medium' | 'high' | 'critical'
      limit?: number
    },
    userId?: string
  ) {
    try {
      const { query, category, tags, urgencyLevel, limit = 20 } = options

      const filter: any = {
        isActive: true,
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { tags: { $regex: query, $options: 'i' } },
        ],
      }

      if (category) filter.category = category
      if (tags && tags.length > 0) filter.tags = { $in: tags }
      if (urgencyLevel) filter['socialIssues.urgencyLevel'] = urgencyLevel

      let forums = await Forum.find(filter)
        .limit(limit)
        .sort({ memberCount: -1, postCount: -1 })
        .populate('creatorId', 'firstName lastName level')

      // Filter expert forums based on user access
      if (userId) {
        const user = await User.findById(userId)
        if (user) {
          forums = forums.filter((forum) => forum.canUserAccess(user))
        }
      }

      return forums
    } catch (error) {
      logger.error('Error searching forums:', error)
      throw error
    }
  }

  /**
   * Update forum
   */
  static async updateForum(
    forumId: string,
    userId: string,
    data: {
      title?: string
      description?: string
      tags?: string[]
      rules?: string[]
      socialIssues?: {
        relatedIssues: string[]
        impactAreas: string[]
        urgencyLevel: 'low' | 'medium' | 'high' | 'critical'
      }
    }
  ) {
    try {
      const forum = await Forum.findById(forumId)
      if (!forum) {
        throw new AppError(404, 'Forum not found')
      }

      // Check if user is creator or moderator
      const isCreator = forum.creatorId.toString() === userId
      const isModerator = forum.moderators.some((mod) => mod.toString() === userId)

      if (!isCreator && !isModerator) {
        throw new AppError(403, 'Only forum creators and moderators can update forums')
      }

      // Update allowed fields
      Object.assign(forum, data)
      await forum.save()

      return forum
    } catch (error) {
      logger.error(`Error updating forum ${forumId}:`, error)
      throw error
    }
  }

  /**
   * Delete forum
   */
  static async deleteForum(forumId: string, userId: string) {
    try {
      const forum = await Forum.findById(forumId)
      if (!forum) {
        throw new AppError(404, 'Forum not found')
      }

      // Only creator can delete forum
      if (forum.creatorId.toString() !== userId) {
        throw new AppError(403, 'Only forum creator can delete forum')
      }

      // Soft delete by setting isActive to false
      forum.isActive = false
      await forum.save()

      return { success: true }
    } catch (error) {
      logger.error(`Error deleting forum ${forumId}:`, error)
      throw error
    }
  }
}
