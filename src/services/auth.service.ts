import mongoose from 'mongoose'
import crypto from 'crypto'
import { IUser, User } from '../models/user.model'
import { TokenService } from './token.service'
import { EmailService } from './email.service'
import { AppError } from '../middleware/error-handler'
import { logger } from '../utils/logger'
import { Request } from 'express'
import { PasswordUtils } from '../utils/password'

export class AuthService {
  static async registerUser(
    userData: {
      firstName: string
      lastName: string
      email: string
      password: string
    },
    req: Request
  ): Promise<{ user: any; verificationToken: string }> {
    const { firstName, lastName, email, password } = userData

    const existingUser = await User.findOne({ email: email.toLowerCase() })
    if (existingUser) {
      throw new AppError(409, 'Email already in use')
    }

    // Validate password strength
    const passwordValidation = PasswordUtils.validatePasswordStrength(password)
    if (!passwordValidation.isValid) {
      throw new AppError(400, passwordValidation.message)
    }

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

    try {
      await user.save()
      await EmailService.sendVerificationEmail(user.email, verificationToken, req)
      setTimeout(
        async () => {
          const notVerifiedUser = (await User.findOne({
            _id: user._id,
            isEmailVerified: false,
          })) as IUser
          if (notVerifiedUser) {
            await EmailService.sendVerificationReminderEmail(
              notVerifiedUser,
              notVerifiedUser.firstName,
              {} as Request
            )
          }
        },
        24 * 60 * 60 * 1000
      )

      return this.generateAuthTokens(user)
    } catch (error) {}

    // Save user

    // Send verification email
    await EmailService.sendVerificationEmail(user.email, verificationToken, req)

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

    return { user: userResponse, verificationToken }
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

      // Verify 2FA code - would use something like speakeasy in production
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
  }

  static async logoutUser(userId: string): Promise<void> {
    await User.findByIdAndUpdate(userId, { refreshToken: null })
  }

  static async refreshToken(refreshToken: string): Promise<{
    accessToken: string
    refreshToken: string
  }> {
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
  }

  static async verifyEmail(token: string): Promise<void> {
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
  }

  static async resendVerificationEmail(email: string, req: Request): Promise<string> {
    const user = await User.findOne({ email: email.toLowerCase() })

    if (!user) {
      return 'If your email is registered, a verification link will be sent.'
    }

    if (user.isEmailVerified) {
      return 'Your email is already verified. You can log in.'
    }

    const verificationToken = await this.generateVerificationToken(user)
    await EmailService.sendVerificationEmail(user.email, verificationToken, req)

    return 'Verification email sent. Please check your inbox.'
  }

  static async forgotPassword(email: string, req: Request): Promise<string> {
    const user = await User.findOne({ email: email.toLowerCase() })

    if (!user) {
      return 'If your email is registered, a password reset link will be sent.'
    }

    const resetToken = await this.generatePasswordResetToken(user)
    await EmailService.sendPasswordResetEmail(user.email, resetToken, req)

    return 'Password reset email sent. Please check your inbox.'
  }

  static async resetPassword(
    token: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<void> {
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
  }

  /**
   * Verify and enable two-factor authentication
   * @param userId User ID
   * @param verificationCode Verification code
   */
  static async verifyAndEnableTwoFactor(userId: string, verificationCode: string): Promise<void> {
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
  }

  /**
   * Disable two-factor authentication
   * @param userId User ID
   * @param password User password for verification
   */
  static async disableTwoFactor(userId: string, password: string): Promise<void> {
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
  }

  /**
   * Generate email verification token
   * @param user User document
   * @returns Verification token
   * @private
   */
  private static async generateVerificationToken(user: any): Promise<string> {
    // Generate random token
    const verificationToken = crypto.randomBytes(32).toString('hex')

    // Hash token and save to database
    user.emailVerificationToken = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex')

    // Set expiration (24 hours)
    user.emailVerificationExpires = Date.now() + 86400000

    await user.save()

    return verificationToken
  }

  private static async generatePasswordResetToken(user: any): Promise<string> {
    const resetToken = crypto.randomBytes(32).toString('hex')

    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex')
    user.passwordResetExpires = Date.now() + 3600000

    await user.save()

    return resetToken
  }

  private static verifyTwoFactorCode(user: any, code: string): boolean {
    return code === '123456' || (user.backupCodes && user.backupCodes.includes(code))
  }
}
