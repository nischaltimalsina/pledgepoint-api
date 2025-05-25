import { Request, Response, NextFunction } from 'express'
import { ConstituencyService } from '../services/constituency.service'
import { logger } from '../utils/logger'

export class ConstituencyController {
  /**
   * Get all constituencies with filtering
   * @route GET /api/constituencies
   */
  static async getConstituencies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, sort, type, assemblyId, districtId, reservedFor, active, search } =
        req.query

      const result = await ConstituencyService.getConstituencies({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        sort: sort as string,
        type: type as 'federal' | 'provincial',
        assemblyId: assemblyId as string,
        districtId: districtId as string,
        reservedFor: reservedFor as string,
        active: active === 'true' ? true : active === 'false' ? false : undefined,
        search: search as string,
      })

      res.status(200).json(result)
    } catch (error) {
      logger.error('Error in getConstituencies controller:', error)
      next(error)
    }
  }

  /**
   * Get constituency by ID
   * @route GET /api/constituencies/:id
   */
  static async getConstituencyById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params

      const constituency = await ConstituencyService.getConstituencyById(id)

      res.status(200).json({ data: constituency })
    } catch (error) {
      logger.error(`Error in getConstituencyById controller for ID ${req.params.id}:`, error)
      next(error)
    }
  }

  /**
   * Get constituencies by assembly
   * @route GET /api/constituencies/assembly/:assemblyId
   */
  static async getConstituenciesByAssembly(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { assemblyId } = req.params
      const { type, reservedFor, active } = req.query

      const constituencies = await ConstituencyService.getConstituenciesByAssembly(assemblyId, {
        type: type as 'federal' | 'provincial',
        reservedFor: reservedFor as string,
        active: active === 'true' ? true : active === 'false' ? false : undefined,
      })

      res.status(200).json({ data: constituencies })
    } catch (error) {
      logger.error(
        `Error in getConstituenciesByAssembly controller for assembly ${req.params.assemblyId}:`,
        error
      )
      next(error)
    }
  }

  /**
   * Get constituencies by district
   * @route GET /api/constituencies/district/:districtId
   */
  static async getConstituenciesByDistrict(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { districtId } = req.params
      const { type, assemblyId } = req.query

      const result = await ConstituencyService.getConstituencies({
        districtId,
        type: type as 'federal' | 'provincial',
        assemblyId: assemblyId as string,
        active: true,
      })

      res.status(200).json(result)
    } catch (error) {
      logger.error(
        `Error in getConstituenciesByDistrict controller for district ${req.params.districtId}:`,
        error
      )
      next(error)
    }
  }

  /**
   * Get constituencies by type
   * @route GET /api/constituencies/type/:type
   */
  static async getConstituenciesByType(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { type } = req.params
      const { assemblyId, districtId, reservedFor } = req.query

      const result = await ConstituencyService.getConstituencies({
        type: type as 'federal' | 'provincial',
        assemblyId: assemblyId as string,
        districtId: districtId as string,
        reservedFor: reservedFor as string,
        active: true,
      })

      res.status(200).json(result)
    } catch (error) {
      logger.error(
        `Error in getConstituenciesByType controller for type ${req.params.type}:`,
        error
      )
      next(error)
    }
  }

  /**
   * Get current representative for constituency
   * @route GET /api/constituencies/:id/representative
   */
  static async getCurrentRepresentative(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params

      const representative = await ConstituencyService.getCurrentRepresentative(id)

      res.status(200).json({ data: representative })
    } catch (error) {
      logger.error(
        `Error in getCurrentRepresentative controller for constituency ${req.params.id}:`,
        error
      )
      next(error)
    }
  }

  /**
   * Get constituency statistics
   * @route GET /api/constituencies/:id/statistics
   */
  static async getConstituencyStatistics(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params

      const statistics = await ConstituencyService.getConstituencyStatistics(id)

      res.status(200).json({ data: statistics })
    } catch (error) {
      logger.error(`Error in getConstituencyStatistics controller for ID ${req.params.id}:`, error)
      next(error)
    }
  }

  /**
   * Search constituencies
   * @route GET /api/constituencies/search
   */
  static async searchConstituencies(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { q, limit, type, assemblyId } = req.query

      if (!q || (q as string).trim().length < 2) {
        res.status(400).json({
          status: 'fail',
          message: 'Search query must be at least 2 characters',
        })
        return
      }

      const results = await ConstituencyService.searchConstituencies(q as string, {
        limit: limit ? parseInt(limit as string) : undefined,
        type: type as 'federal' | 'provincial',
        assemblyId: assemblyId as string,
      })

      res.status(200).json({ data: results })
    } catch (error) {
      logger.error('Error in searchConstituencies controller:', error)
      next(error)
    }
  }

  // Admin routes
  static async createConstituency(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const constituencyData = req.body

      const constituency = await ConstituencyService.createConstituency(constituencyData)

      res.status(201).json({
        message: 'Constituency created successfully',
        data: constituency,
      })
    } catch (error) {
      logger.error('Error in createConstituency controller:', error)
      next(error)
    }
  }

  static async updateConstituency(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const updateData = req.body

      const constituency = await ConstituencyService.updateConstituency(id, updateData)

      res.status(200).json({
        message: 'Constituency updated successfully',
        data: constituency,
      })
    } catch (error) {
      logger.error(`Error in updateConstituency controller for ID ${req.params.id}:`, error)
      next(error)
    }
  }

  static async deleteConstituency(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params

      // Soft delete - set active to false
      const constituency = await ConstituencyService.updateConstituency(id, { active: false })

      res.status(200).json({
        message: 'Constituency deleted successfully',
        data: constituency,
      })
    } catch (error) {
      logger.error(`Error in deleteConstituency controller for ID ${req.params.id}:`, error)
      next(error)
    }
  }

  static async toggleConstituencyActive(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params

      const constituency = await ConstituencyService.getConstituencyById(id)
      const updatedConstituency = await ConstituencyService.updateConstituency(id, {
        active: !constituency.active,
      })

      res.status(200).json({
        message: `Constituency ${updatedConstituency.active ? 'activated' : 'deactivated'} successfully`,
        data: updatedConstituency,
      })
    } catch (error) {
      logger.error(`Error in toggleConstituencyActive controller for ID ${req.params.id}:`, error)
      next(error)
    }
  }
}
