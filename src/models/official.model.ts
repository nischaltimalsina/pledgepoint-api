import { IOfficial } from '@/interfaces/official'
import mongoose, { Schema } from 'mongoose'

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
    constituency: {
      type: String,
      trim: true,
      maxlength: [100, 'Constituency cannot exceed 100 characters'],
      index: true,
    },
    constituencyId: {
      type: Schema.Types.ObjectId,
      ref: 'Constituency',
      index: true,
    },
    assemblyId: {
      type: Schema.Types.ObjectId,
      ref: 'Assembly',
      index: true,
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
        validate: {
          validator: function (this: IOfficial, endDate: Date) {
            return endDate > this.term.start
          },
          message: 'Term end date must be after start date',
        },
      },
    },
    dob: {
      type: Date,
      validate: {
        validator: function (dob: Date) {
          const today = new Date()
          const age = today.getFullYear() - dob.getFullYear()
          return age >= 25 && age <= 100 // Reasonable age limits for officials
        },
        message: 'Official must be between 25 and 100 years old',
      },
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
      phone: {
        type: String,
        validate: {
          validator: (v: string) => {
            return !v || /^[\+]?[0-9\s\-\(\)]{7,15}$/.test(v)
          },
          message: 'Please provide a valid phone number',
        },
      },
      address: {
        type: String,
        maxlength: [300, 'Address cannot exceed 300 characters'],
      },
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
        maxlength: [200, 'Office address cannot exceed 200 characters'],
      },
    },
    verified: {
      type: Boolean,
      default: false,
      index: true,
    },
    bio: {
      type: String,
      maxlength: [1000, 'Bio cannot exceed 1000 characters'],
    },
    photo: String,
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
    active: {
      type: Boolean,
      default: true,
      index: true,
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
officialSchema.index({ name: 1, active: 1 })
officialSchema.index({ position: 1, active: 1 })
officialSchema.index({ district: 1, active: 1 })
officialSchema.index({ constituencyId: 1, active: 1 })
officialSchema.index({ assemblyId: 1, active: 1 })
officialSchema.index({ party: 1, active: 1 })
officialSchema.index({ 'averageRating.overall': -1, active: 1 })
officialSchema.index({ 'term.end': 1, active: 1 })
officialSchema.index({ verified: 1, active: 1 })

// Virtual to get ratings from Rating collection
officialSchema.virtual('ratings', {
  ref: 'Rating',
  localField: '_id',
  foreignField: 'officialId',
  match: { status: 'approved' }, // Only include approved ratings
})

// Virtual for checking if term is current
officialSchema.virtual('isCurrentTerm').get(function () {
  const now = new Date()
  return this.term.start <= now && this.term.end >= now && this.active
})

// Virtual for term status
officialSchema.virtual('termStatus').get(function () {
  const now = new Date()
  if (this.term.end < now) return 'expired'
  if (this.term.start > now) return 'upcoming'
  return 'current'
})

// Virtual for age
officialSchema.virtual('age').get(function () {
  const today = new Date()
  const birthDate = this.dob ? new Date(this.dob) : null
  let age = 0
  if (birthDate) {
    age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
  }

  return age
})

// Method to update average ratings by querying Rating collection
officialSchema.methods.updateAverageRatings = async function (): Promise<void> {
  try {
    const Rating = mongoose.model('Rating')

    // Get all approved ratings for this official
    const ratings = await Rating.find({
      officialId: this._id,
    })

    if (!ratings || ratings.length === 0) {
      this.averageRating = {
        integrity: 0,
        responsiveness: 0,
        effectiveness: 0,
        transparency: 0,
        overall: 0,
      }
      this.totalRatings = 0
      await this.save()
      return
    }

    // Calculate averages
    const count = ratings.length
    const totals = ratings.reduce(
      (acc, rating) => ({
        integrity: acc.integrity + rating.integrity,
        responsiveness: acc.responsiveness + rating.responsiveness,
        effectiveness: acc.effectiveness + rating.effectiveness,
        transparency: acc.transparency + rating.transparency,
        overall: acc.overall + rating.overall,
      }),
      { integrity: 0, responsiveness: 0, effectiveness: 0, transparency: 0, overall: 0 }
    )

    this.averageRating = {
      integrity: parseFloat((totals.integrity / count).toFixed(1)),
      responsiveness: parseFloat((totals.responsiveness / count).toFixed(1)),
      effectiveness: parseFloat((totals.effectiveness / count).toFixed(1)),
      transparency: parseFloat((totals.transparency / count).toFixed(1)),
      overall: parseFloat((totals.overall / count).toFixed(1)),
    }

    this.totalRatings = count
    await this.save()
  } catch (error) {
    console.error(`Error updating average ratings for official ${this._id}:`, error)
  }
}

// Method to get user's rating for this official
officialSchema.methods.getUserRating = async function (userId: string) {
  try {
    const Rating = mongoose.model('Rating')
    return await Rating.findOne({
      officialId: this._id,
      userId: new mongoose.Types.ObjectId(userId),
    })
  } catch (error) {
    console.error(`Error getting user rating for official ${this._id}:`, error)
    return null
  }
}

// Pre-save middleware to auto-populate constituency name
officialSchema.pre('save', async function (next) {
  // Auto-populate constituency name from constituencyId
  if (this.isModified('constituencyId') && this.constituencyId) {
    try {
      const Constituency = mongoose.model('Constituency')
      const constituency = await Constituency.findById(this.constituencyId)
      if (constituency) {
        this.constituency = constituency.name
      }
    } catch (error) {
      // Don't fail save if constituency lookup fails
      console.warn('Failed to populate constituency name:', error)
    }
  }

  next()
})

// Static method to find current officials
officialSchema.statics.findCurrent = function () {
  const now = new Date()
  return this.find({
    'term.start': { $lte: now },
    'term.end': { $gte: now },
    active: true,
  })
}

// Static method to find by constituency
officialSchema.statics.findByConstituency = function (constituencyId: string) {
  return this.find({
    constituencyId: new mongoose.Types.ObjectId(constituencyId),
    active: true,
  }).sort({ 'term.start': -1 })
}

// Static method to find by assembly
officialSchema.statics.findByAssembly = function (assemblyId: string) {
  return this.find({
    assemblyId: new mongoose.Types.ObjectId(assemblyId),
    active: true,
  }).sort({ 'term.start': -1 })
}

// Create and export the model
export const Official = mongoose.model<IOfficial>('Official', officialSchema)
