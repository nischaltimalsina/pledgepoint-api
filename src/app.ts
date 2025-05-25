import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import helmet from 'helmet'
import mongoose from 'mongoose'
import rateLimit from 'express-rate-limit'

import { config } from './config'
import { errorHandler } from './middleware/error-handler'
import { logger } from './utils/logger'
import { redis } from './services/redis.service'

const swaggerUi = require('swagger-ui-express')
const swaggerDocument = require('./swagger.json')

// Import routes
import authRoutes from './routes/auth.routes'
import officialsRoutes from './routes/officials.routes'
import promisesRoutes from './routes/promises.routes'
import campaignsRoutes from './routes/campaigns.routes'
import usersRoutes from './routes/users.routes'
import learningRoutes from './routes/learning.routes'
import badgesRoutes from './routes/badges.routes'
import adminRoutes from './routes/admin.routes'
import districtsRoutes from './routes/districts.routes'
import ratingsRoutes from './routes/ratings.routes'
import constituencyRoutes from './routes/constituencies.routes'
import assemblyRoutes from './routes/assemblies.routes'

import { errorTrackingMiddleware, performanceTrackingMiddleware } from './middleware/error-tracking'

dotenv.config()

const app = express()
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))

// Connect to MongoDB
mongoose
  .connect(config.mongoUri, config.database.options)
  .then(() => {
    logger.info('Connected to MongoDB')
  })
  .catch((err) => {
    logger.error('MongoDB connection error:', err)
    process.exit(1)
  })

// Connect to Redis
redis.on('error', (err) => logger.error('Redis connection error:', err))
redis.on('connect', () => logger.info('Connected to Redis'))

// Express configuration
app.use(helmet())
app.use(cors(config.cors))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Apply rate limiting
const limiter = rateLimit({
  windowMs: config.security.rateLimits.window * 1000,
  max: config.security.rateLimits.max,
  standardHeaders: true,
  legacyHeaders: false,
})
app.use(limiter)

// Basic health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' })
})

// API routes
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/officials', officialsRoutes)
app.use('/api/v1/promises', promisesRoutes)
app.use('/api/v1/campaigns', campaignsRoutes)
app.use('/api/v1/users', usersRoutes)
app.use('/api/v1/learning', learningRoutes)
app.use('/api/v1/badges', badgesRoutes)
app.use('/api/v1/admin', adminRoutes)
app.use('/api/v1/districts', districtsRoutes)
app.use('/api/v1/ratings', ratingsRoutes)
app.use('/api/v1/constituencies', constituencyRoutes)
app.use('/api/v1/assemblies', assemblyRoutes)

// Error handler
app.use(performanceTrackingMiddleware(5000)) // Track requests > 5s
app.use(errorTrackingMiddleware())
app.use(errorHandler)

export default app
