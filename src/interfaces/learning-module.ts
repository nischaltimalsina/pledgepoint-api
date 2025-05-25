import { Document, Types } from 'mongoose'

/**
 * Interface for a quiz question
 */
export interface IQuizQuestion {
  id: string
  question: string
  options: string[]
  correctAnswer: string
  explanation?: string
}

/**
 * Interface for quiz data
 */
export interface IQuizData {
  title: string
  description: string
  questions: IQuizQuestion[]
  passingScore: number
}

/**
 * Interface for text content
 */
export interface ITextData {
  title: string
  content: string
  references?: string[]
}

/**
 * Interface for video content
 */
export interface IVideoData {
  title: string
  url: string
  duration: number
  transcript?: string
}

/**
 * Interface for infographic content
 */
export interface IInfographicData {
  title: string
  imageUrl: string
  description: string
}

/**
 * Union type for module content data
 */
export type ContentData = ITextData | IVideoData | IQuizData | IInfographicData

/**
 * Interface for a content item in a learning module
 */
export interface IModuleContent {
  type: 'text' | 'video' | 'quiz' | 'infographic'
  data: ContentData
}

/**
 * Interface for LearningModule document
 */
export interface ILearningModule extends Document {
  _id: Types.ObjectId
  title: string
  description: string
  category: string
  order: number
  content: IModuleContent[]
  pointsReward: number
  badgeReward?: string
  requiredModules?: Types.ObjectId[]
  region: string
  createdAt: Date
  updatedAt: Date
}
