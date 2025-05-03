import bcrypt from 'bcrypt'
import crypto from 'crypto'
import { config } from '../config'

/**
 * Password utilities for hashing, comparing, and generating reset tokens
 */
export class PasswordUtils {
  /**
   * Hash a password with bcrypt and an additional pepper
   * @param password Plain text password
   * @returns Hashed password
   */
  static async hashPassword(password: string): Promise<string> {
    // Generate salt
    const salt = await bcrypt.genSalt(config.security.passwordHash.saltRounds)

    // Add pepper to password (server-side secret)
    const pepperedPassword = this.applyPepper(password)

    // Hash password with salt
    return bcrypt.hash(pepperedPassword, salt)
  }

  /**
   * Compare plain text password with hashed password
   * @param candidatePassword Plain text password to check
   * @param hashedPassword Stored hashed password
   * @returns True if passwords match, false otherwise
   */
  static async comparePassword(
    candidatePassword: string,
    hashedPassword: string
  ): Promise<boolean> {
    // Add pepper to candidate password
    const pepperedPassword = this.applyPepper(candidatePassword)

    // Compare passwords
    return bcrypt.compare(pepperedPassword, hashedPassword)
  }

  /**
   * Generate a secure random token for password reset
   * @returns Object containing token and hashed token
   */
  static generatePasswordResetToken(): {
    resetToken: string
    hashedResetToken: string
    expiresAt: Date
  } {
    // Generate random token
    const resetToken = crypto.randomBytes(32).toString('hex')

    // Hash token
    const hashedResetToken = crypto.createHash('sha256').update(resetToken).digest('hex')

    // Set expiration (1 hour from now)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    return {
      resetToken,
      hashedResetToken,
      expiresAt,
    }
  }

  /**
   * Generate a secure random token for email verification
   * @returns Object containing token and hashed token
   */
  static generateEmailVerificationToken(): {
    verificationToken: string
    hashedVerificationToken: string
    expiresAt: Date
  } {
    // Generate random token
    const verificationToken = crypto.randomBytes(32).toString('hex')

    // Hash token
    const hashedVerificationToken = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex')

    // Set expiration (24 hours from now)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    return {
      verificationToken,
      hashedVerificationToken,
      expiresAt,
    }
  }

  /**
   * Generate backup codes for two-factor authentication
   * @param count Number of backup codes to generate
   * @returns Array of backup codes and their hashed versions
   */
  static generateBackupCodes(count: number = config.security.twoFactor.backupCodesCount): {
    codes: string[]
    hashedCodes: string[]
  } {
    const codes: string[] = []
    const hashedCodes: string[] = []

    // Generate specified number of backup codes
    for (let i = 0; i < count; i++) {
      // Generate a 8-character alphanumeric code
      const code = crypto.randomBytes(4).toString('hex').toUpperCase()

      // Format code with a dash for readability (e.g., 1A2B-3C4D)
      const formattedCode = `${code.substring(0, 4)}-${code.substring(4, 8)}`

      // Hash code
      const hashedCode = crypto.createHash('sha256').update(formattedCode).digest('hex')

      codes.push(formattedCode)
      hashedCodes.push(hashedCode)
    }

    return { codes, hashedCodes }
  }

  /**
   * Apply pepper to password
   * @param password Plain text password
   * @returns Peppered password
   * @private
   */
  private static applyPepper(password: string): string {
    return `${password}${config.security.passwordHash.pepper}`
  }

  /**
   * Validate password against common password rules
   * @param password Password to validate
   * @returns Object with validation result and message
   */
  static validatePasswordStrength(password: string): {
    isValid: boolean
    message: string
  } {
    // Minimum length check
    if (password.length < 8) {
      return {
        isValid: false,
        message: 'Password must be at least 8 characters',
      }
    }

    // Check for uppercase letter
    if (!/[A-Z]/.test(password)) {
      return {
        isValid: false,
        message: 'Password must contain at least one uppercase letter',
      }
    }

    // Check for lowercase letter
    if (!/[a-z]/.test(password)) {
      return {
        isValid: false,
        message: 'Password must contain at least one lowercase letter',
      }
    }

    // Check for number
    if (!/[0-9]/.test(password)) {
      return {
        isValid: false,
        message: 'Password must contain at least one number',
      }
    }

    // Check for special character
    if (!/[^A-Za-z0-9]/.test(password)) {
      return {
        isValid: false,
        message: 'Password must contain at least one special character',
      }
    }

    return {
      isValid: true,
      message: 'Password meets strength requirements',
    }
  }
}
