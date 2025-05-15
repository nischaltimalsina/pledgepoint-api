import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { AppError } from './error-handler'

/**
 * Middleware factory for validating request data using Zod schemas
 * @param schema Zod schema for validation
 * @param source Where to look for data to validate ('body', 'query', 'params', or a combination)
 */
export const validate = (
  schema: z.ZodTypeAny,
  source: 'body' | 'query' | 'params' | 'all' = 'body'
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      let dataToValidate: any

      // Get data from specified source
      switch (source) {
        case 'body':
          dataToValidate = req.body
          break
        case 'query':
          dataToValidate = req.query
          break
        case 'params':
          dataToValidate = req.params
          break
        case 'all':
          dataToValidate = {
            body: req.body,
            query: req.query,
            params: req.params,
          }
          break
        default:
          dataToValidate = req.body
      }

      // Validate data
      const result = schema.safeParse(dataToValidate)

      if (!result.success) {
        // Format validation errors
        const formattedErrors = formatZodErrors(result.error)

        return next(new AppError(400, 'Validation failed', true, formattedErrors))
      }

      // If validation passes, replace source with validated data
      if (source === 'all') {
        req.body = result.data.body
        req.query = result.data.query
        req.params = result.data.params
      } else {
        switch (source) {
          case 'body':
            req.body = result.data
            break
          case 'query':
            req.query = result.data
            break
          case 'params':
            req.params = result.data
            break
        }
      }

      next()
    } catch (error) {
      next(new AppError(500, 'Validation error', true, (error as Error).message))
    }
  }
}

/**
 * Format Zod errors into a more user-friendly format
 */
const formatZodErrors = (error: z.ZodError) => {
  const errors: Record<string, string> = {}

  for (const issue of error.issues) {
    // Join the path to create a key for nested objects
    const key = issue.path.join('.')
    errors[key] = issue.message
  }

  return {
    errors,
    message: 'Validation failed',
  }
}

/**
 * Common validation schemas
 */
