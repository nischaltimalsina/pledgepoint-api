import mongoose from 'mongoose'
import { config } from '../config'
import { User, Official, Promise, Campaign, Rating, District, Activity } from '../models'
import { logger } from '../utils/logger'

/**
 * Seed the database with sample data for testing and development
 */
export const seedData = async (): Promise<void> => {
  try {
    logger.info('Starting database seeding...')

    // Connect to MongoDB
    await mongoose.connect(config.mongoUri, config.database.options)
    logger.info('Connected to MongoDB')

    // Check if data already exists
    const usersCount = await User.countDocuments()
    if (usersCount > 1) {
      // More than just admin
      logger.info('Database already contains data. Use --force flag to override.')

      // Exit if not forced
      if (!process.argv.includes('--force')) {
        return
      }

      logger.info('Force flag detected. Continuing with seeding...')
    }

    // Get districts for reference
    const districts = await District.find()
    if (districts.length === 0) {
      throw new Error('No districts found in database. Run init-database.ts first.')
    }

    // Seed sample users
    const users = await seedUsers(5)
    logger.info(`Created ${users.length} sample users`)

    // Seed sample officials
    const officials = await seedOfficials(10, districts)
    logger.info(`Created ${officials.length} sample officials`)

    // Seed sample promises
    const promises = await seedPromises(30, officials)
    logger.info(`Created ${promises.length} sample promises`)

    // Seed sample ratings
    const ratings = await seedRatings(20, users, officials)
    logger.info(`Created ${ratings.length} sample ratings`)

    // Seed sample campaigns
    const campaigns = await seedCampaigns(10, users, districts)
    logger.info(`Created ${campaigns.length} sample campaigns`)

    // Seed sample activities
    const activities = await seedActivities(50, users, officials, promises, campaigns)
    logger.info(`Created ${activities.length} sample activities`)

    logger.info('Database seeding completed successfully')
  } catch (error) {
    logger.error('Error seeding database:', error)
    throw error
  } finally {
    // Close the database connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close()
      logger.info('Database connection closed')
    }
  }
}

/**
 * Seed sample users
 */
async function seedUsers(count: number): Promise<any[]> {
  // Delete existing users except admin
  await User.deleteMany({ role: { $ne: 'superadmin' } })

  // Create sample users
  const users = []

  for (let i = 1; i <= count; i++) {
    const user = new User({
      firstName: `User${i}`,
      lastName: `Test${i}`,
      email: `user${i}@example.com`,
      password: 'Password123!',
      role: 'user',
      accountStatus: 'active',
      active: true,
      twoFactorEnabled: false,
      isEmailVerified: true,
      impactPoints: Math.floor(Math.random() * 500),
      level: 'citizen',
      badges: ['first_step'],
      loginAttempts: 0,
    })

    // Randomly give some users advocate or leader level
    if (i === count) {
      user.level = 'leader'
      user.impactPoints = 600 + Math.floor(Math.random() * 400)
      user.badges.push('active_rater', 'promise_tracker', 'civic_novice')
    } else if (i === count - 1) {
      user.level = 'advocate'
      user.impactPoints = 200 + Math.floor(Math.random() * 200)
      user.badges.push('first_voice', 'promise_seeker')
    }

    await user.save()
    users.push(user)
  }

  return users
}

/**
 * Seed sample officials
 */
