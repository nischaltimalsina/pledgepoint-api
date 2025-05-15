import { Request } from 'express'
import { IUser } from '../models/user.model'

/**
 * Interface for requests that require authentication
 * Extends the Express Request interface with user property
 */
export interface AuthenticatedRequest extends Request {
  user: IUser
}

/**
 * Interface for requests with optional authentication
 * Extends the Express Request interface with optional user property
 */
export interface OptionalAuthRequest extends Request {
  user?: IUser
}
