import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Database replica interface
interface DatabaseReplica {
  uri: string;
  priority: number;
}

// Database collection interface
interface DatabaseCollection {
  name: string;
  indexes: Record<string, number>[];
}

// Database configuration interface
interface DatabaseConfig {
  uri: string
  options: {
    autoIndex: boolean
    serverSelectionTimeoutMS: number
    socketTimeoutMS: number
    maxPoolSize: number
    minPoolSize: number
    retryWrites: boolean
    writeConcern: { w: number }
  }
  replicas: DatabaseReplica[]
  collections: DatabaseCollection[]
}

// Create database configuration
export const databaseConfig: DatabaseConfig = {
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/pledgepoint',
  options: {
    autoIndex: process.env.NODE_ENV !== 'production',
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    maxPoolSize: 50,
    minPoolSize: 10,
    retryWrites: true,
    writeConcern: { w: 1 },
  },
  replicas: process.env.MONGODB_REPLICAS
    ? process.env.MONGODB_REPLICAS.split(',').map((uri, index) => ({
        uri,
        priority: index + 1,
      }))
    : [],
  collections: [
    {
      name: 'users',
      indexes: [
        { email: 1 },
        { role: 1 },
        { accountStatus: 1 },
        { createdAt: -1 },
        { lastLogin: -1 },
        { level: 1 },
        { impactPoints: -1 },
      ],
    },
    {
      name: 'officials',
      indexes: [
        { name: 1 },
        { position: 1 },
        { district: 1 },
        { party: 1 },
        { 'averageRating.overall': -1 },
      ],
    },
    {
      name: 'promises',
      indexes: [{ officialId: 1 }, { status: 1 }, { category: 1 }, { datePromised: -1 }],
    },
    {
      name: 'campaigns',
      indexes: [
        { creatorId: 1 },
        { category: 1 },
        { district: 1 },
        { status: 1 },
        { currentSupport: -1 },
      ],
    },
    {
      name: 'learning_modules',
      indexes: [{ category: 1 }, { region: 1 }, { order: 1 }],
    },
    {
      name: 'activities',
      indexes: [{ userId: 1 }, { type: 1 }, { createdAt: -1 }],
    },
  ],
}
