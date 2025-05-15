import { Request } from 'express'
import { IUser as User } from '../models/user.model'

// Extend Express Request interface for authenticated requests
export interface AuthenticatedRequest extends Request {
  user: User
}

// Interface for optional authentication
export interface OptionalAuthRequest extends Request {
  user?: User
}
