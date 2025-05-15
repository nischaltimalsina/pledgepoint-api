import mongoose from 'mongoose'
import { config } from '../config'
import { logger } from '../utils/logger'

/**
 * Validate database setup and indexes
 */
export const validateDatabase = async (): Promise<void> => {
  try {
    logger.info('Starting database validation...')

    // Connect to MongoDB
    await mongoose.connect(config.mongoUri, config.database.options)
    logger.info('Connected to MongoDB')

    // Get all collections in the database
    const collections = await mongoose.connection.db?.listCollections().toArray()
    logger.info(`Found ${collections?.length} collections in the database`)

    if (collections?.length === 0) {
      logger.warn('No collections found. Database may not be initialized.')
      return
    }

    // Log all collections
    logger.info('Collections found:')
    collections?.forEach((collection) => {
      logger.info(`- ${collection.name}`)
    })

    // Check for required collections
    const requiredCollections = [
      'users',
      'officials',
      'promises',
      'campaigns',
      'ratings',
      'badges',
      'learningmodules',
      'learningprogresses',
      'activities',
      'districts',
    ]

    const missingCollections = requiredCollections.filter(
      (name) => !collections?.find((c) => c.name.toLowerCase() === name)
    )

    if (missingCollections.length > 0) {
      logger.warn(`Missing collections: ${missingCollections.join(', ')}`)
    } else {
      logger.info('All required collections exist')
    }

    // Check indexes for each collection
    if (collections) {
      for (const collection of collections) {
        const collectionName = collection.name
        const indexes = await mongoose.connection.db?.collection(collectionName).indexes()

        logger.info(`Indexes for collection '${collectionName}':`)
        indexes?.forEach((index) => {
          const keys = Object.keys(index.key)
            .map((k) => `${k}:${index.key[k]}`)
            .join(', ')
          const properties = []

          if (index.unique) properties.push('unique')
          if (index.sparse) properties.push('sparse')
          if (index.background) properties.push('background')

          const propertiesStr = properties.length > 0 ? ` (${properties.join(', ')})` : ''

          logger.info(`- ${index.name}: { ${keys} }${propertiesStr}`)
        })
      }
    }

    // Validate sample data for each collection
    if (collections) {
      for (const collection of collections) {
        const collectionName = collection.name
        const count = await mongoose.connection.db?.collection(collectionName).countDocuments()

        logger.info(`Collection '${collectionName}' has ${count} documents`)

        // If the collection is empty, report it
        if (count === 0) {
          logger.warn(`Collection '${collectionName}' is empty. Consider seeding data.`)
        }
      }
    } else {
      logger.error('No collections found')
    }

    logger.info('Database validation completed')
  } catch (error) {
    logger.error('Error validating database:', error)
    throw error
  } finally {
    // Close the database connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close()
      logger.info('Database connection closed')
    }
  }
}

// Run the validation if this script is executed directly
if (require.main === module) {
  validateDatabase()
    .then(() => {
      process.exit(0)
    })
    .catch((error) => {
      logger.error('Database validation failed:', error)
      process.exit(1)
    })
}

export default validateDatabase
