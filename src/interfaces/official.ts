import { Document, Types } from 'mongoose'
import { IRating } from './rating'

/**
 * Interface for Official document
 */
export interface IOfficial extends Document {
  name: string
  position: string
  district: string
  party: string
  term: {
    start: Date
    end: Date
  }
  dob: Date
  education?: {
    degree?: string
    institution?: string
    year?: number
  }
  criminalRecord?: {
    type?: string
    description?: string
    date?: Date
    status?: string
  }[]
  assets?: {
    type?: string
    value?: number
    description?: string
  }[]
  contactInfo: {
    email?: string
    phone?: string
    address?: string
    website?: string
    office: string
    verified?: boolean
    socialMedia?: {
      facebook?: string
      twitter?: string
      instagram?: string
      linkedIn?: string
    }
  }
  bio?: string
  photo?: string
  ratings: IRating[]
  averageRating: {
    integrity: number
    responsiveness: number
    effectiveness: number
    transparency: number
    overall: number
  }
  totalRatings: number
  createdAt: Date
  updatedAt: Date

  // Methods
  calculateAverageRatings(): void
}
