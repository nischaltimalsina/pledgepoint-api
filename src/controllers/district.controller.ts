import { Request, Response, NextFunction } from 'express'
import { DistrictService } from '../services/district.service'
import { logger } from '../utils/logger'
import { AuthenticatedRequest } from '../types/user.types'

/**
 * Controller for handling districts-related endpoints
 */
export class DistrictController {
  /**
   * Get all districts with pagination and filtering
   * @route GET /api/districts
   */
  static async getDistricts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, sort, type, region, country, active, search } = req.query

      const result = await DistrictService.getDistricts({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        sort: sort as string,
        type: type as 'federal' | 'provincial' | 'municipal' | 'other',
        region: region as string,
        country: country as string,
        active: active === 'true' ? true : active === 'false' ? false : undefined,
        search: search as string,
      })

      res.status(200).json(result)
    } catch (error) {
      logger.error('Error in getDistricts controller:', error)
      next(error)
    }
  }

  /**
   * Get district by ID
   * @route GET /api/districts/:id
   */
  static async getDistrictById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const { includeStats } = req.query

      const result = await DistrictService.getDistrictById(id, {
        includeStats: includeStats === 'true',
      })

      res.status(200).json({ data: result })
    } catch (error) {
      logger.error(`Error in getDistrictById controller for ID ${req.params.id}:`, error)
      next(error)
    }
  }

  /**
   * Get districts by region
   * @route GET /api/districts/region/:region
   */
  static async getDistrictsByRegion(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { region } = req.params
      const { type, active, sort } = req.query

      const result = await DistrictService.getDistrictsByRegion(region, {
        type: type as 'federal' | 'provincial' | 'municipal' | 'other',
        active: active === 'true' ? true : active === 'false' ? false : undefined,
        sort: sort as string,
      })

      res.status(200).json({ data: result })
    } catch (error) {
      logger.error(
        `Error in getDistrictsByRegion controller for region ${req.params.region}:`,
        error
      )
      next(error)
    }
  }

  /**
   * Get districts by type
   * @route GET /api/districts/type/:type
   */
  static async getDistrictsByType(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type } = req.params
      const { region, country, active, sort } = req.query

      const result = await DistrictService.getDistrictsByType(
        type as 'federal' | 'provincial' | 'municipal' | 'other',
        {
          region: region as string,
          country: country as string,
          active: active === 'true' ? true : active === 'false' ? false : undefined,
          sort: sort as string,
        }
      )

      res.status(200).json({ data: result })
    } catch (error) {
      logger.error(`Error in getDistrictsByType controller for type ${req.params.type}:`, error)
      next(error)
    }
  }

  /**
   * Get district statistics
   * @route GET /api/districts/:id/statistics
   */
  static async getDistrictStatistics(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params

      const statistics = await DistrictService.getDistrictStatistics(id)

      res.status(200).json({ data: statistics })
    } catch (error) {
      logger.error(`Error in getDistrictStatistics controller for ID ${req.params.id}:`, error)
      next(error)
    }
  }

  /**
   * Get officials in a district
   * @route GET /api/districts/:id/officials
   */
  static async getDistrictOfficials(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params
      const { page, limit, sort, position, party } = req.query

      const result = await DistrictService.getDistrictOfficials(id, {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        sort: sort as string,
        position: position as string,
        party: party as string,
      })

      res.status(200).json(result)
    } catch (error) {
      logger.error(`Error in getDistrictOfficials controller for ID ${req.params.id}:`, error)
      next(error)
    }
  }

  /**
   * Get campaigns in a district
   * @route GET /api/districts/:id/campaigns
   */
  static async getDistrictCampaigns(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params
      const { page, limit, sort, status, category } = req.query

      const result = await DistrictService.getDistrictCampaigns(id, {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        sort: sort as string,
        status: status as 'draft' | 'active' | 'completed' | 'archived',
        category: category as string,
      })

      res.status(200).json(result)
    } catch (error) {
      logger.error(`Error in getDistrictCampaigns controller for ID ${req.params.id}:`, error)
      next(error)
    }
  }

  /**
   * Search districts
   * @route GET /api/districts/search
   */
  static async searchDistricts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q, limit, type, region } = req.query

      if (!q || (q as string).trim().length < 2) {
        res.status(400).json({
          status: 'fail',
          message: 'Search query must be at least 2 characters',
        })
        return
      }

      const results = await DistrictService.searchDistricts(q as string, {
        limit: limit ? parseInt(limit as string) : undefined,
        type: type as 'federal' | 'provincial' | 'municipal' | 'other',
        region: region as string,
      })

      res.status(200).json({ data: results })
    } catch (error) {
      logger.error('Error in searchDistricts controller:', error)
      next(error)
    }
  }

  /**
   * Get all regions
   * @route GET /api/districts/regions
   */
  static async getRegions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { country } = req.query

      const regions = await DistrictService.getRegions({
        country: country as string,
      })

      res.status(200).json({ data: regions })
    } catch (error) {
      logger.error('Error in getRegions controller:', error)
      next(error)
    }
  }

  // Admin-only routes below

  /**
   * Create a new district (admin only)
   * @route POST /api/districts
   */
  static async createDistrict(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const districtData = req.body

      const district = await DistrictService.createDistrict(districtData)

      res.status(201).json({
        message: 'District created successfully',
        data: district,
      })
    } catch (error) {
      logger.error('Error in createDistrict controller:', error)
      next(error)
    }
  }

  /**
   * Update a district (admin only)
   * @route PUT /api/districts/:id
   */
  static async updateDistrict(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const updateData = req.body

      const district = await DistrictService.updateDistrict(id, updateData)

      res.status(200).json({
        message: 'District updated successfully',
        data: district,
      })
    } catch (error) {
      logger.error(`Error in updateDistrict controller for ID ${req.params.id}:`, error)
      next(error)
    }
  }

  /**
   * Delete a district (admin only)
   * @route DELETE /api/districts/:id
   */
  static async deleteDistrict(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params

      await DistrictService.deleteDistrict(id)

      res.status(200).json({
        message: 'District deleted successfully',
      })
    } catch (error) {
      logger.error(`Error in deleteDistrict controller for ID ${req.params.id}:`, error)
      next(error)
    }
  }

  /**
   * Bulk import districts (admin only)
   * @route POST /api/districts/bulk-import
   */
  static async bulkImportDistricts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { districts } = req.body

      if (!Array.isArray(districts) || districts.length === 0) {
        res.status(400).json({
          status: 'fail',
          message: 'Districts array is required and cannot be empty',
        })
        return
      }

      const result = await DistrictService.bulkImportDistricts(districts)

      res.status(200).json({
        message: 'Districts imported successfully',
        data: result,
      })
    } catch (error) {
      logger.error('Error in bulkImportDistricts controller:', error)
      next(error)
    }
  }

  /**
   * Toggle district active status (admin only)
   * @route PATCH /api/districts/:id/toggle-active
   */
  static async toggleDistrictActive(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params

      const district = await DistrictService.toggleDistrictActive(id)

      res.status(200).json({
        message: `District ${district.active ? 'activated' : 'deactivated'} successfully`,
        data: district,
      })
    } catch (error) {
      logger.error(`Error in toggleDistrictActive controller for ID ${req.params.id}:`, error)
      next(error)
    }
  }
}
