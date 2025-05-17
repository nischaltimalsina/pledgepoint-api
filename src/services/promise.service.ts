import { Types } from 'mongoose'
import { Promise, User, Official, Activity } from '../models'
import { GamificationService } from './gamification.service'
import { NotificationService } from './notification.service'
import { AppError } from '../middleware/error-handler'
import { logger } from '../utils/logger'

/**
 * Service handling promises-related business logic
 */
export class PromiseService {
  /**
   * Get all promises with pagination and filtering
   */
  static async getPromises(options: {
    page?: number
    limit?: number
    sort?: string
    status?: string
    category?: string
    search?: string
  }) {
    try {
      const { page = 1, limit = 10, sort = '-datePromised', status, category, search } = options

      // Build filter
      const filter: any = {}

      if (status) filter.status = status
      if (category) filter.category = category

      // Add search functionality
      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ]
      }

      // Get promises with pagination
      const promises = await Promise.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('officialId', 'name position district party')

      // Get total count
      const total = await Promise.countDocuments(filter)

      // Calculate pagination metadata
      const pages = Math.ceil(total / limit)
      const hasNext = page < pages
      const hasPrev = page > 1

      return {
        data: promises,
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
      logger.error('Error fetching promises:', error)
      throw error
    }
  }

  /**
   * Get promise by ID
   */
  static async getPromiseById(id: string) {
    try {
      // Validate ID
      if (!Types.ObjectId.isValid(id)) {
        throw new AppError(400, 'Invalid promise ID')
      }

      // Get promise
      const promise = await Promise.findById(id).populate(
        'officialId',
        'name position district party'
      )

      if (!promise) {
        throw new AppError(404, 'Promise not found')
      }

      return promise
    } catch (error) {
      logger.error(`Error fetching promise with ID ${id}:`, error)
      throw error
    }
  }

  /**
   * Get promises by official ID
   */
  static async getPromisesByOfficial(
    officialId: string,
    options: {
      page?: number
      limit?: number
      sort?: string
      status?: string
    }
  ) {
    try {
      // Validate ID
      if (!Types.ObjectId.isValid(officialId)) {
        throw new AppError(400, 'Invalid official ID')
      }

      const { page = 1, limit = 10, sort = '-datePromised', status } = options

      // Build filter
      const filter: any = { officialId: new Types.ObjectId(officialId) }

      if (status) filter.status = status

      // Get promises with pagination
      const promises = await Promise.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('officialId', 'name position district party')

      // Get total count
      const total = await Promise.countDocuments(filter)

      // Calculate pagination metadata
      const pages = Math.ceil(total / limit)
      const hasNext = page < pages
      const hasPrev = page > 1

      return {
        data: promises,
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
      logger.error(`Error fetching promises for official ${officialId}:`, error)
      throw error
    }
  }

  /**
   * Create a new promise
   */
  static async createPromise(
    userId: string,
    data: {
      officialId: string
      title: string
      description: string
      category: string
      datePromised: Date
      source: string
      status?: 'kept' | 'broken' | 'in-progress' | 'unverified'
    }
  ) {
    try {
      // Validate official ID
      if (!Types.ObjectId.isValid(data.officialId)) {
        throw new AppError(400, 'Invalid official ID')
      }

      // Check if official exists
      const official = await Official.findById(data.officialId)

      if (!official) {
        throw new AppError(404, 'Official not found')
      }

      // Create new promise
      const promise = new Promise({
        _id: new Types.ObjectId(),
        ...data,
        status: data.status || 'unverified',
        evidence: [],
        comments: [],
      })

      // Save promise
      await promise.save()

      // Create activity
      const activity = new Activity({
        userId: new Types.ObjectId(userId),
        type: 'promise_created',
        details: {
          promiseId: promise._id,
          promiseTitle: promise.title,
          officialId: promise.officialId,
          officialName: official.name,
        },
        relatedId: promise._id,
        relatedType: 'Promise',
        pointsEarned: 10, // Points for creating a promise entry
      })

      await activity.save()

      return promise
    } catch (error) {
      logger.error('Error creating promise:', error)
      throw error
    }
  }

  /**
   * Add evidence to a promise
   */
  static async addEvidence(
    promiseId: string,
    userId: string,
    data: {
      description: string
      source: string
      status: 'supporting' | 'opposing'
    }
  ) {
    try {
      // Validate IDs
      if (!Types.ObjectId.isValid(promiseId)) {
        throw new AppError(400, 'Invalid promise ID')
      }

      // Get promise
      const promise = await Promise.findById(promiseId)

      if (!promise) {
        throw new AppError(404, 'Promise not found')
      }

      // Get user
      const user = await User.findById(userId)

      if (!user) {
        throw new AppError(404, 'User not found')
      }

      // Store the original status before any changes
      const originalStatus = promise.status

      // Create new evidence
      const evidence = {
        userId: new Types.ObjectId(userId),
        description: data.description,
        source: data.source,
        status: data.status,
        date: new Date(),
        upvotes: [],
        downvotes: [],
      }

      // Add evidence to promise
      promise.evidence.push(evidence)

      // Update promise status based on evidence
      promise.updateStatus()

      // If status changed, save the old status for notification
      if (originalStatus !== promise.status) {
        // Save updated promise
        await promise.save()

        // Send notification about status change
        await NotificationService.sendPromiseStatusChangeNotification(
          promiseId.toString(),
          originalStatus,
          promise.status
        )
      } else {
        // Save updated promise without notification
        await promise.save()
      }

      // Create activity
      const activity = new Activity({
        userId: new Types.ObjectId(userId),
        type: 'evidence_submitted',
        details: {
          promiseId: promise._id,
          promiseTitle: promise.title,
          evidenceStatus: data.status,
        },
        relatedId: promise._id,
        relatedType: 'Promise',
        pointsEarned: 0, // Will be updated by gamification service
        badgesEarned: [],
      })

      // Award points and badges
      const pointsEarned = await GamificationService.awardPoints(userId, 'SUBMIT_EVIDENCE', {
        evidenceStatus: data.status,
      })

      const badgesEarned = await GamificationService.checkAndAwardBadges(
        userId,
        'SUBMIT_EVIDENCE',
        { promiseId, evidenceStatus: data.status }
      )

      // Update activity record with points and badges
      activity.pointsEarned = pointsEarned
      activity.badgesEarned = badgesEarned
      await activity.save()

      // Send notification for earned badges
      if (badgesEarned.length > 0) {
        await NotificationService.sendBadgeNotification(userId, badgesEarned)
      }

      return {
        promise,
        evidence: evidence,
        pointsEarned,
        badgesEarned,
      }
    } catch (error) {
      logger.error(`Error adding evidence to promise ${promiseId}:`, error)
      throw error
    }
  }

  /**
   * Add comment to a promise
   */
  static async addComment(promiseId: string, userId: string, text: string) {
    try {
      // Validate IDs
      if (!Types.ObjectId.isValid(promiseId)) {
        throw new AppError(400, 'Invalid promise ID')
      }

      // Get promise
      const promise = await Promise.findById(promiseId)

      if (!promise) {
        throw new AppError(404, 'Promise not found')
      }

      // Get user
      const user = await User.findById(userId)

      if (!user) {
        throw new AppError(404, 'User not found')
      }

      // Create new comment
      const comment = {
        userId: new Types.ObjectId(userId),
        text,
        createdAt: new Date(),
      }

      // Add comment to promise
      promise.comments.push(comment)

      // Save updated promise
      await promise.save()

      // Create activity
      const activity = new Activity({
        userId: new Types.ObjectId(userId),
        type: 'comment_posted',
        details: {
          promiseId: promise._id,
          promiseTitle: promise.title,
          commentText: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
        },
        relatedId: promise._id,
        relatedType: 'Promise',
        pointsEarned: 0, // Will be updated by gamification service
      })

      // Award points
      const pointsEarned = await GamificationService.awardPoints(userId, 'COMMENT_POSTED', {})

      // Update activity with points earned
      activity.pointsEarned = pointsEarned
      await activity.save()

      return {
        promise,
        comment,
        pointsEarned,
      }
    } catch (error) {
      logger.error(`Error adding comment to promise ${promiseId}:`, error)
      throw error
    }
  }

  /**
   * Upvote evidence
   */
  static async upvoteEvidence(promiseId: string, evidenceIndex: number, userId: string) {
    try {
      // Validate IDs
      if (!Types.ObjectId.isValid(promiseId)) {
        throw new AppError(400, 'Invalid promise ID')
      }

      // Get promise
      const promise = await Promise.findById(promiseId)

      if (!promise) {
        throw new AppError(404, 'Promise not found')
      }

      // Check if evidence exists
      if (!promise.evidence[evidenceIndex]) {
        throw new AppError(404, 'Evidence not found')
      }

      const evidence = promise.evidence[evidenceIndex]

      // Check if user has already upvoted
      const upvoteIndex = evidence.upvotes.findIndex((id) => id.toString() === userId)

      if (upvoteIndex !== -1) {
        // Remove upvote (toggle)
        evidence.upvotes.splice(upvoteIndex, 1)
      } else {
        // Add upvote
        evidence.upvotes.push(new Types.ObjectId(userId))

        // Remove downvote if exists
        const downvoteIndex = evidence.downvotes.findIndex((id) => id.toString() === userId)
        if (downvoteIndex !== -1) {
          evidence.downvotes.splice(downvoteIndex, 1)
        }

        // Award points to evidence creator
        await GamificationService.awardPoints(evidence.userId.toString(), 'UPVOTE_RECEIVED', {
          promiseId,
          evidenceIndex,
        })

        // Create activity
        const activity = new Activity({
          userId: new Types.ObjectId(userId),
          type: 'upvote_received',
          details: {
            promiseId: promise._id,
            evidenceIndex,
          },
          relatedId: promise._id,
          relatedType: 'Promise',
          pointsEarned: 0,
        })

        await activity.save()
      }

      // Save updated promise
      await promise.markModified('evidence')
      await promise.save()

      return promise
    } catch (error) {
      logger.error(`Error upvoting evidence for promise ${promiseId}:`, error)
      throw error
    }
  }

  /**
   * Downvote evidence
   */
  static async downvoteEvidence(promiseId: string, evidenceIndex: number, userId: string) {
    try {
      // Validate IDs
      if (!Types.ObjectId.isValid(promiseId)) {
        throw new AppError(400, 'Invalid promise ID')
      }

      // Get promise
      const promise = await Promise.findById(promiseId)

      if (!promise) {
        throw new AppError(404, 'Promise not found')
      }

      // Check if evidence exists
      if (!promise.evidence[evidenceIndex]) {
        throw new AppError(404, 'Evidence not found')
      }

      const evidence = promise.evidence[evidenceIndex]

      // Check if user has already downvoted
      const downvoteIndex = evidence.downvotes.findIndex((id) => id.toString() === userId)

      if (downvoteIndex !== -1) {
        // Remove downvote (toggle)
        evidence.downvotes.splice(downvoteIndex, 1)
      } else {
        // Add downvote
        evidence.downvotes.push(new Types.ObjectId(userId))

        // Remove upvote if exists
        const upvoteIndex = evidence.upvotes.findIndex((id) => id.toString() === userId)
        if (upvoteIndex !== -1) {
          evidence.upvotes.splice(upvoteIndex, 1)
        }

        // Create activity
        const activity = new Activity({
          userId: new Types.ObjectId(userId),
          type: 'downvote_received',
          details: {
            promiseId: promise._id,
            evidenceIndex,
          },
          relatedId: promise._id,
          relatedType: 'Promise',
          pointsEarned: 0,
        })

        await activity.save()
      }

      // Save updated promise
      await promise.markModified('evidence')
      await promise.save()

      return promise
    } catch (error) {
      logger.error(`Error downvoting evidence for promise ${promiseId}:`, error)
      throw error
    }
  }

  /**
   * Update a promise (admin only)
   */
  static async updatePromise(
    promiseId: string,
    data: {
      title?: string
      description?: string
      category?: string
      datePromised?: Date
      source?: string
      status?: 'kept' | 'broken' | 'in-progress' | 'unverified'
    }
  ) {
    try {
      // Validate ID
      if (!Types.ObjectId.isValid(promiseId)) {
        throw new AppError(400, 'Invalid promise ID')
      }

      // Get promise before update to capture original status
      const originalPromise = await Promise.findById(promiseId)

      if (!originalPromise) {
        throw new AppError(404, 'Promise not found')
      }

      // Remember original status for later
      const originalStatus = originalPromise.status

      // Update promise
      const promise = await Promise.findByIdAndUpdate(
        promiseId,
        { $set: data },
        { new: true, runValidators: true }
      )

      // If status was updated manually, create a notification
      if (data.status && data.status !== originalStatus) {
        await NotificationService.sendPromiseStatusChangeNotification(
          promiseId.toString(),
          originalStatus,
          data.status
        )
      }

      return promise
    } catch (error) {
      logger.error(`Error updating promise ${promiseId}:`, error)
      throw error
    }
  }

  /**
   * Delete a promise (admin only)
   */
  static async deletePromise(promiseId: string) {
    try {
      // Validate ID
      if (!Types.ObjectId.isValid(promiseId)) {
        throw new AppError(400, 'Invalid promise ID')
      }

      // Delete promise
      const promise = await Promise.findByIdAndDelete(promiseId)

      if (!promise) {
        throw new AppError(404, 'Promise not found')
      }

      return { success: true }
    } catch (error) {
      logger.error(`Error deleting promise ${promiseId}:`, error)
      throw error
    }
  }

  /**
   * Get promises statistics
   */
  static async getPromiseStatistics(filter: {
    officialId?: string
    district?: string
    category?: string
  }) {
    try {
      // Build filter
      const queryFilter: any = {}

      if (filter.officialId) {
        if (!Types.ObjectId.isValid(filter.officialId)) {
          throw new AppError(400, 'Invalid official ID')
        }
        queryFilter.officialId = new Types.ObjectId(filter.officialId)
      }

      if (filter.category) {
        queryFilter.category = filter.category
      }

      // If district is provided, need to find officials in that district first
      if (filter.district) {
        const officials = await Official.find({ district: filter.district })

        if (officials.length > 0) {
          const officialIds = officials.map((official) => official._id)
          queryFilter.officialId = { $in: officialIds }
        } else {
          // If no officials found in district, return empty statistics
          return {
            total: 0,
            statusBreakdown: {
              kept: 0,
              broken: 0,
              'in-progress': 0,
              unverified: 0,
            },
            categoryBreakdown: {},
          }
        }
      }

      // Get total promises count
      const total = await Promise.countDocuments(queryFilter)

      // Get status breakdown
      const statusAggregation = await Promise.aggregate([
        { $match: queryFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ])

      const statusBreakdown = {
        kept: 0,
        broken: 0,
        'in-progress': 0,
        unverified: 0,
      }

      type StatusId = 'kept' | 'broken' | 'in-progress' | 'unverified'

      statusAggregation.forEach((status: { _id: StatusId; count: number }) => {
        statusBreakdown[status._id] = status.count
      })

      // Get category breakdown
      const categoryAggregation = await Promise.aggregate([
        { $match: queryFilter },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ])

      const categoryBreakdown: { [key: string]: number } = {}

      categoryAggregation.forEach((category) => {
        categoryBreakdown[category._id] = category.count
      })

      return {
        total,
        statusBreakdown,
        categoryBreakdown,
      }
    } catch (error) {
      logger.error('Error getting promise statistics:', error)
      throw error
    }
  }
}
