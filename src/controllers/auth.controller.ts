import { Request, Response, NextFunction } from 'express'
import mongoose from 'mongoose'
import { User } from '../models/user.model'
import { AppError } from '../middleware/error-handler'
import { logger } from '../utils/logger'
import { TokenService } from '../services/token.service'
import { EmailService } from '../services/email.service'
import { PasswordUtils } from '../utils/password'
import crypto from 'crypto'

// Auth controller class
export class AuthController {
  /**
   * Register a new user
   */
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { firstName, lastName, email, password, confirmPassword } = req.body

      // Check if passwords match
      if (password !== confirmPassword) {
        throw new AppError(400, 'Passwords do not match')
      }

      // Check if email already exists
      const existingUser = await User.findOne({ email: email.toLowerCase() })
      if (existingUser) {
        throw new AppError(409, 'Email already in use')
      }

      // Validate password strength
      const passwordValidation = PasswordUtils.validatePasswordStrength(password)
      if (!passwordValidation.isValid) {
        throw new AppError(400, passwordValidation.message)
      }

      // Create new user
      const user = new User({
        _id: new mongoose.Types.ObjectId(),
        firstName,
        lastName,
        email: email.toLowerCase(),
        password,
        role: 'user',
        accountStatus: 'pending',
        active: true,
        twoFactorEnabled: false,
        isEmailVerified: false,
        impactPoints: 0,
        level: 'citizen',
        badges: [], // Will be awarded on email verification
        loginAttempts: 0,
      })

      // Generate email verification token
      const verificationToken = await user.generateEmailVerificationToken()

      // Save user
      await user.save()

      // Send verification email
      await EmailService.sendVerificationEmail(user.email, verificationToken, req)

      // Create response without sensitive data
      const userResponse = {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        accountStatus: user.accountStatus,
        level: user.level,
      }

