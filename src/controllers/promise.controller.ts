import { Request, Response, NextFunction } from 'express'
import { PromiseService } from '../services/promise.service'
import { logger } from '../utils/logger'
import { AuthenticatedRequest } from '../types/user.types'

/**
 * Controller for handling promises-related endpoints
 */
export class PromiseController {
  /**
   * Get all promises with pagination and filtering
   * @route GET /api/promises
   */
  static async getPromises(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, sort, status, category, search } = req.query

      const result = await PromiseService.getPromises({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        sort: sort as string,
        status: status as string,
        category: category as string,
        search: search as string,
      })

      res.status(200).json(result)
    } catch (error) {
      logger.error('Error in getPromises controller:', error)
      next(error)
    }
  }

  /**
   * Get promise by ID
   * @route GET /api/promises/:id
   */
  static async getPromiseById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params

      const promise = await PromiseService.getPromiseById(id)

      res.status(200).json({ data: promise })
    } catch (error) {
      logger.error(`Error in getPromiseById controller for ID ${req.params.id}:`, error)
      next(error)
    }
  }

  /**
   * Get promises by official ID
   * @route GET /api/promises/official/:officialId
   */
  static async getPromisesByOfficial(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { officialId } = req.params
      const { page, limit, sort, status } = req.query

      const result = await PromiseService.getPromisesByOfficial(officialId, {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        sort: sort as string,
        status: status as string,
      })

      res.status(200).json(result)
    } catch (error) {
      logger.error(
        `Error in getPromisesByOfficial controller for ID ${req.params.officialId}:`,
        error
      )
      next(error)
    }
  }

  /**
   * Create a new promise
   * @route POST /api/promises
   */
  static async createPromise(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const userId = authenticatedReq.user._id.toString()
      const promiseData = authenticatedReq.body

      const promise = await PromiseService.createPromise(userId, promiseData)

      res.status(201).json({
        message: 'Promise created successfully',
        data: promise,
      })
    } catch (error) {
      logger.error('Error in createPromise controller:', error)
      next(error)
    }
  }

  /**
   * Add evidence to a promise
   * @route POST /api/promises/:id/evidence
   */
  static async addEvidence(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const { id } = authenticatedReq.params
      const userId = authenticatedReq.user._id.toString()
      const evidenceData = authenticatedReq.body

      const result = await PromiseService.addEvidence(id, userId, evidenceData)

      res.status(200).json({
        message: 'Evidence added successfully',
        data: result.promise,
        evidence: result.evidence,
        pointsEarned: result.pointsEarned,
        badgesEarned: result.badgesEarned,
      })
    } catch (error) {
      logger.error(
        `Error in addEvidence controller for promise ID ${authenticatedReq.params.id}:`,
        error
      )
      next(error)
    }
  }

  /**
   * Add comment to a promise
   * @route POST /api/promises/:id/comment
   */
  static async addComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const { id } = authenticatedReq.params
      const userId = authenticatedReq.user._id.toString()
      const { text } = authenticatedReq.body

      const result = await PromiseService.addComment(id, userId, text)

      res.status(200).json({
        message: 'Comment added successfully',
        data: result.promise,
        comment: result.comment,
        pointsEarned: result.pointsEarned,
      })
    } catch (error) {
      logger.error(
        `Error in addComment controller for promise ID ${authenticatedReq.params.id}:`,
        error
      )
      next(error)
    }
  }

  /**
   * Upvote evidence
   * @route POST /api/promises/:id/evidence/:evidenceIndex/upvote
   */
  static async upvoteEvidence(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const { id, evidenceIndex } = authenticatedReq.params
      const userId = authenticatedReq.user._id.toString()

      const promise = await PromiseService.upvoteEvidence(id, parseInt(evidenceIndex), userId)

      res.status(200).json({
        message: 'Evidence upvoted successfully',
        data: promise,
      })
    } catch (error) {
      logger.error(
        `Error in upvoteEvidence controller for promise ID ${authenticatedReq.params.id}, evidence index ${authenticatedReq.params.evidenceIndex}:`,
        error
      )
      next(error)
    }
  }

  /**
   * Downvote evidence
   * @route POST /api/promises/:id/evidence/:evidenceIndex/downvote
   */
  static async downvoteEvidence(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const { id, evidenceIndex } = authenticatedReq.params
      const userId = authenticatedReq.user._id.toString()

      const promise = await PromiseService.downvoteEvidence(id, parseInt(evidenceIndex), userId)

      res.status(200).json({
        message: 'Evidence downvoted successfully',
        data: promise,
      })
    } catch (error) {
      logger.error(
        `Error in downvoteEvidence controller for promise ID ${authenticatedReq.params.id}, evidence index ${authenticatedReq.params.evidenceIndex}:`,
        error
      )
      next(error)
    }
  }

  /**
   * Update a promise (admin only)
   * @route PUT /api/promises/:id
   */
  static async updatePromise(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const updateData = req.body

      const promise = await PromiseService.updatePromise(id, updateData)

      res.status(200).json({
        message: 'Promise updated successfully',
        data: promise,
      })
    } catch (error) {
      logger.error(`Error in updatePromise controller for ID ${req.params.id}:`, error)
      next(error)
    }
  }

  /**
   * Delete a promise (admin only)
   * @route DELETE /api/promises/:id
   */
  static async deletePromise(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params

      await PromiseService.deletePromise(id)

      res.status(200).json({
        message: 'Promise deleted successfully',
      })
    } catch (error) {
      logger.error(`Error in deletePromise controller for ID ${req.params.id}:`, error)
      next(error)
    }
  }

  /**
   * Get promise statistics
   * @route GET /api/promises/statistics
   */
  static async getPromiseStatistics(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { officialId, district, category } = req.query

      const statistics = await PromiseService.getPromiseStatistics({
        officialId: officialId as string,
        district: district as string,
        category: category as string,
      })

      res.status(200).json({
        data: statistics,
      })
    } catch (error) {
      logger.error('Error in getPromiseStatistics controller:', error)
      next(error)
    }
  }
}