async function seedOfficials(count: number, districts: any[]): Promise<any[]> {
  // Delete existing officials
  await Official.deleteMany({})

  // Create sample officials
  const officials = []
  const positions = [
    'Mayor',
    'Ward Chairperson',
    'Member of Parliament',
    'Chief Minister',
    'Minister',
  ]
  const parties = [
    'Nepal Communist Party',
    'Nepali Congress',
    'Janata Samajbadi Party',
    'Rastriya Prajatantra Party',
  ]

  for (let i = 1; i <= count; i++) {
    const district = districts[Math.floor(Math.random() * districts.length)]
    const position = positions[Math.floor(Math.random() * positions.length)]
    const party = parties[Math.floor(Math.random() * parties.length)]

    const official = new Official({
      name: `Official ${i}`,
      position,
      district: district.name,
      party,
      term: {
        start: new Date('2022-01-01'),
        end: new Date('2027-01-01'),
      },
      contactInfo: {
        email: `official${i}@example.com`,
        phone: `+977 9${Math.floor(Math.random() * 100000000)}`,
        address: `${district.name}, Nepal`,
        website: `https://example.com/official${i}`,
        socialMedia: {
          facebook: `https://facebook.com/official${i}`,
          twitter: `https://twitter.com/official${i}`,
        },
      },
      bio: `Sample bio for Official ${i}, who is the ${position} of ${district.name}. They are a member of the ${party}.`,
      ratings: [],
      averageRating: {
        integrity: 0,
        responsiveness: 0,
        effectiveness: 0,
        transparency: 0,
        overall: 0,
      },
      totalRatings: 0,
    })

    await official.save()
    officials.push(official)
  }

  return officials
}

/**
 * Seed sample promises
 */
async function seedPromises(count: number, officials: any[]): Promise<any[]> {
  // Delete existing promises
  await Promise.deleteMany({})

  // Create sample promises
  const promises = []
  const categories = [
    'Infrastructure',
    'Education',
    'Healthcare',
    'Environment',
    'Economy',
    'Security',
    'Transportation',
    'Housing',
    'Agriculture',
  ]

  const statuses = ['kept', 'broken', 'in-progress', 'unverified']

  for (let i = 1; i <= count; i++) {
    const official = officials[Math.floor(Math.random() * officials.length)]
    const category = categories[Math.floor(Math.random() * categories.length)]
    const status = statuses[Math.floor(Math.random() * statuses.length)]
    const datePromised = new Date(
      2022,
      Math.floor(Math.random() * 12),
      Math.floor(Math.random() * 28) + 1
    )

    const promise = new Promise({
      officialId: official._id,
      title: `${category} Development Promise ${i}`,
      description: `Official ${official.name} promised to improve ${category.toLowerCase()} in ${official.district} by implementing new programs and allocating budget.`,
      category,
      datePromised,
      source: `https://example.com/promises/${i}`,
      status,
      evidence: [],
      comments: [],
    })

    // Add some evidence to non-unverified promises
    if (status !== 'unverified') {
      const evidenceCount = Math.floor(Math.random() * 3) + 1

      for (let j = 1; j <= evidenceCount; j++) {
        promise.evidence.push({
          userId: new mongoose.Types.ObjectId(),
          description: `Evidence ${j} for promise "${promise.title}"`,
          source: `https://example.com/evidence/${i}-${j}`,
          date: new Date(),
          status:
            status === 'kept'
              ? 'supporting'
              : status === 'broken'
                ? 'opposing'
                : Math.random() > 0.5
                  ? 'supporting'
                  : 'opposing',
          upvotes: [],
          downvotes: [],
        })
      }
    }

    await promise.save()
    promises.push(promise)
  }

  return promises
}

/**
 * Seed sample ratings
 */
