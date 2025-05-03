// src/app.ts
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

// Import routes
import authRoutes from './routes/auth'
import officialsRoutes from './routes/officials'
import promisesRoutes from './routes/promises'
import campaignsRoutes from './routes/campaigns'
import usersRoutes from './routes/users'
import learningRoutes from './routes/learning'
import badgesRoutes from './routes/badges'
import adminRoutes from './routes/admin'

dotenv.config()

const app = express()

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

// Error handler
app.use(errorHandler)

export default app
