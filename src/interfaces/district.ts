import mongoose, { Document } from 'mongoose'

/**
 * Interface for District document
 */
export interface IDistrict extends Document {
  _id: mongoose.Types.ObjectId
  name: string
  code: string
  type: 'federal' | 'provincial' | 'municipal' | 'other'
  region: string
  country: string
  population?: number
  boundaries?: {
    type: string
    coordinates: number[][][]
  }
  parentDistrict?: mongoose.Types.ObjectId
  active: boolean
  createdAt: Date
  updatedAt: Date
}
