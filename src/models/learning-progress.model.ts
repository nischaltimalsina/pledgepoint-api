import mongoose, { Document, Schema, Types } from 'mongoose'
import {
  ITextData,
  IVideoData,
  IQuizData,
  IInfographicData,
  IModuleContent,
  IQuizQuestion,
} from './learning-module.model'

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

// Schema for learning progress
const learningProgressSchema = new Schema<ILearningProgress>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    moduleId: {
      type: Schema.Types.ObjectId,
      ref: 'LearningModule',
      required: [true, 'Module ID is required'],
      index: true,
    },
    progress: {
      type: Number,
      required: [true, 'Progress percentage is required'],
      min: [0, 'Progress cannot be negative'],
      max: [100, 'Progress cannot exceed 100%'],
      default: 0,
    },
    completed: {
      type: Boolean,
      default: false,
      index: true,
    },
    quizResults: [
      {
        questionId: {
          type: String,
          required: [true, 'Question ID is required'],
        },
        answerId: {
          type: String,
          required: [true, 'Answer ID is required'],
        },
        correct: {
          type: Boolean,
          required: [true, 'Correctness flag is required'],
        },
      },
    ],
    pointsEarned: {
      type: Number,
      default: 0,
      min: [0, 'Points earned cannot be negative'],
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
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

// Create a compound index for user and module
learningProgressSchema.index({ userId: 1, moduleId: 1 }, { unique: true })

// Add virtual for score percentage
learningProgressSchema.virtual('scorePercentage').get(function () {
  if (!this.quizResults || this.quizResults.length === 0) return 0

  const correctCount = this.quizResults.filter((result) => result.correct).length
  return Math.round((correctCount / this.quizResults.length) * 100)
})

// Add middleware to update completed status
learningProgressSchema.pre('save', function (next) {
  // If progress is 100% and completed is false, set completed to true and set completedAt
  if (this.isModified('progress') && this.progress === 100 && !this.completed) {
    this.completed = true
    this.completedAt = new Date()
  }
  next()
})

// Create and export the model
export const LearningProgress = mongoose.model<ILearningProgress>(
  'LearningProgress',
  learningProgressSchema
)
