import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Logger configuration interface
interface LoggerConfig {
  level: string
  format: string
  enableConsole: boolean
  enableFile: boolean
  filename: string
  maxSize: number
  maxFiles: number
  httpLogging: {
    enabled: boolean
    format: string
    skip: {
      paths: string[]
      statusCodes: number[]
    }
  }
}

// Create logger configuration
export const loggerConfig: LoggerConfig = {
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.LOG_FORMAT || 'json', // 'json' or 'simple'
  enableConsole: process.env.LOG_CONSOLE !== 'false',
  enableFile: process.env.LOG_FILE === 'true',
  filename: process.env.LOG_FILENAME || 'app.log',
  maxSize: parseInt(process.env.LOG_MAX_SIZE || '10485760', 10), // 10 MB
  maxFiles: parseInt(process.env.LOG_MAX_FILES || '5', 10),
  httpLogging: {
    enabled: process.env.HTTP_LOGGING !== 'false',
    format: process.env.HTTP_LOG_FORMAT || 'combined',
    skip: {
      paths: process.env.HTTP_LOG_SKIP_PATHS
        ? process.env.HTTP_LOG_SKIP_PATHS.split(',')
        : ['/health', '/metrics'],
      statusCodes: process.env.HTTP_LOG_SKIP_STATUS_CODES
        ? process.env.HTTP_LOG_SKIP_STATUS_CODES.split(',').map((code) => parseInt(code, 10))
        : [200, 304],
    },
  },
}
