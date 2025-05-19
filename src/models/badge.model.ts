import mongoose, { Document, Schema } from 'mongoose'

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

// Schema for badge
const badgeSchema = new Schema<IBadge>(
  {
    code: {
      type: String,
      required: [true, 'Badge code is required'],
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Badge name is required'],
      trim: true,
      minlength: [2, 'Badge name must be at least 2 characters'],
      maxlength: [50, 'Badge name cannot exceed 50 characters'],
    },
    description: {
      type: String,
      required: [true, 'Badge description is required'],
      minlength: [10, 'Badge description must be at least 10 characters'],
      maxlength: [500, 'Badge description cannot exceed 500 characters'],
    },
    category: {
      type: String,
      required: [true, 'Badge category is required'],
    },
    image: {
      type: String,
      required: [true, 'Badge image URL is required'],
    },
    criteria: {
      type: {
        type: String,
        required: [true, 'Criteria type is required'],
        enum: [
          'rating_count',
          'review_count',
          'evidence_count',
          'campaign_count',
          'campaign_support_count',
          'module_completion',
          'category_completion',
          'quiz_score',
          'discussion_count',
          'upvote_count',
          'level_reached',
          'streak_days',
          'specific_action',
        ],
      },
      threshold: {
        type: Number,
        required: [true, 'Criteria threshold is required'],
        min: [1, 'Threshold must be at least 1'],
      },
      specificValue: {
        type: String,
      },
    },
    pointsReward: {
      type: Number,
      required: [true, 'Points reward is required'],
      min: [0, 'Points reward cannot be negative'],
      default: 0,
    },
    unlockMessage: {
      type: String,
      required: [true, 'Unlock message is required'],
      minlength: [10, 'Unlock message must be at least 10 characters'],
      maxlength: [200, 'Unlock message cannot exceed 200 characters'],
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        delete ret.__v
        return ret
      },
    },
  }
)

// Indexes for efficient queries
badgeSchema.index({ category: 1 })
badgeSchema.index({ 'criteria.type': 1 })

// Create and export the model
export const Badge = mongoose.model<IBadge>('Badge', badgeSchema)
