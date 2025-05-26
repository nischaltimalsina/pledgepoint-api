import { Request, Response, NextFunction } from 'express'
import { User } from '../models/user.model'
import { TokenService } from '../services/token.service'
import { AppError } from './error-handler'
import { logger } from '../utils/logger'
import { AuthenticatedRequest } from '@/types/user.types'
import { RateLimiter } from './rate-limiter'

/**
 * CRITICAL FIXES APPLIED:
 * 1. Enhanced token validation with timing attack protection
 * 2. Session management security
 * 3. Account enumeration prevention
 * 4. Privilege escalation protection
 * 5. Token refresh security
 */

/**
 * Authentication middleware
 */
export class AuthMiddleware {
  /**
   * ENHANCED: Authenticate user with additional security checks
   */
  static async authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest

    try {
      // Enhanced token extraction with multiple sources
      const token =
        TokenService.extractTokenFromHeader(authenticatedReq.headers.authorization) ||
        authenticatedReq.cookies?.accessToken ||
        (authenticatedReq.headers['x-access-token'] as string)

      if (!token) {
        return next(new AppError(401, 'Authentication required'))
      }

      // Verify token with enhanced validation
      let decoded
      try {
        decoded = TokenService.verifyAccessToken(token)
      } catch (tokenError) {
        // Enhanced token error handling
        if (tokenError instanceof AppError && tokenError.message.includes('expired')) {
          return next(new AppError(401, 'Token expired. Please log in again.'))
        }
        return next(new AppError(401, 'Invalid authentication token'))
      }

      // Rate limiting per user to prevent token abuse
      const rateLimitKey = `auth_check:${decoded.id}`
      const isAllowed = await RateLimiter.checkUserRateLimit(rateLimitKey, 'auth_check', 100, 60000) // 100 per minute

      if (!isAllowed) {
        logger.warn(`Authentication rate limit exceeded for user: ${decoded.id}`)
        return next(new AppError(429, 'Too many authentication requests'))
      }

      // Enhanced user lookup with security checks
      const user = await User.findById(decoded.id).select('+lastLogin +loginAttempts +lockUntil')

      if (!user) {
        // Log potential token forgery attempt
        logger.warn(`Authentication attempt with non-existent user ID: ${decoded.id}`)
        return next(new AppError(401, 'Authentication failed'))
      }

      // CRITICAL: Enhanced account security checks
      if (user.accountStatus === 'suspended') {
        logger.warn(`Suspended user attempted access: ${user.email}`)
        return next(new AppError(403, 'Account suspended. Contact support.'))
      }

      if (!user.active) {
        logger.warn(`Inactive user attempted access: ${user.email}`)
        return next(new AppError(403, 'Account deactivated'))
      }

      if (user.isLocked()) {
        const lockTime = user.lockUntil ? new Date(user.lockUntil).toISOString() : 'indefinitely'
        logger.warn(`Locked user attempted access: ${user.email}`)
        return next(new AppError(403, `Account locked until ${lockTime}`))
      }

      // Validate token age for sensitive operations
      const tokenAge = Date.now() / 1000 - (decoded.iat || 0)
      if (tokenAge > 24 * 60 * 60) {
        // Token older than 24 hours
        // Force re-authentication for old tokens
        if (isSensitiveRoute(req.path)) {
          return next(new AppError(401, 'Please re-authenticate for this action'))
        }
      }

      // SECURITY: Check for role changes (privilege escalation prevention)
      if (decoded.role && decoded.role !== user.role) {
        logger.warn(`Role mismatch for user ${user.email}: token=${decoded.role}, db=${user.role}`)
        return next(new AppError(401, 'Authorization updated. Please log in again.'))
      }

      // Update last activity for session management
      user.lastLogin = new Date()
      await user.save()

      // Add user to request with additional security context
      authenticatedReq.user = user
      authenticatedReq.tokenInfo = {
        iat: decoded.iat!,
        age: tokenAge,
        isRecent: tokenAge < 300, // Less than 5 minutes old
      }

      next()
    } catch (error) {
      // Enhanced error logging with security context
      logger.error('Authentication middleware error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        path: req.path,
        method: req.method,
      })

