import jwt from 'jsonwebtoken'
import { config, StringValue } from '../config'
import { logger } from '../utils/logger'
import { AppError } from '../middleware/error-handler'
import { IUser } from '@/interfaces/user'

/**
 * Token payload interface
 */
interface TokenPayload {
  id: string
  role?: string
  iat?: number
  exp?: number
  iss?: string
}

/**
 * Service for handling JWT token generation and verification
 * SECURITY FIXES APPLIED:
 * - Fixed Bearer token extraction bug
 * - Enhanced token validation
 * - Added algorithm specification
 * - Improved error handling
 */
export class TokenService {
  /**
   * FIXED: Extract token from request headers with proper validation
   * CRITICAL BUG FIX: Changed from 'Bearer-' to 'Bearer ' (space)
   */
  static extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) {
      return null
    }

    // FIXED: Check for proper Bearer format with space (not hyphen)
    if (!authHeader.startsWith('Bearer ')) {
      return null
    }

    const parts = authHeader.split(' ')
    if (parts.length !== 2) {
      return null
    }

    const token = parts[1]
    // Additional validation - ensure token is not empty
    if (!token || token.trim() === '') {
      return null
    }

    return token
  }

  /**
   * Generate an access token for a user with enhanced security
   */
  static generateAccessToken(user: IUser): string {
    try {
      // SECURITY: Validate JWT secret is properly configured
      if (!config.jwt.secret || config.jwt.secret === 'dev_jwt_secret_change_in_production') {
        throw new Error('JWT secret not properly configured for production')
      }

      return jwt.sign(
        {
          id: user._id,
          role: user.role, // Include role for additional validation
          iat: Math.floor(Date.now() / 1000), // Explicit issued at time
        },
        config.jwt.secret,
        {
          expiresIn: config.jwt.accessExpiresIn,
          issuer: config.jwt.issuer,
          audience: 'pledgepoint-users', // Add audience
          algorithm: 'HS256', // Explicit algorithm to prevent algorithm confusion attacks
        }
      )
    } catch (error) {
      logger.error('Error generating access token:', error)
      throw new AppError(500, 'Failed to generate access token')
    }
  }

  /**
   * Generate a refresh token for a user with enhanced security
   */
  static generateRefreshToken(user: IUser): string {
    try {
      // SECURITY: Validate refresh secret is properly configured
      if (
        !config.jwt.refreshSecret ||
        config.jwt.refreshSecret === 'dev_refresh_secret_change_in_production'
      ) {
        throw new Error('JWT refresh secret not properly configured for production')
      }

      return jwt.sign(
        {
          id: user._id,
          type: 'refresh', // Explicitly mark as refresh token
          iat: Math.floor(Date.now() / 1000),
        },
        config.jwt.refreshSecret,
        {
          expiresIn: config.jwt.refreshExpiresIn,
          issuer: config.jwt.issuer,
          audience: 'pledgepoint-refresh',
          algorithm: 'HS256',
        }
      )
    } catch (error) {
      logger.error('Error generating refresh token:', error)
      throw new AppError(500, 'Failed to generate refresh token')
    }
  }

  /**
   * ENHANCED: Verify an access token with additional security checks
   */
  static verifyAccessToken(token: string): TokenPayload {
    try {
      // Additional token format validation
      if (!token || typeof token !== 'string' || token.length < 10) {
        throw new AppError(401, 'Invalid token format')
      }

      // Verify with explicit options for security
      const decoded = jwt.verify(token, config.jwt.secret, {
        issuer: config.jwt.issuer,
        audience: 'pledgepoint-users',
        algorithms: ['HS256'], // Explicit algorithm validation
        clockTolerance: 60, // Allow 60 seconds clock skew
      }) as TokenPayload

      // Additional payload validation
      if (!decoded.id || typeof decoded.id !== 'string') {
        throw new AppError(401, 'Invalid token payload')
      }

      return decoded
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError(401, 'Access token expired')
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError(401, 'Invalid access token')
      }
      if (error instanceof jwt.NotBeforeError) {
        throw new AppError(401, 'Token not active yet')
      }
      if (error instanceof AppError) {
        throw error
      }

      logger.error('Error verifying access token:', error)
      throw new AppError(401, 'Access token verification failed')
    }
  }

  /**
   * ENHANCED: Verify a refresh token with additional security checks
   */
  static verifyRefreshToken(token: string): TokenPayload {
    try {
      // Additional token format validation
      if (!token || typeof token !== 'string' || token.length < 10) {
        throw new AppError(401, 'Invalid refresh token format')
      }

      const decoded = jwt.verify(token, config.jwt.refreshSecret, {
        issuer: config.jwt.issuer,
        audience: 'pledgepoint-refresh',
        algorithms: ['HS256'],
        clockTolerance: 60,
      }) as TokenPayload

      // Validate it's actually a refresh token
      if ((decoded as any).type !== 'refresh') {
        throw new AppError(401, 'Invalid token type')
      }

      if (!decoded.id || typeof decoded.id !== 'string') {
        throw new AppError(401, 'Invalid refresh token payload')
      }

      return decoded
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError(401, 'Refresh token expired')
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError(401, 'Invalid refresh token')
      }
      if (error instanceof AppError) {
        throw error
      }

      logger.error('Error verifying refresh token:', error)
      throw new AppError(401, 'Refresh token verification failed')
    }
  }

  /**
   * Decode a token without verification (for inspection only)
   */
  static decodeToken(token: string): TokenPayload | null {
    try {
      if (!token || typeof token !== 'string') {
        return null
      }
      return jwt.decode(token) as TokenPayload
    } catch (error) {
      logger.error('Error decoding token:', error)
      return null
    }
  }

  /**
   * ENHANCED: Generate a temporary token with better security
   */
  static generateTempToken(
    userId: string,
    expiresIn: string,
    type: 'verify-email' | 'reset-password'
  ): string {
    try {
      const secret =
        type === 'verify-email' ? `${config.jwt.secret}-verify` : `${config.jwt.secret}-reset`

      return jwt.sign(
        {
          id: userId,
          type,
          iat: Math.floor(Date.now() / 1000),
          purpose: type, // Additional validation field
        },
        secret,
        {
          expiresIn: expiresIn as StringValue,
          issuer: config.jwt.issuer,
          audience: `pledgepoint-${type}`,
          algorithm: 'HS256',
        }
      )
    } catch (error) {
      logger.error(`Error generating ${type} token:`, error)
      throw new AppError(500, `Failed to generate ${type} token`)
    }
  }

  /**
   * ENHANCED: Verify a temporary token with additional validation
   */
  static verifyTempToken(
    token: string,
    type: 'verify-email' | 'reset-password'
  ): TokenPayload & { type: string; purpose: string } {
    try {
      if (!token || typeof token !== 'string') {
        throw new AppError(401, 'Invalid token format')
      }

      const secret =
        type === 'verify-email' ? `${config.jwt.secret}-verify` : `${config.jwt.secret}-reset`

      const decoded = jwt.verify(token, secret, {
        issuer: config.jwt.issuer,
        audience: `pledgepoint-${type}`,
        algorithms: ['HS256'],
      }) as TokenPayload & { type: string; purpose: string }

      // Validate token type and purpose match
      if (decoded.type !== type || decoded.purpose !== type) {
        throw new AppError(401, `Invalid ${type} token`)
      }

      if (!decoded.id || typeof decoded.id !== 'string') {
        throw new AppError(401, 'Invalid token payload')
      }

      return decoded
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError(
          401,
          `${type === 'verify-email' ? 'Verification' : 'Reset'} token expired`
        )
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError(
          401,
          `Invalid ${type === 'verify-email' ? 'verification' : 'reset'} token`
        )
      }
      if (error instanceof AppError) {
        throw error
      }

      logger.error(`Error verifying ${type} token:`, error)
      throw new AppError(
        401,
        `${type === 'verify-email' ? 'Verification' : 'Reset'} token verification failed`
      )
    }
  }

  /**
   * SECURITY: Validate token strength (for monitoring)
   */
  static validateTokenSecurity(token: string): boolean {
    try {
      const decoded = this.decodeToken(token)
      if (!decoded) return false

      // Check for minimum security requirements
      const hasValidIssuer = decoded.iss === config.jwt.issuer
      const hasIssuedAt = !!decoded.iat
      const isNotExpired = !decoded.exp || decoded.exp > Math.floor(Date.now() / 1000)

      return hasValidIssuer && hasIssuedAt && isNotExpired
    } catch (error) {
      return false
    }
  }

  /**
   * SECURITY: Get token expiration info
   */
  static getTokenExpiration(token: string): {
    expired: boolean
    expiresAt?: Date
    timeLeft?: number
  } {
    try {
      const decoded = this.decodeToken(token)
      if (!decoded || !decoded.exp) {
        return { expired: true }
      }

      const expiresAt = new Date(decoded.exp * 1000)
      const now = new Date()
      const expired = expiresAt <= now
      const timeLeft = expired ? 0 : Math.floor((expiresAt.getTime() - now.getTime()) / 1000)

      return {
        expired,
        expiresAt,
        timeLeft,
      }
    } catch (error) {
      return { expired: true }
    }
  }
}
