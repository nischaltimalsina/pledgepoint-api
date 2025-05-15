import { User, Badge, Activity, Rating, Promise, Campaign, LearningProgress } from '../models'
import { NotificationService } from './notification.service'
import { logger } from '../utils/logger'
import mongoose, { Types } from 'mongoose'

/**
 * Service handling gamification features (points, badges, levels)
 */
export class GamificationService {
  /**
   * Award impact points for user actions
   * @param userId User ID to award points to
   * @param actionType Type of action performed
   * @param detailsOrAmount Action details or point amount
   * @returns Number of points awarded
   */
  static async awardPoints(
    userId: string,
    actionType: string,
    detailsOrAmount: any
  ): Promise<number> {
    try {
      // Determine points to award
      let pointsToAward = 0

      if (typeof detailsOrAmount === 'number') {
        // If amount is directly provided
        pointsToAward = detailsOrAmount
      } else {
        // Calculate based on action type
        switch (actionType) {
          case 'RATE_OFFICIAL':
            pointsToAward = 10
            break
          case 'SUBMIT_EVIDENCE':
            pointsToAward = 20
            break
          case 'VERIFY_EVIDENCE':
            pointsToAward = 30
            break
          case 'CREATE_CAMPAIGN':
            pointsToAward = 50
            break
          case 'SUPPORT_CAMPAIGN':
            pointsToAward = 10
            break
          case 'COMPLETE_MODULE':
            pointsToAward = detailsOrAmount?.pointsReward || 20
            break
          case 'UPVOTE_RECEIVED':
            pointsToAward = 2
            break
          case 'COMMENT_POSTED':
            pointsToAward = 5
            break
          case 'DISCUSSION_POSTED':
            pointsToAward = 5
            break
          default:
            pointsToAward = 5 // Default points for unspecified actions
        }
      }

      // Apply any bonuses or multipliers
      pointsToAward = await this.applyPointMultipliers(userId, pointsToAward, actionType)

      // Update user's points
      const user = await User.findById(userId)

      if (!user) {
        logger.error(`User not found for ID: ${userId}`)
        return 0
      }

      // Add points
      const previousPoints = user.impactPoints
      user.impactPoints += pointsToAward

      // Get previous level
      const previousLevel = user.level

      // Check if user level should be updated
      const newLevel = this.calculateUserLevel(user.impactPoints)
      if (newLevel !== previousLevel) {
        user.level = newLevel

        // Send level-up notification with unlocked features
        const unlockedFeatures = this.getUnlockedFeaturesByLevel(newLevel)
        await NotificationService.sendLevelUpNotification(userId, newLevel, unlockedFeatures)
      }

      // Save user
      await user.save()

      // Log the points award
      logger.info(`Awarded ${pointsToAward} points to user ${userId} for ${actionType}`)

      return pointsToAward
    } catch (error) {
      logger.error(`Error awarding points to user ${userId}:`, error)
      return 0
    }
  }

  /**
   * Apply any point multipliers based on user status
   * @param userId User ID
   * @param basePoints Base points to multiply
   * @param actionType Type of action performed
   * @returns Adjusted points after multipliers
   */
  private static async applyPointMultipliers(
    userId: string,
    basePoints: number,
    actionType: string
  ): Promise<number> {
    try {
      let multiplier = 1.0

      // Get user's civic streak (weekly consecutive activity)
      const civicStreak = await this.getUserStreak(userId, 'civic')

      // Apply streak multiplier (max 2x after 4 weeks)
      if (civicStreak.currentStreak >= 4) {
        multiplier *= 1.5
      } else if (civicStreak.currentStreak >= 2) {
        multiplier *= 1.2
      }

      // If this is a learning action, check learning streak
      if (actionType === 'COMPLETE_MODULE') {
        const learningStreak = await this.getUserStreak(userId, 'learning')

        // Apply learning streak multiplier (max 2x after 7 days)
        if (learningStreak.currentStreak >= 7) {
          multiplier *= 1.5
        } else if (learningStreak.currentStreak >= 3) {
          multiplier *= 1.2
        }
      }

      // Apply level-based multiplier for certain actions
      const user = await User.findById(userId)
      if (user) {
        if (
          user.level === 'advocate' &&
          ['RATE_OFFICIAL', 'SUBMIT_EVIDENCE'].includes(actionType)
        ) {
          multiplier *= 1.1 // 10% bonus for advocates rating or submitting evidence
        } else if (user.level === 'leader') {
          multiplier *= 1.2 // 20% bonus for leaders on all actions
        }
      }

      // Calculate final points (round to nearest integer)
      return Math.round(basePoints * multiplier)
    } catch (error) {
      logger.error(`Error applying point multipliers for user ${userId}:`, error)
      return basePoints // Return original points on error
    }
  }

