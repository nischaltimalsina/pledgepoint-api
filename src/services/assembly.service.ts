import { Types } from 'mongoose'
import { Assembly, Constituency, Official } from '../models'
import { AppError } from '../middleware/error-handler'
import { logger } from '../utils/logger'

export class AssemblyService {
  /**
   * Get all assemblies with pagination and filtering
   */
  static async getAssemblies(options: {
    page?: number
    limit?: number
    sort?: string
    type?: 'federal' | 'provincial'
    level?: 'house_of_representatives' | 'national_assembly' | 'provincial_assembly'
    province?: string
    status?: 'upcoming' | 'ongoing' | 'completed' | 'dissolved'
    search?: string
  }) {
    try {
      const { page = 1, limit = 10, sort = 'name', type, level, province, status, search } = options

      // Build filter
      const filter: any = { active: true }

      if (type) filter.type = type
      if (level) filter.level = level
      if (province) filter.province = province
      if (status) filter['currentSession.status'] = status

      // Add search functionality
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { province: { $regex: search, $options: 'i' } },
          { headquarters: { $regex: search, $options: 'i' } },
        ]
      }

      // Get assemblies with pagination
      const assemblies = await Assembly.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)

      // Get total count
      const total = await Assembly.countDocuments(filter)

      // Add constituency count to each assembly
      const assembliesWithCounts = await Promise.all(
        assemblies.map(async (assembly) => {
          const constituencyCount = await Constituency.countDocuments({
            assemblyId: assembly._id,
            active: true,
          })

          return {
            ...assembly.toObject(),
            constituencyCount,
          }
        })
      )

      return {
        data: assembliesWithCounts,
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
      logger.error('Error fetching assemblies:', error)
      throw error
    }
  }

  /**
   * Get assembly by ID
   */
  static async getAssemblyById(id: string) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new AppError(400, 'Invalid assembly ID')
      }

      const assembly = await Assembly.findById(id)

      if (!assembly) {
        throw new AppError(404, 'Assembly not found')
      }

      // Get constituency count
      const constituencyCount = await Constituency.countDocuments({
        assemblyId: assembly._id,
        active: true,
      })

      // Get current members count
      const membersCount = await Official.countDocuments({
        assemblyId: assembly._id,
        'term.end': { $gte: new Date() },
        active: true,
      })

      return {
        ...assembly.toObject(),
        constituencyCount,
        membersCount,
      }
    } catch (error) {
      logger.error(`Error fetching assembly with ID ${id}:`, error)
      throw error
    }
  }

  /**
   * Get assemblies by type
   */
  static async getAssembliesByType(
    type: 'federal' | 'provincial',
    options: { level?: string; province?: string } = {}
  ) {
    try {
      const { level, province } = options

      const filter: any = { type, active: true }
      if (level) filter.level = level
      if (province) filter.province = province

      const assemblies = await Assembly.find(filter).sort('name')

      return assemblies
    } catch (error) {
      logger.error(`Error fetching assemblies for type ${type}:`, error)
      throw error
    }
  }

  /**
   * Get current federal government structure
   */
  static async getCurrentFederalStructure() {
    try {
      const federalAssemblies = await Assembly.find({
        type: 'federal',
        active: true,
      }).sort('level')

      const structure = await Promise.all(
        federalAssemblies.map(async (assembly) => {
          const constituencies = await Constituency.find({
            assemblyId: assembly._id,
            active: true,
          }).populate('currentRepresentative', 'name party')

          return {
            assembly: assembly.toObject(),
            constituencies: constituencies.length,
            filledSeats: constituencies.filter((c) => c.currentRepresentative).length,
          }
        })
      )

      return structure
    } catch (error) {
      logger.error('Error getting federal structure:', error)
      throw error
    }
  }

  /**
   * Create a new assembly (admin only)
   */
  static async createAssembly(data: {
    name: string
    type: 'federal' | 'provincial'
    level: 'house_of_representatives' | 'national_assembly' | 'provincial_assembly'
    province?: string
    totalSeats: number
    electedSeats: number
    nominatedSeats?: number
    reservedSeats?: {
      women: number
      dalit: number
      disadvantaged: number
    }
    currentSession: {
      number: number
      startDate: Date
      status: 'upcoming' | 'ongoing' | 'completed' | 'dissolved'
      description?: string
    }
    headquarters: string
    establishedDate: Date
    description?: string
    website?: string
    contactInfo?: {
      phone?: string
      email?: string
      address?: string
    }
  }) {
    try {
      const assembly = new Assembly({
        _id: new Types.ObjectId(),
        ...data,
        active: true,
        previousSessions: [],
      })

      await assembly.save()
      return assembly
    } catch (error) {
      logger.error('Error creating assembly:', error)
      throw error
    }
  }

  /**
   * Update assembly (admin only)
   */
  static async updateAssembly(assemblyId: string, data: any) {
    try {
      if (!Types.ObjectId.isValid(assemblyId)) {
        throw new AppError(400, 'Invalid assembly ID')
      }

      const assembly = await Assembly.findByIdAndUpdate(
        assemblyId,
        { $set: data },
        { new: true, runValidators: true }
      )

      if (!assembly) {
        throw new AppError(404, 'Assembly not found')
      }

      return assembly
    } catch (error) {
      logger.error(`Error updating assembly ${assemblyId}:`, error)
      throw error
    }
  }
}
