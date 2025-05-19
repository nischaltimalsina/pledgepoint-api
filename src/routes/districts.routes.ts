import { Router } from 'express'
import { DistrictController } from '../controllers/district.controller'
import { AuthMiddleware } from '../middleware/auth'
import { validate } from '../middleware/validation'
import { RateLimiter } from '../middleware/rate-limiter'
import { z } from 'zod'

const router = Router()

// Validation schemas for districts
const DistrictValidation = {
  create: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    code: z.string().min(2, 'Code must be at least 2 characters').max(10),
    type: z.enum(['federal', 'provincial', 'municipal', 'other']),
    region: z.string().min(2, 'Region must be at least 2 characters').max(100),
    country: z.string().optional(),
    population: z.number().min(0).optional(),
    parentDistrict: z.string().optional(),
    boundaries: z
      .object({
        type: z.literal('Polygon'),
        coordinates: z.array(z.array(z.array(z.number()))),
      })
      .optional(),
    active: z.boolean().optional(),
  }),

  update: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100).optional(),
    code: z.string().min(2, 'Code must be at least 2 characters').max(10).optional(),
    type: z.enum(['federal', 'provincial', 'municipal', 'other']).optional(),
    region: z.string().min(2, 'Region must be at least 2 characters').max(100).optional(),
    country: z.string().optional(),
    population: z.number().min(0).optional(),
    parentDistrict: z.string().optional(),
    boundaries: z
      .object({
        type: z.literal('Polygon'),
        coordinates: z.array(z.array(z.array(z.number()))),
      })
      .optional(),
    active: z.boolean().optional(),
  }),

  bulkImport: z.object({
    districts: z.array(
      z.object({
        name: z.string().min(2).max(100),
        code: z.string().min(2).max(10),
        type: z.enum(['federal', 'provincial', 'municipal', 'other']),
        region: z.string().min(2).max(100),
        country: z.string().optional(),
        population: z.number().min(0).optional(),
        parentDistrict: z.string().optional(),
        active: z.boolean().optional(),
      })
    ),
  }),
}

// Public routes (no authentication required)

// Get all districts with filtering and pagination
router.get('/', DistrictController.getDistricts)

// Get district by ID
router.get('/:id', DistrictController.getDistrictById)

// Get districts by region
router.get('/region/:region', DistrictController.getDistrictsByRegion)

// Get districts by type
router.get('/type/:type', DistrictController.getDistrictsByType)

// Search districts
router.get('/search', DistrictController.searchDistricts)

// Get all regions
router.get('/regions', DistrictController.getRegions)

// Get district statistics
router.get('/:id/statistics', DistrictController.getDistrictStatistics)

// Get officials in a district
router.get('/:id/officials', DistrictController.getDistrictOfficials)

// Get campaigns in a district
router.get('/:id/campaigns', DistrictController.getDistrictCampaigns)

// Admin-only routes (require authentication and admin role)

// Create a new district
router.post(
  '/',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['admin', 'superadmin']),
  validate(DistrictValidation.create),
  DistrictController.createDistrict
)

// Update a district
router.put(
  '/:id',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['admin', 'superadmin']),
  validate(DistrictValidation.update),
  DistrictController.updateDistrict
)

// Delete a district
router.delete(
  '/:id',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['admin', 'superadmin']),
  DistrictController.deleteDistrict
)

// Bulk import districts
router.post(
  '/bulk-import',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['admin', 'superadmin']),
  validate(DistrictValidation.bulkImport),
  DistrictController.bulkImportDistricts
)

// Toggle district active status
router.patch(
  '/:id/toggle-active',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['admin', 'superadmin']),
  DistrictController.toggleDistrictActive
)

// Get district hierarchy (admin utility)
router.get(
  '/admin/hierarchy',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['admin', 'superadmin']),
  async (req, res, next) => {
    try {
      const { DistrictService } = await import('../services/district.service')
      const { country } = req.query

      const hierarchy = await DistrictService.getDistrictHierarchy(country as string)

      res.status(200).json({
        data: hierarchy,
      })
    } catch (error) {
      next(error)
    }
  }
)

// Validate district boundaries (admin utility)
router.get(
  '/:id/validate-boundaries',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['admin', 'superadmin']),
  async (req, res, next) => {
    try {
      const { DistrictService } = await import('../services/district.service')
      const { id } = req.params

      const validation = await DistrictService.validateDistrictBoundaries(id)

      res.status(200).json({
        data: validation,
      })
    } catch (error) {
      next(error)
    }
  }
)

export default router
