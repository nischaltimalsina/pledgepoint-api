import { Request, Response, NextFunction } from 'express'
import { AuthService } from '../services/auth.service'
import { logger } from '../utils/logger'
import { AuthenticatedRequest } from '../types/user.types'

/**
 * Controller for authentication endpoints
 */
export class AuthController {
  /**
   * Register a new user
   * @route POST /api/auth/register
   */
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { firstName, lastName, email, password, confirmPassword } = req.body

      // Check if passwords match
      if (password !== confirmPassword) {
        res.status(400).json({
          status: 'fail',
          message: 'Passwords do not match',
        })
        return
      }

      // Register user via auth service
      const result = await AuthService.registerUser({ firstName, lastName, email, password }, req)

      // Set refresh token as HTTP-only cookie
      if (result.refreshToken) {
        res.cookie('refreshToken', result.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        })
      }

      res.status(201).json({
        status: 'success',
        message: 'Registration successful. Please verify your email.',
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      })
    } catch (error) {
      logger.error('Error registering user:', error)
      next(error)
    }
  }

  /**
   * Login user
   * @route POST /api/auth/login
   */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, twoFactorCode } = req.body

      // Login user via auth service
      const result = await AuthService.loginUser({ email, password, twoFactorCode })

      // If two-factor authentication is required
      if (result.requiresTwoFactor) {
        res.status(200).json({
          status: 'success',
          message: 'Two-factor authentication required',
          requiresTwoFactor: true,
          user: result.user,
        })
        return
      }

      // Set refresh token as HTTP-only cookie
      if (result.refreshToken) {
        res.cookie('refreshToken', result.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        })
      }

      res.status(200).json({
        status: 'success',
        message: 'Login successful',
        data: {
          accessToken: result.accessToken,
          user: result.user,
        },
      })
    } catch (error) {
      logger.error('Error logging in user:', error)
      next(error)
    }
  }

  /**
   * Logout user
   * @route POST /api/auth/logout
   */
  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    const userReq = req as AuthenticatedRequest
    try {
      const userId = userReq.user?._id

      if (userId) {
        // Logout user via auth service
        await AuthService.logoutUser(userId.toString())
      }

      // Clear refresh token cookie
      res.clearCookie('refreshToken')

      res.status(200).json({
        status: 'success',
        message: 'Logout successful',
      })
    } catch (error) {
      logger.error('Error logging out user:', error)
      next(error)
    }
  }

  /**
   * Refresh access token
   * @route POST /api/auth/refresh-token
   */
  static async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies?.refreshToken || req.body.refreshToken

      if (!refreshToken) {
        res.status(401).json({
          status: 'fail',
          message: 'Refresh token required',
        })
        return
      }

      // Refresh token via auth service
      const tokens = await AuthService.refreshToken(refreshToken)

      // Set new refresh token cookie
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      })

      res.status(200).json({
        status: 'success',
        message: 'Token refreshed successfully',
        data: {
          accessToken: tokens.accessToken,
        },
      })
    } catch (error) {
      logger.error('Error refreshing token:', error)
      next(error)
    }
  }

  /**
   * Verify email with token
   * @route GET /api/auth/verify-email/:token
   */
  static async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.params

      // Verify email via auth service
      await AuthService.verifyEmail(token)

      res.status(200).json({
        status: 'success',
        message: 'Email verified successfully. You can now log in.',
      })
    } catch (error) {
      logger.error('Error verifying email:', error)
      next(error)
    }
  }

  /**
   * Resend verification email
   * @route POST /api/auth/resend-verification
   */
  static async resendVerificationEmail(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { email } = req.body

      // Resend verification email via auth service
      const message = await AuthService.resendVerificationEmail(email, req)

      res.status(200).json({
        status: 'success',
        message,
      })
    } catch (error) {
      logger.error('Error resending verification email:', error)
      next(error)
    }
  }

  /**
   * Forgot password - request password reset
   * @route POST /api/auth/forgot-password
   */
  static async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body

      // Send password reset email via auth service
      const message = await AuthService.forgotPassword(email, req)

      res.status(200).json({
        status: 'success',
        message,
      })
    } catch (error) {
      logger.error('Error sending password reset email:', error)
      next(error)
    }
  }

  /**
   * Reset password with token
   * @route POST /api/auth/reset-password/:token
   */
  static async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.params
      const { password, confirmPassword } = req.body

      // Reset password via auth service
      await AuthService.resetPassword(token, password, confirmPassword)

      res.status(200).json({
        status: 'success',
        message: 'Password reset successfully. You can now log in with your new password.',
      })
    } catch (error) {
      logger.error('Error resetting password:', error)
      next(error)
    }
  }

  /**
   * Setup two-factor authentication
   * @route POST /api/auth/two-factor/setup
   */
  static async setupTwoFactor(req: Request, res: Response, next: NextFunction): Promise<void> {
    const userReq = req as AuthenticatedRequest
    try {
      const userId = userReq.user._id.toString()

      // Setup two-factor authentication via auth service
      const result = await AuthService.setupTwoFactor(userId)

      res.status(200).json({
        status: 'success',
        message: 'Two-factor authentication setup initiated',
        data: result,
      })
    } catch (error) {
      logger.error('Error setting up two-factor authentication:', error)
      next(error)
    }
  }

  /**
   * Verify and enable two-factor authentication
   * @route POST /api/auth/two-factor/enable
   */
  static async verifyAndEnableTwoFactor(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const userReq = req as AuthenticatedRequest
    try {
      const userId = userReq.user._id.toString()
      const { verificationCode } = req.body

      // Verify and enable two-factor authentication via auth service
      await AuthService.verifyAndEnableTwoFactor(userId, verificationCode)

      res.status(200).json({
        status: 'success',
        message: 'Two-factor authentication enabled successfully',
      })
    } catch (error) {
      logger.error('Error enabling two-factor authentication:', error)
      next(error)
    }
  }

  /**
   * Disable two-factor authentication
   * @route POST /api/auth/two-factor/disable
   */
  static async disableTwoFactor(req: Request, res: Response, next: NextFunction): Promise<void> {
    const userReq = req as AuthenticatedRequest
    try {
      const userId = userReq.user._id.toString()
      const { password } = req.body

      // Disable two-factor authentication via auth service
      await AuthService.disableTwoFactor(userId, password)

      res.status(200).json({
        status: 'success',
        message: 'Two-factor authentication disabled successfully',
      })
    } catch (error) {
      logger.error('Error disabling two-factor authentication:', error)
      next(error)
    }
  }

  /**
   * Get current user profile (from token)
   * @route GET /api/auth/me
   */
  static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    const userReq = req as AuthenticatedRequest
    try {
      const user = userReq.user

      res.status(200).json({
        status: 'success',
        data: {
          user,
        },
      })
    } catch (error) {
      logger.error('Error getting current user:', error)
      next(error)
    }
  }

  /**
   * Update current user profile
   * @route PATCH /api/auth/me
   */
  static async updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    const userReq = req as AuthenticatedRequest
    try {
      const userId = userReq.user._id.toString()
      const { firstName, lastName, district, location, bio } = req.body

      // Update user profile via auth service
      const updatedUser = await AuthService.updateProfile(userId, {
        firstName,
        lastName,
        district,
        location,
        bio,
      })

      res.status(200).json({
        status: 'success',
        message: 'Profile updated successfully',
        data: {
          user: updatedUser,
        },
      })
    } catch (error) {
      logger.error('Error updating profile:', error)
      next(error)
    }
  }

  /**
   * Change password
   * @route POST /api/auth/change-password
   */
  static async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    const userReq = req as AuthenticatedRequest
    try {
      const userId = userReq.user._id.toString()
      const { currentPassword, newPassword, confirmPassword } = req.body

      // Check if new passwords match
      if (newPassword !== confirmPassword) {
        res.status(400).json({
          status: 'fail',
          message: 'New passwords do not match',
        })
        return
      }

      // Change password via auth service
      await AuthService.changePassword(userId, currentPassword, newPassword)

      res.status(200).json({
        status: 'success',
        message: 'Password changed successfully',
      })
    } catch (error) {
      logger.error('Error changing password:', error)
      next(error)
    }
  }
}
