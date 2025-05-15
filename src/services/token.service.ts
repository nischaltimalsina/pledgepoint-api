import jwt from 'jsonwebtoken'
import { config, StringValue } from '../config'
import { logger } from '../utils/logger'
import { AppError } from '../middleware/error-handler'
import { IUser } from '@/models/user.model'

/**
 * Token payload interface
 */
interface TokenPayload {
  id: string
  iat?: number
  exp?: number
  iss?: string
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
  static generateAccessToken(user: IUser): string {
    try {
      return jwt.sign({ id: user._id }, config.jwt.secret, {
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
  static generateRefreshToken(user: IUser): string {
    try {
      return jwt.sign({ id: user._id }, config.jwt.refreshSecret, {
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

  /**
   * Decode a token without verification
   * @param token JWT token to decode
   * @returns Decoded token payload or null if invalid
   */
  static decodeToken(token: string): TokenPayload | null {
    try {
      return jwt.decode(token) as TokenPayload
    } catch (error) {
      logger.error('Error decoding token:', error)
      return null
    }
  }

  /**
   * Generate a temporary token for email verification or password reset
   * @param userId User ID to include in the token
   * @param expiresIn Token expiration time (e.g., '1h', '1d')
   * @param type Token type ('verify-email' or 'reset-password')
   * @returns JWT token
   */
  static generateTempToken(
    userId: string,
    expiresIn: string,
    type: 'verify-email' | 'reset-password'
  ): string {
    try {
      return jwt.sign(
        {
          id: userId,
          type,
        },
        type === 'verify-email' ? config.jwt.secret + '-verify' : config.jwt.secret + '-reset',
        {
          expiresIn: expiresIn as StringValue,
          issuer: config.jwt.issuer,
        }
      )
    } catch (error) {
      logger.error(`Error generating ${type} token:`, error)
      throw new AppError(500, `Failed to generate ${type} token`)
    }
  }

  /**
   * Verify a temporary token for email verification or password reset
   * @param token JWT token to verify
   * @param type Token type ('verify-email' or 'reset-password')
   * @returns Decoded token payload
   */
  static verifyTempToken(
    token: string,
    type: 'verify-email' | 'reset-password'
  ): TokenPayload & { type: string } {
    try {
      return jwt.verify(
        token,
        type === 'verify-email' ? config.jwt.secret + '-verify' : config.jwt.secret + '-reset'
      ) as TokenPayload & { type: string }
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

      logger.error(`Error verifying ${type} token:`, error)
      throw new AppError(
        401,
        `${type === 'verify-email' ? 'Verification' : 'Reset'} token verification failed`
      )
    }
  }
}
