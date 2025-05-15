import { Request, Response, NextFunction } from 'express'
import { User } from '../models/user.model'
import { TokenService } from '../services/token.service'
import { AppError } from './error-handler'
import { logger } from '../utils/logger'

/**
 * Authentication middleware
 */
export class AuthMiddleware {
  /**
   * Authenticate user from token
   * @param req Express request
   * @param res Express response
   * @param next Express next function
   */
  static async authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Get token from authorization header or cookies
      const token =
        TokenService.extractTokenFromHeader(req.headers.authorization) ||
        (req.cookies?.token as string)

      if (!token) {
        return next(new AppError(401, 'Authentication required'))
      }

      // Verify token
      const decoded = TokenService.verifyAccessToken(token)

      // Find user by id
      const user = await User.findById(decoded.id)

      if (!user || user.accountStatus === 'suspended' || !user.active) {
        return next(new AppError(401, 'Authentication failed'))
      }

      // Add user to request
      req.user = user
      next()
    } catch (error) {
      if (error instanceof AppError) {
        return next(error)
      }
      logger.error('Auth middleware error:', error)
      next(new AppError(401, 'Authentication failed'))
    }
  }

  /**
   * Authorize user by role
   * @param roles Allowed roles
   * @returns Express middleware
   */
  static authorize(roles: string[]): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        return next(new AppError(401, 'Authentication required'))
      }

      if (!roles.includes(req.user.role)) {
        return next(new AppError(403, 'Unauthorized access'))
      }

      next()
    }
  }

  /**
   * Verify email verification token
   * @param req Express request
   * @param res Express response
   * @param next Express next function
   */
  static async verifyEmailToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.params

      if (!token) {
        return next(new AppError(400, 'Verification token is required'))
      }

      // Verify token
      const decoded = TokenService.verifyTempToken(token, 'verify-email')

      // Check if token type is correct
      if (decoded.type !== 'verify-email') {
        return next(new AppError(400, 'Invalid verification token'))
      }

      // Add user ID to request
      req.user = { id: decoded.id }
      next()
    } catch (error) {
      if (error instanceof AppError) {
        return next(error)
      }
      logger.error('Verify email token error:', error)
      next(new AppError(400, 'Invalid or expired verification token'))
    }
  }

  /**
   * Verify password reset token
   * @param req Express request
   * @param res Express response
   * @param next Express next function
   */
  static async verifyResetToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.params

      if (!token) {
        return next(new AppError(400, 'Reset token is required'))
      }

      // Verify token
      const decoded = TokenService.verifyTempToken(token, 'reset-password')

      // Check if token type is correct
      if (decoded.type !== 'reset-password') {
        return next(new AppError(400, 'Invalid reset token'))
      }

      // Add user ID to request
      req.user = { id: decoded.id }
      next()
    } catch (error) {
      if (error instanceof AppError) {
        return next(error)
      }
      logger.error('Verify reset token error:', error)
      next(new AppError(400, 'Invalid or expired reset token'))
    }
  }

  /**
   * Optional authentication
   * Authenticate user if token is present but don't require it
   * @param req Express request
   * @param res Express response
   * @param next Express next function
   */
  static async optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Get token from authorization header or cookies
      const token =
        TokenService.extractTokenFromHeader(req.headers.authorization) ||
        (req.cookies?.token as string)

      if (!token) {
        // No token, continue without authentication
        return next()
      }

      // Verify token
      const decoded = TokenService.verifyAccessToken(token)

      // Find user by id
      const user = await User.findById(decoded.id)

      if (user && user.accountStatus !== 'suspended' && user.active) {
        // Add user to request
        req.user = user
      }

      next()
    } catch (error) {
      // Continue without authentication on error
      logger.debug('Optional auth failed, continuing without user:', error)
      next()
    }
  }
}
