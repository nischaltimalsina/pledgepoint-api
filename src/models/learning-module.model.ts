import { ILearningModule, IModuleContent, IQuizData } from '@/interfaces/learning-module'
import mongoose, { Document, Schema, Types } from 'mongoose'

// Create schema for learning module
const learningModuleSchema = new Schema<ILearningModule>(
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
    order: {
      type: Number,
      required: [true, 'Order is required'],
      min: [0, 'Order must be a positive number'],
    },
    content: {
      type: [
        {
          type: {
            type: String,
            enum: ['text', 'video', 'quiz', 'infographic'],
            required: [true, 'Content type is required'],
          },
          data: {
            type: Schema.Types.Mixed,
            required: [true, 'Content data is required'],
          },
        },
      ],
      required: [true, 'Content is required'],
      validate: {
        validator: function (content: IModuleContent[]) {
          return content.length > 0
        },
        message: 'At least one content item is required',
      },
    },
    pointsReward: {
      type: Number,
      required: [true, 'Points reward is required'],
      min: [0, 'Points reward must be a positive number'],
      default: 20,
    },
    badgeReward: {
      type: String,
    },
    requiredModules: [
      {
        type: Schema.Types.ObjectId,
        ref: 'LearningModule',
      },
    ],
    region: {
      type: String,
      required: [true, 'Region is required'],
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

// Validate quiz data
learningModuleSchema.path('content').validate(function (content: IModuleContent[]) {
  for (const item of content) {
    if (item.type === 'quiz') {
      const quizData = item.data as IQuizData
      if (
        !quizData.questions ||
        !Array.isArray(quizData.questions) ||
        quizData.questions.length === 0
      ) {
        throw new Error('Quiz must have at least one question')
      }

      for (const question of quizData.questions) {
        if (!question.question || question.question.trim() === '') {
          throw new Error('Question text is required')
        }
        if (!question.options || !Array.isArray(question.options) || question.options.length < 2) {
          throw new Error('Question must have at least two options')
        }
        if (!question.correctAnswer || !question.options.includes(question.correctAnswer)) {
          throw new Error('Correct answer must be one of the options')
        }
      }
    }
  }
  return true
})

// Indexes for efficient queries
learningModuleSchema.index({ category: 1 })
learningModuleSchema.index({ region: 1 })
learningModuleSchema.index({ order: 1 })
learningModuleSchema.index({ badgeReward: 1 })

// Create and export the model
export const LearningModule = mongoose.model<ILearningModule>(
  'LearningModule',
  learningModuleSchema
)