  /**
   * Calculate user level based on points
   * @param points User's impact points
   * @returns User level
   */
  static calculateUserLevel(points: number): 'citizen' | 'advocate' | 'leader' {
    if (points >= 500) {
      return 'leader'
    } else if (points >= 100) {
      return 'advocate'
    } else {
      return 'citizen'
    }
  }

  /**
   * Get unlocked features for a level
   * @param level User level
   * @returns Array of feature descriptions
   */
  private static getUnlockedFeaturesByLevel(level: string): string[] {
    switch (level) {
      case 'advocate':
        return [
          'Create and manage campaigns',
          'Submit evidence for promises',
          'Participate in moderation votes',
          'Customize your profile',
        ]
      case 'leader':
        return [
          'Priority visibility for your reviews and campaigns',
          'Create and moderate community discussions',
          'Mentor new users',
          'Access to advanced analytics',
          'Early access to new features',
        ]
      default:
        return []
    }
  }

  /**
   * Check and award any eligible badges
   * @param userId User ID to check badges for
   * @param actionType Type of action performed
   * @param details Action details
   * @returns Array of awarded badge codes
   */
  static async checkAndAwardBadges(
    userId: string,
    actionType: string,
    details: any
  ): Promise<string[]> {
    try {
      const awardedBadges: string[] = []

      // Get user
      const user = await User.findById(userId)

      if (!user) {
        logger.error(`User not found for ID: ${userId}`)
        return awardedBadges
      }

      // Initialize badges array if it doesn't exist
      if (!user.badges) {
        user.badges = []
      }

      // Get all available badges
      const allBadges = await Badge.find()

      // Check each badge for eligibility
      for (const badge of allBadges) {
        // Skip if user already has this badge
        if (user.badges.includes(badge.code)) {
          continue
        }

        // Check if user meets badge criteria
        const isEligible = await this.checkBadgeEligibility(userId, badge, actionType, details)

        if (isEligible) {
          // Award badge
          user.badges.push(badge.code)
          awardedBadges.push(badge.code)

          // Award badge points
          user.impactPoints += badge.pointsReward

          logger.info(`Awarded badge ${badge.code} to user ${userId}`)
        }
      }

      // If any badges were awarded, save user
      if (awardedBadges.length > 0) {
        await user.save()
      }

      return awardedBadges
    } catch (error) {
      logger.error(`Error checking badges for user ${userId}:`, error)
      return []
    }
  }

  /**
   * Check if a user is eligible for a badge
   * @param userId User ID
   * @param badge Badge to check
   * @param actionType Current action type
   * @param details Action details
   * @returns Whether the user is eligible for the badge
   */
  private static async checkBadgeEligibility(
    userId: string,
    badge: any,
    actionType: string,
    details: any
  ): Promise<boolean> {
    try {
      const criteria = badge.criteria

      // Handle specific_action criteria first (typically for onboarding badges)
      if (criteria.type === 'specific_action') {
        if (actionType === criteria.specificValue) {
          return true
        }
        return false
      }

      // For other criteria types, check counts
      switch (criteria.type) {
        case 'rating_count': {
          // Count user's ratings
          const count = await Rating.countDocuments({ userId })
          return count >= criteria.threshold
        }

        case 'review_count': {
          // Count user's ratings with comments longer than 50 chars
          const count = await Rating.countDocuments({
            userId,
            comment: { $exists: true, $regex: /^.{50,}$/ },
          })
          return count >= criteria.threshold
        }

        case 'evidence_count': {
          // Count promise evidence submissions
          let count = 0
          const promises = await Promise.find({ 'evidence.userId': new Types.ObjectId(userId) })

          promises.forEach((promise) => {
            const userEvidence = promise.evidence.filter((e) => e.userId.toString() === userId)
            count += userEvidence.length
          })

          return count >= criteria.threshold
        }

        case 'campaign_count': {
          // Count created campaigns
          const count = await Campaign.countDocuments({ creatorId: userId })
          return count >= criteria.threshold
        }

        case 'campaign_support_count': {
          // Count supported campaigns
          const count = await Campaign.countDocuments({
            supporters: { $elemMatch: { $eq: new Types.ObjectId(userId) } },
          })
          return count >= criteria.threshold
        }

        case 'module_completion': {
          if (criteria.specificValue) {
            // Check for specific module completion
            const module = await mongoose.model('LearningModule').findOne({
              category: criteria.specificValue,
            })

            if (!module) return false

            const progress = await LearningProgress.findOne({
              userId,
              moduleId: module._id,
              completed: true,
            })

            return !!progress
          } else {
            // Check for general module completion count
            const count = await LearningProgress.countDocuments({
              userId,
              completed: true,
            })
            return count >= criteria.threshold
          }
        }

        case 'category_completion': {
          // Check for completion of all modules in a category
          const modules = await mongoose.model('LearningModule').find({
            category: criteria.specificValue,
          })

          if (!modules.length) return false

          // Count completed modules in this category
          const completedCount = await LearningProgress.countDocuments({
            userId,
            moduleId: { $in: modules.map((m) => m._id) },
            completed: true,
          })

          return completedCount >= modules.length
        }

        case 'quiz_score': {
          // Check for high quiz scores
          const highScoreCount = await LearningProgress.countDocuments({
            userId,
            'quizResults.correct': { $gte: criteria.threshold },
          })

          return highScoreCount > 0
        }

        case 'upvote_count': {
          // Count ratings that received upvotes
          const ratings = await Rating.find({ userId })
          let upvoteCount = 0

          ratings.forEach((rating) => {
            if (rating.upvotes && rating.upvotes.length >= criteria.threshold) {
              upvoteCount++
            }
          })

          return upvoteCount > 0
        }

        case 'level_reached': {
          // Check if user reached a specific level
          const user = await User.findById(userId)
          if (!user) return false

          const levels = ['citizen', 'advocate', 'leader']
          const levelValue = levels.indexOf(user.level)
          const thresholdValue = levels.indexOf(criteria.specificValue)

          return levelValue >= thresholdValue
        }

        default:
          return false
      }
    } catch (error) {
      logger.error(`Error checking badge eligibility for user ${userId}:`, error)
      return false
    }
  }

