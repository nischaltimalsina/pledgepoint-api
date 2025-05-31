import { Types, Document } from 'mongoose'

export interface IForumPost {
  _id: Types.ObjectId
  userId: Types.ObjectId
  content: string
  attachments?: string[]
  upvotes: Types.ObjectId[]
  downvotes: Types.ObjectId[]
  replies: IForumReply[]
  pinned: boolean
  createdAt: Date
  updatedAt: Date
}

export interface IForumReply {
  _id: Types.ObjectId
  userId: Types.ObjectId
  content: string
  upvotes: Types.ObjectId[]
  downvotes: Types.ObjectId[]
  createdAt: Date
}

export interface IForum extends Document {
  _id: Types.ObjectId
  title: string
  description: string
  category: 'general' | 'expert'
  tags: string[]
  creatorId: Types.ObjectId
  moderators: Types.ObjectId[] // For expert forums
  subscribers: Types.ObjectId[]
  posts: IForumPost[]
  isActive: boolean
  memberCount: number
  postCount: number
  lastActivity: Date
  rules?: string[]
  expertRequirements?: {
    minimumLevel: 'advocate' | 'leader'
    requiredBadges?: string[]
    approvalRequired: boolean
  }
  socialIssues?: {
    relatedIssues: string[]
    impactAreas: string[]
    urgencyLevel: 'low' | 'medium' | 'high' | 'critical'
  }
  createdAt: Date
  updatedAt: Date

  addPost(userId: string, content: string, attachments?: string[]): Promise<void>
  canUserAccess: (user: any) => boolean
}