async function seedRatings(count: number, users: any[], officials: any[]): Promise<any[]> {
  // Delete existing ratings
  await Rating.deleteMany({})

  // Create sample ratings
  const ratings = []

  for (let i = 1; i <= count; i++) {
    const user = users[Math.floor(Math.random() * users.length)]
    const official = officials[Math.floor(Math.random() * officials.length)]

    // Skip if this user has already rated this official
    const existingRating = await Rating.findOne({ userId: user._id, officialId: official._id })
    if (existingRating) {
      continue
    }

    // Generate random ratings
    const integrity = Math.floor(Math.random() * 5) + 1
    const responsiveness = Math.floor(Math.random() * 5) + 1
    const effectiveness = Math.floor(Math.random() * 5) + 1
    const transparency = Math.floor(Math.random() * 5) + 1
    const overall = parseFloat(
      ((integrity + responsiveness + effectiveness + transparency) / 4).toFixed(1)
    )

    const rating = new Rating({
      officialId: official._id,
      userId: user._id,
      integrity,
      responsiveness,
      effectiveness,
      transparency,
      overall,
      comment: `This is a sample rating comment for ${official.name}. The official has performed ${overall >= 3 ? 'well' : 'poorly'} in their role.`,
      evidence: `https://example.com/rating-evidence/${i}`,
      upvotes: [],
      downvotes: [],
      status: 'approved',
    })

    await rating.save()
    ratings.push(rating)

    // Update official's ratings
    official.ratings.push({
      userId: user._id,
      integrity,
      responsiveness,
      effectiveness,
      transparency,
      overall,
      comment: rating.comment,
      evidence: rating.evidence,
      upvotes: [],
      downvotes: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }

  // Recalculate ratings for each official
  for (const official of officials) {
    official.calculateAverageRatings()
    await official.save()
  }

  return ratings
}

/**
 * Seed sample campaigns
 */
async function seedCampaigns(count: number, users: any[], districts: any[]): Promise<any[]> {
  // Delete existing campaigns
  await Campaign.deleteMany({})

  // Create sample campaigns
  const campaigns = []
  const categories = [
    'Infrastructure',
    'Education',
    'Healthcare',
    'Environment',
    'Public Service',
    'Transportation',
  ]
  const statuses = ['draft', 'active', 'completed', 'archived']

  for (let i = 1; i <= count; i++) {
    const user = users[Math.floor(Math.random() * users.length)]
    const district = districts[Math.floor(Math.random() * districts.length)]
    const category = categories[Math.floor(Math.random() * categories.length)]
    let status = statuses[Math.floor(Math.random() * statuses.length)]

    // Ensure first campaign is active
    if (i === 1) {
      status = 'active'
    }

    // Create campaign
    const campaign = new Campaign({
      title: `${category} Improvement Campaign ${i}`,
      description: `A campaign to improve ${category.toLowerCase()} in ${district.name} by advocating for better policies and community involvement.`,
      category,
      district: district.name,
      goal: Math.floor(Math.random() * 90) + 10, // 10-100
      currentSupport: 0, // Will be updated below
      creatorId: user._id,
      supporters: [user._id], // Creator supports their own campaign
      status,
      image: `https://example.com/campaign-images/${i}.jpg`,
      updates: [],
      discussions: [],
    })

    // Add random supporters
    const supportCount = Math.floor(Math.random() * users.length)
    for (let j = 0; j < supportCount; j++) {
      const supporter = users[j]
      if (!campaign.supporters.includes(supporter._id) && supporter._id !== user._id) {
        campaign.supporters.push(supporter._id)
      }
    }

    // Update current support
    campaign.currentSupport = campaign.supporters.length

    // Add some updates
    const updateCount = Math.floor(Math.random() * 3)
    for (let j = 1; j <= updateCount; j++) {
      campaign.updates.push({
        userId: user._id,
        content: `Update ${j} for campaign "${campaign.title}": We've made progress and are continuing to gather support.`,
        createdAt: new Date(Date.now() - j * 86400000), // j days ago
      })
    }

    // Add some discussions
    const discussionCount = Math.floor(Math.random() * 3)
    for (let j = 1; j <= discussionCount; j++) {
      const discussionUser = users[Math.floor(Math.random() * users.length)]
      campaign.discussions.push({
        _id: new mongoose.Types.ObjectId(),
        userId: discussionUser._id,
        content: `This is discussion ${j} for campaign "${campaign.title}". I think this campaign is important because...`,
        createdAt: new Date(Date.now() - j * 86400000), // j days ago
        upvotes: [],
        downvotes: [],
        replies: [],
      })
    }

    // If status is 'completed' and current support is less than goal, update it
    if (status === 'completed' && campaign.currentSupport < campaign.goal) {
      campaign.currentSupport = campaign.goal
    }

    await campaign.save()
    campaigns.push(campaign)
  }

  return campaigns
}

/**
 * Seed sample activities
 */
async function seedActivities(
  count: number,
  users: any[],
  officials: any[],
  promises: any[],
  campaigns: any[]
): Promise<any[]> {
  // Delete existing activities
  await Activity.deleteMany({})

  // Activity types
  const activityTypes = [
    'rating_created',
    'evidence_submitted',
    'campaign_created',
    'campaign_supported',
    'discussion_posted',
    'comment_posted',
    'login',
  ]

  // Create sample activities
  const activities = []

  for (let i = 1; i <= count; i++) {
    const user = users[Math.floor(Math.random() * users.length)]
    const type = activityTypes[Math.floor(Math.random() * activityTypes.length)]
    let details = {}
    let relatedId = undefined
    let relatedType = undefined
    let pointsEarned = 0

    // Create activity details based on type
    switch (type) {
      case 'rating_created':
        const official = officials[Math.floor(Math.random() * officials.length)]
        details = {
          officialId: official._id,
          officialName: official.name,
          rating: Math.floor(Math.random() * 5) + 1,
        }
        relatedId = official._id
        relatedType = 'Official'
        pointsEarned = 10
        break

      case 'evidence_submitted':
        const promise = promises[Math.floor(Math.random() * promises.length)]
        details = {
          promiseId: promise._id,
          promiseTitle: promise.title,
          status: Math.random() > 0.5 ? 'supporting' : 'opposing',
        }
        relatedId = promise._id
        relatedType = 'Promise'
        pointsEarned = 20
        break

      case 'campaign_created':
        const createdCampaign = campaigns[Math.floor(Math.random() * campaigns.length)]
        details = {
          campaignId: createdCampaign._id,
          campaignTitle: createdCampaign.title,
        }
        relatedId = createdCampaign._id
        relatedType = 'Campaign'
        pointsEarned = 50
        break

      case 'campaign_supported':
        const supportedCampaign = campaigns[Math.floor(Math.random() * campaigns.length)]
        details = {
          campaignId: supportedCampaign._id,
          campaignTitle: supportedCampaign.title,
        }
        relatedId = supportedCampaign._id
        relatedType = 'Campaign'
        pointsEarned = 10
        break

      case 'discussion_posted':
        const discussionCampaign = campaigns[Math.floor(Math.random() * campaigns.length)]
        details = {
          campaignId: discussionCampaign._id,
          campaignTitle: discussionCampaign.title,
          content: `Discussion on campaign "${discussionCampaign.title}"`,
        }
        relatedId = discussionCampaign._id
        relatedType = 'Campaign'
        pointsEarned = 5
        break

      case 'comment_posted':
        const commentPromise = promises[Math.floor(Math.random() * promises.length)]
        details = {
          promiseId: commentPromise._id,
          promiseTitle: commentPromise.title,
          content: `Comment on promise "${commentPromise.title}"`,
        }
        relatedId = commentPromise._id
        relatedType = 'Promise'
        pointsEarned = 5
        break

      case 'login':
        details = {
          ipAddress: '192.168.1.' + Math.floor(Math.random() * 255),
          userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        }
        pointsEarned = 0
        break
    }

    // Create new activity
    const activity = new Activity({
      userId: user._id,
      type,
      details,
      relatedId,
      relatedType,
      pointsEarned,
      badgesEarned: [],
      ip: '192.168.1.' + Math.floor(Math.random() * 255),
      userAgent: 'Mozilla/5.0 Sample User Agent',
      createdAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000), // 0-30 days ago
    })

    await activity.save()
    activities.push(activity)
  }

  return activities
}

// Run the seeding if this script is executed directly
if (require.main === module) {
  seedData()
    .then(() => {
      process.exit(0)
    })
    .catch((error) => {
      logger.error('Database seeding failed:', error)
      process.exit(1)
    })
}

export default seedData
