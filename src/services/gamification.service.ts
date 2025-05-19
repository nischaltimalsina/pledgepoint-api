import { User, Badge, Activity, Rating, Promise, Campaign, LearningProgress } from '../models'
import { NotificationService } from './notification.service'
import { logger } from '../utils/logger'
import mongoose, { Types } from 'mongoose'

/**
 * Service handling gamification features (points, badges, levels)
 */
export class GamificationService {
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
   * Update user's streak and calculate longest streak
   * @param userId User ID
   * @param streakType Type of streak ('civic' or 'learning')
   * @param activityDate Date of the activity (defaults to now)
   * @returns Updated streak information
   */
  static async updateUserStreak(
    userId: string,
    streakType: 'civic' | 'learning',
    activityDate: Date = new Date()
  ): Promise<{
    currentStreak: number
    longestStreak: number
    isNewRecord: boolean
  }> {
    try {
      const user = await User.findById(userId)
      if (!user) {
        throw new Error(`User not found: ${userId}`)
      }

      // Initialize streaks if they don't exist
      if (!user.streaks) {
        user.streaks = {
          civic: { current: 0, longest: 0, lastActivity: new Date() },
          learning: { current: 0, longest: 0, lastActivity: new Date() },
        }
      }

      const streak = user.streaks[streakType]
      const timeUnit = streakType === 'civic' ? 'week' : 'day'

      // Calculate if this activity continues the streak
      const { shouldContinue, daysSinceLastActivity } = this.shouldContinueStreak(
        streak.lastActivity,
        activityDate,
        timeUnit
      )

      let isNewRecord = false

      if (shouldContinue) {
        // Continue existing streak
        streak.current += 1
      } else if (daysSinceLastActivity === 0) {
        // Same day/week activity - don't change streak
        // Just update last activity
      } else {
        // Streak broken, start new one
        streak.current = 1
      }

      // Update last activity
      streak.lastActivity = activityDate

      // Check if we have a new longest streak record
      if (streak.current > streak.longest) {
        streak.longest = streak.current
        isNewRecord = true
      }

      // Save user with updated streaks
      await user.save()

      logger.info(
        `Updated ${streakType} streak for user ${userId}: current=${streak.current}, longest=${streak.longest}`
      )

      return {
        currentStreak: streak.current,
        longestStreak: streak.longest,
        isNewRecord,
      }
    } catch (error) {
      logger.error(`Error updating streak for user ${userId}:`, error)
      throw error
    }
  }

