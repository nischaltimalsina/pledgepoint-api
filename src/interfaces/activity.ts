import { Document, Types } from 'mongoose'

/**
 * Activity types
 */
export type ActivityType =
  | 'rating_created'
  | 'evidence_submitted'
  | 'evidence_verified'
  | 'campaign_created'
  | 'campaign_supported'
  | 'campaign_completed'
  | 'discussion_posted'
  | 'comment_posted'
  | 'module_started'
  | 'module_completed'
  | 'quiz_completed'
  | 'level_up'
  | 'badge_earned'
  | 'upvote_received'
  | 'downvote_received'
  | 'profile_updated'
  | 'login'

/**
 * Interface for Activity document
 */
export interface IActivity extends Document {
  userId: Types.ObjectId
  type: ActivityType
  details: any
  relatedId?: Types.ObjectId
  relatedType?: string
  pointsEarned: {
    pointsAwarded: number
    streakInfo?: {
      type: 'civic' | 'learning'
      currentStreak: number
      longestStreak: number
      isNewRecord: boolean
      multiplier: number
    }
  }

  badgesEarned: string[]
  ip?: string
  userAgent?: string
  createdAt: Date
}