  /**
   * Get user's progress toward next level
   * @param points User's current impact points
   * @returns Progress info
   */
  static getNextLevelProgress(points: number): {
    currentLevel: string
    nextLevel: string
    progress: number
  } {
    let currentLevel = this.calculateUserLevel(points)
    let nextLevel: string
    let currentThreshold: number
    let nextThreshold: number

    switch (currentLevel) {
      case 'citizen':
        nextLevel = 'advocate'
        currentThreshold = 0
        nextThreshold = 100
        break
      case 'advocate':
        nextLevel = 'leader'
        currentThreshold = 100
        nextThreshold = 500
        break
      case 'leader':
        nextLevel = 'leader' // Max level
        currentThreshold = 500
        nextThreshold = 500
        break
      default:
        nextLevel = 'advocate'
        currentThreshold = 0
        nextThreshold = 100
    }

    // Calculate progress percentage
    const progress =
      currentLevel === 'leader'
        ? 100 // Already at max level
        : Math.floor(((points - currentThreshold) / (nextThreshold - currentThreshold)) * 100)

    return {
      currentLevel,
      nextLevel,
      progress,
    }
  }

  /**
   * Get user's badge progress
   * @param userId User ID to check badge progress for
   * @param badgeCode Badge code to check progress for
   * @returns Badge progress info
   */
  static async getUserBadgeProgress(
    userId: string,
    badgeCode: string
  ): Promise<{
    badge: any
    progress: number
    isAwarded: boolean
  }> {
    try {
      // Get user
      const user = await User.findById(userId)

      if (!user) {
        throw new Error(`User not found for ID: ${userId}`)
      }

      // Check if badge already awarded
      const isAwarded = user.badges?.includes(badgeCode) || false

      // Get badge details
      const badge = await Badge.findOne({ code: badgeCode })

      if (!badge) {
        throw new Error(`Badge not found with code: ${badgeCode}`)
      }

      // Calculate progress based on badge criteria
      let progress = 0

      if (isAwarded) {
        progress = 100
      } else {
        // Calculate based on criteria type
        switch (badge.criteria.type) {
          case 'rating_count': {
            const count = await Rating.countDocuments({ userId })
            progress = Math.min(100, Math.floor((count / badge.criteria.threshold) * 100))
            break
          }

          case 'review_count': {
            const count = await Rating.countDocuments({
              userId,
              comment: { $exists: true, $regex: /^.{50,}$/ },
            })
            progress = Math.min(100, Math.floor((count / badge.criteria.threshold) * 100))
            break
          }

          case 'evidence_count': {
            let count = 0
            const promises = await Promise.find({ 'evidence.userId': new Types.ObjectId(userId) })

            promises.forEach((promise) => {
              const userEvidence = promise.evidence.filter((e) => e.userId.toString() === userId)
              count += userEvidence.length
            })

            progress = Math.min(100, Math.floor((count / badge.criteria.threshold) * 100))
            break
          }

          case 'campaign_count': {
            const count = await Campaign.countDocuments({ creatorId: userId })
            progress = Math.min(100, Math.floor((count / badge.criteria.threshold) * 100))
            break
          }

          case 'campaign_support_count': {
            const count = await Campaign.countDocuments({
              supporters: { $elemMatch: { $eq: new Types.ObjectId(userId) } },
            })
            progress = Math.min(100, Math.floor((count / badge.criteria.threshold) * 100))
            break
          }

          case 'module_completion': {
            if (badge.criteria.specificValue) {
              // For specific module
              const module = await mongoose.model('LearningModule').findOne({
                category: badge.criteria.specificValue,
              })

              if (!module) break

              const userProgress = await LearningProgress.findOne({
                userId,
                moduleId: module._id,
              })

              if (userProgress) {
                progress = Math.min(100, userProgress.progress || 0)
              }
            } else {
              // For general count
              const count = await LearningProgress.countDocuments({
                userId,
                completed: true,
              })
              progress = Math.min(100, Math.floor((count / badge.criteria.threshold) * 100))
            }
            break
          }

          default:
            progress = 0
        }
      }

      return {
        badge,
        progress,
        isAwarded,
      }
    } catch (error) {
      logger.error(`Error getting badge progress for user ${userId}, badge ${badgeCode}:`, error)
      throw error
    }
  }

