import { Types } from 'mongoose'
import { District, Official, Campaign, User } from '../models'
import { AppError } from '../middleware/error-handler'
import { logger } from '../utils/logger'

/**
 * Service handling districts-related business logic
 */
export class DistrictService {
  /**
   * Get all districts with pagination and filtering
   */
  static async getDistricts(options: {
    page?: number
    limit?: number
    sort?: string
    type?: 'federal' | 'provincial' | 'municipal' | 'other'
    region?: string
    country?: string
    active?: boolean
    search?: string
  }) {
    try {
      const {
        page = 1,
        limit = 10,
        sort = 'name',
        type,
        region,
        country = 'Nepal',
        active,
        search,
      } = options

      // Build filter
      const filter: any = { country }

      if (type) filter.type = type
      if (region) filter.region = region
      if (active !== undefined) filter.active = active

      // Add search functionality
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { code: { $regex: search, $options: 'i' } },
          { region: { $regex: search, $options: 'i' } },
        ]
      }

      // Get districts with pagination
      const districts = await District.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('parentDistrict', 'name code type')

      // Get total count
      const total = await District.countDocuments(filter)

      // Calculate pagination metadata
      const pages = Math.ceil(total / limit)
      const hasNext = page < pages
      const hasPrev = page > 1

      return {
        data: districts,
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
      logger.error('Error fetching districts:', error)
      throw error
    }
  }

  /**
   * Get district by ID
   */
  static async getDistrictById(id: string, options: { includeStats?: boolean } = {}): Promise<any> {
    try {
      // Validate ID
      if (!Types.ObjectId.isValid(id)) {
        throw new AppError(400, 'Invalid district ID')
      }

      // Get district
      const district = await District.findById(id)
        .populate('parentDistrict', 'name code type')
        .populate('childDistricts', 'name code type')

      if (!district) {
        throw new AppError(404, 'District not found')
      }

      // Include statistics if requested
      if (options.includeStats) {
        const stats = await this.getDistrictStatistics(id)
        return {
          ...district.toObject(),
          statistics: stats,
        }
      }

      return district
    } catch (error) {
      logger.error(`Error fetching district with ID ${id}:`, error)
      throw error
    }
  }

  /**
   * Get districts by region
   */
  static async getDistrictsByRegion(
    region: string,
    options: {
      type?: 'federal' | 'provincial' | 'municipal' | 'other'
      active?: boolean
      sort?: string
    } = {}
  ) {
    try {
      const { type, active, sort = 'name' } = options

      // Build filter
      const filter: any = { region }

      if (type) filter.type = type
      if (active !== undefined) filter.active = active

      // Get districts
      const districts = await District.find(filter).sort(sort)

      return districts
    } catch (error) {
      logger.error(`Error fetching districts for region ${region}:`, error)
      throw error
    }
  }

  /**
   * Get districts by type
   */
  static async getDistrictsByType(
    type: 'federal' | 'provincial' | 'municipal' | 'other',
    options: {
      region?: string
      country?: string
      active?: boolean
      sort?: string
    } = {}
  ) {
    try {
      const { region, country = 'Nepal', active, sort = 'name' } = options

      // Build filter
      const filter: any = { type, country }

      if (region) filter.region = region
      if (active !== undefined) filter.active = active

      // Get districts
      const districts = await District.find(filter).sort(sort)

      return districts
    } catch (error) {
      logger.error(`Error fetching districts for type ${type}:`, error)
      throw error
    }
  }

  /**
   * Get district statistics
   */
  static async getDistrictStatistics(districtId: string) {
    try {
      // Validate ID
      if (!Types.ObjectId.isValid(districtId)) {
        throw new AppError(400, 'Invalid district ID')
      }

      // Get district
      const district = await District.findById(districtId)

      if (!district) {
        throw new AppError(404, 'District not found')
      }

      // Get officials count
      const officialsCount = await Official.countDocuments({ district: district.name })

      // Get campaigns count
      const campaignsCount = await Campaign.countDocuments({ district: district.name })

      // Get active campaigns count
      const activeCampaignsCount = await Campaign.countDocuments({
        district: district.name,
        status: 'active',
      })

      // Get users in district count
      const usersCount = await User.countDocuments({ district: district.name })

      // Get campaign completion rate
      const completedCampaigns = await Campaign.countDocuments({
        district: district.name,
        status: 'completed',
      })

      const campaignCompletionRate =
        campaignsCount > 0 ? (completedCampaigns / campaignsCount) * 100 : 0

      // Get average official rating
      const officials = await Official.find({ district: district.name })
      let averageOfficialRating = 0

      if (officials.length > 0) {
        const totalRating = officials.reduce((sum, official) => {
          return sum + (official.averageRating?.overall || 0)
        }, 0)
        averageOfficialRating = totalRating / officials.length
      }

      return {
        population: district.population || 0,
        officials: {
          total: officialsCount,
          averageRating: Math.round(averageOfficialRating * 10) / 10,
        },
        campaigns: {
          total: campaignsCount,
          active: activeCampaignsCount,
          completed: completedCampaigns,
          completionRate: Math.round(campaignCompletionRate * 100) / 100,
        },
        users: {
          total: usersCount,
        },
        engagement: {
          campaignsPerCapita:
            district.population && district.population > 0
              ? Math.round((campaignsCount / district.population) * 10000) / 10000
              : 0,
          usersPerCapita:
            district.population && district.population > 0
              ? Math.round((usersCount / district.population) * 100) / 100
              : 0,
        },
      }
    } catch (error) {
      logger.error(`Error getting statistics for district ${districtId}:`, error)
      throw error
    }
  }

  /**
   * Get officials in a district
   */
  static async getDistrictOfficials(
    districtId: string,
    options: {
      page?: number
      limit?: number
      sort?: string
      position?: string
      party?: string
    } = {}
  ) {
    try {
      // Validate ID
      if (!Types.ObjectId.isValid(districtId)) {
        throw new AppError(400, 'Invalid district ID')
      }

      // Get district
      const district = await District.findById(districtId)

      if (!district) {
        throw new AppError(404, 'District not found')
      }

      const { page = 1, limit = 10, sort = '-averageRating.overall', position, party } = options

      // Build filter
      const filter: any = { district: district.name }

      if (position) filter.position = position
      if (party) filter.party = party

      // Get officials with pagination
      const officials = await Official.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)

      // Get total count
      const total = await Official.countDocuments(filter)

      return {
        data: officials,
        meta: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
        district: {
          id: district._id,
          name: district.name,
          type: district.type,
          region: district.region,
        },
      }
    } catch (error) {
      logger.error(`Error fetching officials for district ${districtId}:`, error)
      throw error
    }
  }

  /**
   * Get campaigns in a district
   */
  static async getDistrictCampaigns(
    districtId: string,
    options: {
      page?: number
      limit?: number
      sort?: string
      status?: 'draft' | 'active' | 'completed' | 'archived'
      category?: string
    } = {}
  ) {
    try {
      // Validate ID
      if (!Types.ObjectId.isValid(districtId)) {
        throw new AppError(400, 'Invalid district ID')
      }

      // Get district
      const district = await District.findById(districtId)

      if (!district) {
        throw new AppError(404, 'District not found')
      }

      const { page = 1, limit = 10, sort = '-currentSupport', status, category } = options

      // Build filter
      const filter: any = { district: district.name }

      if (status) filter.status = status
      if (category) filter.category = category

      // Get campaigns with pagination
      const campaigns = await Campaign.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('creatorId', 'firstName lastName')

      // Get total count
      const total = await Campaign.countDocuments(filter)

      return {
        data: campaigns,
        meta: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
        district: {
          id: district._id,
          name: district.name,
          type: district.type,
          region: district.region,
        },
      }
    } catch (error) {
      logger.error(`Error fetching campaigns for district ${districtId}:`, error)
      throw error
    }
  }

  /**
   * Search districts
   */
  static async searchDistricts(
    query: string,
    options: {
      limit?: number
      type?: 'federal' | 'provincial' | 'municipal' | 'other'
      region?: string
    } = {}
  ) {
    try {
      const { limit = 10, type, region } = options

      // Build filter
      const filter: any = {
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { code: { $regex: query, $options: 'i' } },
          { region: { $regex: query, $options: 'i' } },
        ],
        active: true, // Only search active districts
      }

      if (type) filter.type = type
      if (region) filter.region = region

      // Search districts
      const districts = await District.find(filter).limit(limit).sort('name')

      return districts
    } catch (error) {
      logger.error(`Error searching districts with query "${query}":`, error)
      throw error
    }
  }

  /**
   * Get all regions
   */
  static async getRegions(options: { country?: string } = {}) {
    try {
      const { country = 'Nepal' } = options

      // Get distinct regions
      const regions = await District.distinct('region', { country, active: true })

      // Get region statistics
      const regionStats = await District.aggregate([
        { $match: { country, active: true } },
        {
          $group: {
            _id: '$region',
            districts: { $sum: 1 },
            municipalDistricts: {
              $sum: { $cond: [{ $eq: ['$type', 'municipal'] }, 1, 0] },
            },
            provincialDistricts: {
              $sum: { $cond: [{ $eq: ['$type', 'provincial'] }, 1, 0] },
            },
            federalDistricts: {
              $sum: { $cond: [{ $eq: ['$type', 'federal'] }, 1, 0] },
            },
            totalPopulation: { $sum: '$population' },
          },
        },
        { $sort: { _id: 1 } },
      ])

      return regionStats.map((stat) => ({
        name: stat._id,
        districts: stat.districts,
        breakdown: {
          municipal: stat.municipalDistricts,
          provincial: stat.provincialDistricts,
          federal: stat.federalDistricts,
          other:
            stat.districts -
            stat.municipalDistricts -
            stat.provincialDistricts -
            stat.federalDistricts,
        },
        population: stat.totalPopulation || 0,
      }))
    } catch (error) {
      logger.error('Error fetching regions:', error)
      throw error
    }
  }

  // Admin-only methods below

  /**
   * Create a new district (admin only)
   */
  static async createDistrict(data: {
    name: string
    code: string
    type: 'federal' | 'provincial' | 'municipal' | 'other'
    region: string
    country?: string
    population?: number
    parentDistrict?: string
    boundaries?: any
    active?: boolean
  }) {
    try {
      // Check if code already exists
      const existingDistrict = await District.findOne({ code: data.code })

      if (existingDistrict) {
        throw new AppError(409, 'District code already exists')
      }

      // Validate parent district if provided
      if (data.parentDistrict) {
        if (!Types.ObjectId.isValid(data.parentDistrict)) {
          throw new AppError(400, 'Invalid parent district ID')
        }

        const parentDistrict = await District.findById(data.parentDistrict)

        if (!parentDistrict) {
          throw new AppError(404, 'Parent district not found')
        }
      }

      // Create new district
      const district = new District({
        _id: new Types.ObjectId(),
        ...data,
        country: data.country || 'Nepal',
        active: data.active !== undefined ? data.active : true,
        parentDistrict: data.parentDistrict ? new Types.ObjectId(data.parentDistrict) : undefined,
      })

      // Save district
      await district.save()

      return district
    } catch (error) {
      logger.error('Error creating district:', error)
      throw error
    }
  }

  /**
   * Update a district (admin only)
   */
  static async updateDistrict(
    districtId: string,
    data: {
      name?: string
      code?: string
      type?: 'federal' | 'provincial' | 'municipal' | 'other'
      region?: string
      country?: string
      population?: number
      parentDistrict?: string
      boundaries?: any
      active?: boolean
    }
  ) {
    try {
      // Validate ID
      if (!Types.ObjectId.isValid(districtId)) {
        throw new AppError(400, 'Invalid district ID')
      }

      // Check if code already exists for another district
      if (data.code) {
        const existingDistrict = await District.findOne({
          code: data.code,
          _id: { $ne: districtId },
        })

        if (existingDistrict) {
          throw new AppError(409, 'District code already exists')
        }
      }

      // Validate parent district if provided
      if (data.parentDistrict) {
        if (!Types.ObjectId.isValid(data.parentDistrict)) {
          throw new AppError(400, 'Invalid parent district ID')
        }

        // Prevent self-referencing
        if (data.parentDistrict === districtId) {
          throw new AppError(400, 'District cannot be its own parent')
        }

        const parentDistrict = await District.findById(data.parentDistrict)

        if (!parentDistrict) {
          throw new AppError(404, 'Parent district not found')
        }
      }

      // Update district
      const updateData: any = { ...data }
      if (data.parentDistrict) {
        updateData.parentDistrict = new Types.ObjectId(data.parentDistrict)
      }

      const district = await District.findByIdAndUpdate(
        districtId,
        { $set: updateData },
        { new: true, runValidators: true }
      )

      if (!district) {
        throw new AppError(404, 'District not found')
      }

      return district
    } catch (error) {
      logger.error(`Error updating district ${districtId}:`, error)
      throw error
    }
  }

  /**
   * Delete a district (admin only)
   */
  static async deleteDistrict(districtId: string) {
    try {
      // Validate ID
      if (!Types.ObjectId.isValid(districtId)) {
        throw new AppError(400, 'Invalid district ID')
      }

      // Check if district has child districts
      const childDistricts = await District.find({ parentDistrict: districtId })

      if (childDistricts.length > 0) {
        throw new AppError(400, 'Cannot delete district that has child districts')
      }

      // Check if district has officials
      const district = await District.findById(districtId)

      if (!district) {
        throw new AppError(404, 'District not found')
      }

      const officialsCount = await Official.countDocuments({ district: district.name })

      if (officialsCount > 0) {
        throw new AppError(400, 'Cannot delete district that has officials')
      }

      // Check if district has campaigns
      const campaignsCount = await Campaign.countDocuments({ district: district.name })

      if (campaignsCount > 0) {
        throw new AppError(400, 'Cannot delete district that has campaigns')
      }

      // Delete district
      await District.findByIdAndDelete(districtId)

      return { success: true }
    } catch (error) {
      logger.error(`Error deleting district ${districtId}:`, error)
      throw error
    }
  }

  /**
   * Bulk import districts (admin only)
   */
  static async bulkImportDistricts(
    districts: Array<{
      name: string
      code: string
      type: 'federal' | 'provincial' | 'municipal' | 'other'
      region: string
      country?: string
      population?: number
      parentDistrict?: string
      active?: boolean
    }>
  ) {
    try {
      const results = {
        created: 0,
        skipped: 0,
        errors: [] as Array<{ district: any; error: string }>,
      }

      // Process districts in batches
      for (const districtData of districts) {
        try {
          // Check if district already exists
          const existingDistrict = await District.findOne({ code: districtData.code })

          if (existingDistrict) {
            results.skipped++
            continue
          }

          // Validate parent district if provided
          let parentDistrictId = undefined
          if (districtData.parentDistrict) {
            const parentDistrict = await District.findOne({ code: districtData.parentDistrict })
            if (parentDistrict) {
              parentDistrictId = parentDistrict._id
            }
          }

          // Create district
          const district = new District({
            _id: new Types.ObjectId(),
            ...districtData,
            country: districtData.country || 'Nepal',
            active: districtData.active !== undefined ? districtData.active : true,
            parentDistrict: parentDistrictId,
          })

          await district.save()
          results.created++
        } catch (error) {
          results.errors.push({
            district: districtData,
            error: (error as Error).message,
          })
        }
      }

      return results
    } catch (error) {
      logger.error('Error bulk importing districts:', error)
      throw error
    }
  }

  /**
   * Toggle district active status (admin only)
   */
  static async toggleDistrictActive(districtId: string) {
    try {
      // Validate ID
      if (!Types.ObjectId.isValid(districtId)) {
        throw new AppError(400, 'Invalid district ID')
      }

      // Get district
      const district = await District.findById(districtId)

      if (!district) {
        throw new AppError(404, 'District not found')
      }

      // Toggle active status
      district.active = !district.active

      // Save district
      await district.save()

      return district
    } catch (error) {
      logger.error(`Error toggling active status for district ${districtId}:`, error)
      throw error
    }
  }

  /**
   * Get district hierarchy (admin utility)
   */
  static async getDistrictHierarchy(country: string = 'Nepal') {
    try {
      // Get all districts for the country
      const districts = await District.find({ country }).sort('name')

      // Build hierarchy
      const hierarchy: any = {}

      districts.forEach((district) => {
        if (!hierarchy[district.region]) {
          hierarchy[district.region] = {
            name: district.region,
            federal: [],
            provincial: [],
            municipal: [],
            other: [],
          }
        }

        const districtData = {
          id: district._id,
          name: district.name,
          code: district.code,
          population: district.population,
          active: district.active,
          childDistricts: districts
            .filter((d) => d.parentDistrict?.toString() === district._id.toString())
            .map((d) => ({
              id: d._id,
              name: d.name,
              code: d.code,
              type: d.type,
            })),
        }

        hierarchy[district.region][district.type].push(districtData)
      })

      return hierarchy
    } catch (error) {
      logger.error(`Error getting district hierarchy for country ${country}:`, error)
      throw error
    }
  }

  /**
   * Validate district boundaries (admin utility)
   */
  static async validateDistrictBoundaries(districtId: string) {
    try {
      // Validate ID
      if (!Types.ObjectId.isValid(districtId)) {
        throw new AppError(400, 'Invalid district ID')
      }

      // Get district
      const district = await District.findById(districtId)

      if (!district) {
        throw new AppError(404, 'District not found')
      }

      // Check if boundaries exist
      if (!district.boundaries) {
        return {
          valid: false,
          reason: 'No boundaries defined',
        }
      }

      // Basic validation for GeoJSON format
      const boundaries = district.boundaries

      if (boundaries.type !== 'Polygon') {
        return {
          valid: false,
          reason: 'Boundaries must be of type Polygon',
        }
      }

      if (!Array.isArray(boundaries.coordinates) || boundaries.coordinates.length === 0) {
        return {
          valid: false,
          reason: 'Invalid coordinates format',
        }
      }

      // Check each polygon
      for (const polygon of boundaries.coordinates) {
        if (!Array.isArray(polygon) || polygon.length < 3) {
          return {
            valid: false,
            reason: 'Each polygon must have at least 3 coordinates',
          }
        }

        // Check coordinate format
        for (const coordinate of polygon) {
          if (!Array.isArray(coordinate) || coordinate.length !== 2) {
            return {
              valid: false,
              reason: 'Each coordinate must be an array of [longitude, latitude]',
            }
          }

          const [lng, lat] = coordinate
          if (typeof lng !== 'number' || typeof lat !== 'number') {
            return {
              valid: false,
              reason: 'Longitude and latitude must be numbers',
            }
          }

          // Basic range check for Nepal
          if (lng < 80 || lng > 89 || lat < 26 || lat > 31) {
            return {
              valid: false,
              reason: 'Coordinates appear to be outside Nepal',
            }
          }
        }
      }

      return {
        valid: true,
        reason: 'Boundaries are valid',
      }
    } catch (error) {
      logger.error(`Error validating boundaries for district ${districtId}:`, error)
      throw error
    }
  }
}
