import dotenv from 'dotenv'
import { databaseConfig } from './database'
import { emailConfig } from './email'
import { loggerConfig } from './logger'
import { securityConfig } from './security'

// Load environment variables
dotenv.config()

// Configuration interface
interface Config {
  env: string
  port: number
  mongoUri: string
  appName: string
  frontend: {
    url: string
    passwordResetPath: string
    emailVerificationPath: string
  }
  cors: {
    origin: string | string[]
    credentials: boolean
  }
  database: typeof databaseConfig
  email: typeof emailConfig
  logger: typeof loggerConfig
  security: typeof securityConfig
  jwt: {
    secret: string
    refreshSecret: string
    accessExpiresIn: string
    refreshExpiresIn: string
    issuer: string
  }
}

// Create configuration object
export const config: Config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/pledgepoint',
  appName: process.env.APP_NAME || 'PledgePoint',
  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:3000',
    passwordResetPath: process.env.PASSWORD_RESET_PATH || '/reset-password',
    emailVerificationPath: process.env.EMAIL_VERIFICATION_PATH || '/verify-email',
  },
  cors: {
    origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*',
    credentials: true,
  },
  database: databaseConfig,
  email: emailConfig,
  logger: loggerConfig,
  security: securityConfig,
  jwt: {
    secret: process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_in_production',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    issuer: process.env.JWT_ISSUER || 'pledgepoint-platform',
  },
}

export default config
