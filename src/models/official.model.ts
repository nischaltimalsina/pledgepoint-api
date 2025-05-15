import mongoose, { Document, Schema, Types } from 'mongoose'

/**
 * Interface for a rating of an official
 */
export interface IRating {
  userId: Types.ObjectId
  integrity: number
  responsiveness: number
  effectiveness: number
  transparency: number
  overall: number
  comment: string
  evidence: string
  upvotes: Types.ObjectId[]
  downvotes: Types.ObjectId[]
  createdAt: Date
  updatedAt: Date
}

/**
 * Interface for Official document
 */
export interface IOfficial extends Document {
  name: string
  position: string
  district: string
  party: string
  term: {
    start: Date
    end: Date
  }
  contactInfo: {
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
  ratings: IRating[]
  averageRating: {
    integrity: number
    responsiveness: number
    effectiveness: number
    transparency: number
    overall: number
  }
  totalRatings: number
  createdAt: Date
  updatedAt: Date

  // Methods
  calculateAverageRatings(): void
}

// Schema for rating
const ratingSchema = new Schema<IRating>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
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
        validator: (v: string) => {
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
    upvotes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    downvotes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
)

// Schema for official
const officialSchema = new Schema<IOfficial>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
      index: true,
    },
    position: {
      type: String,
      required: [true, 'Position is required'],
      trim: true,
      minlength: [2, 'Position must be at least 2 characters'],
      maxlength: [100, 'Position cannot exceed 100 characters'],
      index: true,
    },
    district: {
      type: String,
      required: [true, 'District is required'],
      trim: true,
      minlength: [2, 'District must be at least 2 characters'],
      maxlength: [100, 'District cannot exceed 100 characters'],
      index: true,
    },
    party: {
      type: String,
      required: [true, 'Party is required'],
      trim: true,
      maxlength: [100, 'Party cannot exceed 100 characters'],
      index: true,
    },
    term: {
      start: {
        type: Date,
        required: [true, 'Term start date is required'],
      },
      end: {
        type: Date,
        required: [true, 'Term end date is required'],
      },
    },
    contactInfo: {
      email: {
        type: String,
        trim: true,
        lowercase: true,
        validate: {
          validator: (v: string) => {
            return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
          },
          message: 'Please provide a valid email address',
        },
      },
      phone: String,
      address: String,
      website: {
        type: String,
        validate: {
          validator: (v: string) => {
            try {
              return !v || !!new URL(v)
            } catch (error) {
              return false
            }
          },
          message: 'Website must be a valid URL',
        },
      },
      socialMedia: {
        facebook: {
          type: String,
          validate: {
            validator: (v: string) => {
              try {
                return !v || !!new URL(v)
              } catch (error) {
                return false
              }
            },
            message: 'Facebook must be a valid URL',
          },
        },
        twitter: {
          type: String,
          validate: {
            validator: (v: string) => {
              try {
                return !v || !!new URL(v)
              } catch (error) {
                return false
              }
            },
            message: 'Twitter must be a valid URL',
          },
        },
        instagram: {
          type: String,
          validate: {
            validator: (v: string) => {
              try {
                return !v || !!new URL(v)
              } catch (error) {
                return false
              }
            },
            message: 'Instagram must be a valid URL',
          },
        },
      },
    },
    bio: {
      type: String,
      maxlength: [1000, 'Bio cannot exceed 1000 characters'],
    },
    photo: String,
    ratings: [ratingSchema],
    averageRating: {
      integrity: {
        type: Number,
        default: 0,
      },
      responsiveness: {
        type: Number,
        default: 0,
      },
      effectiveness: {
        type: Number,
        default: 0,
      },
      transparency: {
        type: Number,
        default: 0,
      },
      overall: {
        type: Number,
        default: 0,
        index: true,
      },
    },
    totalRatings: {
      type: Number,
      default: 0,
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
officialSchema.index({ name: 1 })
officialSchema.index({ position: 1 })
officialSchema.index({ district: 1 })
officialSchema.index({ party: 1 })
officialSchema.index({ 'averageRating.overall': -1 })

// Method to calculate average ratings
officialSchema.methods.calculateAverageRatings = function (): void {
  if (!this.ratings || this.ratings.length === 0) {
    this.averageRating = {
      integrity: 0,
      responsiveness: 0,
      effectiveness: 0,
      transparency: 0,
      overall: 0,
    }
    this.totalRatings = 0
    return
  }

  // Calculate average for each category
  const totalIntegrity = this.ratings.reduce(
    (sum: number, rating: IRating) => sum + rating.integrity,
    0
  )
  const totalResponsiveness = this.ratings.reduce(
    (sum: number, rating: IRating) => sum + rating.responsiveness,
    0
  )
  const totalEffectiveness = this.ratings.reduce(
    (sum: number, rating: IRating) => sum + rating.effectiveness,
    0
  )
  const totalTransparency = this.ratings.reduce(
    (sum: number, rating: IRating) => sum + rating.transparency,
    0
  )
  const totalOverall = this.ratings.reduce(
    (sum: number, rating: IRating) => sum + rating.overall,
    0
  )

  const count = this.ratings.length

  this.averageRating = {
    integrity: parseFloat((totalIntegrity / count).toFixed(1)),
    responsiveness: parseFloat((totalResponsiveness / count).toFixed(1)),
    effectiveness: parseFloat((totalEffectiveness / count).toFixed(1)),
    transparency: parseFloat((totalTransparency / count).toFixed(1)),
    overall: parseFloat((totalOverall / count).toFixed(1)),
  }

  this.totalRatings = count
}

// Middleware to update average ratings before saving
officialSchema.pre('save', function (next) {
  if (this.isModified('ratings')) {
    this.calculateAverageRatings()
  }
  next()
})

// Create and export the model
export const Official = mongoose.model<IOfficial>('Official', officialSchema)
