import mongoose, { Document, Schema } from 'mongoose'
import bcrypt from 'bcrypt'
import crypto from 'crypto'
import { config } from '../config'

export interface IUser extends Document {
  firstName: string
  lastName: string
  email: string
  password: string
  role: 'user' | 'admin' | 'moderator' | 'superadmin'
  accountStatus: 'pending' | 'active' | 'suspended'
  active: boolean
  twoFactorEnabled: boolean
  twoFactorSecret?: string
  backupCodes?: string[]
  refreshToken?: string
  lastLogin?: Date
  isEmailVerified: boolean
  emailVerificationToken?: string
  emailVerificationExpires?: Date
  passwordResetToken?: string
  passwordResetExpires?: Date
  loginAttempts: number
  lockUntil?: Date

  // PledgePoint specific fields
  impactPoints: number
  level: 'citizen' | 'advocate' | 'leader'
  badges: string[]
  district?: string
  location?: string
  profilePicture?: string
  bio?: string

  // Methods
  comparePassword(candidatePassword: string): Promise<boolean>
  generatePasswordResetToken(): Promise<string>
  generateEmailVerificationToken(): Promise<string>
  isLocked(): boolean
  incrementLoginAttempts(): Promise<void>
  resetLoginAttempts(): Promise<void>
}

const userSchema = new Schema<IUser>(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      minlength: [2, 'First name must be at least 2 characters'],
      maxlength: [50, 'First name must be less than 50 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      minlength: [2, 'Last name must be at least 2 characters'],
      maxlength: [50, 'Last name must be less than 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'moderator', 'superadmin'],
      default: 'user',
    },
    accountStatus: {
      type: String,
      enum: ['pending', 'active', 'suspended'],
      default: 'pending',
    },
    active: {
      type: Boolean,
      default: true,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorSecret: String,
    backupCodes: [String],
    refreshToken: String,
    lastLogin: Date,
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: Date,

    // PledgePoint specific fields
    impactPoints: {
      type: Number,
      default: 0,
    },
    level: {
      type: String,
      enum: ['citizen', 'advocate', 'leader'],
      default: 'citizen',
    },
    badges: {
      type: [String],
      default: [],
    },
    district: String,
    location: String,
    profilePicture: String,
    bio: {
      type: String,
      maxlength: [500, 'Bio must be less than 500 characters'],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_, ret) => {
        delete ret.password
        delete ret.refreshToken
        delete ret.twoFactorSecret
        delete ret.backupCodes
        delete ret.emailVerificationToken
        delete ret.emailVerificationExpires
        delete ret.passwordResetToken
        delete ret.passwordResetExpires
        delete ret.__v
        return ret
      },
    },
  }
)

// Index for efficient queries
userSchema.index({ email: 1 })
userSchema.index({ role: 1 })
userSchema.index({ accountStatus: 1 })
userSchema.index({ level: 1 })
userSchema.index({ impactPoints: -1 })
userSchema.index({ district: 1 })

// Pre-save middleware for password hashing
userSchema.pre('save', async function (next) {
  // Only hash the password if it's modified (or new)
  if (!this.isModified('password')) return next()

  try {
    // Generate salt
    const salt = await bcrypt.genSalt(config.security.passwordHash.saltRounds)

    // Hash password with pepper
    const pepperedPassword = `${this.password}${config.security.passwordHash.pepper}`

    // Replace plain text password with hashed one
    this.password = await bcrypt.hash(pepperedPassword, salt)
    next()
  } catch (error) {
    next(error as Error)
  }
})

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  // Add pepper to candidate password
  const pepperedPassword = `${candidatePassword}${config.security.passwordHash.pepper}`

  // Compare passwords
  return bcrypt.compare(pepperedPassword, this.password)
}

// Generate password reset token
userSchema.methods.generatePasswordResetToken = async function (): Promise<string> {
  // Generate random token
  const resetToken = crypto.randomBytes(32).toString('hex')

  // Hash token and save to database
  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex')

  // Set expiration (1 hour)
  this.passwordResetExpires = Date.now() + 3600000

  await this.save()
  return resetToken
}

// Generate email verification token
userSchema.methods.generateEmailVerificationToken = async function (): Promise<string> {
  // Generate random token
  const verificationToken = crypto.randomBytes(32).toString('hex')

  // Hash token and save to database
  this.emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex')

  // Set expiration (24 hours)
  this.emailVerificationExpires = Date.now() + 86400000

  await this.save()
  return verificationToken
}

// Check if account is locked
userSchema.methods.isLocked = function (): boolean {
  // Check for lockUntil and if it's greater than current time
  return !!(this.lockUntil && this.lockUntil > new Date())
}

// Increment login attempts
userSchema.methods.incrementLoginAttempts = async function (): Promise<void> {
  // Increment attempts
  this.loginAttempts += 1

  // Lock account if max attempts exceeded
  if (this.loginAttempts >= config.security.loginAttempts.max) {
    this.lockUntil = new Date(Date.now() + config.security.loginAttempts.lockoutDuration * 1000)
  }

  await this.save()
}

// Reset login attempts
userSchema.methods.resetLoginAttempts = async function (): Promise<void> {
  this.loginAttempts = 0
  this.lockUntil = undefined
  await this.save()
}

export const User = mongoose.model<IUser>('User', userSchema)
