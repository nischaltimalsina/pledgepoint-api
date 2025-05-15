import mongoose, { Document, Schema, Types } from 'mongoose'

/**
 * Interface for campaign update
 */
export interface ICampaignUpdate {
  userId: Types.ObjectId
  content: string
  createdAt: Date
}

/**
 * Interface for campaign discussion reply
 */
export interface IDiscussionReply {
  userId: Types.ObjectId
  content: string
  createdAt: Date
  upvotes: Types.ObjectId[]
  downvotes: Types.ObjectId[]
}

/**
 * Interface for campaign discussion
 */
export interface ICampaignDiscussion {
  _id: Types.ObjectId
  userId: Types.ObjectId
  content: string
  createdAt: Date
  upvotes: Types.ObjectId[]
  downvotes: Types.ObjectId[]
  replies: IDiscussionReply[]
}

/**
 * Interface for campaign document
 */
export interface ICampaign extends Document {
  title: string
  description: string
  category: string
  district: string
  goal: number
  currentSupport: number
  creatorId: Types.ObjectId
  supporters: Types.ObjectId[]
  status: 'draft' | 'active' | 'completed' | 'archived'
  image?: string
  updates: ICampaignUpdate[]
  discussions: ICampaignDiscussion[]
  createdAt: Date
  updatedAt: Date

  // Methods
  calculateProgress(): number
}

// Schema for campaign update
const campaignUpdateSchema = new Schema<ICampaignUpdate>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
  },
  content: {
    type: String,
    required: [true, 'Update content is required'],
    minlength: [10, 'Update must be at least 10 characters'],
    maxlength: [1000, 'Update cannot exceed 1000 characters'],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

// Schema for discussion reply
const discussionReplySchema = new Schema<IDiscussionReply>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
  },
  content: {
    type: String,
    required: [true, 'Reply content is required'],
    minlength: [5, 'Reply must be at least 5 characters'],
    maxlength: [500, 'Reply cannot exceed 500 characters'],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  upvotes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  downvotes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
})

// Schema for campaign discussion
const campaignDiscussionSchema = new Schema<ICampaignDiscussion>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
  },
  content: {
    type: String,
    required: [true, 'Discussion content is required'],
    minlength: [10, 'Discussion must be at least 10 characters'],
    maxlength: [1000, 'Discussion cannot exceed 1000 characters'],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  upvotes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  downvotes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  replies: [discussionReplySchema],
})

// Schema for campaign
const campaignSchema = new Schema<ICampaign>(
  {
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
    },
    district: {
      type: String,
      required: [true, 'District is required'],
    },
    goal: {
      type: Number,
      required: [true, 'Goal is required'],
      min: [10, 'Goal must be at least 10 supporters'],
    },
    currentSupport: {
      type: Number,
      default: 0,
      min: [0, 'Current support cannot be negative'],
    },
    creatorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator ID is required'],
    },
    supporters: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    status: {
      type: String,
      enum: ['draft', 'active', 'completed', 'archived'],
      default: 'draft',
    },
    image: String,
    updates: [campaignUpdateSchema],
    discussions: [campaignDiscussionSchema],
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
campaignSchema.index({ creatorId: 1 })
campaignSchema.index({ category: 1 })
campaignSchema.index({ district: 1 })
campaignSchema.index({ status: 1 })
campaignSchema.index({ currentSupport: -1 })

// Virtual for progress percentage
campaignSchema.virtual('progressPercentage').get(function () {
  return this.calculateProgress()
})

// Method to calculate progress as percentage
campaignSchema.methods.calculateProgress = function (): number {
  if (this.goal === 0) return 0
  const percentage = (this.currentSupport / this.goal) * 100
  return Math.min(100, Math.round(percentage))
}

// Middleware to update status based on support
campaignSchema.pre('save', function (next) {
  if (this.isModified('currentSupport') || this.isModified('goal')) {
    // Update status to 'completed' if goal is reached and campaign is active
    if (this.status === 'active' && this.currentSupport >= this.goal) {
      this.status = 'completed'
    }
  }
  next()
})

// Create and export the model
export const Campaign = mongoose.model<ICampaign>('Campaign', campaignSchema)
