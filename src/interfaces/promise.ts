import { Document, Types } from 'mongoose'

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
