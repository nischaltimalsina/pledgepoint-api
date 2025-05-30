import { Document, ObjectId } from 'mongoose'

export interface IUser extends Document {
  _id: ObjectId
  firstName: string
  lastName: string
  email: string
  password: string
  role: 'user' | 'admin' | 'moderator' | 'superadmin'
  gender?: 'male' | 'female' | 'other' | 'prefer not to say'
  dob?: Date
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

  // Streak tracking fields
  streaks: {
    civic: {
      current: number
      longest: number
      lastActivity: Date
    }
    learning: {
      current: number
      longest: number
      lastActivity: Date
    }
  }

  // Methods
  comparePassword(candidatePassword: string): Promise<boolean>
  generatePasswordResetToken(): Promise<string>
  generateEmailVerificationToken(): Promise<string>
  isLocked(): boolean
  incrementLoginAttempts(): Promise<void>
  resetLoginAttempts(): Promise<void>
}
