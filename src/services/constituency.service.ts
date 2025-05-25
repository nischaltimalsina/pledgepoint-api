import { Types } from 'mongoose'
import { Constituency, Assembly, Official, Campaign, User } from '../models'
import { AppError } from '../middleware/error-handler'
import { logger } from '../utils/logger'

export class ConstituencyService {
  /**
   * Get all constituencies with pagination and filtering
   */
  static async getConstituencies(options: {
    page?: number
    limit?: number
    sort?: string
    type?: 'federal' | 'provincial'
    assemblyId?: string
    districtId?: string
    reservedFor?: string
    active?: boolean
    search?: string
  }) {
    try {
      const {
        page = 1,
        limit = 10,
        sort = 'name',
        type,
        assemblyId,
        districtId,
        reservedFor,
        active,
        search,
      } = options

      // Build filter
      const filter: any = {}

      if (type) filter.type = type
      if (assemblyId) filter.assemblyId = new Types.ObjectId(assemblyId)
      if (districtId) filter.districtId = new Types.ObjectId(districtId)
      if (reservedFor) filter.reservedFor = reservedFor
      if (active !== undefined) filter.active = active

      // Add search functionality
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { code: { $regex: search, $options: 'i' } },
          { headquarters: { $regex: search, $options: 'i' } },
        ]
      }

      // Get constituencies with pagination
      const constituencies = await Constituency.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('assemblyId', 'name type level')
        .populate('districtId', 'name region')
        .populate('currentRepresentative', 'name position party')

      // Get total count
      const total = await Constituency.countDocuments(filter)

