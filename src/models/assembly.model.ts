import { IAssembly, IAssemblySession } from '@/interfaces/assembly'
import mongoose, { Schema } from 'mongoose'

// Schema for assembly session
const assemblySessionSchema = new Schema<IAssemblySession>({
  number: {
    type: Number,
    required: [true, 'Session number is required'],
    min: [1, 'Session number must be at least 1'],
  },
  startDate: {
    type: Date,
    required: [true, 'Session start date is required'],
  },
  endDate: {
    type: Date,
    validate: {
      validator: function (this: IAssemblySession, endDate: Date) {
        return !endDate || endDate > this.startDate
      },
      message: 'End date must be after start date',
    },
  },
  status: {
    type: String,
    enum: ['upcoming', 'ongoing', 'completed', 'dissolved'],
    default: 'upcoming',
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters'],
  },
})

// Schema for assembly
const assemblySchema = new Schema<IAssembly>(
  {
    name: {
      type: String,
      required: [true, 'Assembly name is required'],
      trim: true,
      minlength: [2, 'Assembly name must be at least 2 characters'],
      maxlength: [150, 'Assembly name cannot exceed 150 characters'],
      index: true,
    },
    type: {
      type: String,
      required: [true, 'Assembly type is required'],
      enum: ['federal', 'provincial'],
      index: true,
    },
    level: {
      type: String,
      required: [true, 'Assembly level is required'],
      enum: ['house_of_representatives', 'national_assembly', 'provincial_assembly'],
      index: true,
    },
    province: {
      type: String,
      trim: true,
      maxlength: [100, 'Province name cannot exceed 100 characters'],
      index: true,
      validate: {
        validator: function (this: IAssembly, province: string) {
          // Province is required for provincial assemblies
          return this.type !== 'provincial' || !!province
        },
        message: 'Province is required for provincial assemblies',
      },
    },
    totalSeats: {
      type: Number,
      required: [true, 'Total seats is required'],
      min: [1, 'Total seats must be at least 1'],
    },
    electedSeats: {
      type: Number,
      required: [true, 'Elected seats is required'],
      min: [1, 'Elected seats must be at least 1'],
    },
    nominatedSeats: {
      type: Number,
      min: [0, 'Nominated seats cannot be negative'],
      default: 0,
    },
    reservedSeats: {
      women: {
        type: Number,
        min: [0, 'Reserved seats for women cannot be negative'],
        default: 0,
      },
      dalit: {
        type: Number,
        min: [0, 'Reserved seats for dalit cannot be negative'],
        default: 0,
      },
      disadvantaged: {
        type: Number,
        min: [0, 'Reserved seats for disadvantaged cannot be negative'],
        default: 0,
      },
    },
    currentSession: {
      type: assemblySessionSchema,
      required: [true, 'Current session is required'],
    },
    previousSessions: [assemblySessionSchema],
    headquarters: {
      type: String,
      required: [true, 'Headquarters is required'],
      trim: true,
      maxlength: [200, 'Headquarters cannot exceed 200 characters'],
    },
    establishedDate: {
      type: Date,
      required: [true, 'Established date is required'],
    },
    description: {
      type: String,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    website: {
      type: String,
      validate: {
        validator: function (v: string) {
          try {
            return !v || !!new URL(v)
          } catch (error) {
            return false
          }
        },
        message: 'Website must be a valid URL',
      },
    },
    contactInfo: {
      phone: String,
      email: {
        type: String,
        trim: true,
        lowercase: true,
        validate: {
          validator: function (v: string) {
            return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
          },
          message: 'Please provide a valid email address',
        },
      },
      address: {
        type: String,
        maxlength: [300, 'Address cannot exceed 300 characters'],
      },
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

// Compound indexes
assemblySchema.index({ type: 1, level: 1 })
assemblySchema.index({ province: 1, type: 1 })
assemblySchema.index({ 'currentSession.status': 1 })

// Validation for seat consistency
assemblySchema.pre('save', function (next) {
  const reservedTotal =
    (this.reservedSeats?.women || 0) +
    (this.reservedSeats?.dalit || 0) +
    (this.reservedSeats?.disadvantaged || 0)

  if (this.electedSeats + (this.nominatedSeats || 0) + reservedTotal !== this.totalSeats) {
    next(new Error('Elected seats + nominated seats + reserved seats must equal total seats'))
  }

  next()
})

export const Assembly = mongoose.model<IAssembly>('Assembly', assemblySchema)
