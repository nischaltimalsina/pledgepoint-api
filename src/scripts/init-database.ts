import mongoose from 'mongoose'
import { config } from '../config'
import { User, Badge, District, LearningModule } from '../models'
import { ITextData, IVideoData, IQuizData } from '../interfaces/learning-module'
import { logger } from '../utils/logger'

/**
 * Initialize database with required collections and indexes
 */
export const initDatabase = async (): Promise<void> => {
  try {
    logger.info('Starting database initialization...')

    // Connect to MongoDB
    await mongoose.connect(config.mongoUri, config.database.options)
    logger.info('Connected to MongoDB')

    // Check for reset flag
    const resetDb = process.argv.includes('--reset')
    if (resetDb) {
      logger.info('Resetting database...')
      await mongoose.connection.dropDatabase()
      logger.info('Database reset completed')
    }

    // Create admin user if it doesn't exist
    const adminExists = await User.findOne({ role: 'superadmin' })
    if (!adminExists) {
      logger.info('Creating admin user...')
      const admin = new User({
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@pledgepoint.com',
        password: 'Admin@123456', // This will be hashed by the schema pre-save hook
        role: 'superadmin',
        accountStatus: 'active',
        active: true,
        twoFactorEnabled: false,
        isEmailVerified: true,
        impactPoints: 1000,
        level: 'leader',
        badges: ['first_step', 'admin'],
        loginAttempts: 0,
      })

      await admin.save()
      logger.info('Admin user created successfully')
    }

    // Create initial badges if they don't exist
    const badgesExist = await Badge.countDocuments()
    if (badgesExist === 0) {
      logger.info('Creating initial badges...')

      const initialBadges = [
        {
          code: 'first_step',
          name: 'First Step',
          description: 'Awarded for joining PledgePoint and verifying your email.',
          category: 'onboarding',
          image: '/badges/first_step.png',
          criteria: {
            type: 'specific_action',
            threshold: 1,
            specificValue: 'join',
          },
          pointsReward: 10,
          unlockMessage:
            "Welcome to PledgePoint! You've taken your first step toward civic engagement.",
        },
        {
          code: 'first_voice',
          name: 'First Voice',
          description: 'Awarded for submitting your first rating or review.',
          category: 'rating',
          image: '/badges/first_voice.png',
          criteria: {
            type: 'rating_count',
            threshold: 1,
          },
          pointsReward: 10,
          unlockMessage: "Your voice matters! You've submitted your first rating.",
        },
        {
          code: 'promise_seeker',
          name: 'Promise Seeker',
          description: 'Awarded for submitting your first evidence for a promise.',
          category: 'promise',
          image: '/badges/promise_seeker.png',
          criteria: {
            type: 'evidence_count',
            threshold: 1,
          },
          pointsReward: 10,
          unlockMessage: "You've started tracking promises! Keep holding officials accountable.",
        },
        {
          code: 'campaign_starter',
          name: 'Campaign Starter',
          description: 'Awarded for creating your first campaign.',
          category: 'campaign',
          image: '/badges/campaign_starter.png',
          criteria: {
            type: 'campaign_count',
            threshold: 1,
          },
          pointsReward: 10,
          unlockMessage:
            'Congratulations on starting your first campaign! Lead the change you want to see.',
        },
        {
          code: 'civic_novice',
          name: 'Civic Novice',
          description: 'Awarded for completing your first learning module.',
          category: 'learning',
          image: '/badges/civic_novice.png',
          criteria: {
            type: 'module_completion',
            threshold: 1,
          },
          pointsReward: 10,
          unlockMessage: "Knowledge is power! You've completed your first learning module.",
        },
        {
          code: 'active_rater',
          name: 'Active Rater',
          description: 'Awarded for submitting 10 ratings or reviews.',
          category: 'rating',
          image: '/badges/active_rater.png',
          criteria: {
            type: 'rating_count',
            threshold: 10,
          },
          pointsReward: 25,
          unlockMessage:
            "You're becoming a trusted voice in the community with your consistent ratings!",
        },
        {
          code: 'promise_tracker',
          name: 'Promise Tracker',
          description: 'Awarded for submitting 5 pieces of evidence.',
          category: 'promise',
          image: '/badges/promise_tracker.png',
          criteria: {
            type: 'evidence_count',
            threshold: 5,
          },
          pointsReward: 25,
          unlockMessage: "You're holding officials accountable by tracking their promises!",
        },
        {
          code: 'rights_defender',
          name: 'Rights Defender',
          description: "Awarded for completing the Citizens' Rights module.",
          category: 'learning',
          image: '/badges/rights_defender.png',
          criteria: {
            type: 'module_completion',
            threshold: 1,
            specificValue: 'citizens_rights',
          },
          pointsReward: 25,
          unlockMessage:
            'You now understand your rights as a citizen. Knowledge is the first step to defending them!',
        },
      ]

      await Badge.insertMany(initialBadges)
      logger.info(`Created ${initialBadges.length} initial badges`)
    }

    // Create default districts if they don't exist
    const districtsExist = await District.countDocuments()
    if (districtsExist === 0) {
      logger.info('Creating initial districts...')

      // Example districts for Nepal
      const initialDistricts = [
        {
          name: 'Kathmandu',
          code: 'KTM',
          type: 'municipal',
          region: 'Bagmati',
          country: 'Nepal',
          population: 975453,
          active: true,
        },
        {
          name: 'Lalitpur',
          code: 'LTP',
          type: 'municipal',
          region: 'Bagmati',
          country: 'Nepal',
          population: 284922,
          active: true,
        },
        {
          name: 'Bhaktapur',
          code: 'BKT',
          type: 'municipal',
          region: 'Bagmati',
          country: 'Nepal',
          population: 81748,
          active: true,
        },
        {
          name: 'Pokhara',
          code: 'PKR',
          type: 'municipal',
          region: 'Gandaki',
          country: 'Nepal',
          population: 402995,
          active: true,
        },
        {
          name: 'Bharatpur',
          code: 'BRT',
          type: 'municipal',
          region: 'Bagmati',
          country: 'Nepal',
          population: 280502,
          active: true,
        },
      ]

      await District.insertMany(initialDistricts)
      logger.info(`Created ${initialDistricts.length} initial districts`)
    }

    // Create sample learning modules if they don't exist
    const modulesExist = await LearningModule.countDocuments()
    if (modulesExist === 0) {
      logger.info('Creating sample learning modules...')

      // Introduction to Nepal's Constitution module
      const introModule = new LearningModule({
        title: "Introduction to Nepal's Constitution",
        description:
          "Learn the basics of Nepal's 2015 Constitution and how it structures the government.",
        category: 'constitution',
        order: 1,
        content: [
          {
            type: 'text',
            data: {
              title: 'Overview of the Constitution',
              content: `Nepal's Constitution, adopted in 2015, is the fundamental law of Nepal. This constitution was the first one created by democratically elected representatives after a decade-long civil war, replacing the interim constitution of 2007.

The Constitution of Nepal established the country as a federal democratic republic with three main levels of government: federal, provincial, and local. It divides power among these levels and establishes fundamental rights for citizens.

This module will provide an overview of the constitution, its key provisions, and the structure of governance it establishes.`,
              references: [
                'https://www.constituteproject.org/constitution/Nepal_2015',
                'https://www.lawcommission.gov.np/en/archives/category/documents/prevailing-law/constitution/constitution-of-nepal',
              ],
            } as ITextData,
          },
          {
            type: 'video',
            data: {
              title: 'Structure of Government in Nepal',
              url: 'https://www.example.com/videos/nepal-government-structure',
              duration: 420, // 7 minutes
              transcript:
                'This video explains the three-tiered government structure of Nepal, including federal, provincial, and local governments.',
            } as IVideoData,
          },
          {
            type: 'text',
            data: {
              title: 'Fundamental Rights',
              content: `The Constitution of Nepal guarantees numerous fundamental rights to its citizens. These include:

1. Right to freedom (Article 17)
2. Right to equality (Article 18)
3. Right to communication (Article 19)
4. Rights regarding justice (Article 20)
5. Right against torture (Article 22)
6. Right to privacy (Article 28)
7. Right to information (Article 27)
8. Rights regarding property (Article 25)
9. Right to religious freedom (Article 26)
10. Right to clean environment (Article 30)

Understanding these rights is crucial for active citizenship and advocacy.`,
              references: [
                'https://www.lawcommission.gov.np/en/archives/category/documents/prevailing-law/constitution/constitution-of-nepal',
                'https://www.idea.int/sites/default/files/publications/analysis-of-nepals-constitution.pdf',
              ],
            } as ITextData,
          },
          {
            type: 'quiz',
            data: {
              title: 'Test Your Knowledge',
              description:
                "Answer these questions to test your understanding of Nepal's constitution.",
              questions: [
                {
                  id: 'q1',
                  question: 'When was the current Constitution of Nepal adopted?',
                  options: ['2007', '2013', '2015', '2018'],
                  correctAnswer: '2015',
                  explanation: 'The Constitution of Nepal was promulgated on September 20, 2015.',
                },
                {
                  id: 'q2',
                  question: "How many tiers of government does Nepal's constitution establish?",
                  options: ['1', '2', '3', '4'],
                  correctAnswer: '3',
                  explanation:
                    'Nepal has three tiers of government: federal, provincial, and local.',
                },
                {
                  id: 'q3',
                  question: 'Which article guarantees the right to equality?',
                  options: ['Article 16', 'Article 17', 'Article 18', 'Article 19'],
                  correctAnswer: 'Article 18',
                  explanation: 'Article 18 of the Constitution guarantees the right to equality.',
                },
              ],
              passingScore: 70,
            } as IQuizData,
          },
        ],
        pointsReward: 20,
        badgeReward: 'civic_novice',
        region: 'Nepal',
      })

      // Citizens' Rights module
      const rightsModule = new LearningModule({
        title: "Understanding Citizens' Rights",
        description:
          "A deep dive into the fundamental rights of citizens according to Nepal's constitution.",
        category: 'rights',
        order: 2,
        content: [
          {
            type: 'text',
            data: {
              title: "Introduction to Citizens' Rights",
              content: `Fundamental rights are the basic rights and freedoms to which all humans are entitled, often held to be inalienable. The Constitution of Nepal guarantees these rights to all citizens.

This module explores these rights in depth, their implications, and how citizens can exercise them effectively.`,
              references: [
                'https://www.lawcommission.gov.np/en/archives/category/documents/prevailing-law/constitution/constitution-of-nepal',
              ],
            } as ITextData,
          },
          {
            type: 'text',
            data: {
              title: 'Right to Information',
              content: `Article 27 of the Constitution guarantees the right to information. This means:

1. Every citizen has the right to demand and receive information on any matter of public importance.
2. This right is implemented through the Right to Information Act, 2007.
3. Government agencies must proactively disclose certain categories of information.
4. Citizens can file requests for information with public bodies.

The right to information is a powerful tool for transparency and accountability in governance.`,
              references: [
                'https://www.lawcommission.gov.np/en/archives/category/documents/prevailing-law/constitution/constitution-of-nepal',
                'https://www.rti.org.np/',
              ],
            } as ITextData,
          },
          {
            type: 'quiz',
            data: {
              title: 'Right to Information Quiz',
              description: 'Test your understanding of the Right to Information in Nepal.',
              questions: [
                {
                  id: 'q1',
                  question:
                    "Which article of Nepal's Constitution guarantees the right to information?",
                  options: ['Article 25', 'Article 26', 'Article 27', 'Article 28'],
                  correctAnswer: 'Article 27',
                  explanation:
                    'Article 27 guarantees that every citizen shall have the right to demand and receive information on any matter of public importance.',
                },
                {
                  id: 'q2',
                  question: 'In which year was the Right to Information Act enacted in Nepal?',
                  options: ['2005', '2007', '2010', '2015'],
                  correctAnswer: '2007',
                  explanation:
                    'The Right to Information Act was enacted in 2007, predating the current constitution.',
                },
                {
                  id: 'q3',
                  question:
                    'Which of the following is NOT a valid reason for denying information under RTI?',
                  options: [
                    'Information affects national security',
                    'Information is personally sensitive',
                    'The requester did not pay a fee',
                    'The public body finds the request unnecessary',
                  ],
                  correctAnswer: 'The public body finds the request unnecessary',
                  explanation:
                    'Public bodies cannot deny information simply because they deem it unnecessary. There must be specific legal grounds for denial.',
                },
              ],
              passingScore: 70,
            } as IQuizData,
          },
          {
            type: 'text',
            data: {
              title: 'How to Use Your Rights Effectively',
              content: `Knowing your rights is only the first step. Effectively using them requires understanding processes and procedures. Here are some practical tips:

1. For Right to Information requests:
   - Identify the correct public body
   - Be specific about the information you need
   - Submit your request in writing
   - Follow up if you don't receive a response within 15 days
   - Appeal to the National Information Commission if denied

2. For constitutional remedies:
   - Document violations of your rights
   - Seek legal counsel when necessary
   - Know which courts have jurisdiction
   - Be aware of limitation periods for filing cases

Effective use of rights strengthens democracy and promotes good governance.`,
              references: [
                'https://www.rti.org.np/how-to-file-rti-request',
                'https://www.lawcommission.gov.np/en',
              ],
            } as ITextData,
          },
        ],
        pointsReward: 25,
        badgeReward: 'rights_defender',
        requiredModules: [introModule._id],
        region: 'Nepal',
      })

      // Save both modules
      await introModule.save()
      await rightsModule.save()

      logger.info('Created sample learning modules')
    }

    logger.info('Database initialization completed')
  } catch (error) {
    logger.error('Error initializing database:', error)
    throw error
  } finally {
    // Close the database connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close()
      logger.info('Database connection closed')
    }
  }
}

// Run the initialization if this script is executed directly
if (require.main === module) {
  initDatabase()
    .then(() => {
      process.exit(0)
    })
    .catch((error) => {
      logger.error('Database initialization failed:', error)
      process.exit(1)
    })
}

export default initDatabase
