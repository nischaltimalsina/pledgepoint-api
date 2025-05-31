import { Badge } from './badge.model'
import mongoose, { Schema } from 'mongoose'
import { IForum, IForumPost, IForumReply } from '../interfaces/forum'
import { IBadge } from '@/interfaces/badge'
import { IUser } from '@/interfaces/user'

const forumReplySchema = new Schema<IForumReply>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
  },
  content: {
    type: String,
    required: [true, 'Reply content is required'],
    minlength: [5, 'Reply must be at least 5 characters'],
    maxlength: [2000, 'Reply cannot exceed 2000 characters'],
  },
  upvotes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  downvotes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

const forumPostSchema = new Schema<IForumPost>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    content: {
      type: String,
      required: [true, 'Post content is required'],
      minlength: [10, 'Post must be at least 10 characters'],
      maxlength: [5000, 'Post cannot exceed 5000 characters'],
    },
    attachments: [String],
    upvotes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    downvotes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    replies: [forumReplySchema],
    pinned: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
)

const forumSchema = new Schema<IForum>(
  {
    title: {
      type: String,
      required: [true, 'Forum title is required'],
      trim: true,
      minlength: [5, 'Title must be at least 5 characters'],
      maxlength: [100, 'Title cannot exceed 100 characters'],
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Forum description is required'],
      minlength: [20, 'Description must be at least 20 characters'],
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    category: {
      type: String,
      enum: ['general', 'expert'],
      required: [true, 'Forum category is required'],
      index: true,
    },
    tags: {
      type: [String],
      validate: {
        validator: function (tags: string[]) {
          return tags.length <= 10
        },
        message: 'Cannot have more than 10 tags',
      },
      index: true,
    },
    creatorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator ID is required'],
      index: true,
    },
    moderators: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    subscribers: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    posts: [forumPostSchema],
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    memberCount: {
      type: Number,
      default: 0,
    },
    postCount: {
      type: Number,
      default: 0,
    },
    lastActivity: {
      type: Date,
      default: Date.now,
      index: true,
    },
    rules: [String],
    expertRequirements: {
      minimumLevel: {
        type: String,
        enum: ['advocate', 'leader'],
        default: 'advocate',
      },
      requiredBadges: [String],
      approvalRequired: {
        type: Boolean,
        default: false,
      },
    },
    socialIssues: {
      relatedIssues: [String],
      impactAreas: [String],
      urgencyLevel: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium',
      },
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
forumSchema.index({ category: 1, isActive: 1 })
forumSchema.index({ tags: 1, isActive: 1 })
forumSchema.index({ creatorId: 1, category: 1 })
forumSchema.index({ 'socialIssues.urgencyLevel': 1 })
forumSchema.index({ lastActivity: -1, isActive: 1 })

// Virtual for active posts
forumSchema.virtual('activePosts').get(function () {
  return this.posts.length
})

// Pre-save middleware to update counts
forumSchema.pre('save', function (next) {
  if (this.isModified('posts')) {
    this.postCount = this.posts.length
  }
  if (this.isModified('subscribers')) {
    this.memberCount = this.subscribers.length
  }
  next()
})

// Method to check if user can access expert forum
forumSchema.methods.canUserAccess = function (user: any): boolean {
  if (this.category === 'general') return true

  if (this.category === 'expert' && this.expertRequirements) {
    const { minimumLevel, requiredBadges, approvalRequired } = this.expertRequirements

    // Check minimum level
    const levelHierarchy = { citizen: 0, advocate: 1, leader: 2 }
    const userLevel = levelHierarchy[user.level as keyof typeof levelHierarchy] || 0
    const requiredLevel = levelHierarchy[minimumLevel as keyof typeof levelHierarchy] || 1

    if (userLevel < requiredLevel) return false

    // Check required badges
    if (requiredBadges && requiredBadges.length > 0) {
      const hasAllBadges = requiredBadges.every((badge: IBadge) => user.badges?.includes(badge))
      if (!hasAllBadges) return false
    }

    // Check if user is moderator or creator
    if (
      this.moderators.some((mod: IUser) => mod.toString() === user._id.toString()) ||
      this.creatorId.toString() === user._id.toString()
    ) {
      return true
    }

    // Check approval requirement
    if (approvalRequired) {
      return this.subscribers.some((sub: IUser) => sub.toString() === user._id.toString())
    }
  }

  return true
}

// Method to add post
forumSchema.methods.addPost = async function (
  userId: string,
  content: string,
  attachments?: string[]
): Promise<void> {
  this.posts.push({
    _id: new mongoose.Types.ObjectId(),
    userId: new mongoose.Types.ObjectId(userId),
    content,
    attachments: attachments || [],
    upvotes: [],
    downvotes: [],
    replies: [],
    pinned: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  this.lastActivity = new Date()
  await this.save()
}

export const Forum = mongoose.model<IForum>('Forum', forumSchema)
