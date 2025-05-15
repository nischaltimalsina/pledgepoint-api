import mongoose from 'mongoose'
import crypto from 'crypto'
import { IUser, User } from '../models/user.model'
import { TokenService } from './token.service'
import { EmailService } from './email.service'
import { AppError } from '../middleware/error-handler'
import { logger } from '../utils/logger'
import { Request } from 'express'
import { PasswordUtils } from '../utils/password'

/**
 * Authentication service
 */
export class AuthService {
  /**
   * Register a new user
   * @param userData User registration data
   * @param req Express request for building email URLs
   * @returns Registered user and token info
   */
  static async registerUser(
    userData: {
      firstName: string
      lastName: string
      email: string
      password: string
    },
    req: Request
  ): Promise<{
    user: any
    verificationToken?: string
    accessToken?: string
    refreshToken?: string
  }> {
    try {
      const { firstName, lastName, email, password } = userData

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
        badges: [],
        loginAttempts: 0,
      })

      // Generate email verification token
      const verificationToken = await user.generateEmailVerificationToken()

      // Save user
      await user.save()

      // Send verification email
      await EmailService.sendVerificationEmail(user.email, verificationToken, req)

      // Schedule a reminder email after 24 hours if not verified
      setTimeout(
        async () => {
          try {
            const notVerifiedUser = await User.findOne({
              _id: user._id,
              isEmailVerified: false,
            })

            if (notVerifiedUser) {
              await EmailService.sendVerificationReminderEmail(
                notVerifiedUser,
                notVerifiedUser.firstName,
                req
              )
            }
          } catch (error) {
            logger.error('Error sending verification reminder:', error)
          }
        },
        24 * 60 * 60 * 1000
      ) // 24 hours

      // Return user without sensitive data
      const userResponse = {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        accountStatus: user.accountStatus,
        level: user.level,
      }

      // Generate access and refresh tokens
      const accessToken = TokenService.generateAccessToken(user)
      const refreshToken = TokenService.generateRefreshToken(user)

