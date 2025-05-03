import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Security configuration interface
interface SecurityConfig {
  passwordHash: {
    saltRounds: number
    pepper: string
  }
  rateLimits: {
    window: number
    max: number
  }
  loginAttempts: {
    max: number
    lockoutDuration: number // in seconds
  }
  twoFactor: {
    issuer: string
    window: number
    backupCodesCount: number
  }
  session: {
    secret: string
    duration: number // in seconds
    inactiveTimeout: number // in seconds
    maxPerUser: number
  }
  csrfToken: {
    secret: string
    cookieName: string
    headerName: string
  }
  cors: {
    allowedOrigins: string[]
    allowedMethods: string[]
    allowedHeaders: string[]
    exposedHeaders: string[]
    maxAge: number
  }
  upload: {
    maxSize: number // in bytes
    allowedTypes: string[]
    destination: string
  }
}

// Create security configuration
export const securityConfig: SecurityConfig = {
  passwordHash: {
    saltRounds: parseInt(process.env.PASSWORD_SALT_ROUNDS || '10', 10),
    pepper: process.env.PASSWORD_PEPPER || 'change_this_in_production',
  },
  rateLimits: {
    window: parseInt(process.env.RATE_LIMIT_WINDOW || '900', 10), // 15 minutes in seconds
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },
  loginAttempts: {
    max: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION || '900', 10), // 15 minutes in seconds
  },
  twoFactor: {
    issuer: process.env.TWO_FACTOR_ISSUER || 'PledgePoint',
    window: parseInt(process.env.TWO_FACTOR_WINDOW || '1', 10),
    backupCodesCount: parseInt(process.env.BACKUP_CODES_COUNT || '10', 10),
  },
  session: {
    secret: process.env.SESSION_SECRET || 'change_this_in_production',
    duration: parseInt(process.env.SESSION_DURATION || '86400', 10), // 24 hours in seconds
    inactiveTimeout: parseInt(process.env.SESSION_INACTIVE_TIMEOUT || '1800', 10), // 30 minutes in seconds
    maxPerUser: parseInt(process.env.MAX_SESSIONS_PER_USER || '5', 10),
  },
  csrfToken: {
    secret: process.env.CSRF_SECRET || 'change_this_in_production',
    cookieName: 'csrf-token',
    headerName: 'X-CSRF-Token',
  },
  cors: {
    allowedOrigins: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',')
      : ['http://localhost:3000'],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    exposedHeaders: [
      'Content-Length',
      'X-Rate-Limit-Limit',
      'X-Rate-Limit-Remaining',
      'X-Rate-Limit-Reset',
    ],
    maxAge: 86400, // 24 hours in seconds
  },
  upload: {
    maxSize: parseInt(process.env.UPLOAD_MAX_SIZE || '5242880', 10), // 5 MB in bytes
    allowedTypes: process.env.UPLOAD_ALLOWED_TYPES
      ? process.env.UPLOAD_ALLOWED_TYPES.split(',')
      : ['image/jpeg', 'image/png', 'application/pdf'],
    destination: process.env.UPLOAD_DESTINATION || 'uploads/',
  },
}
