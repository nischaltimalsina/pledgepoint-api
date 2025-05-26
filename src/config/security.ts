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
export const securityConfig = {
  passwordHash: {
    saltRounds: parseInt(process.env.PASSWORD_SALT_ROUNDS || '12', 10),
    pepper:
      process.env.PASSWORD_PEPPER ||
      (() => {
        if (process.env.NODE_ENV === 'production') {
          throw new Error('PASSWORD_PEPPER must be set in production')
        }
        return 'dev_pepper_not_for_production'
      })(),
  },

  rateLimits: {
    window: parseInt(process.env.RATE_LIMIT_WINDOW || '900', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    skipSuccessfulRequests: true, // Don't count successful requests
    skipFailedRequests: false, // Count failed requests
  },

  // Enhanced login attempt tracking
  loginAttempts: {
    max: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION || '1800', 10), // 30 minutes
    progressiveDelay: true, // Increase delay with each attempt
  },

  // Session security
  session: {
    secret:
      process.env.SESSION_SECRET ||
      (() => {
        if (process.env.NODE_ENV === 'production') {
          throw new Error('SESSION_SECRET must be set in production')
        }
        return 'dev_session_secret'
      })(),
    duration: parseInt(process.env.SESSION_DURATION || '3600', 10), // 1 hour
    inactiveTimeout: parseInt(process.env.SESSION_INACTIVE_TIMEOUT || '1800', 10),
    maxPerUser: parseInt(process.env.MAX_SESSIONS_PER_USER || '3', 10),
  },

  // CSRF protection
  csrfToken: {
    secret:
      process.env.CSRF_SECRET ||
      (() => {
        if (process.env.NODE_ENV === 'production') {
          throw new Error('CSRF_SECRET must be set in production')
        }
        return 'dev_csrf_secret'
      })(),
    cookieName: '_csrf',
    headerName: 'X-CSRF-Token',
  },

  // Enhanced CORS configuration
  cors: {
    allowedOrigins: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',')
      : process.env.NODE_ENV === 'production'
        ? [] // No default origins in production
        : ['http://localhost:3000'],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    credentials: true,
    maxAge: 86400,
  },

  // File upload security
  upload: {
    maxSize: parseInt(process.env.UPLOAD_MAX_SIZE || '5242880', 10), // 5MB
    allowedTypes: process.env.UPLOAD_ALLOWED_TYPES
      ? process.env.UPLOAD_ALLOWED_TYPES.split(',')
      : ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    destination: process.env.UPLOAD_DESTINATION || 'uploads/',
    quarantineDir: process.env.QUARANTINE_DIR || 'quarantine/',
  },

  // Additional security headers
  headers: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
  },
  twoFactor: {
    issuer: process.env.TWO_FACTOR_ISSUER || 'PledgePoint',
    window: parseInt(process.env.TWO_FACTOR_WINDOW || '30', 10), // 30 seconds
    backupCodesCount: parseInt(process.env.BACKUP_CODES_COUNT || '10', 10),
  },
}
