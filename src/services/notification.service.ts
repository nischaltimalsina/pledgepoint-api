import { User, Badge } from '../models'
import { EmailService } from './email.service'
import { logger } from '../utils/logger'

/**
 * Service for handling notifications
 */
export class NotificationService {
  /**
   * Send a badge earned notification
   * @param userId User ID who earned the badge
   * @param badgeCodes Array of badge codes earned
   */
  static async sendBadgeNotification(userId: string, badgeCodes: string[]): Promise<void> {
    try {
      // Get user
      const user = await User.findById(userId)

      if (!user) {
        logger.error(`User with ID ${userId} not found for badge notification`)
        return
      }

      // Get badge details
      const badges = await Badge.find({ code: { $in: badgeCodes } })

      if (badges.length === 0) {
        logger.error(`No badges found with codes: ${badgeCodes.join(', ')}`)
        return
      }

      // For each badge, send a notification
      for (const badge of badges) {
        try {
          // Send email notification
          await EmailService.sendBadgeEarnedEmail(user.email, badge.name, badge.description)

          logger.info(`Sent badge notification for badge ${badge.code} to user ${userId}`)
        } catch (error) {
          logger.error(`Error sending badge notification for badge ${badge.code}:`, error)
        }
      }
    } catch (error) {
      logger.error(`Error sending badge notifications to user ${userId}:`, error)
    }
  }

  /**
   * Send a level up notification
   * @param userId User ID who leveled up
   * @param newLevel New level
   * @param unlockedFeatures Features unlocked at this level
   */
  static async sendLevelUpNotification(
    userId: string,
    newLevel: string,
    unlockedFeatures: string[]
  ): Promise<void> {
    try {
      // Get user
      const user = await User.findById(userId)

      if (!user) {
        logger.error(`User with ID ${userId} not found for level up notification`)
        return
      }

      // Send email notification
      await EmailService.sendLevelUpEmail(user.email, newLevel, unlockedFeatures)

      logger.info(`Sent level up notification to user ${userId} for level ${newLevel}`)
    } catch (error) {
      logger.error(`Error sending level up notification to user ${userId}:`, error)
    }
  }

  /**
   * Send a rating moderation notification
   * @param userId User ID who submitted the rating
   * @param officialName Name of the official rated
   * @param approved Whether the rating was approved or rejected
   * @param moderatorNote Note from the moderator
   */
  static async sendRatingModerationNotification(
    userId: string,
    officialName: string,
    approved: boolean,
    moderatorNote?: string
  ): Promise<void> {
    try {
      // Get user
      const user = await User.findById(userId)

      if (!user) {
        logger.error(`User with ID ${userId} not found for rating moderation notification`)
        return
      }

      // For now, just log the notification
      // In a real implementation, you would send an email or in-app notification
      logger.info(
        `Rating moderation notification for user ${userId}: ` +
          `Rating for ${officialName} was ${approved ? 'approved' : 'rejected'}. ` +
          `${moderatorNote ? 'Note: ' + moderatorNote : ''}`
      )
    } catch (error) {
      logger.error(`Error sending rating moderation notification to user ${userId}:`, error)
    }
  }

  /**
   * Send a campaign milestone notification
   * @param campaignId Campaign ID that reached a milestone
   * @param milestoneName Name of the milestone
   * @param currentSupport Current support count
   */
  static async sendCampaignMilestoneNotification(
    campaignId: string,
    milestoneName: string,
    currentSupport: number
  ): Promise<void> {
    try {
      // In a real implementation, you would notify the campaign creator
      // and possibly all supporters of the campaign

      // For now, just log the notification
      logger.info(
        `Campaign ${campaignId} reached milestone: ${milestoneName} with ${currentSupport} supporters`
      )
    } catch (error) {
      logger.error(
        `Error sending campaign milestone notification for campaign ${campaignId}:`,
        error
      )
    }
  }

  /**
   * Send a promise status change notification
   * @param promiseId Promise ID that had a status change
   * @param oldStatus Previous status
   * @param newStatus New status
   */
  static async sendPromiseStatusChangeNotification(
    promiseId: string,
    oldStatus: string,
    newStatus: string
  ): Promise<void> {
    try {
      // In a real implementation, you would notify users who submitted evidence
      // or commented on this promise

      // For now, just log the notification
      logger.info(`Promise ${promiseId} status changed from ${oldStatus} to ${newStatus}`)
    } catch (error) {
      logger.error(
        `Error sending promise status change notification for promise ${promiseId}:`,
        error
      )
    }
  }
}
