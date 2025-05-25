import { Document, Types } from 'mongoose'

/**
 * Interface for quiz result
 */
export interface IQuizResult {
  questionId: string
  answerId: string
  correct: boolean
}

/**
 * Interface for LearningProgress document
 */
export interface ILearningProgress extends Document {
  userId: Types.ObjectId
  moduleId: Types.ObjectId
  progress: number
  completed: boolean
  quizResults: IQuizResult[]
  pointsEarned: number
  startedAt: Date
  completedAt?: Date
}
