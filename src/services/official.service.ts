import { Types } from 'mongoose'
import { Official, Rating, User, Activity } from '../models'
import { GamificationService } from './gamification.service'
import { NotificationService } from './notification.service'
import { AppError } from '../middleware/error-handler'
import { logger } from '../utils/logger'

/**
 * Service handling officials-related business logic
 */
export class OfficialService {
  /**
   * Get all officials with pagination and filtering
   */
  static async getOfficials(options: {
    page?: number
    limit?: number
    sort?: string
    district?: string
    position?: string
    party?: string
    search?: string
  }) {
    try {
      const {
        page = 1,
        limit = 10,
        sort = '-averageRating.overall',
        district,
        position,
        party,
        search,
      } = options

      // Build filter
      const filter: any = {}

      if (district) filter.district = district
      if (position) filter.position = position
      if (party) filter.party = party

      // Add search functionality
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { position: { $regex: search, $options: 'i' } },
          { district: { $regex: search, $options: 'i' } },
          { party: { $regex: search, $options: 'i' } },
        ]
      }

      // Get officials with pagination
      const officials = await Official.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)

      // Get total count
      const total = await Official.countDocuments(filter)

      // Calculate pagination metadata
      const pages = Math.ceil(total / limit)
      const hasNext = page < pages
      const hasPrev = page > 1

      return {
        data: officials,
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
      logger.error('Error fetching officials:', error)
      throw error
    }
  }

  /**
   * Get official by ID
   */
  static async getOfficialById(id: string) {
    try {
      // Validate ID
      if (!Types.ObjectId.isValid(id)) {
        throw new AppError(400, 'Invalid official ID')
      }

      // Get official
      const official = await Official.findById(id)

      if (!official) {
        throw new AppError(404, 'Official not found')
      }

      return official
    } catch (error) {
      logger.error(`Error fetching official with ID ${id}:`, error)
      throw error
    }
  }

  /**
   * Create a new official
   */
  static async createOfficial(data: {
    name: string
    position: string
    district: string
    party: string
    term: {
      start: Date
      end: Date
    }
    contactInfo?: {
      email?: string
      phone?: string
      address?: string
      website?: string
      socialMedia?: {
        facebook?: string
        twitter?: string
        instagram?: string
      }
    }
    bio?: string
    photo?: string
  }) {
    try {
      // Create new official
      const official = new Official({
        _id: new Types.ObjectId(),
        ...data,
        averageRating: {
          integrity: 0,
          responsiveness: 0,
          effectiveness: 0,
          transparency: 0,
          overall: 0,
        },
        totalRatings: 0,
      })

      // Save official
      await official.save()

      return official
    } catch (error) {
      logger.error('Error creating official:', error)
      throw error
    }
  }

  /**
   * Rate an official - FIXED to work with standalone Rating model
   */
  static async rateOfficial(
    officialId: string,
    userId: string,
    ratingData: {
      integrity: number
      responsiveness: number
      effectiveness: number
      transparency: number
      comment: string
      evidence?: string
    }
  ) {
    try {
      // Validate official ID
      if (!Types.ObjectId.isValid(officialId)) {
        throw new AppError(400, 'Invalid official ID')
      }

      // Get official
      const official = await Official.findById(officialId)

      if (!official) {
        throw new AppError(404, 'Official not found')
      }

      // Get user
      const user = await User.findById(userId)

      if (!user) {
        throw new AppError(404, 'User not found')
      }

      // Calculate overall rating
      const overall = parseFloat(
        (
          (ratingData.integrity +
            ratingData.responsiveness +
            ratingData.effectiveness +
            ratingData.transparency) /
          4
        ).toFixed(1)
      )

      // Check if user has already rated this official
      let existingRating = await Rating.findOne({
        officialId: new Types.ObjectId(officialId),
        userId: new Types.ObjectId(userId),
      })

      let isNewRating = false

      if (existingRating) {
        // Update existing rating
        existingRating.integrity = ratingData.integrity
        existingRating.responsiveness = ratingData.responsiveness
        existingRating.effectiveness = ratingData.effectiveness
        existingRating.transparency = ratingData.transparency
        existingRating.overall = overall
        existingRating.comment = ratingData.comment
        existingRating.evidence = ratingData.evidence
        existingRating.status = 'pending' // Reset to pending for moderation

        await existingRating.save()
      } else {
        // Create new rating
        isNewRating = true
        existingRating = new Rating({
          _id: new Types.ObjectId(),
          officialId: new Types.ObjectId(officialId),
          userId: new Types.ObjectId(userId),
          integrity: ratingData.integrity,
          responsiveness: ratingData.responsiveness,
          effectiveness: ratingData.effectiveness,
          transparency: ratingData.transparency,
          overall,
          comment: ratingData.comment,
          evidence: ratingData.evidence,
          upvotes: [],
          downvotes: [],
          status: 'pending', // Ratings start as pending for moderation
        })

        await existingRating.save()
      }

      // FIXED: Use the correct method name from the Official model
      // The Rating model middleware will automatically call this, but we can also call it manually
      await official.updateAverageRatings()

      // Track activity and award points only if this is a new rating
      if (isNewRating) {
        // Create activity record
        const activity = new Activity({
          userId: new Types.ObjectId(userId),
          type: 'rating_created',
          details: {
            officialId: official._id,
            officialName: official.name,
            rating: overall,
          },
          relatedId: official._id,
          relatedType: 'Official',
          pointsEarned: 0, // Will be updated by gamification service
          badgesEarned: [],
        })

        // Award points and badges
        const pointsEarned = await GamificationService.awardPoints(userId, 'RATE_OFFICIAL', {
          rating: overall,
        })

        const badgesEarned = await GamificationService.checkAndAwardBadges(
          userId,
          'RATE_OFFICIAL',
          { officialId, rating: overall }
        )

        // Update activity record with points and badges
        activity.pointsEarned = pointsEarned
        activity.badgesEarned = badgesEarned
        await activity.save()

        // Send notification for earned badges
        if (badgesEarned.length > 0) {
          await NotificationService.sendBadgeNotification(userId, badgesEarned)
        }
      }

      return existingRating
    } catch (error) {
      logger.error(`Error rating official ${officialId}:`, error)
      throw error
    }
  }

  /**
   * Update an official
   */
  static async updateOfficial(
    id: string,
    data: {
      name?: string
      position?: string
      district?: string
      party?: string
      term?: {
        start: Date
        end: Date
      }
      contactInfo?: {
        email?: string
        phone?: string
        address?: string
        website?: string
        socialMedia?: {
          facebook?: string
          twitter?: string
          instagram?: string
        }
      }
      bio?: string
      photo?: string
    }
  ) {
    try {
      // Validate ID
      if (!Types.ObjectId.isValid(id)) {
        throw new AppError(400, 'Invalid official ID')
      }

      // Update official
      const official = await Official.findByIdAndUpdate(
        id,
        { $set: data },
        { new: true, runValidators: true }
      )

      if (!official) {
        throw new AppError(404, 'Official not found')
      }

      return official
    } catch (error) {
      logger.error(`Error updating official ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete an official
   */
  static async deleteOfficial(id: string) {
    try {
      // Validate ID
      if (!Types.ObjectId.isValid(id)) {
        throw new AppError(400, 'Invalid official ID')
      }

      // Delete official
      const official = await Official.findByIdAndDelete(id)

      if (!official) {
        throw new AppError(404, 'Official not found')
      }

      // Also delete all ratings for this official
      await Rating.deleteMany({ officialId: id })

      return { success: true }
    } catch (error) {
      logger.error(`Error deleting official ${id}:`, error)
      throw error
    }
  }

  /**
   * Upvote a rating - FIXED to work with standalone Rating model
   */
  static async upvoteRating(ratingId: string, userId: string) {
    try {
      // Validate IDs
      if (!Types.ObjectId.isValid(ratingId) || !Types.ObjectId.isValid(userId)) {
        throw new AppError(400, 'Invalid rating or user ID')
      }

      // Get rating
      const rating = await Rating.findById(ratingId)

      if (!rating) {
        throw new AppError(404, 'Rating not found')
      }

      // Check if user has already upvoted
      if (rating.upvotes.includes(new Types.ObjectId(userId))) {
        // Remove upvote (toggle)
        rating.upvotes = rating.upvotes.filter((id) => id.toString() !== userId)
      } else {
        // Add upvote
        rating.upvotes.push(new Types.ObjectId(userId))

        // Remove downvote if exists
        rating.downvotes = rating.downvotes.filter((id) => id.toString() !== userId)

        // Award points to rating creator
        await GamificationService.awardPoints(rating.userId.toString(), 'UPVOTE_RECEIVED', {
          ratingId,
        })

        // Create activity
        const activity = new Activity({
          userId: new Types.ObjectId(userId),
          type: 'upvote_received',
          details: {
            ratingId: rating._id,
            officialId: rating.officialId,
          },
          relatedId: rating._id,
          relatedType: 'Rating',
          pointsEarned: 0,
        })

        await activity.save()
      }

      await rating.save()

      return rating
    } catch (error) {
      logger.error(`Error upvoting rating ${ratingId}:`, error)
      throw error
    }
  }

  /**
   * Downvote a rating - FIXED to work with standalone Rating model
   */
  static async downvoteRating(ratingId: string, userId: string) {
    try {
      // Validate IDs
      if (!Types.ObjectId.isValid(ratingId) || !Types.ObjectId.isValid(userId)) {
        throw new AppError(400, 'Invalid rating or user ID')
      }

      // Get rating
      const rating = await Rating.findById(ratingId)

      if (!rating) {
        throw new AppError(404, 'Rating not found')
      }

      // Check if user has already downvoted
      if (rating.downvotes.includes(new Types.ObjectId(userId))) {
        // Remove downvote (toggle)
        rating.downvotes = rating.downvotes.filter((id) => id.toString() !== userId)
      } else {
        // Add downvote
        rating.downvotes.push(new Types.ObjectId(userId))

        // Remove upvote if exists
        rating.upvotes = rating.upvotes.filter((id) => id.toString() !== userId)

        // Create activity
        const activity = new Activity({
          userId: new Types.ObjectId(userId),
          type: 'downvote_received',
          details: {
            ratingId: rating._id,
            officialId: rating.officialId,
          },
          relatedId: rating._id,
          relatedType: 'Rating',
          pointsEarned: 0,
        })

        await activity.save()
      }

      await rating.save()

      return rating
    } catch (error) {
      logger.error(`Error downvoting rating ${ratingId}:`, error)
      throw error
    }
  }

  /**
   * Get top rated officials
   */
  static async getTopRatedOfficials(options: {
    limit?: number
    district?: string
    position?: string
  }) {
    try {
      const { limit = 5, district, position } = options

      // Build filter
      const filter: any = {}

      if (district) filter.district = district
      if (position) filter.position = position

      // Only include officials with at least one rating
      filter.totalRatings = { $gt: 0 }

      // Get top rated officials
      const officials = await Official.find(filter)
        .sort({ 'averageRating.overall': -1 })
        .limit(limit)

      return officials
    } catch (error) {
      logger.error('Error fetching top rated officials:', error)
      throw error
    }
  }
}
