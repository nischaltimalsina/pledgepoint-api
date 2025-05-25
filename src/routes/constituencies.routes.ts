import { Router } from 'express'
import { ConstituencyController } from '../controllers/constituency.controller'
import { AuthMiddleware } from '../middleware/auth'
import { validate } from '../middleware/validation'
import { RateLimiter } from '../middleware/rate-limiter'
import { z } from 'zod'

const router = Router()

// Validation schemas
const ConstituencyValidation = {
  create: z.object({
    name: z.string().min(2).max(100),
    code: z.string().min(2).max(10),
    type: z.enum(['federal', 'provincial']),
    assemblyId: z.string().min(1, 'Assembly ID is required'),
    districtId: z.string().min(1, 'District ID is required'),
    population: z.number().min(0).optional(),
    area: z.number().min(0).optional(),
    reservedFor: z.enum(['general', 'women', 'dalit', 'madhesi', 'muslim', 'other']).optional(),
    headquarters: z.string().max(100).optional(),
    description: z.string().max(500).optional(),
    active: z.boolean().optional(),
  }),

  update: z.object({
    name: z.string().min(2).max(100).optional(),
    code: z.string().min(2).max(10).optional(),
    type: z.enum(['federal', 'provincial']).optional(),
    assemblyId: z.string().optional(),
    districtId: z.string().optional(),
    population: z.number().min(0).optional(),
    area: z.number().min(0).optional(),
    reservedFor: z.enum(['general', 'women', 'dalit', 'madhesi', 'muslim', 'other']).optional(),
    headquarters: z.string().max(100).optional(),
    description: z.string().max(500).optional(),
    active: z.boolean().optional(),
  }),
}

// Public routes
router.get('/', ConstituencyController.getConstituencies)
router.get('/search', ConstituencyController.searchConstituencies)
router.get('/assembly/:assemblyId', ConstituencyController.getConstituenciesByAssembly)
router.get('/district/:districtId', ConstituencyController.getConstituenciesByDistrict)
router.get('/type/:type', ConstituencyController.getConstituenciesByType)
router.get('/:id', ConstituencyController.getConstituencyById)
router.get('/:id/representative', ConstituencyController.getCurrentRepresentative)
router.get('/:id/statistics', ConstituencyController.getConstituencyStatistics)

// Admin routes
router.post(
  '/',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['admin', 'superadmin']),
  validate(ConstituencyValidation.create),
  ConstituencyController.createConstituency
)

router.put(
  '/:id',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['admin', 'superadmin']),
  validate(ConstituencyValidation.update),
  ConstituencyController.updateConstituency
)

router.delete(
  '/:id',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['admin', 'superadmin']),
  ConstituencyController.deleteConstituency
)

router.patch(
  '/:id/toggle-active',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['admin', 'superadmin']),
  ConstituencyController.toggleConstituencyActive
)

export default router
