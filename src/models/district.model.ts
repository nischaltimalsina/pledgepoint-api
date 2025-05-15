import mongoose, { Document, Schema } from 'mongoose'

/**
 * Interface for District document
 */
export interface IDistrict extends Document {
  name: string
  code: string
  type: 'federal' | 'provincial' | 'municipal' | 'other'
  region: string
  country: string
  population?: number
  boundaries?: {
    type: string
    coordinates: number[][][]
  }
  parentDistrict?: mongoose.Types.ObjectId
  active: boolean
  createdAt: Date
  updatedAt: Date
}

// Schema for district
const districtSchema = new Schema<IDistrict>(
  {
    name: {
      type: String,
      required: [true, 'District name is required'],
      trim: true,
      minlength: [2, 'District name must be at least 2 characters'],
      maxlength: [100, 'District name cannot exceed 100 characters'],
      index: true,
    },
    code: {
      type: String,
      required: [true, 'District code is required'],
      trim: true,
      unique: true,
    },
    type: {
      type: String,
      required: [true, 'District type is required'],
      enum: ['federal', 'provincial', 'municipal', 'other'],
      index: true,
    },
    region: {
      type: String,
      required: [true, 'Region is required'],
      trim: true,
      index: true,
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      trim: true,
      default: 'Nepal', // Default country setting
      index: true,
    },
    population: {
      type: Number,
      min: [0, 'Population cannot be negative'],
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
            // Basic validation - each polygon should have at least 3 coordinates
            return v.every((polygon) => polygon.length >= 3)
          },
          message: 'Each polygon must have at least 3 coordinates',
        },
      },
    },
    parentDistrict: {
      type: Schema.Types.ObjectId,
      ref: 'District',
      index: true,
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
districtSchema.index({ name: 1, country: 1 })
districtSchema.index({ type: 1, region: 1 })

// Add 2dsphere index for geospatial queries if needed
// districtSchema.index({ boundaries: '2dsphere' });

// Virtual for child districts
districtSchema.virtual('childDistricts', {
  ref: 'District',
  localField: '_id',
  foreignField: 'parentDistrict',
})

// Create and export the model
export const District = mongoose.model<IDistrict>('District', districtSchema)