  /**
   * Get user's streak information
   * @param userId User ID
   * @param streakType Type of streak ('civic' or 'learning')
   * @returns Streak information
   */
  static async getUserStreak(
    userId: string,
    streakType: 'civic' | 'learning' = 'civic'
  ): Promise<{
    currentStreak: number
    longestStreak: number
    lastActivity: Date | null
    multiplier: number
  }> {
    try {
      // Default return if no streak
      const defaultResult = {
        currentStreak: 0,
        longestStreak: 0,
        lastActivity: null,
        multiplier: 1.0,
      }

      // Get user
      const user = await User.findById(userId)
      if (!user) return defaultResult

      // Determine time unit and activity types based on streak type
      let timeUnit: 'day' | 'week' = 'day'
      let activityTypes: string[] = []

      if (streakType === 'civic') {
        timeUnit = 'week'
        activityTypes = [
          'rating_created',
          'evidence_submitted',
          'campaign_created',
          'campaign_supported',
          'discussion_posted',
          'comment_posted',
        ]
      } else {
        // learning streak
        timeUnit = 'day'
        activityTypes = ['module_started', 'module_completed', 'quiz_completed']
      }

      // Get activity history grouped by time unit
      const activities = await Activity.find({
        userId: new Types.ObjectId(userId),
        type: { $in: activityTypes },
      }).sort({ createdAt: -1 })

      if (!activities.length) return defaultResult

      // Get the most recent activity date
      const lastActivity = activities[0].createdAt

      // Group activities by time unit
      const activityTimeUnits = new Set<string>()

      activities.forEach((activity) => {
        let timeUnitStr: string

        if (timeUnit === 'day') {
          timeUnitStr = activity.createdAt.toISOString().split('T')[0] // YYYY-MM-DD
        } else {
          // week
          // Get week number (ISO week starts on Monday)
          const date = activity.createdAt
          const dayOfWeek = date.getDay() || 7 // Convert Sunday from 0 to 7
          const mondayDate = new Date(date)
          mondayDate.setDate(date.getDate() - dayOfWeek + 1)
          timeUnitStr = mondayDate.toISOString().split('T')[0] // Week start date
        }

        activityTimeUnits.add(timeUnitStr)
      })

      // Convert to array and sort chronologically
      const sortedTimeUnits = Array.from(activityTimeUnits).sort()

      // Calculate current streak
      let currentStreak = 0
      let checkDate: Date

      if (timeUnit === 'day') {
        checkDate = new Date()
        // If there was activity today, start checking from yesterday
        if (sortedTimeUnits.includes(checkDate.toISOString().split('T')[0])) {
          checkDate.setDate(checkDate.getDate() - 1)
          currentStreak = 1
        }
      } else {
        // week
        checkDate = new Date()
        const dayOfWeek = checkDate.getDay() || 7
        const mondayDate = new Date(checkDate)
        mondayDate.setDate(checkDate.getDate() - dayOfWeek + 1)
        const currentWeek = mondayDate.toISOString().split('T')[0]

        // If there was activity this week, start checking from last week
        if (sortedTimeUnits.includes(currentWeek)) {
          checkDate.setDate(checkDate.getDate() - 7)
          currentStreak = 1
        }
      }

      // Check consecutive time units
      for (let i = sortedTimeUnits.length - 1; i >= 0; i--) {
        const timeUnitDate = new Date(sortedTimeUnits[i])

        // Check if this is the expected next date
        if (timeUnit === 'day') {
          // For daily streak, dates should be consecutive
          const expectedDate = new Date(checkDate)
          expectedDate.setDate(expectedDate.getDate() - 1)

          if (
            timeUnitDate.toISOString().split('T')[0] === expectedDate.toISOString().split('T')[0]
          ) {
            currentStreak++
            checkDate = expectedDate
          } else {
            break
          }
        } else {
          // week
          // For weekly streak, weeks should be consecutive
          const expectedDate = new Date(checkDate)
          expectedDate.setDate(expectedDate.getDate() - 7)

          const expectedDayOfWeek = expectedDate.getDay() || 7
          const expectedMonday = new Date(expectedDate)
          expectedMonday.setDate(expectedDate.getDate() - expectedDayOfWeek + 1)

          if (
            timeUnitDate.toISOString().split('T')[0] === expectedMonday.toISOString().split('T')[0]
          ) {
            currentStreak++
            checkDate = expectedDate
          } else {
            break
          }
        }
      }

      // Calculate longest streak (simplified - in real implementation would be stored in user profile)
      const longestStreak = Math.max(currentStreak, 0) // Replace with actual longest streak

      // Calculate multiplier based on streak
      let multiplier = 1.0

      if (streakType === 'civic') {
        if (currentStreak >= 4) {
          // 4+ weeks
          multiplier = 1.5
        } else if (currentStreak >= 2) {
          // 2-3 weeks
          multiplier = 1.2
        }
      } else {
        // learning
        if (currentStreak >= 7) {
          // 7+ days
          multiplier = 1.5
        } else if (currentStreak >= 3) {
          // 3-6 days
          multiplier = 1.2
        }
      }

      return {
        currentStreak,
        longestStreak,
        lastActivity,
        multiplier,
      }
    } catch (error) {
      logger.error(`Error getting ${streakType} streak for user ${userId}:`, error)
      return {
        currentStreak: 0,
        longestStreak: 0,
        lastActivity: null,
        multiplier: 1.0,
      }
    }
  }

