import { Document, Types } from 'mongoose'

/**
 * Interface for Rating document
 */
export interface IRating extends Document {
  officialId: Types.ObjectId
  userId: Types.ObjectId
  integrity: number
  responsiveness: number
  effectiveness: number
  transparency: number
  overall: number
  comment: string
  evidence: string
  upvotes: Types.ObjectId[]
  downvotes: Types.ObjectId[]
  status?: 'pending' | 'approved' | 'rejected'
  moderatorNote?: string
  createdAt: Date
  updatedAt: Date
}
