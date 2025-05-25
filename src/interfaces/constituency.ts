import mongoose, { Document } from 'mongoose'
import { IOfficial } from './official'

/**
 * Interface for Constituency document
 */
export interface IConstituency extends Document {
  _id: mongoose.Types.ObjectId
  name: string
  code: string
  type: 'federal' | 'provincial'
  assemblyId: mongoose.Types.ObjectId
  districtId: mongoose.Types.ObjectId
  population?: number
  area?: number // in square kilometers
  boundaries?: {
    type: string
    coordinates: number[][][]
  }
  reservedFor?: 'general' | 'women' | 'dalit' | 'madhesi' | 'muslim' | 'other'
  headquarters?: string
  description?: string
  currentRepresentative?: IOfficial
  active: boolean
  createdAt: Date
  updatedAt: Date
}
