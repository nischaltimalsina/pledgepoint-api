import { User } from '../models/user.model'
import { logger } from '../utils/logger'

/**
 * Service for handling gamification features
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
          case 'REVIEW_OFFICIAL':
            pointsToAward = 20
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
          default:
            pointsToAward = 5 // Default points for unspecified actions
        }
      }

      // Update user's points
      const user = await User.findById(userId)

      if (!user) {
        logger.error(`User not found for ID: ${userId}`)
        return 0
      }

      // Add points
      user.impactPoints += pointsToAward

      // Check if user level should be updated
      const newLevel = this.calculateUserLevel(user.impactPoints)
      if (newLevel !== user.level) {
        user.level = newLevel

        // Could trigger level-up notification here
      }

      // Save user
      await user.save()

      return pointsToAward
    } catch (error) {
      logger.error('Error awarding points:', error)
      return 0
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

      // Get user with badges
      const user = await User.findById(userId)

      if (!user) {
        logger.error(`User not found for ID: ${userId}`)
        return awardedBadges
      }

      // Initialize badges array if it doesn't exist
      if (!user.badges) {
        user.badges = []
      }

      // Check for eligible badges based on action type
      switch (actionType) {
        case 'RATE_OFFICIAL':
          // First Voice badge - First rating/review
          if (!user.badges.includes('First Voice')) {
            user.badges.push('First Voice')
            awardedBadges.push('First Voice')
          }

          // Active Rater badge - 10 ratings
          // Would need to count all ratings, simplified here
          break

        case 'SUBMIT_EVIDENCE':
          // Promise Seeker badge - First evidence submission
          if (!user.badges.includes('Promise Seeker')) {
            user.badges.push('Promise Seeker')
            awardedBadges.push('Promise Seeker')
          }
          break

        case 'CREATE_CAMPAIGN':
          // Campaign Starter badge - First campaign created
          if (!user.badges.includes('Campaign Starter')) {
            user.badges.push('Campaign Starter')
            awardedBadges.push('Campaign Starter')
          }
          break

        case 'COMPLETE_MODULE':
          // Specific module completion badges would be handled here
          // For example, 'Rights Defender' for completing rights module
          if (details.module?.category === 'rights' && !user.badges.includes('Rights Defender')) {
            user.badges.push('Rights Defender')
            awardedBadges.push('Rights Defender')
          }
          break
      }

      // Level-based badges
      if (user.level === 'advocate' && !user.badges.includes('Advocate')) {
        user.badges.push('Advocate')
        awardedBadges.push('Advocate')
      } else if (user.level === 'leader' && !user.badges.includes('Leader')) {
        user.badges.push('Leader')
        awardedBadges.push('Leader')
      }

      // Save user if badges were awarded
      if (awardedBadges.length > 0) {
        await user.save()
      }

      return awardedBadges
    } catch (error) {
      logger.error('Error checking badges:', error)
      return []
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
      const isAwarded = user.badges.includes(badgeCode)

      // Get badge threshold based on badge code
      // In a full implementation, this would fetch from a Badge model
      const badgeThresholds: { [key: string]: { threshold: number; count: number } } = {
        'First Voice': { threshold: 1, count: 0 }, // First rating
        'Active Rater': { threshold: 10, count: 0 }, // 10 ratings
        'Critical Reviewer': { threshold: 5, count: 0 }, // 5 detailed reviews
        'Promise Seeker': { threshold: 1, count: 0 }, // 1 evidence submission
        'Promise Tracker': { threshold: 5, count: 0 }, // 5 evidence submissions
        'Campaign Starter': { threshold: 1, count: 0 }, // 1 campaign created
        'Campaign Catalyst': { threshold: 3, count: 0 }, // 3 successful campaigns
      }

      // If badge not found, return default values
      if (!badgeThresholds[badgeCode]) {
        return {
          badge: {
            code: badgeCode,
            name: badgeCode,
            description: 'Badge description not available',
            threshold: 1,
          },
          progress: isAwarded ? 100 : 0,
          isAwarded,
        }
      }

      // Get badge details
      const badge = {
        code: badgeCode,
        name: badgeCode, // Would fetch from Badge model
        description: 'Badge description', // Would fetch from Badge model
        threshold: badgeThresholds[badgeCode].threshold,
      }

      // Calculate progress based on user's activity
      // This is simplified - would typically query Activity model
      let count = badgeThresholds[badgeCode].count
      let progress = isAwarded ? 100 : Math.floor((count / badge.threshold) * 100)

      return {
        badge,
        progress,
        isAwarded,
      }
    } catch (error) {
      logger.error('Error getting badge progress:', error)
      return {
        badge: {
          code: badgeCode,
          name: badgeCode,
          description: 'Badge description not available',
          threshold: 1,
        },
        progress: 0,
        isAwarded: false,
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
          // Sort by badge count (using array length)
          // Note: MongoDB aggregation would be better for this
          break
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

  /**
   * Get activity streak for a user
   * @param userId User ID to check streak for
   * @param streakType Type of streak (e.g., 'civic', 'learning')
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
      // In a full implementation, this would query an Activity model
      // For now, return placeholder data
      return {
        currentStreak: 3, // Example: 3 days/weeks streak
        longestStreak: 5, // Example: 5 days/weeks best streak
        lastActivity: new Date(), // Last activity date
        multiplier: 1.0, // Point multiplier based on streak
      }
    } catch (error) {
      logger.error('Error getting user streak:', error)
      return {
        currentStreak: 0,
        longestStreak: 0,
        lastActivity: null,
        multiplier: 1.0,
      }
    }
  }
}