export const ValidationSchemas = {
  // User schemas
  user: {
    register: z
      .object({
        firstName: z.string().min(2, 'First name must be at least 2 characters').max(50),
        lastName: z.string().min(2, 'Last name must be at least 2 characters').max(50),
        email: z.string().email('Invalid email address'),
        password: z
          .string()
          .min(8, 'Password must be at least 8 characters')
          .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
          .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
          .regex(/[0-9]/, 'Password must contain at least one number')
          .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
        confirmPassword: z.string(),
      })
      .refine((data) => data.password === data.confirmPassword, {
        message: 'Passwords do not match',
        path: ['confirmPassword'],
      }),

    login: z.object({
      email: z.string().email('Invalid email address'),
      password: z.string().min(1, 'Password is required'),
      twoFactorToken: z.string().optional(),
    }),

    forgotPassword: z.object({
      email: z.string().email('Invalid email address'),
    }),

    resetPassword: z
      .object({
        token: z.string().min(1, 'Token is required'),
        password: z
          .string()
          .min(8, 'Password must be at least 8 characters')
          .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
          .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
          .regex(/[0-9]/, 'Password must contain at least one number')
          .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
        confirmPassword: z.string(),
      })
      .refine((data) => data.password === data.confirmPassword, {
        message: 'Passwords do not match',
        path: ['confirmPassword'],
      }),

    updateProfile: z.object({
      firstName: z.string().min(2, 'First name must be at least 2 characters').max(50).optional(),
      lastName: z.string().min(2, 'Last name must be at least 2 characters').max(50).optional(),
      district: z.string().optional(),
      location: z.string().optional(),
      bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
    }),

    changePassword: z
      .object({
        currentPassword: z.string().min(1, 'Current password is required'),
        newPassword: z
          .string()
          .min(8, 'Password must be at least 8 characters')
          .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
          .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
          .regex(/[0-9]/, 'Password must contain at least one number')
          .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
        confirmPassword: z.string(),
      })
      .refine((data) => data.newPassword === data.confirmPassword, {
        message: 'Passwords do not match',
        path: ['confirmPassword'],
      }),

    // Add two-factor validation schemas
    twoFactorVerify: z.object({
      verificationCode: z.string().min(6, 'Verification code must be at least 6 characters'),
    }),

    twoFactorDisable: z.object({
      password: z.string().min(1, 'Password is required'),
    }),
  },

  // Official schemas
  official: {
    create: z.object({
      name: z.string().min(2, 'Name must be at least 2 characters').max(100),
      position: z.string().min(2, 'Position must be at least 2 characters').max(100),
      district: z.string().min(2, 'District must be at least 2 characters').max(100),
      party: z.string().min(1, 'Party is required').max(100),
      term: z.object({
        start: z.string().or(z.date()),
        end: z.string().or(z.date()),
      }),
      contactInfo: z
        .object({
          email: z.string().email('Invalid email address').optional(),
          phone: z.string().optional(),
          address: z.string().optional(),
          website: z.string().url('Invalid website URL').optional(),
          socialMedia: z
            .object({
              facebook: z.string().url('Invalid Facebook URL').optional(),
              twitter: z.string().url('Invalid Twitter URL').optional(),
              instagram: z.string().url('Invalid Instagram URL').optional(),
            })
            .optional(),
        })
        .optional(),
      bio: z.string().max(1000, 'Bio must be less than 1000 characters').optional(),
      photo: z.string().optional(),
    }),

    rate: z.object({
      integrity: z.number().min(1).max(5),
      responsiveness: z.number().min(1).max(5),
      effectiveness: z.number().min(1).max(5),
      transparency: z.number().min(1).max(5),
      comment: z.string().min(10, 'Comment must be at least 10 characters').max(1000),
      evidence: z.string().url('Evidence must be a valid URL'),
    }),

    update: z.object({
      name: z.string().min(2, 'Name must be at least 2 characters').max(100).optional(),
      position: z.string().min(2, 'Position must be at least 2 characters').max(100).optional(),
      district: z.string().min(2, 'District must be at least 2 characters').max(100).optional(),
      party: z.string().min(1, 'Party is required').max(100).optional(),
      term: z
        .object({
          start: z.string().or(z.date()),
          end: z.string().or(z.date()),
        })
        .optional(),
      contactInfo: z
        .object({
          email: z.string().email('Invalid email address').optional(),
          phone: z.string().optional(),
          address: z.string().optional(),
          website: z.string().url('Invalid website URL').optional(),
          socialMedia: z
            .object({
              facebook: z.string().url('Invalid Facebook URL').optional(),
              twitter: z.string().url('Invalid Twitter URL').optional(),
              instagram: z.string().url('Invalid Instagram URL').optional(),
            })
            .optional(),
        })
        .optional(),
      bio: z.string().max(1000, 'Bio must be less than 1000 characters').optional(),
      photo: z.string().optional(),
    }),
  },

  // Promise schemas
  promise: {
    create: z.object({
      officialId: z.string().min(1, 'Official ID is required'),
      title: z.string().min(5, 'Title must be at least 5 characters').max(200),
      description: z.string().min(10, 'Description must be at least 10 characters').max(1000),
      category: z.string().min(1, 'Category is required'),
      datePromised: z.string().or(z.date()),
      source: z.string().url('Source must be a valid URL'),
    }),

    addEvidence: z.object({
      description: z.string().min(10, 'Description must be at least 10 characters').max(1000),
      source: z.string().url('Source must be a valid URL'),
      status: z.enum(['supporting', 'opposing']),
    }),

    addComment: z.object({
      text: z.string().min(5, 'Comment must be at least 5 characters').max(500),
    }),

    update: z.object({
      title: z.string().min(5, 'Title must be at least 5 characters').max(200).optional(),
      description: z
        .string()
        .min(10, 'Description must be at least 10 characters')
        .max(1000)
        .optional(),
      category: z.string().optional(),
      datePromised: z.string().or(z.date()).optional(),
      source: z.string().url('Source must be a valid URL').optional(),
      status: z.enum(['kept', 'broken', 'in-progress', 'unverified']).optional(),
    }),
  },

  // Campaign schemas
  campaign: {
    create: z.object({
      title: z.string().min(5, 'Title must be at least 5 characters').max(200),
      description: z.string().min(10, 'Description must be at least 10 characters').max(1000),
      category: z.string().min(1, 'Category is required'),
      district: z.string().min(1, 'District is required'),
      goal: z.number().min(10, 'Goal must be at least 10 supporters'),
      image: z.string().optional(),
    }),

    update: z.object({
      title: z.string().min(5, 'Title must be at least 5 characters').max(200).optional(),
      description: z
        .string()
        .min(10, 'Description must be at least 10 characters')
        .max(1000)
        .optional(),
      category: z.string().optional(),
      district: z.string().optional(),
      goal: z.number().min(10, 'Goal must be at least 10 supporters').optional(),
      status: z.enum(['draft', 'active', 'completed', 'archived']).optional(),
      image: z.string().optional(),
    }),

    addUpdate: z.object({
      content: z.string().min(10, 'Update must be at least 10 characters').max(1000),
    }),

    addDiscussion: z.object({
      content: z.string().min(10, 'Discussion must be at least 10 characters').max(1000),
    }),

    addReply: z.object({
      content: z.string().min(5, 'Reply must be at least 5 characters').max(500),
    }),
  },

  // Learning module schemas
  learning: {
    createModule: z.object({
      title: z.string().min(5, 'Title must be at least 5 characters').max(200),
      description: z.string().min(10, 'Description must be at least 10 characters').max(1000),
      category: z.string().min(1, 'Category is required'),
      order: z.number().min(0),
      content: z.array(
        z.object({
          type: z.enum(['text', 'video', 'quiz', 'infographic']),
          data: z.any(),
        })
      ),
      pointsReward: z.number().min(0),
      badgeReward: z.string().optional(),
      requiredModules: z.array(z.string()).optional(),
      region: z.string().min(1, 'Region is required'),
    }),

    updateProgress: z.object({
      moduleId: z.string().min(1, 'Module ID is required'),
      progress: z.number().min(0).max(100),
    }),

    submitQuiz: z.object({
      answers: z.array(z.string()),
    }),
  },

  // Common schemas
  common: {
    id: z.object({
      id: z.string().min(1, 'ID is required'),
    }),

    pagination: z.object({
      page: z.string().or(z.number()).transform(Number).optional(),
      limit: z.string().or(z.number()).transform(Number).optional(),
      sort: z.string().optional(),
    }),

    search: z.object({
      query: z.string().min(1, 'Search query is required'),
    }),
  },
}
