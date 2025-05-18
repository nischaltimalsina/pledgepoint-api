import { Types } from 'mongoose'
import { LearningModule, LearningProgress, User, Activity, Badge } from '../models'
import { GamificationService } from './gamification.service'
import { NotificationService } from './notification.service'
import { AppError } from '../middleware/error-handler'
import { logger } from '../utils/logger'

/**
 * Service handling learning-related business logic
 */
export class LearningService {
  /**
   * Get all learning modules with pagination and filtering
   */
  static async getLearningModules(options: {
    page?: number
    limit?: number
    sort?: string
    category?: string
    region?: string
    search?: string
  }) {
    try {
      const { page = 1, limit = 10, sort = 'order', category, region, search } = options

      // Build filter
      const filter: any = {}

      if (category) filter.category = category
      if (region) filter.region = region

      // Add search functionality
      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ]
      }

      // Get modules with pagination
      const modules = await LearningModule.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('requiredModules', 'title')

      // Get total count
      const total = await LearningModule.countDocuments(filter)

      // Calculate pagination metadata
      const pages = Math.ceil(total / limit)
      const hasNext = page < pages
      const hasPrev = page > 1

      return {
        data: modules,
        meta: {
          total,
          page,
          limit,
          pages,
          hasNext,
          hasPrev,
        },
      }
    } catch (error) {
      logger.error('Error fetching learning modules:', error)
      throw error
    }
  }

  /**
   * Get learning module by ID
   */
  static async getLearningModuleById(id: string, userId?: string) {
    try {
      // Validate ID
      if (!Types.ObjectId.isValid(id)) {
        throw new AppError(400, 'Invalid module ID')
      }

      // Get module
      const module = await LearningModule.findById(id).populate('requiredModules', 'title')

      if (!module) {
        throw new AppError(404, 'Learning module not found')
      }

      // If user ID provided, get user's progress for this module
      let userProgress = null
      if (userId) {
        userProgress = await LearningProgress.findOne({
          userId: new Types.ObjectId(userId),
          moduleId: new Types.ObjectId(id),
        })
      }

      return {
        module,
        userProgress,
      }
    } catch (error) {
      logger.error(`Error fetching learning module with ID ${id}:`, error)
      throw error
    }
  }

  /**
   * Get modules by category
   */
  static async getModulesByCategory(
    category: string,
    userId?: string,
    options: { page?: number; limit?: number; region?: string } = {}
  ) {
    try {
      const { page = 1, limit = 10, region } = options

      // Build filter
      const filter: any = { category }
      if (region) filter.region = region

      // Get modules
      const modules = await LearningModule.find(filter)
        .sort('order')
        .skip((page - 1) * limit)
        .limit(limit)

      // If user ID provided, get progress for each module
      let modulesWithProgress: any[] = modules.map((module) => module.toObject())

      if (userId) {
        const moduleIds = modules.map((module) => module._id)
        const progressRecords = await LearningProgress.find({
          userId: new Types.ObjectId(userId),
          moduleId: { $in: moduleIds },
        })

        // Map progress to modules
        modulesWithProgress = modules.map((module) => {
          const progress = progressRecords.find(
            (p) => p.moduleId.toString() === module._id.toString()
          )
          return {
            ...module.toObject(),
            userProgress: progress || null,
          }
        })
      }

      const total = await LearningModule.countDocuments(filter)

      return {
        data: modulesWithProgress,
        meta: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      }
    } catch (error) {
      logger.error(`Error fetching modules by category ${category}:`, error)
      throw error
    }
  }

  /**
   * Start or update module progress
   */
  static async startOrUpdateProgress(userId: string, moduleId: string, progressPercentage: number) {
    try {
      // Validate IDs
      if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(moduleId)) {
        throw new AppError(400, 'Invalid user or module ID')
      }

      // Validate progress percentage
      if (progressPercentage < 0 || progressPercentage > 100) {
        throw new AppError(400, 'Progress percentage must be between 0 and 100')
      }

      // Get module
      const module = await LearningModule.findById(moduleId)

      if (!module) {
        throw new AppError(404, 'Learning module not found')
      }

      // Get user
      const user = await User.findById(userId)

      if (!user) {
        throw new AppError(404, 'User not found')
      }

      // Check if module has prerequisites and if user has completed them
      if (module.requiredModules && module.requiredModules.length > 0) {
        const completedModules = await LearningProgress.countDocuments({
          userId: new Types.ObjectId(userId),
          moduleId: { $in: module.requiredModules },
          completed: true,
        })

        if (completedModules < module.requiredModules.length) {
          throw new AppError(400, 'You must complete prerequisite modules first')
        }
      }

      // Find or create progress record
      let progress = await LearningProgress.findOne({
        userId: new Types.ObjectId(userId),
        moduleId: new Types.ObjectId(moduleId),
      })

      const isNewProgress = !progress

      if (!progress) {
        progress = new LearningProgress({
          _id: new Types.ObjectId(),
          userId: new Types.ObjectId(userId),
          moduleId: new Types.ObjectId(moduleId),
          progress: progressPercentage,
          completed: progressPercentage >= 100,
          quizResults: [],
          pointsEarned: 0,
          startedAt: new Date(),
        })

        // Create activity for starting module
        const activity = new Activity({
          userId: new Types.ObjectId(userId),
          type: 'module_started',
          details: {
            moduleId: module._id,
            moduleTitle: module.title,
            category: module.category,
          },
          relatedId: module._id,
          relatedType: 'LearningModule',
          pointsEarned: 5, // Small reward for starting
        })

        await activity.save()
      } else {
        // Update existing progress
        progress.progress = progressPercentage
        progress.completed = progressPercentage >= 100

        // Set completion date if just completed
        if (progressPercentage >= 100 && !progress.completedAt) {
          progress.completedAt = new Date()

          // Award completion points and badges
          const pointsEarned = await GamificationService.awardPoints(userId, 'COMPLETE_MODULE', {
            moduleId,
            pointsReward: module.pointsReward,
          })

          const badgesEarned = await GamificationService.checkAndAwardBadges(
            userId,
            'COMPLETE_MODULE',
            { moduleId, category: module.category }
          )

          // Update progress with points earned
          progress.pointsEarned = pointsEarned

          // Create completion activity
          const activity = new Activity({
            userId: new Types.ObjectId(userId),
            type: 'module_completed',
            details: {
              moduleId: module._id,
              moduleTitle: module.title,
              category: module.category,
              pointsEarned,
            },
            relatedId: module._id,
            relatedType: 'LearningModule',
            pointsEarned,
            badgesEarned,
          })

          await activity.save()

          // Send notifications for badges
          if (badgesEarned.length > 0) {
            await NotificationService.sendBadgeNotification(userId, badgesEarned)
          }

          // Check if user earned the module's badge reward
          if (module.badgeReward && !user.badges?.includes(module.badgeReward)) {
            if (!user.badges) user.badges = []
            user.badges.push(module.badgeReward)
            await user.save()

            // Send badge notification
            await NotificationService.sendBadgeNotification(userId, [module.badgeReward])
          }
        }
      }

      // Save progress
      await progress.save()

      return {
        progress,
        isNewProgress,
      }
    } catch (error) {
      logger.error(`Error updating progress for module ${moduleId}:`, error)
      throw error
    }
  }

  /**
   * Submit quiz answers
   */
  static async submitQuiz(
    userId: string,
    moduleId: string,
    answers: string[]
  ): Promise<{
    progress: any
    score: number
    passed: boolean
    correctAnswers: number
    totalQuestions: number
    quizResults: any[]
    pointsEarned: number
    badgesEarned: string[]
  }> {
    try {
      // Validate IDs
      if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(moduleId)) {
        throw new AppError(400, 'Invalid user or module ID')
      }

      // Get module
      const module = await LearningModule.findById(moduleId)

      if (!module) {
        throw new AppError(404, 'Learning module not found')
      }

      // Get user
      const user = await User.findById(userId)

      if (!user) {
        throw new AppError(404, 'User not found')
      }

      // Find quiz content in the module
      const quizContent = module.content.find((c) => c.type === 'quiz')

      if (!quizContent) {
        throw new AppError(400, 'This module does not have a quiz')
      }

      const quiz = quizContent.data as any

      if (!quiz.questions || answers.length !== quiz.questions.length) {
        throw new AppError(400, 'Invalid number of answers provided')
      }

      // Calculate the score
      let correctAnswers = 0
      const quizResults = answers.map((answer: string, index: number) => {
        const question = quiz.questions[index]
        const isCorrect = answer === question.correctAnswer
        if (isCorrect) correctAnswers++

        return {
          questionId: question.id,
          answerId: answer,
          correct: isCorrect,
        }
      })

      const score = Math.round((correctAnswers / quiz.questions.length) * 100)
      const passed = score >= (quiz.passingScore || 70)

      // Find or create progress record
      let progress = await LearningProgress.findOne({
        userId: new Types.ObjectId(userId),
        moduleId: new Types.ObjectId(moduleId),
      })

      if (!progress) {
        progress = new LearningProgress({
          _id: new Types.ObjectId(),
          userId: new Types.ObjectId(userId),
          moduleId: new Types.ObjectId(moduleId),
          progress: 0,
          completed: false,
          quizResults: [],
          pointsEarned: 0,
          startedAt: new Date(),
        })
      }

      // Update quiz results
      progress.quizResults = quizResults

      let pointsEarned = 0
      let badgesEarned: string[] = []

      if (passed) {
        // Mark as completed if passed
        progress.progress = 100
        progress.completed = true
        progress.completedAt = new Date()

        // Award points for completion
        pointsEarned = await GamificationService.awardPoints(userId, 'COMPLETE_MODULE', {
          moduleId,
          pointsReward: module.pointsReward,
          quizScore: score,
        })

        // Check for badges
        badgesEarned = await GamificationService.checkAndAwardBadges(userId, 'COMPLETE_MODULE', {
          moduleId,
          category: module.category,
          quizScore: score,
        })

        // Update progress with points earned
        progress.pointsEarned = pointsEarned

        // Create completion activity
        const activity = new Activity({
          userId: new Types.ObjectId(userId),
          type: 'quiz_completed',
          details: {
            moduleId: module._id,
            moduleTitle: module.title,
            score,
            passed: true,
            pointsEarned,
          },
          relatedId: module._id,
          relatedType: 'LearningModule',
          pointsEarned,
          badgesEarned,
        })

        await activity.save()

        // Send notifications for badges
        if (badgesEarned.length > 0) {
          await NotificationService.sendBadgeNotification(userId, badgesEarned)
        }

        // Check if user earned the module's badge reward
        if (module.badgeReward && !user.badges?.includes(module.badgeReward)) {
          if (!user.badges) user.badges = []
          user.badges.push(module.badgeReward)
          await user.save()

          // Add to badges earned for notification
          if (!badgesEarned.includes(module.badgeReward)) {
            badgesEarned.push(module.badgeReward)
            await NotificationService.sendBadgeNotification(userId, [module.badgeReward])
          }
        }
      } else {
        // Create activity for failed quiz attempt
        const activity = new Activity({
          userId: new Types.ObjectId(userId),
          type: 'quiz_completed',
          details: {
            moduleId: module._id,
            moduleTitle: module.title,
            score,
            passed: false,
          },
          relatedId: module._id,
          relatedType: 'LearningModule',
          pointsEarned: 0,
        })

        await activity.save()
      }

      // Save progress
      await progress.save()

      return {
        progress,
        score,
        passed,
        correctAnswers,
        totalQuestions: quiz.questions.length,
        quizResults,
        pointsEarned,
        badgesEarned,
      }
    } catch (error) {
      logger.error(`Error submitting quiz for module ${moduleId}:`, error)
      throw error
    }
  }

  /**
   * Get user's learning progress
   */
  static async getUserProgress(
    userId: string,
    options: {
      page?: number
      limit?: number
      category?: string
      completed?: boolean
    } = {}
  ) {
    try {
      // Validate user ID
      if (!Types.ObjectId.isValid(userId)) {
        throw new AppError(400, 'Invalid user ID')
      }

      const { page = 1, limit = 10, category, completed } = options

      // Build filters
      const progressFilter: any = { userId: new Types.ObjectId(userId) }
      if (completed !== undefined) progressFilter.completed = completed

      const moduleFilter: any = {}
      if (category) moduleFilter.category = category

      // Get progress records with module details
      const progressRecords = await LearningProgress.find(progressFilter)
        .populate({
          path: 'moduleId',
          match: moduleFilter,
          select: 'title description category pointsReward badgeReward order',
        })
        .sort('-startedAt')
        .skip((page - 1) * limit)
        .limit(limit)

      // Filter out records where module didn't match the filter
      const validProgressRecords = progressRecords.filter((record) => record.moduleId)

      // Get total count
      let total = validProgressRecords.length
      if (!category) {
        total = await LearningProgress.countDocuments(progressFilter)
      }

      // Calculate overall statistics
      const allProgress = await LearningProgress.find({ userId: new Types.ObjectId(userId) })
      const completedCount = allProgress.filter((p) => p.completed).length
      const totalModules = await LearningModule.countDocuments()
      const overallProgress = totalModules > 0 ? (completedCount / totalModules) * 100 : 0

      return {
        data: validProgressRecords,
        meta: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
        statistics: {
          totalModules,
          completedModules: completedCount,
          inProgressModules: allProgress.filter((p) => p.progress > 0 && !p.completed).length,
          overallProgress: Math.round(overallProgress),
          totalPointsEarned: allProgress.reduce((sum, p) => sum + p.pointsEarned, 0),
        },
      }
    } catch (error) {
      logger.error(`Error getting user progress for user ${userId}:`, error)
      throw error
    }
  }

  /**
   * Get learning path recommendations
   */
  static async getRecommendations(userId: string, limit: number = 5) {
    try {
      // Validate user ID
      if (!Types.ObjectId.isValid(userId)) {
        throw new AppError(400, 'Invalid user ID')
      }

      // Get user's completed modules
      const completedProgress = await LearningProgress.find({
        userId: new Types.ObjectId(userId),
        completed: true,
      }).select('moduleId')

      const completedModuleIds = completedProgress.map((p) => p.moduleId)

      // Get user's interests (categories of completed modules)
      const completedModules = await LearningModule.find({
        _id: { $in: completedModuleIds },
      }).select('category')

      const userCategories = [...new Set(completedModules.map((m) => m.category))]

      // Find modules the user hasn't completed
      const availableModules = await LearningModule.find({
        _id: { $not: { $in: completedModuleIds } },
      })

      // Filter modules that user can start (prerequisites met)
      const recommendations: any[] = []

      for (const module of availableModules) {
        // Check if prerequisites are met
        if (module.requiredModules && module.requiredModules.length > 0) {
          const hasCompletedPrerequisites = module.requiredModules.every((reqId) =>
            completedModuleIds.some((compId) => compId.toString() === reqId.toString())
          )

          if (!hasCompletedPrerequisites) {
            continue
          }
        }

        // Prioritize modules in user's interested categories
        const isInUserCategory = userCategories.includes(module.category)
        const recommendation = {
          ...module.toObject(),
          recommended: true,
          reason: isInUserCategory
            ? `Based on your interest in ${module.category}`
            : 'Recommended for you',
          priority: isInUserCategory ? 1 : 2,
        }

        recommendations.push(recommendation)
      }

      // Sort by priority and limit results
      recommendations.sort((a, b) => a.priority - b.priority || a.order - b.order)

      return recommendations.slice(0, limit)
    } catch (error) {
      logger.error(`Error getting recommendations for user ${userId}:`, error)
      throw error
    }
  }

  /**
   * Get learning statistics
   */
  static async getLearningStatistics(filter?: {
    userId?: string
    category?: string
    region?: string
  }) {
    try {
      // Build filters
      const moduleFilter: any = {}
      if (filter?.category) moduleFilter.category = filter.category
      if (filter?.region) moduleFilter.region = filter.region

      const progressFilter: any = {}
      if (filter?.userId) {
        if (!Types.ObjectId.isValid(filter.userId)) {
          throw new AppError(400, 'Invalid user ID')
        }
        progressFilter.userId = new Types.ObjectId(filter.userId)
      }

      // Get module statistics
      const totalModules = await LearningModule.countDocuments(moduleFilter)

      const categoryBreakdown = await LearningModule.aggregate([
        { $match: moduleFilter },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ])

      const categoryStats: { [key: string]: number } = {}
      categoryBreakdown.forEach((category) => {
        categoryStats[category._id] = category.count
      })

      // Get progress statistics
      const moduleIds = await LearningModule.find(moduleFilter).distinct('_id')

      const progressStats = await LearningProgress.aggregate([
        {
          $match: {
            ...progressFilter,
            moduleId: { $in: moduleIds },
          },
        },
        {
          $group: {
            _id: null,
            totalStarted: { $sum: 1 },
            totalCompleted: { $sum: { $cond: ['$completed', 1, 0] } },
            averageProgress: { $avg: '$progress' },
            totalPointsEarned: { $sum: '$pointsEarned' },
          },
        },
      ])

      const stats = progressStats[0] || {
        totalStarted: 0,
        totalCompleted: 0,
        averageProgress: 0,
        totalPointsEarned: 0,
      }

      // Calculate completion rate
      const completionRate =
        stats.totalStarted > 0 ? (stats.totalCompleted / stats.totalStarted) * 100 : 0

      return {
        modules: {
          total: totalModules,
          categories: categoryStats,
        },
        progress: {
          started: stats.totalStarted,
          completed: stats.totalCompleted,
          completionRate: Math.round(completionRate * 100) / 100,
          averageProgress: Math.round(stats.averageProgress * 100) / 100,
          totalPointsEarned: stats.totalPointsEarned,
        },
      }
    } catch (error) {
      logger.error('Error getting learning statistics:', error)
      throw error
    }
  }

  /**
   * Create a new learning module (admin only)
   */
  static async createLearningModule(data: {
    title: string
    description: string
    category: string
    order: number
    content: any[]
    pointsReward: number
    badgeReward?: string
    requiredModules?: string[]
    region: string
  }) {
    try {
      // Validate required modules if provided
      if (data.requiredModules && data.requiredModules.length > 0) {
        for (const reqId of data.requiredModules) {
          if (!Types.ObjectId.isValid(reqId)) {
            throw new AppError(400, 'Invalid required module ID')
          }

          const requiredModule = await LearningModule.findById(reqId)
          if (!requiredModule) {
            throw new AppError(404, `Required module not found: ${reqId}`)
          }
        }
      }

      // Create new module
      const module = new LearningModule({
        _id: new Types.ObjectId(),
        ...data,
        requiredModules: data.requiredModules
          ? data.requiredModules.map((id) => new Types.ObjectId(id))
          : [],
      })

      // Save module
      await module.save()

      return module
    } catch (error) {
      logger.error('Error creating learning module:', error)
      throw error
    }
  }

  /**
   * Update a learning module (admin only)
   */
  static async updateLearningModule(
    moduleId: string,
    data: {
      title?: string
      description?: string
      category?: string
      order?: number
      content?: any[]
      pointsReward?: number
      badgeReward?: string
      requiredModules?: string[]
      region?: string
    }
  ) {
    try {
      // Validate module ID
      if (!Types.ObjectId.isValid(moduleId)) {
        throw new AppError(400, 'Invalid module ID')
      }

      // Validate required modules if provided
      if (data.requiredModules && data.requiredModules.length > 0) {
        for (const reqId of data.requiredModules) {
          if (!Types.ObjectId.isValid(reqId)) {
            throw new AppError(400, 'Invalid required module ID')
          }

          const requiredModule = await LearningModule.findById(reqId)
          if (!requiredModule) {
            throw new AppError(404, `Required module not found: ${reqId}`)
          }
        }

        // Convert to ObjectIds
        data.requiredModules = data.requiredModules.map((id) => new Types.ObjectId(id)) as any[]
      }

      // Update module
      const module = await LearningModule.findByIdAndUpdate(
        moduleId,
        { $set: data },
        { new: true, runValidators: true }
      )

      if (!module) {
        throw new AppError(404, 'Learning module not found')
      }

      return module
    } catch (error) {
      logger.error(`Error updating learning module ${moduleId}:`, error)
      throw error
    }
  }

  /**
   * Delete a learning module (admin only)
   */
  static async deleteLearningModule(moduleId: string) {
    try {
      // Validate module ID
      if (!Types.ObjectId.isValid(moduleId)) {
        throw new AppError(400, 'Invalid module ID')
      }

      // Check if module is used as prerequisite
      const dependentModules = await LearningModule.find({
        requiredModules: { $in: [new Types.ObjectId(moduleId)] },
      })

      if (dependentModules.length > 0) {
        throw new AppError(400, 'Cannot delete module that is a prerequisite for other modules')
      }

      // Delete module
      const module = await LearningModule.findByIdAndDelete(moduleId)

      if (!module) {
        throw new AppError(404, 'Learning module not found')
      }

      // Delete all related progress records
      await LearningProgress.deleteMany({ moduleId: new Types.ObjectId(moduleId) })

      return { success: true }
    } catch (error) {
      logger.error(`Error deleting learning module ${moduleId}:`, error)
      throw error
    }
  }
}
