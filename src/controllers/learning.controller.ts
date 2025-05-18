import { Request, Response, NextFunction } from 'express'
import { LearningService } from '../services/learning.service'
import { logger } from '../utils/logger'
import { AuthenticatedRequest, OptionalAuthRequest } from '../types/user.types'

/**
 * Controller for handling learning-related endpoints
 */
export class LearningController {
  /**
   * Get all learning modules with pagination and filtering
   * @route GET /api/learning/modules
   */
  static async getLearningModules(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, sort, category, region, search } = req.query

      const result = await LearningService.getLearningModules({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        sort: sort as string,
        category: category as string,
        region: region as string,
        search: search as string,
      })

      res.status(200).json(result)
    } catch (error) {
      logger.error('Error in getLearningModules controller:', error)
      next(error)
    }
  }

  /**
   * Get learning module by ID
   * @route GET /api/learning/modules/:id
   */
  static async getLearningModuleById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const optionalAuthReq = req as OptionalAuthRequest
    try {
      const { id } = optionalAuthReq.params
      const userId = optionalAuthReq.user?._id.toString()

      const result = await LearningService.getLearningModuleById(id, userId)

      res.status(200).json({
        data: result.module,
        userProgress: result.userProgress,
      })
    } catch (error) {
      logger.error(`Error in getLearningModuleById controller for ID ${req.params.id}:`, error)
      next(error)
    }
  }

  /**
   * Get modules by category
   * @route GET /api/learning/modules/category/:category
   */
  static async getModulesByCategory(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const optionalAuthReq = req as OptionalAuthRequest
    try {
      const { category } = optionalAuthReq.params
      const { page, limit, region } = optionalAuthReq.query
      const userId = optionalAuthReq.user?._id.toString()

      const result = await LearningService.getModulesByCategory(category, userId, {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        region: region as string,
      })

      res.status(200).json(result)
    } catch (error) {
      logger.error(
        `Error in getModulesByCategory controller for category ${req.params.category}:`,
        error
      )
      next(error)
    }
  }

  /**
   * Start or update module progress
   * @route POST /api/learning/progress
   */
  static async updateProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const userId = authenticatedReq.user._id.toString()
      const { moduleId, progress } = authenticatedReq.body

      const result = await LearningService.startOrUpdateProgress(userId, moduleId, progress)

      res.status(200).json({
        message: result.isNewProgress
          ? 'Module started successfully'
          : 'Progress updated successfully',
        data: result.progress,
      })
    } catch (error) {
      logger.error('Error in updateProgress controller:', error)
      next(error)
    }
  }

  /**
   * Submit quiz answers
   * @route POST /api/learning/quiz/:moduleId
   */
  static async submitQuiz(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const { moduleId } = authenticatedReq.params
      const userId = authenticatedReq.user._id.toString()
      const { answers } = authenticatedReq.body

      const result = await LearningService.submitQuiz(userId, moduleId, answers)

      res.status(200).json({
        message: result.passed
          ? 'Quiz completed successfully!'
          : 'Quiz completed, but minimum score not reached',
        data: {
          score: result.score,
          passed: result.passed,
          correctAnswers: result.correctAnswers,
          totalQuestions: result.totalQuestions,
          progress: result.progress,
          pointsEarned: result.pointsEarned,
          badgesEarned: result.badgesEarned,
        },
      })
    } catch (error) {
      logger.error(`Error in submitQuiz controller for module ${req.params.moduleId}:`, error)
      next(error)
    }
  }

  /**
   * Get user's learning progress
   * @route GET /api/learning/progress/user
   */
  static async getUserProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const userId = authenticatedReq.user._id.toString()
      const { page, limit, category, completed } = authenticatedReq.query

      const result = await LearningService.getUserProgress(userId, {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        category: category as string,
        completed: completed === 'true' ? true : completed === 'false' ? false : undefined,
      })

      res.status(200).json(result)
    } catch (error) {
      logger.error('Error in getUserProgress controller:', error)
      next(error)
    }
  }

  /**
   * Get learning path recommendations
   * @route GET /api/learning/recommendations
   */
  static async getRecommendations(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const userId = authenticatedReq.user._id.toString()
      const { limit } = authenticatedReq.query

      const recommendations = await LearningService.getRecommendations(
        userId,
        limit ? parseInt(limit as string) : undefined
      )

      res.status(200).json({
        data: recommendations,
      })
    } catch (error) {
      logger.error('Error in getRecommendations controller:', error)
      next(error)
    }
  }

  /**
   * Get learning statistics
   * @route GET /api/learning/statistics
   */
  static async getLearningStatistics(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const optionalAuthReq = req as OptionalAuthRequest
    try {
      const { category, region } = optionalAuthReq.query
      const userId = optionalAuthReq.user?._id.toString()

      const statistics = await LearningService.getLearningStatistics({
        userId,
        category: category as string,
        region: region as string,
      })

      res.status(200).json({
        data: statistics,
      })
    } catch (error) {
      logger.error('Error in getLearningStatistics controller:', error)
      next(error)
    }
  }

  /**
   * Get modules by region
   * @route GET /api/learning/modules/region/:region
   */
  static async getModulesByRegion(req: Request, res: Response, next: NextFunction): Promise<void> {
    const optionalAuthReq = req as OptionalAuthRequest
    try {
      const { region } = optionalAuthReq.params
      const { page, limit, sort, category } = optionalAuthReq.query

      const result = await LearningService.getLearningModules({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        sort: sort as string,
        category: category as string,
        region,
      })

      res.status(200).json(result)
    } catch (error) {
      logger.error(`Error in getModulesByRegion controller for region ${req.params.region}:`, error)
      next(error)
    }
  }

  /**
   * Get user's completed modules
   * @route GET /api/learning/progress/completed
   */
  static async getCompletedModules(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const userId = authenticatedReq.user._id.toString()
      const { page, limit, category } = authenticatedReq.query

      const result = await LearningService.getUserProgress(userId, {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        category: category as string,
        completed: true,
      })

      res.status(200).json(result)
    } catch (error) {
      logger.error('Error in getCompletedModules controller:', error)
      next(error)
    }
  }

  /**
   * Get user's in-progress modules
   * @route GET /api/learning/progress/in-progress
   */
  static async getInProgressModules(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const userId = authenticatedReq.user._id.toString()
      const { page, limit, category } = authenticatedReq.query

      const result = await LearningService.getUserProgress(userId, {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        category: category as string,
        completed: false,
      })

      // Filter to only include modules with progress > 0
      const inProgressData = result.data.filter((item) => item.progress > 0)

      res.status(200).json({
        ...result,
        data: inProgressData,
        meta: {
          ...result.meta,
          total: inProgressData.length,
        },
      })
    } catch (error) {
      logger.error('Error in getInProgressModules controller:', error)
      next(error)
    }
  }

  // Admin-only routes below

  /**
   * Create a new learning module (admin only)
   * @route POST /api/learning/modules
   */
  static async createLearningModule(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const moduleData = req.body

      const module = await LearningService.createLearningModule(moduleData)

      res.status(201).json({
        message: 'Learning module created successfully',
        data: module,
      })
    } catch (error) {
      logger.error('Error in createLearningModule controller:', error)
      next(error)
    }
  }

  /**
   * Update a learning module (admin only)
   * @route PUT /api/learning/modules/:id
   */
  static async updateLearningModule(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params
      const updateData = req.body

      const module = await LearningService.updateLearningModule(id, updateData)

      res.status(200).json({
        message: 'Learning module updated successfully',
        data: module,
      })
    } catch (error) {
      logger.error(`Error in updateLearningModule controller for ID ${req.params.id}:`, error)
      next(error)
    }
  }

  /**
   * Delete a learning module (admin only)
   * @route DELETE /api/learning/modules/:id
   */
  static async deleteLearningModule(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params

      await LearningService.deleteLearningModule(id)

      res.status(200).json({
        message: 'Learning module deleted successfully',
      })
    } catch (error) {
      logger.error(`Error in deleteLearningModule controller for ID ${req.params.id}:`, error)
      next(error)
    }
  }

  /**
   * Get all categories
   * @route GET /api/learning/categories
   */
  static async getCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Get distinct categories from learning modules
      const categories = await LearningService.getLearningModules({ limit: 1000 })
      const uniqueCategories = [...new Set(categories.data.map((module: any) => module.category))]

      res.status(200).json({
        data: uniqueCategories,
      })
    } catch (error) {
      logger.error('Error in getCategories controller:', error)
      next(error)
    }
  }

  /**
   * Get all regions
   * @route GET /api/learning/regions
   */
  static async getRegions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Get distinct regions from learning modules
      const modules = await LearningService.getLearningModules({ limit: 1000 })
      const uniqueRegions = [...new Set(modules.data.map((module: any) => module.region))]

      res.status(200).json({
        data: uniqueRegions,
      })
    } catch (error) {
      logger.error('Error in getRegions controller:', error)
      next(error)
    }
  }
}
