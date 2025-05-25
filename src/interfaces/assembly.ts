import mongoose, { Document } from 'mongoose'

/**
 * Interface for Assembly Session
 */
export interface IAssemblySession {
  number: number
  startDate: Date
  endDate?: Date
  status: 'upcoming' | 'ongoing' | 'completed' | 'dissolved'
  description?: string
}

/**
 * Interface for Assembly document
 */
export interface IAssembly extends Document {
  _id: mongoose.Types.ObjectId
  name: string
  type: 'federal' | 'provincial'
  level: 'house_of_representatives' | 'national_assembly' | 'provincial_assembly'
  province?: string // for provincial assemblies
  totalSeats: number
  electedSeats: number
  nominatedSeats?: number
  reservedSeats?: {
    women: number
    dalit: number
    disadvantaged: number
  }
  currentSession: IAssemblySession
  previousSessions: IAssemblySession[]
  headquarters: string
  establishedDate: Date
  description?: string
  website?: string
  contactInfo?: {
    phone?: string
    email?: string
    address?: string
  }
  active: boolean
  createdAt: Date
  updatedAt: Date
}
