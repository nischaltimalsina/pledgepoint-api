import jwt from 'jsonwebtoken'
import { config } from '../config'
import { logger } from '../utils/logger'
import { AppError } from '../middleware/error-handler'

/**
 * Token payload interface
 */
interface TokenPayload {
  id: string
  iat: number
  exp: number
  iss: string
}

/**
 * Service for handling JWT token generation and verification
 */
export class TokenService {
  /**
   * Generate an access token for a user
   * @param userId User ID to include in the token
   * @returns JWT access token
   */
  static generateAccessToken(userId: string): string {
    try {
      return jwt.sign({ id: userId }, config.jwt.secret, {
        expiresIn: config.jwt.accessExpiresIn,
        issuer: config.jwt.issuer,
      })
    } catch (error) {
      logger.error('Error generating access token:', error)
      throw new AppError(500, 'Failed to generate access token')
    }
  }

  /**
   * Generate a refresh token for a user
   * @param userId User ID to include in the token
   * @returns JWT refresh token
   */
  static generateRefreshToken(userId: string): string {
    try {
      return jwt.sign({ id: userId }, config.jwt.refreshSecret, {
        expiresIn: config.jwt.refreshExpiresIn,
        issuer: config.jwt.issuer,
      })
    } catch (error) {
      logger.error('Error generating refresh token:', error)
      throw new AppError(500, 'Failed to generate refresh token')
    }
  }

  /**
   * Verify an access token
   * @param token JWT access token to verify
   * @returns Decoded token payload
   */
  static verifyAccessToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, config.jwt.secret) as TokenPayload
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError(401, 'Access token expired')
      }

      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError(401, 'Invalid access token')
      }

      logger.error('Error verifying access token:', error)
      throw new AppError(401, 'Access token verification failed')
    }
  }

  /**
   * Verify a refresh token
   * @param token JWT refresh token to verify
   * @returns Decoded token payload
   */
  static verifyRefreshToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, config.jwt.refreshSecret) as TokenPayload
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError(401, 'Refresh token expired')
      }

      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError(401, 'Invalid refresh token')
      }

      logger.error('Error verifying refresh token:', error)
      throw new AppError(401, 'Refresh token verification failed')
    }
  }

  /**
   * Extract token from request headers
   * @param authHeader Authorization header value
   * @returns Extracted token or null if not found
   */
  static extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    return authHeader.split(' ')[1]
  }
}
