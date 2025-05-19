import speakeasy from 'speakeasy'
import QRCode from 'qrcode'
import crypto from 'crypto'
import { IUser } from '../models/user.model'
import { logger } from '../utils/logger'
import { AppError } from '../middleware/error-handler'

/**
 * Two-Factor Authentication Service using Speakeasy
 */
export class TwoFactorService {
  private static readonly APP_NAME = 'PledgePoint'
  private static readonly TOTP_WINDOW = 2 // Allow 2 windows (previous, current, next)
  private static readonly BACKUP_CODES_COUNT = 8

  /**
   * Generate secret for TOTP setup
   */
  static generateSecret(userEmail: string): {
    secret: string
    qrCodeUrl: string
    manualEntryKey: string
  } {
    try {
      const secret = speakeasy.generateSecret({
        name: userEmail,
        issuer: this.APP_NAME,
        length: 32,
      })

      return {
        secret: secret.base32,
        qrCodeUrl: secret.otpauth_url || '',
        manualEntryKey: secret.base32,
      }
    } catch (error) {
      logger.error('Error generating 2FA secret:', error)
      throw new AppError(500, 'Failed to generate 2FA secret')
    }
  }

  /**
   * Generate QR code as data URL
   */
  static async generateQRCode(otpauthUrl: string): Promise<string> {
    try {
      const qrCodeDataURL = await QRCode.toDataURL(otpauthUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      })
      return qrCodeDataURL
    } catch (error) {
      logger.error('Error generating QR code:', error)
      throw new AppError(500, 'Failed to generate QR code')
    }
  }

  /**
   * Verify TOTP token
   */
  static verifyToken(secret: string, token: string): boolean {
    try {
      return speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: this.TOTP_WINDOW,
      })
    } catch (error) {
      logger.error('Error verifying TOTP token:', error)
      return false
    }
  }

  /**
   * Generate backup codes
   */
  static generateBackupCodes(): {
    codes: string[]
    hashedCodes: string[]
  } {
    try {
      const codes: string[] = []
      const hashedCodes: string[] = []

      for (let i = 0; i < this.BACKUP_CODES_COUNT; i++) {
        // Generate 8-character alphanumeric code
        const code = crypto.randomBytes(4).toString('hex').toUpperCase()

        // Format with dash for readability (e.g., A1B2-C3D4)
        const formattedCode = `${code.substring(0, 4)}-${code.substring(4, 8)}`

        // Hash the code for storage
        const hashedCode = crypto.createHash('sha256').update(formattedCode).digest('hex')

        codes.push(formattedCode)
        hashedCodes.push(hashedCode)
      }

      return { codes, hashedCodes }
    } catch (error) {
      logger.error('Error generating backup codes:', error)
      throw new AppError(500, 'Failed to generate backup codes')
    }
  }

  /**
   * Verify backup code
   */
  static verifyBackupCode(
    providedCode: string,
    hashedCodes: string[]
  ): {
    isValid: boolean
    usedCodeIndex?: number
  } {
    try {
      // Hash the provided code
      const hashedProvidedCode = crypto
        .createHash('sha256')
        .update(providedCode.toUpperCase())
        .digest('hex')

      // Find matching code
      const codeIndex = hashedCodes.findIndex((hash) => hash === hashedProvidedCode)

      if (codeIndex !== -1) {
        return {
          isValid: true,
          usedCodeIndex: codeIndex,
        }
      }

      return { isValid: false }
    } catch (error) {
      logger.error('Error verifying backup code:', error)
      return { isValid: false }
    }
  }

  /**
   * Complete 2FA setup and verification
   */
  static async setupTwoFactor(user: IUser): Promise<{
    secret: string
    qrCodeDataURL: string
    manualEntryKey: string
    backupCodes: string[]
  }> {
    try {
      // Generate TOTP secret
      const secretData = this.generateSecret(user.email)

      // Generate QR code
      const qrCodeDataURL = await this.generateQRCode(secretData.qrCodeUrl)

      // Generate backup codes
      const { codes: backupCodes, hashedCodes } = this.generateBackupCodes()

      // Store secret and hashed backup codes (don't enable 2FA yet)
      user.twoFactorSecret = secretData.secret
      user.backupCodes = hashedCodes
      user.twoFactorEnabled = false // Will be enabled after verification

      await user.save()

      return {
        secret: secretData.secret,
        qrCodeDataURL,
        manualEntryKey: secretData.manualEntryKey,
        backupCodes, // Return plain codes for user to save
      }
    } catch (error) {
      logger.error(`Error setting up 2FA for user ${user._id}:`, error)
      throw new AppError(500, 'Failed to setup two-factor authentication')
    }
  }

  /**
   * Verify and enable 2FA
   */
  static async verifyAndEnable(user: IUser, verificationCode: string): Promise<void> {
    try {
      if (!user.twoFactorSecret) {
        throw new AppError(400, 'Two-factor authentication not set up')
      }

      // Verify the TOTP code
      const isValid = this.verifyToken(user.twoFactorSecret, verificationCode)

      if (!isValid) {
        throw new AppError(401, 'Invalid verification code')
      }

      // Enable 2FA
      user.twoFactorEnabled = true
      await user.save()

      logger.info(`Two-factor authentication enabled for user ${user._id}`)
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      logger.error(`Error enabling 2FA for user ${user._id}:`, error)
      throw new AppError(500, 'Failed to enable two-factor authentication')
    }
  }

  /**
   * Disable 2FA
   */
  static async disable(user: IUser, password: string): Promise<void> {
    try {
      // Verify password first
      const isPasswordValid = await user.comparePassword(password)
      if (!isPasswordValid) {
        throw new AppError(401, 'Invalid password')
      }

      // Disable 2FA and clear secrets
      user.twoFactorEnabled = false
      user.twoFactorSecret = undefined
      user.backupCodes = undefined

      await user.save()

      logger.info(`Two-factor authentication disabled for user ${user._id}`)
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      logger.error(`Error disabling 2FA for user ${user._id}:`, error)
      throw new AppError(500, 'Failed to disable two-factor authentication')
    }
  }

  /**
   * Verify 2FA code during login
   */
  static verifyLoginCode(
    user: IUser,
    code: string
  ): {
    isValid: boolean
    isBackupCode?: boolean
    usedBackupCodeIndex?: number
  } {
    try {
      if (!user.twoFactorEnabled || !user.twoFactorSecret) {
        return { isValid: false }
      }

      // First try TOTP verification
      if (this.verifyToken(user.twoFactorSecret, code)) {
        return { isValid: true, isBackupCode: false }
      }

      // If TOTP fails, try backup codes
      if (user.backupCodes && user.backupCodes.length > 0) {
        const backupResult = this.verifyBackupCode(code, user.backupCodes)
        if (backupResult.isValid) {
          return {
            isValid: true,
            isBackupCode: true,
            usedBackupCodeIndex: backupResult.usedCodeIndex,
          }
        }
      }

      return { isValid: false }
    } catch (error) {
      logger.error(`Error verifying 2FA code for user ${user._id}:`, error)
      return { isValid: false }
    }
  }

  /**
   * Remove used backup code
   */
  static async removeUsedBackupCode(user: IUser, usedCodeIndex: number): Promise<void> {
    try {
      if (!user.backupCodes || !user.backupCodes[usedCodeIndex]) {
        return
      }

      // Remove the used backup code
      user.backupCodes.splice(usedCodeIndex, 1)
      await user.save()

      logger.info(
        `Backup code used and removed for user ${user._id}. Remaining: ${user.backupCodes.length}`
      )

      // Warn user if running low on backup codes
      if (user.backupCodes.length <= 2) {
        logger.warn(`User ${user._id} has only ${user.backupCodes.length} backup codes remaining`)
        // Here you could trigger a notification to the user
      }
    } catch (error) {
      logger.error(`Error removing used backup code for user ${user._id}:`, error)
    }
  }

  /**
   * Generate new backup codes (invalidates existing ones)
   */
  static async regenerateBackupCodes(user: IUser): Promise<string[]> {
    try {
      if (!user.twoFactorEnabled) {
        throw new AppError(400, 'Two-factor authentication is not enabled')
      }

      const { codes, hashedCodes } = this.generateBackupCodes()

      user.backupCodes = hashedCodes
      await user.save()

      logger.info(`New backup codes generated for user ${user._id}`)

      return codes // Return plain codes for user to save
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      logger.error(`Error regenerating backup codes for user ${user._id}:`, error)
      throw new AppError(500, 'Failed to regenerate backup codes')
    }
  }

  /**
   * Get 2FA status for user
   */
  static getTwoFactorStatus(user: IUser): {
    enabled: boolean
    hasBackupCodes: boolean
    backupCodesCount: number
    secretConfigured: boolean
  } {
    return {
      enabled: user.twoFactorEnabled || false,
      hasBackupCodes: !!(user.backupCodes && user.backupCodes.length > 0),
      backupCodesCount: user.backupCodes ? user.backupCodes.length : 0,
      secretConfigured: !!user.twoFactorSecret,
    }
  }

  /**
   * Validate TOTP setup during testing
   */
  static validateTOTPSetup(secret: string, testCode: string): boolean {
    try {
      return this.verifyToken(secret, testCode)
    } catch (error) {
      logger.error('Error validating TOTP setup:', error)
      return false
    }
  }
}
