import { User } from '../models/user.model'

declare global {
  namespace Express {
    // Extend Request interface
    interface Request {
      user?: User // Use your actual User type
    }
  }
}
