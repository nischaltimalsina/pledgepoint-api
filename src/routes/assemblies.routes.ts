import { Router } from 'express'
import { AssemblyController } from '../controllers/assembly.controller'
import { AuthMiddleware } from '../middleware/auth'
import { validate } from '../middleware/validation'
import { RateLimiter } from '../middleware/rate-limiter'
import { z } from 'zod'

const router = Router()

// Validation schemas
const AssemblyValidation = {
  create: z.object({
    name: z.string().min(2).max(150),
    type: z.enum(['federal', 'provincial']),
    level: z.enum(['house_of_representatives', 'national_assembly', 'provincial_assembly']),
    province: z.string().max(100).optional(),
    totalSeats: z.number().min(1),
    electedSeats: z.number().min(1),
    nominatedSeats: z.number().min(0).optional(),
    reservedSeats: z
      .object({
        women: z.number().min(0).optional(),
        dalit: z.number().min(0).optional(),
        disadvantaged: z.number().min(0).optional(),
      })
      .optional(),
    currentSession: z.object({
      number: z.number().min(1),
      startDate: z.string().or(z.date()),
      endDate: z.string().or(z.date()).optional(),
      status: z.enum(['upcoming', 'ongoing', 'completed', 'dissolved']),
      description: z.string().max(500).optional(),
    }),
    headquarters: z.string().min(2).max(200),
    establishedDate: z.string().or(z.date()),
    description: z.string().max(1000).optional(),
    website: z.string().url().optional(),
    contactInfo: z
      .object({
        phone: z.string().optional(),
        email: z.string().email().optional(),
        address: z.string().max(300).optional(),
      })
      .optional(),
  }),

  update: z.object({
    name: z.string().min(2).max(150).optional(),
    type: z.enum(['federal', 'provincial']).optional(),
    level: z
      .enum(['house_of_representatives', 'national_assembly', 'provincial_assembly'])
      .optional(),
    province: z.string().max(100).optional(),
    totalSeats: z.number().min(1).optional(),
    electedSeats: z.number().min(1).optional(),
    nominatedSeats: z.number().min(0).optional(),
    reservedSeats: z
      .object({
        women: z.number().min(0).optional(),
        dalit: z.number().min(0).optional(),
        disadvantaged: z.number().min(0).optional(),
      })
      .optional(),
    currentSession: z
      .object({
        number: z.number().min(1).optional(),
        startDate: z.string().or(z.date()).optional(),
        endDate: z.string().or(z.date()).optional(),
        status: z.enum(['upcoming', 'ongoing', 'completed', 'dissolved']).optional(),
        description: z.string().max(500).optional(),
      })
      .optional(),
    headquarters: z.string().min(2).max(200).optional(),
    description: z.string().max(1000).optional(),
    website: z.string().url().optional(),
    contactInfo: z
      .object({
        phone: z.string().optional(),
        email: z.string().email().optional(),
        address: z.string().max(300).optional(),
      })
      .optional(),
  }),
}

// Public routes
router.get('/', AssemblyController.getAssemblies)
router.get('/federal/current', AssemblyController.getCurrentFederalStructure)
router.get('/type/:type', AssemblyController.getAssembliesByType)
router.get('/:id', AssemblyController.getAssemblyById)

// Admin routes
router.post(
  '/',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['admin', 'superadmin']),
  validate(AssemblyValidation.create),
  AssemblyController.createAssembly
)

router.put(
  '/:id',
  RateLimiter.apiLimiter,
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['admin', 'superadmin']),
  validate(AssemblyValidation.update),
  AssemblyController.updateAssembly
)

export default router
