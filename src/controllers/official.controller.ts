import { Request, Response, NextFunction } from 'express'
import { OfficialService } from '../services/official.service'
import { logger } from '../utils/logger'
import { AuthenticatedRequest } from '../types/user.types'

/**
 * Controller for handling officials-related endpoints
 */
export class OfficialController {
  /**
   * Get all officials with pagination and filtering
   * @route GET /api/officials
   */
  static async getOfficials(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, sort, district, position, party, search } = req.query

      const result = await OfficialService.getOfficials({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        sort: sort as string,
        district: district as string,
        position: position as string,
        party: party as string,
        search: search as string,
      })

      res.status(200).json(result)
    } catch (error) {
      logger.error('Error in getOfficials controller:', error)
      next(error)
    }
  }

  /**
   * Get official by ID
   * @route GET /api/officials/:id
   */
  static async getOfficialById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params

      const official = await OfficialService.getOfficialById(id)

      res.status(200).json({ data: official })
    } catch (error) {
      logger.error(`Error in getOfficialById controller for ID ${req.params.id}:`, error)
      next(error)
    }
  }

  /**
   * Create a new official
   * @route POST /api/officials
   */
  static async createOfficial(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const officialData = req.body

      const official = await OfficialService.createOfficial(officialData)

      res.status(201).json({
        message: 'Official created successfully',
        data: official,
      })
    } catch (error) {
      logger.error('Error in createOfficial controller:', error)
      next(error)
    }
  }

  /**
   * Rate an official
   * @route POST /api/officials/:id/rate
   */
  static async rateOfficial(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const { id } = authenticatedReq.params
      const userId = authenticatedReq.user._id.toString()
      const ratingData = authenticatedReq.body

      console.log(`Rating data for official ID ${id}:`, ratingData)
      console.log(`User ID: ${userId}`)

      const rating = await OfficialService.rateOfficial(id, userId, ratingData)
      console.log(`Rating result for official ID ${id}:`, rating)
      res.status(200).json({
        message: 'Official rated successfully',
        data: rating,
      })
    } catch (error) {
      logger.error(`Error in rateOfficial controller for ID ${authenticatedReq.params.id}:`, error)
      next(error)
    }
  }

  /**
   * Update an official
   * @route PUT /api/officials/:id
   */
  static async updateOfficial(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const updateData = req.body

      const official = await OfficialService.updateOfficial(id, updateData)

      res.status(200).json({
        message: 'Official updated successfully',
        data: official,
      })
    } catch (error) {
      logger.error(`Error in updateOfficial controller for ID ${req.params.id}:`, error)
      next(error)
    }
  }

  /**
   * Delete an official
   * @route DELETE /api/officials/:id
   */
  static async deleteOfficial(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params

      await OfficialService.deleteOfficial(id)

      res.status(200).json({
        message: 'Official deleted successfully',
      })
    } catch (error) {
      logger.error(`Error in deleteOfficial controller for ID ${req.params.id}:`, error)
      next(error)
    }
  }

  /**
   * Upvote a rating
   * @route POST /api/officials/ratings/:id/upvote
   */
  static async upvoteRating(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const { id } = authenticatedReq.params
      const userId = authenticatedReq.user._id.toString()

      const rating = await OfficialService.upvoteRating(id, userId)

      res.status(200).json({
        message: 'Rating upvoted successfully',
        data: rating,
      })
    } catch (error) {
      logger.error(`Error in upvoteRating controller for ID ${authenticatedReq.params.id}:`, error)
      next(error)
    }
  }

  /**
   * Downvote a rating
   * @route POST /api/officials/ratings/:id/downvote
   */
  static async downvoteRating(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const { id } = authenticatedReq.params
      const userId = authenticatedReq.user._id.toString()

      const rating = await OfficialService.downvoteRating(id, userId)

      res.status(200).json({
        message: 'Rating downvoted successfully',
        data: rating,
      })
    } catch (error) {
      logger.error(
        `Error in downvoteRating controller for ID ${authenticatedReq.params.id}:`,
        error
      )
      next(error)
    }
  }

  /**
   * Get top rated officials
   * @route GET /api/officials/top-rated
   */
  static async getTopRatedOfficials(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { limit, district, position } = req.query

      const officials = await OfficialService.getTopRatedOfficials({
        limit: limit ? parseInt(limit as string) : undefined,
        district: district as string,
        position: position as string,
      })

      res.status(200).json({
        data: officials,
      })
    } catch (error) {
      logger.error('Error in getTopRatedOfficials controller:', error)
      next(error)
    }
  }
}
