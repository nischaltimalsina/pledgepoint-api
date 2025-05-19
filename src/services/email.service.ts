import nodemailer from 'nodemailer'
import { Request } from 'express'
import { config } from '../config'
import { logger } from '../utils/logger'
import { IUser } from '../models/user.model'

/**
 * Service for sending emails
 */
export class EmailService {
  private static transporter: nodemailer.Transporter
  private static initialized = false

  /**
   * Initialize email service
   */
  private static async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      // Create transporter
      this.transporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure,
        auth: {
          user: config.email.auth.user,
          pass: config.email.auth.pass,
        },
        tls: {
          rejectUnauthorized: false, // For development environments with self-signed certs
        },
      })

      // Verify connection
      await this.transporter.verify()

      this.initialized = true
      logger.info('Email service initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize email service:', error)
      throw new Error(`Email service initialization failed: ${(error as Error).message}`)
    }
  }

  /**
   * Send an email
   * @param options Email options
   */
  private static async sendEmail(options: {
    to: string | string[]
    subject: string
    html: string
    text?: string
    template?: string
    data?: Record<string, any>
    attachments?: any[]
    cc?: string | string[]
    bcc?: string | string[]
    priority?: 'low' | 'normal' | 'high'
    category?: string
  }): Promise<void> {
    try {
      if (!this.initialized) {
        await this.initialize()
      }

      const mailOptions = {
        from: `"${config.appName}" <${config.email.from}>`,
        to: options.to,
        cc: options.cc,
        bcc: options.bcc,
        subject: options.subject,
        text: options.text || '',
        html: options.html,
        attachments: options.attachments,
        priority: options.priority || 'normal',
        headers: options.category ? { 'X-Category': options.category } : undefined,
      }

      await this.transporter.sendMail(mailOptions)
      logger.info(`Email sent to ${options.to}`)
    } catch (error) {
      logger.error('Failed to send email:', error)
      throw new Error(`Failed to send email: ${(error as Error).message}`)
    }
  }

  /**
   * Send verification email
   * @param email User's email address
   * @param token Verification token
   * @param req Express request object for building URLs
   */
  static async sendVerificationEmail(email: string, token: string, req: Request): Promise<void> {
    try {
      // Build verification URL
      const verifyUrl = `${config.frontend.url}${config.frontend.emailVerificationPath}/${token}`

      // Build email HTML
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #4A90E2; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">PledgePoint</h1>
          </div>
          <div style="padding: 20px; border: 1px solid #eee;">
            <h2>Email Verification</h2>
            <p>Thank you for registering with PledgePoint. Please verify your email address to activate your account.</p>
            <p style="margin: 30px 0; text-align: center;">
              <a href="${verifyUrl}"
                 style="background-color: #4A90E2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                Verify Email
              </a>
            </p>
            <p>Or copy and paste this link in your browser:</p>
            <p style="word-break: break-all;">${verifyUrl}</p>
            <p>This verification link will expire in 24 hours.</p>
            <p>If you did not create an account with PledgePoint, please ignore this email.</p>
          </div>
          <div style="padding: 20px; text-align: center; color: #777; font-size: 12px;">
            <p>© ${new Date().getFullYear()} PledgePoint. All rights reserved.</p>
          </div>
        </div>
      `

      const text = `
        PledgePoint - Email Verification

        Thank you for registering with PledgePoint. Please verify your email address to activate your account.

        Verify your email by visiting this link:
        ${verifyUrl}

        This verification link will expire in 24 hours.

        If you did not create an account with PledgePoint, please ignore this email.

        © ${new Date().getFullYear()} PledgePoint. All rights reserved.
      `

      // Send email
      await this.sendEmail({
        to: email,
        subject: 'Verify Your PledgePoint Account',
        html,
        text,
        priority: 'high',
        category: 'account',
      })
    } catch (error) {
      logger.error('Failed to send verification email:', error)
      throw new Error(`Failed to send verification email: ${(error as Error).message}`)
    }
  }

  /**
   * Send verification reminder email
   * @param user User object
   * @param firstName User's first name
   * @param req Express request object for building URLs
   */
  static async sendVerificationReminderEmail(
    user: IUser,
    firstName: string,
    req: Request
  ): Promise<void> {
    try {
      // Build verification URL
      const verifyUrl = `${config.frontend.url}${config.frontend.emailVerificationPath}`

      // Build email HTML
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #4A90E2; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">PledgePoint</h1>
          </div>
          <div style="padding: 20px; border: 1px solid #eee;">
            <h2>Email Verification Reminder</h2>
            <p>Hello ${firstName},</p>
            <p>We noticed that you haven't verified your email address yet. Please verify your email to access all features of PledgePoint.</p>
            <p style="margin: 30px 0; text-align: center;">
              <a href="${verifyUrl}"
                 style="background-color: #4A90E2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                Verify Email
              </a>
            </p>
            <p>Or you can request a new verification link from the login page.</p>
            <p>If you did not create an account with PledgePoint, please ignore this email.</p>
          </div>
          <div style="padding: 20px; text-align: center; color: #777; font-size: 12px;">
            <p>© ${new Date().getFullYear()} PledgePoint. All rights reserved.</p>
          </div>
        </div>
      `

      const text = `
        PledgePoint - Email Verification Reminder

        Hello ${firstName},

        We noticed that you haven't verified your email address yet. Please verify your email to access all features of PledgePoint.

        You can verify your email or request a new verification link from the login page:
        ${verifyUrl}

        If you did not create an account with PledgePoint, please ignore this email.

        © ${new Date().getFullYear()} PledgePoint. All rights reserved.
      `

      // Send email
      await this.sendEmail({
        to: user.email,
        subject: 'Verify Your Email - Reminder',
        html,
        text,
        priority: 'high',
        category: 'account',
      })
    } catch (error) {
      logger.error('Failed to send verification reminder email:', error)
      // Don't throw error for reminder emails to avoid breaking application flow
    }
  }

  /**
   * Send password reset email
   * @param email User's email address
   * @param token Reset token
   * @param req Express request object for building URLs
   */
  static async sendPasswordResetEmail(email: string, token: string, req: Request): Promise<void> {
    try {
      // Build reset URL
      const resetUrl = `${config.frontend.url}${config.frontend.passwordResetPath}/${token}`

      // Build email HTML
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #4A90E2; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">PledgePoint</h1>
          </div>
          <div style="padding: 20px; border: 1px solid #eee;">
            <h2>Password Reset</h2>
            <p>We received a request to reset your password. Click the button below to set a new password:</p>
            <p style="margin: 30px 0; text-align: center;">
              <a href="${resetUrl}"
                 style="background-color: #4A90E2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                Reset Password
              </a>
            </p>
            <p>Or copy and paste this link in your browser:</p>
            <p style="word-break: break-all;">${resetUrl}</p>
            <p>This password reset link will expire in 1 hour.</p>
            <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
          </div>
          <div style="padding: 20px; text-align: center; color: #777; font-size: 12px;">
            <p>© ${new Date().getFullYear()} PledgePoint. All rights reserved.</p>
          </div>
        </div>
      `

      const text = `
        PledgePoint - Password Reset

        We received a request to reset your password. Use the link below to set a new password:

        ${resetUrl}

        This password reset link will expire in 1 hour.

        If you did not request a password reset, please ignore this email or contact support if you have concerns.

        © ${new Date().getFullYear()} PledgePoint. All rights reserved.
      `

      // Send email
      await this.sendEmail({
        to: email,
        subject: 'Reset Your PledgePoint Password',
        html,
        text,
        priority: 'high',
        category: 'account',
      })
    } catch (error) {
      logger.error('Failed to send password reset email:', error)
      throw new Error(`Failed to send password reset email: ${(error as Error).message}`)
    }
  }

  /**
   * Send badge earned notification
   * @param email User's email address
   * @param badgeName Name of the earned badge
   * @param badgeDescription Description of the badge
   */
  static async sendBadgeEarnedEmail(
    email: string,
    badgeName: string,
    badgeDescription: string
  ): Promise<void> {
    try {
      // Build profile URL
      const profileUrl = `${config.frontend.url}/profile/badges`

      // Build email HTML
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #4A90E2; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">PledgePoint</h1>
          </div>
          <div style="padding: 20px; border: 1px solid #eee; text-align: center;">
            <h2>Congratulations! You've Earned a Badge</h2>
            <div style="background-color: #f8f8f8; border-radius: 50%; width: 100px; height: 100px; margin: 20px auto; display: flex; align-items: center; justify-content: center;">
              <span style="font-size: 40px;">🏆</span>
            </div>
            <h3 style="color: #4A90E2;">${badgeName}</h3>
            <p>${badgeDescription}</p>
            <p style="margin: 30px 0;">
              <a href="${profileUrl}"
                 style="background-color: #4A90E2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                View Your Badges
              </a>
            </p>
            <p>Keep up the great civic participation!</p>
          </div>
          <div style="padding: 20px; text-align: center; color: #777; font-size: 12px;">
            <p>© ${new Date().getFullYear()} PledgePoint. All rights reserved.</p>
            <p>You can manage email notifications in your <a href="${config.frontend.url}/settings">account settings</a>.</p>
          </div>
        </div>
      `

      const text = `
        PledgePoint - You've Earned a Badge!

        Congratulations! You've earned the "${badgeName}" badge.

        ${badgeDescription}

        View your badges: ${profileUrl}

        Keep up the great civic participation!

        © ${new Date().getFullYear()} PledgePoint. All rights reserved.

        You can manage email notifications in your account settings: ${config.frontend.url}/settings
      `

      // Send email
      await this.sendEmail({
        to: email,
        subject: `PledgePoint: You've Earned the ${badgeName} Badge!`,
        html,
        text,
        category: 'gamification',
      })
    } catch (error) {
      logger.error('Failed to send badge earned email:', error)
      // Don't throw error for notification emails
    }
  }

  /**
   * Send level up notification
   * @param email User's email address
   * @param newLevel New user level
   * @param unlockedFeatures Array of features unlocked at this level
   */
  static async sendLevelUpEmail(
    email: string,
    newLevel: string,
    unlockedFeatures: string[]
  ): Promise<void> {
    try {
      // Build profile URL
      const profileUrl = `${config.frontend.url}/profile`

      // Format level name
      const levelName = newLevel.charAt(0).toUpperCase() + newLevel.slice(1)

      // Build email HTML
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #4A90E2; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">PledgePoint</h1>
          </div>
          <div style="padding: 20px; border: 1px solid #eee; text-align: center;">
            <h2>Congratulations! You've Leveled Up</h2>
            <div style="background-color: #f8f8f8; border-radius: 50%; width: 100px; height: 100px; margin: 20px auto; display: flex; align-items: center; justify-content: center;">
              <span style="font-size: 40px;">⭐</span>
            </div>
            <h3 style="color: #4A90E2;">You are now a ${levelName}!</h3>
            <p>Your civic engagement has earned you a new level. Here's what you've unlocked:</p>
            <ul style="text-align: left; display: inline-block;">
              ${unlockedFeatures.map((feature) => `<li>${feature}</li>`).join('')}
            </ul>
            <p style="margin: 30px 0;">
              <a href="${profileUrl}"
                 style="background-color: #4A90E2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                View Your Profile
              </a>
            </p>
            <p>Thank you for your continued participation in our democratic process!</p>
          </div>
          <div style="padding: 20px; text-align: center; color: #777; font-size: 12px;">
            <p>© ${new Date().getFullYear()} PledgePoint. All rights reserved.</p>
            <p>You can manage email notifications in your <a href="${config.frontend.url}/settings">account settings</a>.</p>
          </div>
        </div>
      `

      const text = `
        PledgePoint - You've Leveled Up!

        Congratulations! You are now a ${levelName}!

        Your civic engagement has earned you a new level. Here's what you've unlocked:
        ${unlockedFeatures.map((feature) => `- ${feature}`).join('\n')}

        View your profile: ${profileUrl}

        Thank you for your continued participation in our democratic process!

        © ${new Date().getFullYear()} PledgePoint. All rights reserved.

        You can manage email notifications in your account settings: ${config.frontend.url}/settings
      `

      // Send email
      await this.sendEmail({
        to: email,
        subject: `PledgePoint: You've Leveled Up to ${levelName}!`,
        html,
        text,
        category: 'gamification',
      })
    } catch (error) {
      logger.error('Failed to send level up email:', error)
      // Don't throw error for notification emails
    }
  }

  /**
   * Send welcome email after email verification
   * @param email User's email address
   * @param firstName User's first name
   */
  static async sendWelcomeEmail(email: string, firstName: string): Promise<void> {
    try {
      // Build URLs
      const profileUrl = `${config.frontend.url}/profile`
      const learningUrl = `${config.frontend.url}/learning`
      const campaignsUrl = `${config.frontend.url}/campaigns`

      // Build email HTML
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #4A90E2; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">PledgePoint</h1>
          </div>
          <div style="padding: 20px; border: 1px solid #eee;">
            <h2>Welcome to PledgePoint, ${firstName}!</h2>
            <p>Thank you for joining PledgePoint. Your account is now active, and you're ready to start your civic journey!</p>
            <h3>Getting Started</h3>
            <p>Here are a few things you can do:</p>
            <ul>
              <li>Complete your <a href="${profileUrl}">profile</a> to connect with your local community</li>
              <li>Explore our <a href="${learningUrl}">Civic Learning Hub</a> to earn your first badges</li>
              <li>Join a <a href="${campaignsUrl}">campaign</a> that matters to you</li>
            </ul>
            <p>Remember, every rating, review, and campaign contribution earns you Impact Points that help you level up!</p>
            <p style="margin: 30px 0; text-align: center;">
              <a href="${profileUrl}"
                 style="background-color: #4A90E2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                Complete Your Profile
              </a>
            </p>
          </div>
          <div style="padding: 20px; text-align: center; color: #777; font-size: 12px;">
            <p>© ${new Date().getFullYear()} PledgePoint. All rights reserved.</p>
            <p>You can manage email notifications in your <a href="${config.frontend.url}/settings">account settings</a>.</p>
          </div>
        </div>
      `

      const text = `
        PledgePoint - Welcome!

        Welcome to PledgePoint, ${firstName}!

        Thank you for joining PledgePoint. Your account is now active, and you're ready to start your civic journey!

        Getting Started

        Here are a few things you can do:
        - Complete your profile to connect with your local community: ${profileUrl}
        - Explore our Civic Learning Hub to earn your first badges: ${learningUrl}
        - Join a campaign that matters to you: ${campaignsUrl}

        Remember, every rating, review, and campaign contribution earns you Impact Points that help you level up!

        © ${new Date().getFullYear()} PledgePoint. All rights reserved.

        You can manage email notifications in your account settings: ${config.frontend.url}/settings
      `

      // Send email
      await this.sendEmail({
        to: email,
        subject: 'Welcome to PledgePoint!',
        html,
        text,
        category: 'account',
      })
    } catch (error) {
      logger.error('Failed to send welcome email:', error)
      // Don't throw error for notification emails
    }
  }

  /**
   * Send email for error alerts
   * @param email Recipient's email address
   * @param alert Alert object containing error details
   */
  static async sendAlertEmail(
    email: string,
    alert: {
      type: string
      message: string
      severity: string
      category: string
      error: Error
      count?: number
    }
  ): Promise<void> {
    try {
      // Build email HTML
      const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #4A90E2; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">PledgePoint</h1>
        </div>
        <div style="padding: 20px; border: 1px solid #eee;">
          <h2>Alert from PledgePoint</h2>
          <p><strong>Type:</strong> ${alert.type}</p>
          <p><strong>Message:</strong> ${alert.message}</p>
          <p><strong>Severity:</strong> ${alert.severity}</p>
          <p><strong>Category:</strong> ${alert.category}</p>
          ${alert.count ? `<p><strong>Count:</strong> ${alert.count}</p>` : ''}
          <p><strong>Error Stack:</strong></p>
          <pre style="background: #f4f4f4; padding: 10px; font-size: 12px;">${alert.error.stack}</pre>
        </div>
        <div style="padding: 20px; text-align: center; color: #777; font-size: 12px;">
          <p>© ${new Date().getFullYear()} PledgePoint. All rights reserved.</p>
        </div>
      </div>
    `

      // Build plain text version
      const text = `
PledgePoint - Alert

Type: ${alert.type}
Message: ${alert.message}
Severity: ${alert.severity}
Category: ${alert.category}
${alert.count ? `Count: ${alert.count}\n` : ''}
Error Stack:
${alert.error.stack}

© ${new Date().getFullYear()} PledgePoint. All rights reserved.
    `

      // Send email
      await this.sendEmail({
        to: email,
        subject: `PledgePoint Alert: ${alert.type} [${alert.severity}]`,
        html,
        text,
        category: 'alert',
      })
    } catch (error) {
      logger.error(`Failed to send alert email to ${email}:`, error)
      // Don't throw error for notification emails
    }
  }
}
