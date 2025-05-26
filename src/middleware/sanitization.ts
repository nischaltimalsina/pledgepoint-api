import { Request, Response, NextFunction } from 'express'
import mongoose from 'mongoose'
import { AppError } from './error-handler'

/**
 * NoSQL Injection protection middleware
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Recursively sanitize object
    const sanitizeObject = (obj: any): any => {
      if (obj && typeof obj === 'object') {
        if (Array.isArray(obj)) {
          return obj.map(sanitizeObject)
        }

        const sanitized: any = {}
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            // Remove MongoDB operators from keys
            if (key.startsWith('$') || key.includes('.')) {
              continue // Skip potentially dangerous keys
            }
            sanitized[key] = sanitizeObject(obj[key])
          }
        }
        return sanitized
      }

      // Sanitize strings
      if (typeof obj === 'string') {
        // Remove null bytes and other dangerous characters
        return obj.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      }

      return obj
    }

    // Sanitize request body, query, and params
    if (req.body) {
      req.body = sanitizeObject(req.body)
    }
    if (req.query) {
      req.query = sanitizeObject(req.query)
    }
    if (req.params) {
      req.params = sanitizeObject(req.params)
    }

    next()
  } catch (error) {
    next(new AppError(400, 'Invalid request data'))
  }
}

/**
 * Additional validation for MongoDB ObjectIds
 */
export const validateObjectIds = (req: Request, res: Response, next: NextFunction) => {
  const checkObjectId = (obj: any, path: string = ''): void => {
    if (obj && typeof obj === 'object') {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const currentPath = path ? `${path}.${key}` : key

          // Check if field name suggests it's an ObjectId
          if ((key.endsWith('Id') || key.endsWith('_id')) && obj[key]) {
            if (typeof obj[key] === 'string' && !mongoose.Types.ObjectId.isValid(obj[key])) {
              throw new AppError(400, `Invalid ObjectId format for ${currentPath}`)
            }
          }

          if (typeof obj[key] === 'object') {
            checkObjectId(obj[key], currentPath)
          }
        }
      }
    }
  }

  try {
    checkObjectId(req.body, 'body')
    checkObjectId(req.query, 'query')
    checkObjectId(req.params, 'params')
    next()
  } catch (error) {
    next(error)
  }
}
