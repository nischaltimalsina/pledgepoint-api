import mongoose, { Document } from 'mongoose'

/**
 * Badge criteria types
 */
export type BadgeCriteriaType =
  | 'rating_count'
  | 'review_count'
  | 'evidence_count'
  | 'campaign_count'
  | 'campaign_support_count'
  | 'module_completion'
  | 'category_completion'
  | 'quiz_score'
  | 'discussion_count'
  | 'upvote_count'
  | 'level_reached'
  | 'streak_days'
  | 'specific_action'

/**
 * Interface for badge criteria
 */
export interface IBadgeCriteria {
  type: BadgeCriteriaType
  threshold: number
  specificValue?: string // For specific module IDs, categories, etc.
}

/**
 * Interface for Badge document
 */
export interface IBadge extends Document {
  _id: mongoose.Types.ObjectId
  code: string
  name: string
  description: string
  category: string
  image: string
  criteria: IBadgeCriteria
  pointsReward: number
  unlockMessage: string
  createdAt: Date
  updatedAt: Date
}
