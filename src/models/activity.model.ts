import { IActivity } from '@/interfaces/activity'
import mongoose, { Schema } from 'mongoose'

// Schema for activity
const activitySchema = new Schema<IActivity>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    type: {
      type: String,
      required: [true, 'Activity type is required'],
      enum: [
        'rating_created',
        'evidence_submitted',
        'evidence_verified',
        'campaign_created',
        'campaign_supported',
        'campaign_completed',
        'discussion_posted',
        'comment_posted',
        'module_started',
        'module_completed',
        'quiz_completed',
        'level_up',
        'badge_earned',
        'upvote_received',
        'downvote_received',
        'profile_updated',
        'login',
      ],
      index: true,
    },
    details: {
      type: Schema.Types.Mixed,
      default: {},
    },
    relatedId: {
      type: Schema.Types.ObjectId,
      index: true,
    },
    relatedType: {
      type: String,
      enum: [
        'Official',
        'Promise',
        'Campaign',
        'LearningModule',
        'User',
        'Discussion',
        'Comment',
        'Rating',
      ],
      index: true,
    },
    pointsEarned: {
      pointsAwarded: {
        type: Number,
        min: [0, 'Points awarded cannot be negative'],
      },
      streakInfo: {
        type: {
          type: String,
          enum: ['civic', 'learning'],
        },
        currentStreak: {
          type: Number,
          default: 0,
        },
        longestStreak: {
          type: Number,
          default: 0,
        },
        isNewRecord: {
          type: Boolean,
          default: false,
        },
        multiplier: {
          type: Number,
          default: 1,
        },
      },
    },
    badgesEarned: {
      type: [String],
      default: [],
    },
    ip: String,
    userAgent: String,
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: { updatedAt: false }, // Only createdAt, no updatedAt
    toJSON: {
      transform: (_, ret) => {
        delete ret.__v
        return ret
      },
    },
  }
)

// Compound indexes for efficient queries
activitySchema.index({ userId: 1, type: 1 })
activitySchema.index({ userId: 1, createdAt: -1 })
activitySchema.index({ type: 1, createdAt: -1 })
activitySchema.index({ relatedId: 1, relatedType: 1 })

// Create and export the model
export const Activity = mongoose.model<IActivity>('Activity', activitySchema)
