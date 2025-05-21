import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Email configuration interface
interface EmailConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
  from: string
  replyTo: string
  logoUrl: string
  footer: string
  templates: {
    emailVerification: string
    passwordReset: string
    welcome: string
    notification: string
    badgeEarned: string
    campaignSuccess: string
    weeklyDigest: string
  }
  rateLimits: {
    window: number
    max: number
  }
}

// Create email configuration
export const emailConfig: EmailConfig = {
  host: process.env.EMAIL_HOST || 'pledgepoint-mailhog',
  port: parseInt(process.env.EMAIL_PORT || '1025', 10),
  secure: process.env.EMAIL_SECURE === 'false',
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASSWORD || '',
  },
  from: process.env.EMAIL_FROM || 'pledgepoint@example.com',
  replyTo: process.env.EMAIL_REPLY_TO || 'support@example.com',
  logoUrl: process.env.EMAIL_LOGO_URL || '/logo.png',
  footer: process.env.EMAIL_FOOTER || '© 2025 PledgePoint. All rights reserved.',
  templates: {
    emailVerification: 'email-verification',
    passwordReset: 'password-reset',
    welcome: 'welcome',
    notification: 'notification',
    badgeEarned: 'badge-earned',
    campaignSuccess: 'campaign-success',
    weeklyDigest: 'weekly-digest',
  },
  rateLimits: {
    window: parseInt(process.env.EMAIL_RATE_LIMIT_WINDOW || '3600', 10), // 1 hour in seconds
    max: parseInt(process.env.EMAIL_RATE_LIMIT_MAX || '20', 10), // 20 emails per window
  },
}
