import { IRating } from '@/interfaces/rating'
import mongoose, { Schema } from 'mongoose'

export const ratingSchema = new Schema<IRating>(
  {
    officialId: {
      type: Schema.Types.ObjectId,
      ref: 'Official',
      required: [true, 'Official ID is required'],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    integrity: {
      type: Number,
      required: [true, 'Integrity rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },
    responsiveness: {
      type: Number,
      required: [true, 'Responsiveness rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },
    effectiveness: {
      type: Number,
      required: [true, 'Effectiveness rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },
    transparency: {
      type: Number,
      required: [true, 'Transparency rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },
    overall: {
      type: Number,
      required: [true, 'Overall rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },
    comment: {
      type: String,
      required: [true, 'Comment is required'],
      minlength: [10, 'Comment must be at least 10 characters'],
      maxlength: [1000, 'Comment cannot exceed 1000 characters'],
    },
    evidence: {
      type: String,
      required: [true, 'Evidence URL is required'],
      validate: {
        validator: function (v: string) {
          try {
            new URL(v)
            return true
          } catch (error) {
            return false
          }
        },
        message: 'Evidence must be a valid URL',
      },
    },
    upvotes: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    downvotes: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    moderatorNote: {
      type: String,
      maxlength: [500, 'Moderator note cannot exceed 500 characters'],
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

// Create compound index for user and official (one rating per user per official)
ratingSchema.index({ userId: 1, officialId: 1 }, { unique: true })

// Index for efficient queries
ratingSchema.index({ officialId: 1, status: 1 })
ratingSchema.index({ userId: 1, createdAt: -1 })
ratingSchema.index({ status: 1, createdAt: -1 })

// Virtual for vote count
ratingSchema.virtual('voteCount').get(function () {
  return (this.upvotes?.length || 0) - (this.downvotes?.length || 0)
})

// Pre-save hook to calculate overall rating
ratingSchema.pre('save', function (next) {
  if (
    this.isModified('integrity') ||
    this.isModified('responsiveness') ||
    this.isModified('effectiveness') ||
    this.isModified('transparency')
  ) {
    // Calculate overall rating as average of the four categories
    const sum = this.integrity + this.responsiveness + this.effectiveness + this.transparency
    this.overall = parseFloat((sum / 4).toFixed(1))
  }
  next()
})

// Post-save middleware to update official's average ratings
ratingSchema.post('save', async function () {
  try {
    const Official = mongoose.model('Official')
    const official = await Official.findById(this.officialId)
    if (official) {
      await official.updateAverageRatings()
    }
  } catch (error) {
    console.error('Error updating official ratings after rating save:', error)
  }
})

// Post-remove middleware to update official's average ratings
ratingSchema.post('findOneAndDelete', async function () {
  try {
    if (this.getQuery().officialId) {
      const Official = mongoose.model('Official')
      const official = await Official.findById(this.getQuery().officialId)
      if (official) {
        await official.updateAverageRatings()
      }
    }
  } catch (error) {
    console.error('Error updating official ratings after rating delete:', error)
  }
})

// Create and export the model
export const Rating = mongoose.model<IRating>('Rating', ratingSchema)
