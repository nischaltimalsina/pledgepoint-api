import { IOfficial } from '@/interfaces/official'
import mongoose, { Schema } from 'mongoose'
import { ratingSchema } from './rating.model'
import { IRating } from '@/interfaces/rating'
// Schema for official
const officialSchema = new Schema<IOfficial>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    position: {
      type: String,
      required: [true, 'Position is required'],
      trim: true,
      minlength: [2, 'Position must be at least 2 characters'],
      maxlength: [100, 'Position cannot exceed 100 characters'],
    },
    district: {
      type: String,
      required: [true, 'District is required'],
      trim: true,
      minlength: [2, 'District must be at least 2 characters'],
      maxlength: [100, 'District cannot exceed 100 characters'],
    },
    party: {
      type: String,
      required: [true, 'Party is required'],
      trim: true,
      maxlength: [100, 'Party cannot exceed 100 characters'],
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
    dob: {
      type: Date,
      required: [true, 'Date of birth is required'],
    },
    education: {
      degree: {
        type: String,
        trim: true,
        maxlength: [100, 'Degree cannot exceed 100 characters'],
      },
      institution: {
        type: String,
        trim: true,
        maxlength: [100, 'Institution cannot exceed 100 characters'],
      },
      year: {
        type: Number,
        min: [1900, 'Year must be after 1900'],
        max: [new Date().getFullYear(), 'Year cannot be in the future'],
      },
    },
    criminalRecord: [
      {
        type: String,
        description: {
          type: String,
          trim: true,
          maxlength: [500, 'Description cannot exceed 500 characters'],
        },
        date: {
          type: Date,
          required: [true, 'Criminal record date is required'],
        },
        status: {
          type: String,
          enum: ['pending', 'resolved', 'dismissed'],
          default: 'pending',
        },
      },
    ],
    assets: [
      {
        type: String,
        value: {
          type: Number,
          min: [0, 'Value must be a positive number'],
          required: [true, 'Asset value is required'],
        },
        description: {
          type: String,
          trim: true,
          maxlength: [500, 'Description cannot exceed 500 characters'],
        },
      },
    ],
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
      office: {
        type: String,
        trim: true,
        maxlength: [100, 'Office cannot exceed 100 characters'],
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