      return {
        user: userResponse,
        verificationToken,
        accessToken,
        refreshToken,
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      logger.error('Error registering user:', error)
      throw new AppError(500, 'Registration failed')
    }
  }

  /**
   * Login user
   * @param credentials User login credentials
   * @returns User data and tokens
   */
  static async loginUser(credentials: {
    email: string
    password: string
    twoFactorCode?: string
  }): Promise<{
    user: any
    accessToken?: string
    refreshToken?: string
    requiresTwoFactor?: boolean
  }> {
    try {
      const { email, password, twoFactorCode } = credentials

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

      // Check if email is verified
      if (!user.isEmailVerified) {
        throw new AppError(401, 'Please verify your email before logging in')
      }

      // Check if two-factor auth is enabled
      if (user.twoFactorEnabled) {
        // If no code provided, ask for it
        if (!twoFactorCode) {
          return {
            user: {
              _id: user._id,
              email: user.email,
            },
            requiresTwoFactor: true,
          }
        }

        // Verify 2FA code
        const isValidTwoFactorCode = this.verifyTwoFactorCode(user, twoFactorCode)

        if (!isValidTwoFactorCode) {
          throw new AppError(401, 'Invalid two-factor authentication code')
        }
      }

      // Reset login attempts on successful login
      await user.resetLoginAttempts()

      // Generate tokens
      const accessToken = TokenService.generateAccessToken(user)
      const refreshToken = TokenService.generateRefreshToken(user)

      // Update user's refresh token and last login
      user.refreshToken = refreshToken
      user.lastLogin = new Date()
      await user.save()

      // Return user data and token
      return {
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          level: user.level,
          impactPoints: user.impactPoints,
        },
        accessToken,
        refreshToken,
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      logger.error('Error logging in user:', error)
      throw new AppError(500, 'Login failed')
    }
  }

  /**
   * Logout user
   * @param userId User ID
   */
  static async logoutUser(userId: string): Promise<void> {
    try {
      await User.findByIdAndUpdate(userId, { refreshToken: null })
    } catch (error) {
      logger.error('Error logging out user:', error)
      throw new AppError(500, 'Logout failed')
    }
  }

  /**
   * Refresh access token
   * @param refreshToken Refresh token
   * @returns New access and refresh tokens
   */
  static async refreshToken(refreshToken: string): Promise<{
    accessToken: string
    refreshToken: string
  }> {
    try {
      const decoded = TokenService.verifyRefreshToken(refreshToken)

      const user = await User.findOne({
        _id: decoded.id,
        refreshToken,
        active: true,
      })

      if (!user) {
        throw new AppError(401, 'Invalid refresh token')
      }

      const newAccessToken = TokenService.generateAccessToken(user)
      const newRefreshToken = TokenService.generateRefreshToken(user)

      user.refreshToken = newRefreshToken
      await user.save()

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      logger.error('Error refreshing token:', error)
      throw new AppError(401, 'Token refresh failed')
    }
  }

  /**
   * Verify email with token
   * @param token Verification token
   */
  static async verifyEmail(token: string): Promise<void> {
    try {
      if (!token) {
        throw new AppError(400, 'Verification token is required')
      }

      const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

      const user = await User.findOne({
        emailVerificationToken: hashedToken,
        emailVerificationExpires: { $gt: Date.now() },
      })

      if (!user) {
        throw new AppError(400, 'Invalid or expired verification token')
      }

      user.isEmailVerified = true
      user.accountStatus = 'active'
      user.emailVerificationToken = undefined
      user.emailVerificationExpires = undefined

      if (!user.badges.includes('First Step')) {
        user.badges.push('First Step')
      }

      await user.save()

      // Send welcome email
      await EmailService.sendWelcomeEmail(user.email, user.firstName)
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      logger.error('Error verifying email:', error)
      throw new AppError(500, 'Email verification failed')
    }
  }

  /**
   * Resend verification email
   * @param email User's email
   * @param req Express request for building URLs
   * @returns Status message
   */
  static async resendVerificationEmail(email: string, req: Request): Promise<string> {
    try {
      const user = await User.findOne({ email: email.toLowerCase() })

      if (!user) {
        // Don't reveal user existence for security
        return 'If your email is registered, a verification link will be sent.'
      }

      if (user.isEmailVerified) {
        return 'Your email is already verified. You can log in.'
      }

      // Generate new verification token
      const verificationToken = await this.generateVerificationToken(user)

      // Send verification email
      await EmailService.sendVerificationEmail(user.email, verificationToken, req)

      return 'Verification email sent. Please check your inbox.'
    } catch (error) {
      logger.error('Error resending verification email:', error)
      // Don't reveal errors for security
      return 'If your email is registered, a verification link will be sent.'
    }
  }

  /**
   * Forgot password - request password reset
   * @param email User's email
   * @param req Express request for building URLs
   * @returns Status message
   */
  static async forgotPassword(email: string, req: Request): Promise<string> {
    try {
      const user = await User.findOne({ email: email.toLowerCase() })

      if (!user) {
        // Don't reveal user existence for security
        return 'If your email is registered, a password reset link will be sent.'
      }

      // Generate reset token
      const resetToken = await this.generatePasswordResetToken(user)

      // Send password reset email
      await EmailService.sendPasswordResetEmail(user.email, resetToken, req)

      return 'Password reset email sent. Please check your inbox.'
    } catch (error) {
      logger.error('Error sending password reset email:', error)
      // Don't reveal errors for security
      return 'If your email is registered, a password reset link will be sent.'
    }
  }

  /**
   * Reset password with token
   * @param token Reset token
   * @param newPassword New password
   * @param confirmPassword Confirm new password
   */
  static async resetPassword(
    token: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<void> {
    try {
      if (!token) {
        throw new AppError(400, 'Reset token is required')
      }

      // Check if passwords match
      if (newPassword !== confirmPassword) {
        throw new AppError(400, 'Passwords do not match')
      }

      // Validate password strength
      const passwordValidation = PasswordUtils.validatePasswordStrength(newPassword)
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
      user.password = newPassword
      user.passwordResetToken = undefined
      user.passwordResetExpires = undefined

      // Reset login attempts
      user.loginAttempts = 0
      user.lockUntil = undefined

      // Save user
      await user.save()
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      logger.error('Error resetting password:', error)
      throw new AppError(500, 'Password reset failed')
    }
  }

  /**
   * Setup two-factor authentication
   * @param userId User ID
   * @returns 2FA setup data
   */
  static async setupTwoFactor(userId: string): Promise<{
    secret: string
    backupCodes: string[]
  }> {
    try {
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

      return {
        secret: twoFactorSecret,
        backupCodes,
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      logger.error('Error setting up two-factor authentication:', error)
      throw new AppError(500, 'Two-factor authentication setup failed')
    }
  }

  /**
   * Verify and enable two-factor authentication
   * @param userId User ID
   * @param verificationCode Verification code
   */
  static async verifyAndEnableTwoFactor(userId: string, verificationCode: string): Promise<void> {
    try {
      // Find user
      const user = await User.findById(userId)

      if (!user) {
        throw new AppError(404, 'User not found')
      }

      if (!user.twoFactorSecret) {
        throw new AppError(400, 'Two-factor authentication not set up yet')
      }

      // Verify code - in real implementation use speakeasy
      const isValidCode = this.verifyTwoFactorCode(user, verificationCode)

      if (!isValidCode) {
        throw new AppError(401, 'Invalid verification code')
      }

      // Enable 2FA
      user.twoFactorEnabled = true
      await user.save()
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      logger.error('Error enabling two-factor authentication:', error)
      throw new AppError(500, 'Failed to enable two-factor authentication')
    }
  }

  /**
   * Disable two-factor authentication
   * @param userId User ID
   * @param password User password for verification
   */
  static async disableTwoFactor(userId: string, password: string): Promise<void> {
    try {
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
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      logger.error('Error disabling two-factor authentication:', error)
      throw new AppError(500, 'Failed to disable two-factor authentication')
    }
  }

  /**
   * Generate email verification token
   * @param user User document
   * @returns Verification token
   * @private
   */
  private static async generateVerificationToken(user: IUser): Promise<string> {
    // Generate random token
    const verificationToken = crypto.randomBytes(32).toString('hex')

    // Hash token and save to database
    user.emailVerificationToken = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex')

    // Set expiration (24 hours)
    user.emailVerificationExpires = new Date(Date.now() + 86400000)

    await user.save()

    return verificationToken
  }

  /**
   * Generate password reset token
   * @param user User document
   * @returns Reset token
   * @private
   */
  private static async generatePasswordResetToken(user: IUser): Promise<string> {
    // Generate random token
    const resetToken = crypto.randomBytes(32).toString('hex')

    // Hash token and save to database
    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex')

    // Set expiration (1 hour)
    user.passwordResetExpires = new Date(Date.now() + 3600000)

    await user.save()

    return resetToken
  }

  /**
   * Verify two-factor authentication code
   * @param user User document
   * @param code Verification code
   * @returns Whether code is valid
   * @private
   */
  private static verifyTwoFactorCode(user: IUser, code: string): boolean {
    // In a real implementation, use speakeasy to verify TOTP
    // For simplicity, we're just checking if code is "123456" or a backup code

    return code === '123456' || user.backupCodes?.includes(code) !== undefined
  }
}
