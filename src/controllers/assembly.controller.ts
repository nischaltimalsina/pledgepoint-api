import { Request, Response, NextFunction } from 'express'
import { AssemblyService } from '../services/assembly.service'
import { logger } from '../utils/logger'

export class AssemblyController {
  /**
   * Get all assemblies with filtering
   * @route GET /api/assemblies
   */
  static async getAssemblies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, sort, type, level, province, status, search } = req.query

      const result = await AssemblyService.getAssemblies({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        sort: sort as string,
        type: type as 'federal' | 'provincial',
        level: level as 'house_of_representatives' | 'national_assembly' | 'provincial_assembly',
        province: province as string,
        status: status as 'upcoming' | 'ongoing' | 'completed' | 'dissolved',
        search: search as string,
      })

      res.status(200).json(result)
    } catch (error) {
      logger.error('Error in getAssemblies controller:', error)
      next(error)
    }
  }

  /**
   * Get assembly by ID
   * @route GET /api/assemblies/:id
   */
  static async getAssemblyById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params

      const assembly = await AssemblyService.getAssemblyById(id)

      res.status(200).json({ data: assembly })
    } catch (error) {
      logger.error(`Error in getAssemblyById controller for ID ${req.params.id}:`, error)
      next(error)
    }
  }

  /**
   * Get assemblies by type
   * @route GET /api/assemblies/type/:type
   */
  static async getAssembliesByType(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type } = req.params
      const { level, province } = req.query

      const assemblies = await AssemblyService.getAssembliesByType(
        type as 'federal' | 'provincial',
        {
          level: level as string,
          province: province as string,
        }
      )

      res.status(200).json({ data: assemblies })
    } catch (error) {
      logger.error(`Error in getAssembliesByType controller for type ${req.params.type}:`, error)
      next(error)
    }
  }

  /**
   * Get current federal government structure
   * @route GET /api/assemblies/federal/current
   */
  static async getCurrentFederalStructure(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const structure = await AssemblyService.getCurrentFederalStructure()

      res.status(200).json({ data: structure })
    } catch (error) {
      logger.error('Error in getCurrentFederalStructure controller:', error)
      next(error)
    }
  }

  // Admin routes
  static async createAssembly(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const assemblyData = req.body

      const assembly = await AssemblyService.createAssembly(assemblyData)

      res.status(201).json({
        message: 'Assembly created successfully',
        data: assembly,
      })
    } catch (error) {
      logger.error('Error in createAssembly controller:', error)
      next(error)
    }
  }

  static async updateAssembly(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const updateData = req.body

      const assembly = await AssemblyService.updateAssembly(id, updateData)

      res.status(200).json({
        message: 'Assembly updated successfully',
        data: assembly,
      })
    } catch (error) {
      logger.error(`Error in updateAssembly controller for ID ${req.params.id}:`, error)
      next(error)
    }
  }
}