  /**
   * Determine if activity should continue the current streak
   * @param lastActivity Last activity date
   * @param activityDate Current activity date
   * @param timeUnit 'day' or 'week'
   * @returns Whether to continue streak and days since last activity
   */
  private static shouldContinueStreak(
    lastActivity: Date | null,
    activityDate: Date,
    timeUnit: 'day' | 'week'
  ): { shouldContinue: boolean; daysSinceLastActivity: number } {
    if (!lastActivity) {
      return { shouldContinue: false, daysSinceLastActivity: Infinity }
    }

    const daysDiff = Math.floor(
      (activityDate.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (timeUnit === 'day') {
      // For daily streaks: continue if activity is on consecutive days (1 day difference)
      return {
        shouldContinue: daysDiff === 1,
        daysSinceLastActivity: daysDiff,
      }
    } else {
      // For weekly streaks: continue if activity is in consecutive weeks (5-9 days difference typically)
      const shouldContinue = daysDiff >= 5 && daysDiff <= 9
      return {
        shouldContinue,
        daysSinceLastActivity: daysDiff,
      }
    }
  }

  /**
   * Get user's streak information (updated implementation)
   * @param userId User ID
   * @param streakType Type of streak ('civic' or 'learning')
   * @returns Detailed streak information including multiplier
   */
  static async getUserStreak(
    userId: string,
    streakType: 'civic' | 'learning' = 'civic'
  ): Promise<{
    currentStreak: number
    longestStreak: number
    lastActivity: Date | null
    multiplier: number
    daysUntilBreak: number
    isAtRisk: boolean
  }> {
    try {
      const user = await User.findById(userId)
      if (!user) {
        return {
          currentStreak: 0,
          longestStreak: 0,
          lastActivity: null,
          multiplier: 1.0,
          daysUntilBreak: 0,
          isAtRisk: false,
        }
      }

      // Initialize streaks if they don't exist
      if (!user.streaks || !user.streaks[streakType]) {
        return {
          currentStreak: 0,
          longestStreak: 0,
          lastActivity: null,
          multiplier: 1.0,
          daysUntilBreak: 0,
          isAtRisk: false,
        }
      }

      const streak = user.streaks[streakType]
      const timeUnit = streakType === 'civic' ? 'week' : 'day'

      // Calculate multiplier based on current streak
      let multiplier = 1.0
      if (streakType === 'civic') {
        if (streak.current >= 4) multiplier = 1.5
        else if (streak.current >= 2) multiplier = 1.2
      } else {
        if (streak.current >= 7) multiplier = 1.5
        else if (streak.current >= 3) multiplier = 1.2
      }

      // Calculate days until streak breaks and risk assessment
      let daysUntilBreak = 0
      let isAtRisk = false

      if (streak.lastActivity) {
        const daysSinceLastActivity = Math.floor(
          (Date.now() - streak.lastActivity.getTime()) / (1000 * 60 * 60 * 24)
        )

        if (timeUnit === 'day') {
          daysUntilBreak = Math.max(0, 2 - daysSinceLastActivity) // Break after 2 days
          isAtRisk = daysSinceLastActivity >= 1
        } else {
          daysUntilBreak = Math.max(0, 10 - daysSinceLastActivity) // Break after 10 days
          isAtRisk = daysSinceLastActivity >= 7
        }
      }

      return {
        currentStreak: streak.current,
        longestStreak: streak.longest,
        lastActivity: streak.lastActivity,
        multiplier,
        daysUntilBreak,
        isAtRisk,
      }
    } catch (error) {
      logger.error(`Error getting ${streakType} streak for user ${userId}:`, error)
      return {
        currentStreak: 0,
        longestStreak: 0,
        lastActivity: null,
        multiplier: 1.0,
        daysUntilBreak: 0,
        isAtRisk: false,
      }
    }
  }

  /**
   * Award points with streak multiplier and update streaks
   * @param userId User ID to award points to
   * @param actionType Type of action performed
   * @param detailsOrAmount Action details or point amount
   * @returns Points awarded and streak information
   */
  static async awardPoints(
    userId: string,
    actionType: string,
    detailsOrAmount: any
  ): Promise<{
    pointsAwarded: number
    streakInfo?: {
      type: 'civic' | 'learning'
      currentStreak: number
      longestStreak: number
      isNewRecord: boolean
      multiplier: number
    }
  }> {
    try {
      // Get base points (existing logic)
      let basePoints = 0
      if (typeof detailsOrAmount === 'number') {
        basePoints = detailsOrAmount
      } else {
        // Calculate based on action type (existing switch logic)
        switch (actionType) {
          case 'RATE_OFFICIAL':
            basePoints = 10
            break
          case 'SUBMIT_EVIDENCE':
            basePoints = 20
            break
          // ... other cases
          default:
            basePoints = 5
        }
      }

      // Determine streak type based on action
      let streakType: 'civic' | 'learning' | null = null
      const civicActions = [
        'RATE_OFFICIAL',
        'SUBMIT_EVIDENCE',
        'CREATE_CAMPAIGN',
        'SUPPORT_CAMPAIGN',
        'DISCUSSION_POSTED',
        'COMMENT_POSTED',
      ]
      const learningActions = ['COMPLETE_MODULE', 'QUIZ_COMPLETED']

      if (civicActions.includes(actionType)) {
        streakType = 'civic'
      } else if (learningActions.includes(actionType)) {
        streakType = 'learning'
      }

      let streakInfo: any = undefined

      // Update streak and apply multiplier if applicable
      if (streakType) {
        const streakUpdate = await this.updateUserStreak(userId, streakType)
        const currentStreak = await this.getUserStreak(userId, streakType)

        // Apply streak multiplier
        basePoints = Math.round(basePoints * currentStreak.multiplier)

        streakInfo = {
          type: streakType,
          currentStreak: streakUpdate.currentStreak,
          longestStreak: streakUpdate.longestStreak,
          isNewRecord: streakUpdate.isNewRecord,
          multiplier: currentStreak.multiplier,
        }
      }

      // Update user's points (existing logic)
      const user = await User.findById(userId)
      if (!user) {
        logger.error(`User not found for ID: ${userId}`)
        return { pointsAwarded: 0 }
      }

      user.impactPoints += basePoints

      // Check level update (existing logic)
      const previousLevel = user.level
      const newLevel = this.calculateUserLevel(user.impactPoints)
      if (newLevel !== previousLevel) {
        user.level = newLevel
        const unlockedFeatures = this.getUnlockedFeaturesByLevel(newLevel)
        await NotificationService.sendLevelUpNotification(userId, newLevel, unlockedFeatures)
      }

      await user.save()

      logger.info(
        `Awarded ${basePoints} points to user ${userId} for ${actionType}${streakInfo ? ` (${streakInfo.multiplier}x multiplier)` : ''}`
      )

      return {
        pointsAwarded: basePoints,
        streakInfo,
      }
    } catch (error) {
      logger.error(`Error awarding points to user ${userId}:`, error)
      return { pointsAwarded: 0 }
    }
  }

  /**
   * Get leaderboard including streak information
   * @param category Leaderboard category
   * @param filter Additional filters
   * @param limit Number of users to return
   * @returns Leaderboard entries with streak data
   */
  static async getLeaderboard(
    category: string = 'points',
    filter: any = {},
    limit: number = 10
  ): Promise<any[]> {
    try {
      let query: any = { active: true }
      let sort: any = {}

      if (filter.district) {
        query.district = filter.district
      }

      switch (category) {
        case 'points':
          sort = { impactPoints: -1 }
          break
        case 'civic_streak':
          sort = { 'streaks.civic.current': -1 }
          break
        case 'learning_streak':
          sort = { 'streaks.learning.current': -1 }
          break
        case 'badges':
          // Existing badge logic
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
                streaks: 1,
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
            streaks: user.streaks || {
              civic: { current: 0, longest: 0 },
              learning: { current: 0, longest: 0 },
            },
          }))
        default:
          sort = { impactPoints: -1 }
      }

      const users = await User.find(query)
        .select('firstName lastName impactPoints level badges district streaks')
        .sort(sort)
        .limit(limit)

      return users.map((user, index) => ({
        rank: index + 1,
        userId: user._id,
        name: `${user.firstName} ${user.lastName.charAt(0)}.`,
        points: user.impactPoints,
        level: user.level,
        badgeCount: user.badges ? user.badges.length : 0,
        district: user.district || 'Unknown',
        streaks: user.streaks || {
          civic: { current: 0, longest: 0 },
          learning: { current: 0, longest: 0 },
        },
      }))
    } catch (error) {
      logger.error('Error getting leaderboard:', error)
      return []
    }
  }
}
