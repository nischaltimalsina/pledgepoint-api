import mongoose, { Document, Schema, Types } from 'mongoose'

/**
 * Interface for promise evidence
 */
export interface IPromiseEvidence {
  userId: Types.ObjectId
  description: string
  source: string
  date: Date
  status: 'supporting' | 'opposing'
  upvotes: Types.ObjectId[]
  downvotes: Types.ObjectId[]
}

/**
 * Interface for promise comment
 */
export interface IPromiseComment {
  userId: Types.ObjectId
  text: string
  createdAt: Date
}

/**
 * Interface for promise document
 */
export interface IPromise extends Document {
  officialId: Types.ObjectId
  title: string
  description: string
  category: string
  datePromised: Date
  source: string
  status: 'kept' | 'broken' | 'in-progress' | 'unverified'
  evidence: IPromiseEvidence[]
  comments: IPromiseComment[]
  createdAt: Date
  updatedAt: Date

  // Methods
  updateStatus(): void
}

// Schema for promise evidence
const promiseEvidenceSchema = new Schema<IPromiseEvidence>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    minlength: [10, 'Description must be at least 10 characters'],
    maxlength: [1000, 'Description cannot exceed 1000 characters'],
  },
  source: {
    type: String,
    required: [true, 'Source URL is required'],
    validate: {
      validator: (v: string) => {
        try {
          new URL(v)
          return true
        } catch (error) {
          return false
        }
      },
      message: 'Source must be a valid URL',
    },
  },
  date: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['supporting', 'opposing'],
    required: [true, 'Evidence status is required'],
  },
  upvotes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  downvotes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
})

// Schema for promise comment
const promiseCommentSchema = new Schema<IPromiseComment>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
  },
  text: {
    type: String,
    required: [true, 'Comment text is required'],
    minlength: [5, 'Comment must be at least 5 characters'],
    maxlength: [500, 'Comment cannot exceed 500 characters'],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

// Schema for promise
const promiseSchema = new Schema<IPromise>(
  {
    officialId: {
      type: Schema.Types.ObjectId,
      ref: 'Official',
      required: [true, 'Official ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [5, 'Title must be at least 5 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      minlength: [10, 'Description must be at least 10 characters'],
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      index: true,
    },
    datePromised: {
      type: Date,
      required: [true, 'Date promised is required'],
      index: true,
    },
    source: {
      type: String,
      required: [true, 'Source URL is required'],
      validate: {
        validator: (v: string) => {
          try {
            new URL(v)
            return true
          } catch (error) {
            return false
          }
        },
        message: 'Source must be a valid URL',
      },
    },
    status: {
      type: String,
      enum: ['kept', 'broken', 'in-progress', 'unverified'],
      default: 'unverified',
      index: true,
    },
    evidence: [promiseEvidenceSchema],
    comments: [promiseCommentSchema],
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

// Method to update promise status based on evidence
promiseSchema.methods.updateStatus = function (): void {
  if (!this.evidence || this.evidence.length === 0) {
    this.status = 'unverified'
    return
  }

  // Count supporting and opposing evidence
  const supportingCount = this.evidence.filter(
    (e: IPromiseEvidence) => e.status === 'supporting'
  ).length
  const opposingCount = this.evidence.filter(
    (e: IPromiseEvidence) => e.status === 'opposing'
  ).length

  // Simple threshold-based logic (can be made more sophisticated)
  if (supportingCount > opposingCount && supportingCount >= 3) {
    this.status = 'kept'
  } else if (opposingCount > supportingCount && opposingCount >= 3) {
    this.status = 'broken'
  } else if (supportingCount > 0 || opposingCount > 0) {
    this.status = 'in-progress'
  } else {
    this.status = 'unverified'
  }
}

// Middleware to update status before saving
promiseSchema.pre('save', function (next) {
  if (this.isModified('evidence')) {
    this.updateStatus()
  }
  next()
})

// Create and export the model
export const Promise = mongoose.model<IPromise>('Promise', promiseSchema)
