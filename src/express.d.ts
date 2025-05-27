import { IUser } from '../models/user.model'
import { Express } from 'express'
import { Multer } from 'multer'

declare global {
  namespace Express {
    interface Request {
      user?: IUser
      file?: Express.Multer.File
      files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] }
    }
  }
}

export {}