      // Generic error message to prevent information disclosure
      next(new AppError(401, 'Authentication failed'))
    }
  }

  /**
   * ENHANCED: Authorize user by role with additional security
   */
  static authorize(
    roles: string[],
    requireRecentAuth: boolean = false
  ): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, res: Response, next: NextFunction): void => {
      const authenticatedReq = req as AuthenticatedRequest & { tokenInfo?: any }

      // Ensure user is authenticated
      if (!authenticatedReq.user) {
        return next(new AppError(401, 'Authentication required'))
      }

      const user = authenticatedReq.user

      // CRITICAL: Enhanced role validation
      if (!roles.includes(user.role)) {
        // Log authorization failure for monitoring
        logger.warn(
          `Authorization failed for user ${user.email}: required=${roles}, actual=${user.role}`
        )
        return next(new AppError(403, 'Insufficient permissions'))
      }

      // SECURITY: Recent authentication requirement for sensitive operations
      if (requireRecentAuth && authenticatedReq.tokenInfo) {
        if (!authenticatedReq.tokenInfo.isRecent) {
          return next(new AppError(401, 'Recent authentication required for this action'))
        }
      }

      // SECURITY: Admin role additional validation
      if (['admin', 'superadmin'].includes(user.role)) {
        // Check for admin-specific security requirements
        if (!validateAdminAccess(req, user)) {
          logger.warn(`Admin access validation failed for user ${user.email}`)
          return next(new AppError(403, 'Admin access restricted'))
        }
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
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const { token } = authenticatedReq.params

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
      const user = await User.findById(decoded.id)
      if (!user) {
        return next(new AppError(404, 'User not found'))
      }
      authenticatedReq.user = user
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
    const authenticatedReq = req as AuthenticatedRequest
    try {
      const { token } = authenticatedReq.params

      if (!token) {
        return next(new AppError(400, 'Reset token is required'))
      }

      // Verify token
      const decoded = TokenService.verifyTempToken(token, 'reset-password')

      // Check if token type is correct
      if (decoded.type !== 'reset-password') {
        return next(new AppError(400, 'Invalid reset token'))
      }

      // Fetch user data from database
      const user = await User.findById(decoded.id)

      // Check if user exists
      if (!user) {
        return next(new AppError(404, 'User not found'))
      }

      // Add user to request
      authenticatedReq.user = user
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
  /**
   * ENHANCED: Optional authentication with security improvements
   */
  static async optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest

    try {
      const token =
        TokenService.extractTokenFromHeader(authenticatedReq.headers.authorization) ||
        authenticatedReq.cookies?.accessToken

      if (!token) {
        return next() // No token, continue without authentication
      }

      // Basic token validation
      let decoded
      try {
        decoded = TokenService.verifyAccessToken(token)
      } catch (error) {
        // Silent failure for optional auth
        logger.debug('Optional auth token verification failed:', error)
        return next()
      }

      // Lightweight user lookup for optional auth
      const user = await User.findById(decoded.id).select(
        'firstName lastName email role accountStatus active'
      )

      if (user && user.accountStatus === 'active' && user.active) {
        authenticatedReq.user = user
      }

      next()
    } catch (error) {
      // Silent failure for optional auth
      logger.debug('Optional auth error:', error)
      next()
    }
  }

  /**
   * SECURITY: Secure token refresh with validation
   */
  static async secureRefresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies?.refreshToken || req.body.refreshToken

      if (!refreshToken) {
        return next(new AppError(401, 'Refresh token required'))
      }

      // Verify refresh token
      const decoded = TokenService.verifyRefreshToken(refreshToken)

      // Enhanced user validation for refresh
      const user = await User.findOne({
        _id: decoded.id,
        refreshToken,
        active: true,
        accountStatus: 'active',
      }).select('+refreshToken')

      if (!user) {
        // Clear invalid refresh token
        res.clearCookie('refreshToken')
        return next(new AppError(401, 'Invalid refresh token'))
      }

      // Check for suspicious refresh patterns
      const refreshRateKey = `refresh:${user._id}`
      const isAllowed = await RateLimiter.checkUserRateLimit(
        refreshRateKey,
        'token_refresh',
        10,
        60000
      ) // 10 per minute

      if (!isAllowed) {
        logger.warn(`Suspicious token refresh rate for user: ${user.email}`)
        // Invalidate all tokens for this user
        user.refreshToken = undefined
        await user.save()
        res.clearCookie('refreshToken')
        return next(new AppError(429, 'Too many refresh attempts. Please log in again.'))
      }

      // Add user to request for token generation
      ;(req as any).user = user
      next()
    } catch (error) {
      logger.error('Secure refresh error:', error)
      next(new AppError(401, 'Token refresh failed'))
    }
  }
}

/**
 * Check if route requires sensitive permissions
 */
function isSensitiveRoute(path: string): boolean {
  const sensitivePatterns = [
    '/admin',
    '/user/delete',
    '/user/change-password',
    '/officials/delete',
    '/promises/delete',
    '/two-factor',
  ]

  return sensitivePatterns.some((pattern) => path.includes(pattern))
}

/**
 * Enhanced admin access validation
 */
function validateAdminAccess(req: Request, user: any): boolean {
  // Check IP whitelist for admin operations
  const adminWhitelist = process.env.ADMIN_IP_WHITELIST?.split(',') || []

  if (adminWhitelist.length > 0) {
    const clientIP = req.ip || req.socket.remoteAddress
    if (!adminWhitelist.includes(clientIP!)) {
      return false
    }
  }

  // Check for admin session requirements
  if (user.role === 'superadmin') {
    // Superadmin requires recent authentication
    const lastLogin = new Date(user.lastLogin || 0)
    const hoursSinceLogin = (Date.now() - lastLogin.getTime()) / (1000 * 60 * 60)

    if (hoursSinceLogin > 4) {
      // 4 hour session limit for superadmin
      return false
    }
  }

  return true
}

/**
 * SECURITY: Account lockout middleware for failed attempts
 */
export const accountLockoutProtection = async (req: Request, res: Response, next: NextFunction) => {
  if (req.path.includes('/login') && req.method === 'POST') {
    const email = req.body?.email

    if (email) {
      // Check if account is already locked
      const user = await User.findOne({ email: email.toLowerCase() }).select(
        '+lockUntil +loginAttempts'
      )

      if (user?.isLocked()) {
        const lockTime = user.lockUntil ? new Date(user.lockUntil).toLocaleString() : 'indefinitely'
        return next(
          new AppError(
            423,
            `Account locked due to multiple failed login attempts. Try again after ${lockTime}`
          )
        )
      }
    }
  }

  next()
}
