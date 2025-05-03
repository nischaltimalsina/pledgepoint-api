import app from './app'
import { config } from './config'
import { logger } from './utils/logger'
import mongoose from 'mongoose'

const server = app.listen(config.port, () => {
  logger.info(`Server running at http://localhost:${config.port}`)
  logger.info(`Environment: ${config.env}`)
})

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully')
  server.close(() => {
    logger.info('Server closed')
    mongoose.connection
      .close(false)
      .then(() => {
        logger.info('MongoDB connection closed')
        process.exit(0)
      })
      .catch((err) => {
        logger.error('Error closing MongoDB connection:', err)
        process.exit(1)
      })
  })
})

export default server