  /**
   * Get leaderboard for users
   * @param category Leaderboard category (points, badges, specific activity)
   * @param filter Additional filters (e.g., district, timeframe)
   * @param limit Number of users to return
   * @returns Leaderboard entries
   */
  static async getLeaderboard(
    category: string = 'points',
    filter: any = {},
    limit: number = 10
  ): Promise<any[]> {
    try {
      let query: any = { active: true }
      let sort: any = {}

      // Apply filters
      if (filter.district) {
        query.district = filter.district
      }

      // Determine sort field based on category
      switch (category) {
        case 'points':
          sort = { impactPoints: -1 }
          break
        case 'badges':
          // Handle badge count sorting through aggregation
          const badgeLeaderboard = await User.aggregate([
            { $match: query },
            {
              $project: {
                firstName: 1,
                lastName: 1,
                impactPoints: 1,
                level: 1,
                district: 1,
                badgeCount: { $size: { $ifNull: ['$badges', []] } },
              },
            },
            { $sort: { badgeCount: -1 } },
            { $limit: limit },
          ])

          return badgeLeaderboard.map((user, index) => ({
            rank: index + 1,
            userId: user._id,
            name: `${user.firstName} ${user.lastName.charAt(0)}.`,
            points: user.impactPoints,
            level: user.level,
            badgeCount: user.badgeCount,
            district: user.district || 'Unknown',
          }))
        default:
          sort = { impactPoints: -1 }
      }

      // Get users for leaderboard
      const users = await User.find(query)
        .select('firstName lastName impactPoints level badges district')
        .sort(sort)
        .limit(limit)

      // Format leaderboard entries
      return users.map((user, index) => ({
        rank: index + 1,
        userId: user._id,
        name: `${user.firstName} ${user.lastName.charAt(0)}.`, // Privacy: only first name and last initial
        points: user.impactPoints,
        level: user.level,
        badgeCount: user.badges ? user.badges.length : 0,
        district: user.district || 'Unknown',
      }))
    } catch (error) {
      logger.error('Error getting leaderboard:', error)
      return []
    }
  }
}