      res.status(201).json({
        status: 'success',
        message: 'Registration successful. Please verify your email.',
        data: userResponse,
      })
    } catch (error) {
      logger.error('Error registering user:', error)
      next(error)
    }
  }

  /**
   * Login user
   */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, twoFactorCode } = req.body

      // Find user by email
      const user = await User.findOne({ email: email.toLowerCase() })

      // Check if user exists
      if (!user) {
        throw new AppError(401, 'Invalid email or password')
      }

      // Check if account is active
      if (!user.active) {
        throw new AppError(401, 'Account is deactivated')
      }

      // Check if account is suspended
      if (user.accountStatus === 'suspended') {
        throw new AppError(401, 'Account is suspended. Please contact support.')
      }

      // Check if account is locked due to too many attempts
      if (user.isLocked()) {
        const lockTime = new Date(user.lockUntil!)
        throw new AppError(
          401,
          `Account is locked due to too many login attempts. Try again after ${lockTime.toLocaleString()}`
        )
      }

      // Verify password
      const isPasswordCorrect = await user.comparePassword(password)

      if (!isPasswordCorrect) {
        // Increment login attempts
        await user.incrementLoginAttempts()
        throw new AppError(401, 'Invalid email or password')
      }

      // Check if two-factor auth is enabled
      if (user.twoFactorEnabled) {
        // If no code provided, ask for it
        if (!twoFactorCode) {
          return res.status(200).json({
            status: 'success',
            message: 'Two-factor authentication required',
            requiresTwoFactor: true,
          })
        }

        // Verify 2FA code - would use something like speakeasy in production
        const isValidTwoFactorCode = twoFactorCode === '123456' // Mock validation

        if (!isValidTwoFactorCode) {
          throw new AppError(401, 'Invalid two-factor authentication code')
        }
      }

      // Reset login attempts on successful login
      await user.resetLoginAttempts()

      // Generate tokens
      const accessToken = TokenService.generateAccessToken(user._id)
      const refreshToken = TokenService.generateRefreshToken(user._id)

      // Update user's refresh token and last login
      user.refreshToken = refreshToken
      user.lastLogin = new Date()
      await user.save()

      // Set refresh token as HTTP-only cookie
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      })

      res.status(200).json({
        status: 'success',
        message: 'Login successful',
        accessToken,
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          level: user.level,
          impactPoints: user.impactPoints,
        },
      })
    } catch (error) {
      logger.error('Error logging in user:', error)
      next(error)
    }
  }

  /**
   * Logout user
   */
  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?._id

      if (userId) {
        // Clear refresh token in database
        await User.findByIdAndUpdate(userId, { refreshToken: null })
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
   */
  static async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies.refreshToken || req.body.refreshToken

      if (!refreshToken) {
        throw new AppError(401, 'Refresh token required')
      }

      // Verify refresh token
      const decoded = TokenService.verifyRefreshToken(refreshToken)

      // Get user with the stored refresh token
      const user = await User.findOne({
        _id: decoded.id,
        refreshToken,
        active: true,
      })

      if (!user) {
        throw new AppError(401, 'Invalid refresh token')
      }

      // Generate new tokens
      const newAccessToken = TokenService.generateAccessToken(user._id)
      const newRefreshToken = TokenService.generateRefreshToken(user._id)

      // Update user's refresh token
      user.refreshToken = newRefreshToken
      await user.save()

      // Set new refresh token as HTTP-only cookie
      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      })

      res.status(200).json({
        status: 'success',
        message: 'Token refreshed successfully',
        accessToken: newAccessToken,
      })
    } catch (error) {
      logger.error('Error refreshing token:', error)
      next(error)
    }
  }

  /**
   * Verify email
   */
  static async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.params

      if (!token) {
        throw new AppError(400, 'Verification token is required')
      }

      // Hash token to compare with stored hash
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

      // Find user with the token
      const user = await User.findOne({
        emailVerificationToken: hashedToken,
        emailVerificationExpires: { $gt: Date.now() },
      })

      if (!user) {
        throw new AppError(400, 'Invalid or expired verification token')
      }

      // Verify user email
      user.isEmailVerified = true
      user.accountStatus = 'active'
      user.emailVerificationToken = undefined
      user.emailVerificationExpires = undefined

      // Award "First Step" badge (if not already awarded)
      if (!user.badges.includes('First Step')) {
        user.badges.push('First Step')
      }

      // Save user
      await user.save()

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
   */
  static async resendVerificationEmail(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { email } = req.body

      // Find user by email
      const user = await User.findOne({ email: email.toLowerCase() })

      if (!user) {
        // Don't reveal that email doesn't exist
        return res.status(200).json({
          status: 'success',
          message: 'If your email is registered, a verification link will be sent.',
        })
      }

      // Check if email is already verified
      if (user.isEmailVerified) {
        return res.status(200).json({
          status: 'success',
          message: 'Your email is already verified. You can log in.',
        })
      }

      // Generate new verification token
      const verificationToken = await user.generateEmailVerificationToken()

      // Send verification email
      await EmailService.sendVerificationEmail(user.email, verificationToken, req)

      res.status(200).json({
        status: 'success',
        message: 'Verification email sent. Please check your inbox.',
      })
    } catch (error) {
      logger.error('Error resending verification email:', error)
      next(error)
    }
  }

  /**
   * Forgot password
   */
  static async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body

      // Find user by email
      const user = await User.findOne({ email: email.toLowerCase() })

      if (!user) {
        // Don't reveal that email doesn't exist
        return res.status(200).json({
          status: 'success',
          message: 'If your email is registered, a password reset link will be sent.',
        })
      }

      // Generate password reset token
      const resetToken = await user.generatePasswordResetToken()

      // Send password reset email
      await EmailService.sendPasswordResetEmail(user.email, resetToken, req)

      res.status(200).json({
        status: 'success',
        message: 'Password reset email sent. Please check your inbox.',
      })
    } catch (error) {
      logger.error('Error sending password reset email:', error)
      next(error)
    }
  }

  /**
   * Reset password
   */
  static async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.params
      const { password, confirmPassword } = req.body

      if (!token) {
        throw new AppError(400, 'Reset token is required')
      }

      // Check if passwords match
      if (password !== confirmPassword) {
        throw new AppError(400, 'Passwords do not match')
      }

      // Validate password strength
      const passwordValidation = PasswordUtils.validatePasswordStrength(password)
      if (!passwordValidation.isValid) {
        throw new AppError(400, passwordValidation.message)
      }

      // Hash token to compare with stored hash
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

      // Find user with the token
      const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() },
      })

      if (!user) {
        throw new AppError(400, 'Invalid or expired reset token')
      }

      // Update password
      user.password = password
      user.passwordResetToken = undefined
      user.passwordResetExpires = undefined

      // Reset login attempts
      user.loginAttempts = 0
      user.lockUntil = undefined

      // Save user
      await user.save()

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
   */
  static async setupTwoFactor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user._id

      // Find user
      const user = await User.findById(userId)

      if (!user) {
        throw new AppError(404, 'User not found')
      }

      // Generate secret for 2FA
      // In a real implementation, use libraries like speakeasy
      const twoFactorSecret = crypto.randomBytes(32).toString('hex')

      // Generate backup codes
      const backupCodes = []
      for (let i = 0; i < 10; i++) {
        backupCodes.push(crypto.randomBytes(4).toString('hex').toUpperCase())
      }

      // Save to user but don't enable 2FA yet
      user.twoFactorSecret = twoFactorSecret
      user.backupCodes = backupCodes
      await user.save()

      // In a real implementation, generate QR code for scanning

      res.status(200).json({
        status: 'success',
        message: 'Two-factor authentication setup initiated',
        data: {
          secret: twoFactorSecret, // Would be shown as QR code
          backupCodes,
        },
      })
    } catch (error) {
      logger.error('Error setting up two-factor authentication:', error)
      next(error)
    }
  }

  /**
   * Verify and enable two-factor authentication
   */
  static async verifyAndEnableTwoFactor(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = (req as any).user._id
      const { verificationCode } = req.body

      // Find user
      const user = await User.findById(userId)

      if (!user) {
        throw new AppError(404, 'User not found')
      }

      if (!user.twoFactorSecret) {
        throw new AppError(400, 'Two-factor authentication not set up yet')
      }

      // Verify code - in real implementation use speakeasy
      const isValidCode = verificationCode === '123456' // Mock validation

      if (!isValidCode) {
        throw new AppError(401, 'Invalid verification code')
      }

      // Enable 2FA
      user.twoFactorEnabled = true
      await user.save()

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
   */
  static async disableTwoFactor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user._id
      const { password } = req.body

      // Find user
      const user = await User.findById(userId).select('+password')

      if (!user) {
        throw new AppError(404, 'User not found')
      }

      // Verify password
      const isPasswordCorrect = await user.comparePassword(password)

      if (!isPasswordCorrect) {
        throw new AppError(401, 'Invalid password')
      }

      // Disable 2FA
      user.twoFactorEnabled = false
      user.twoFactorSecret = undefined
      user.backupCodes = undefined
      await user.save()

      res.status(200).json({
        status: 'success',
        message: 'Two-factor authentication disabled successfully',
      })
    } catch (error) {
      logger.error('Error disabling two-factor authentication:', error)
      next(error)
    }
  }
}