      return {
        data: constituencies,
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
      logger.error('Error fetching constituencies:', error)
      throw error
    }
  }

  /**
   * Get constituency by ID
   */
  static async getConstituencyById(id: string) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new AppError(400, 'Invalid constituency ID')
      }

      const constituency = await Constituency.findById(id)
        .populate('assemblyId', 'name type level totalSeats currentSession')
        .populate('districtId', 'name region country population')
        .populate('currentRepresentative', 'name position party term averageRating')

      if (!constituency) {
        throw new AppError(404, 'Constituency not found')
      }

      return constituency
    } catch (error) {
      logger.error(`Error fetching constituency with ID ${id}:`, error)
      throw error
    }
  }

  /**
   * Get constituencies by assembly
   */
  static async getConstituenciesByAssembly(
    assemblyId: string,
    options: {
      type?: 'federal' | 'provincial'
      reservedFor?: string
      active?: boolean
    } = {}
  ) {
    try {
      if (!Types.ObjectId.isValid(assemblyId)) {
        throw new AppError(400, 'Invalid assembly ID')
      }

      const { type, reservedFor, active } = options

      const filter: any = { assemblyId: new Types.ObjectId(assemblyId) }
      if (type) filter.type = type
      if (reservedFor) filter.reservedFor = reservedFor
      if (active !== undefined) filter.active = active

      const constituencies = await Constituency.find(filter)
        .sort('name')
        .populate('districtId', 'name')
        .populate('currentRepresentative', 'name party')

      return constituencies
    } catch (error) {
      logger.error(`Error fetching constituencies for assembly ${assemblyId}:`, error)
      throw error
    }
  }

  /**
   * Get current representative for constituency
   */
  static async getCurrentRepresentative(constituencyId: string) {
    try {
      if (!Types.ObjectId.isValid(constituencyId)) {
        throw new AppError(400, 'Invalid constituency ID')
      }

      const representative = await Official.findOne({
        constituencyId: new Types.ObjectId(constituencyId),
        'term.end': { $gte: new Date() },
        active: true,
      }).populate('constituencyId', 'name type')

      return representative
    } catch (error) {
      logger.error(`Error fetching representative for constituency ${constituencyId}:`, error)
      throw error
    }
  }

  /**
   * Get constituency statistics
   */
  static async getConstituencyStatistics(constituencyId: string) {
    try {
      if (!Types.ObjectId.isValid(constituencyId)) {
        throw new AppError(400, 'Invalid constituency ID')
      }

      const constituency = await Constituency.findById(constituencyId)
      if (!constituency) {
        throw new AppError(404, 'Constituency not found')
      }

      // Get current representative
      const representative = await this.getCurrentRepresentative(constituencyId)

      // Get campaigns count
      const campaignsCount = await Campaign.countDocuments({
        constituency: constituency.name,
      })

      // Get active campaigns count
      const activeCampaignsCount = await Campaign.countDocuments({
        constituency: constituency.name,
        status: 'active',
      })

      // Get users in constituency count
      const usersCount = await User.countDocuments({
        constituency: constituency.name,
      })

      return {
        constituency: {
          name: constituency.name,
          type: constituency.type,
          population: constituency.population || 0,
          area: constituency.area || 0,
        },
        representative: representative
          ? {
              name: representative.name,
              party: representative.party,
              averageRating: representative.averageRating?.overall || 0,
              termStart: representative.term.start,
              termEnd: representative.term.end,
            }
          : null,
        campaigns: {
          total: campaignsCount,
          active: activeCampaignsCount,
        },
        engagement: {
          registeredVoters: usersCount,
          voterDensity: constituency.population
            ? Math.round((usersCount / constituency.population) * 100)
            : 0,
        },
      }
    } catch (error) {
      logger.error(`Error getting statistics for constituency ${constituencyId}:`, error)
      throw error
    }
  }

  /**
   * Create a new constituency (admin only)
   */
  static async createConstituency(data: {
    name: string
    code: string
    type: 'federal' | 'provincial'
    assemblyId: string
    districtId: string
    population?: number
    area?: number
    reservedFor?: 'general' | 'women' | 'dalit' | 'madhesi' | 'muslim' | 'other'
    headquarters?: string
    description?: string
    active?: boolean
  }) {
    try {
      // Validate assembly exists
      const assembly = await Assembly.findById(data.assemblyId)
      if (!assembly) {
        throw new AppError(404, 'Assembly not found')
      }

      // Validate district exists
      const district = await require('../models').District.findById(data.districtId)
      if (!district) {
        throw new AppError(404, 'District not found')
      }

      // Check if code already exists
      const existingConstituency = await Constituency.findOne({ code: data.code })
      if (existingConstituency) {
        throw new AppError(409, 'Constituency code already exists')
      }

      const constituency = new Constituency({
        _id: new Types.ObjectId(),
        ...data,
        assemblyId: new Types.ObjectId(data.assemblyId),
        districtId: new Types.ObjectId(data.districtId),
        active: data.active !== undefined ? data.active : true,
      })

      await constituency.save()
      return constituency
    } catch (error) {
      logger.error('Error creating constituency:', error)
      throw error
    }
  }

  /**
   * Update constituency (admin only)
   */
  static async updateConstituency(constituencyId: string, data: any) {
    try {
      if (!Types.ObjectId.isValid(constituencyId)) {
        throw new AppError(400, 'Invalid constituency ID')
      }

      // Check if code already exists for another constituency
      if (data.code) {
        const existingConstituency = await Constituency.findOne({
          code: data.code,
          _id: { $ne: constituencyId },
        })
        if (existingConstituency) {
          throw new AppError(409, 'Constituency code already exists')
        }
      }

      // Convert string IDs to ObjectIds
      if (data.assemblyId) data.assemblyId = new Types.ObjectId(data.assemblyId)
      if (data.districtId) data.districtId = new Types.ObjectId(data.districtId)

      const constituency = await Constituency.findByIdAndUpdate(
        constituencyId,
        { $set: data },
        { new: true, runValidators: true }
      )

      if (!constituency) {
        throw new AppError(404, 'Constituency not found')
      }

      return constituency
    } catch (error) {
      logger.error(`Error updating constituency ${constituencyId}:`, error)
      throw error
    }
  }

  /**
   * Search constituencies
   */
  static async searchConstituencies(
    query: string,
    options: {
      limit?: number
      type?: 'federal' | 'provincial'
      assemblyId?: string
    } = {}
  ) {
    try {
      const { limit = 10, type, assemblyId } = options

      const filter: any = {
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { code: { $regex: query, $options: 'i' } },
          { headquarters: { $regex: query, $options: 'i' } },
        ],
        active: true,
      }

      if (type) filter.type = type
      if (assemblyId) filter.assemblyId = new Types.ObjectId(assemblyId)

      const constituencies = await Constituency.find(filter)
        .limit(limit)
        .sort('name')
        .populate('assemblyId', 'name type')
        .populate('districtId', 'name')

      return constituencies
    } catch (error) {
      logger.error(`Error searching constituencies with query "${query}":`, error)
      throw error
    }
  }
}
