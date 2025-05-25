import { IConstituency } from '@/interfaces/constituency'
import mongoose, { Schema } from 'mongoose'

// Schema for constituency
const constituencySchema = new Schema<IConstituency>(
  {
    name: {
      type: String,
      required: [true, 'Constituency name is required'],
      trim: true,
      minlength: [2, 'Constituency name must be at least 2 characters'],
      maxlength: [100, 'Constituency name cannot exceed 100 characters'],
      index: true,
    },
    code: {
      type: String,
      required: [true, 'Constituency code is required'],
      trim: true,
      unique: true,
      uppercase: true,
    },
    type: {
      type: String,
      required: [true, 'Constituency type is required'],
      enum: ['federal', 'provincial'],
      index: true,
    },
    assemblyId: {
      type: Schema.Types.ObjectId,
      ref: 'Assembly',
      required: [true, 'Assembly ID is required'],
      index: true,
    },
    districtId: {
      type: Schema.Types.ObjectId,
      ref: 'District',
      required: [true, 'District ID is required'],
      index: true,
    },
    population: {
      type: Number,
      min: [0, 'Population cannot be negative'],
    },
    area: {
      type: Number,
      min: [0, 'Area cannot be negative'],
    },
    boundaries: {
      type: {
        type: String,
        enum: ['Polygon'],
        default: 'Polygon',
      },
      coordinates: {
        type: [[[Number]]],
        validate: {
          validator: function (v: number[][][]) {
            return v.every((polygon) => polygon.length >= 3)
          },
          message: 'Each polygon must have at least 3 coordinates',
        },
      },
    },
    reservedFor: {
      type: String,
      enum: ['general', 'women', 'dalit', 'madhesi', 'muslim', 'other'],
      default: 'general',
      index: true,
    },
    headquarters: {
      type: String,
      trim: true,
      maxlength: [100, 'Headquarters cannot exceed 100 characters'],
    },
    description: {
      type: String,
      maxlength: [500, 'Description cannot exceed 500 characters'],
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
constituencySchema.index({ type: 1, assemblyId: 1 })
constituencySchema.index({ districtId: 1, type: 1 })
constituencySchema.index({ name: 1, type: 1 })

// Virtual for current representative
constituencySchema.virtual('currentRepresentative', {
  ref: 'Official',
  localField: '_id',
  foreignField: 'constituencyId',
  justOne: true,
  match: {
    'term.end': { $gte: new Date() },
    active: true,
  },
})

export const Constituency = mongoose.model<IConstituency>('Constituency', constituencySchema)
