import winston from 'winston'
import { config } from '../config'

// Define custom log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
}

// Define level colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
}

// Add colors to winston
winston.addColors(colors)

// Define the log format
const formatOptions = {
  console: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.colorize({ all: true }),
    winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)
  ),
  file: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.json()
  ),
}

// Create the transports
const transports = [
  // Console transport
  ...(config.logger.enableConsole
    ? [
        new winston.transports.Console({
          format: formatOptions.console,
        }),
      ]
    : []),
  // File transport
  ...(config.logger.enableFile
    ? [
        new winston.transports.File({
          filename: config.logger.filename,
          format: formatOptions.file,
          maxsize: config.logger.maxSize,
          maxFiles: config.logger.maxFiles,
        }),
      ]
    : []),
]

// Create the logger
export const logger = winston.createLogger({
  level: config.logger.level,
  levels,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    config.logger.format === 'json' ? winston.format.json() : winston.format.simple()
  ),
  defaultMeta: { service: 'pledgepoint-api' },
  transports,
  exitOnError: false,
})

// Create a stream object for Morgan HTTP logger
export const stream = {
  write: (message: string) => {
    logger.http(message.trim())
  },
}

// HTTP request logging middleware for Express
export const httpLogger = (req: any, res: any, next: any) => {
  // Skip logging if the path or status code is in the skip list
  if (
    config.logger.httpLogging.skip.paths.includes(req.path) ||
    (res.statusCode && config.logger.httpLogging.skip.statusCodes.includes(res.statusCode))
  ) {
    return next()
  }

  const start = Date.now()

  // Log request
  logger.http(`${req.method} ${req.url} - Request received`, {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.user ? req.user.id : 'unauthenticated',
  })

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start
    logger.http(`${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`, {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: req.user ? req.user.id : 'unauthenticated',
    })
  })

  next()
}
