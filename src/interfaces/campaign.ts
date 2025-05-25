import { Document, Types } from 'mongoose'

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
