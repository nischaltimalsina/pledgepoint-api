import { Request, Response, NextFunction } from 'express'
import mongoose from 'mongoose'
import { User, IUser } from '../models/user.model'
import { AppError } from '../middleware/error-handler'
import { PasswordUtils } from '../utils/password'
import { GamificationService } from '../services/gamification.service'
import { PaginationUtils } from '../utils/pagination'
import { FileUploadService } from '../services/file.service'
import { AuthenticatedRequest } from '../types/user.types'

// User controller class
export class UserController {
  /**
   * Get current user profile
   */
  static async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user._id

      const user = await User.findById(userId)

      if (!user) {
        throw new AppError(404, 'User not found')
      }

      res.status(200).json({
        status: 'success',
        data: user,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user._id
      const { firstName, lastName, district, location, bio } = req.body

      // Allow updating only these fields
      const updateData: Partial<IUser> = {}
      if (firstName) updateData.firstName = firstName
      if (lastName) updateData.lastName = lastName
      if (district) updateData.district = district
      if (location) updateData.location = location
      if (bio) updateData.bio = bio

      const user = await User.findByIdAndUpdate(userId, updateData, {
        new: true,
        runValidators: true,
      })

      if (!user) {
        throw new AppError(404, 'User not found')
      }

      res.status(200).json({
        status: 'success',
        data: user,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Change user password
   */
  static async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user._id
      const { currentPassword, newPassword } = req.body

      // Get user with password
      const user = await User.findById(userId).select('+password')

      if (!user) {
        throw new AppError(404, 'User not found')
      }

      // Verify current password
      const isPasswordCorrect = await user.comparePassword(currentPassword)

      if (!isPasswordCorrect) {
        throw new AppError(401, 'Current password is incorrect')
      }

      // Validate password strength
      const passwordValidation = PasswordUtils.validatePasswordStrength(newPassword)
      if (!passwordValidation.isValid) {
        throw new AppError(400, passwordValidation.message)
      }

      // Update password and save
      user.password = newPassword
      await user.save()

      res.status(200).json({
        status: 'success',
        message: 'Password updated successfully',
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get user badges
   */
  static async getBadges(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user._id

      const user = await User.findById(userId).select('badges')

      if (!user) {
        throw new AppError(404, 'User not found')
      }

      // Here you would ideally fetch badge details from Badge model
      // For now, we'll just return the badge codes

      res.status(200).json({
        status: 'success',
        data: {
          badges: user.badges,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get user impact points history
   * This would typically fetch from an Activity model
   */
  static async getPointsHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user._id

      // For this implementation, we'll just return the total points
      // In a full implementation, you would fetch from Activity model
      const user = await User.findById(userId).select('impactPoints level')

      if (!user) {
        throw new AppError(404, 'User not found')
      }

      // Check next level progress
      const nextLevelProgress = GamificationService.getNextLevelProgress(user.impactPoints)

      res.status(200).json({
        status: 'success',
        data: {
          totalPoints: user.impactPoints,
          currentLevel: user.level,
          nextLevelProgress,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Upload profile picture
   */
  static uploadProfilePicture = (req: Request, res: Response, next: NextFunction): void => {
    // Use the profile picture upload middleware
    FileUploadService.profilePictureUpload(req, res, async (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new AppError(400, 'File too large. Maximum size is 5MB.'))
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return next(new AppError(400, 'Only one file allowed'))
        }
        return next(new AppError(400, err.message))
      }

      try {
        const authenticatedReq = req as AuthenticatedRequest
        const userId = authenticatedReq.user._id

        if (!req.file) {
          throw new AppError(400, 'No file uploaded')
        }

        // Process the uploaded file
        const fileInfo = FileUploadService.processUploadedFile(req.file)

        // Get current user to check for existing profile picture
        const currentUser = await User.findById(userId)
        if (!currentUser) {
          // Clean up uploaded file if user not found
          FileUploadService.deleteFile(req.file.path)
          throw new AppError(404, 'User not found')
        }

        // Delete old profile picture if it exists
        if (currentUser.profilePicture) {
          const oldFilePath = currentUser.profilePicture.replace('/uploads/', '')
          await FileUploadService.deleteFile(`uploads/${oldFilePath}`)
        }

        // Update user with new profile picture URL
        const user = await User.findByIdAndUpdate(
          userId,
          { profilePicture: fileInfo.url },
          { new: true }
        )

        res.status(200).json({
          status: 'success',
          message: 'Profile picture uploaded successfully',
          data: {
            profilePicture: user?.profilePicture,
            fileInfo: {
              originalName: fileInfo.originalName,
              size: fileInfo.size,
              url: fileInfo.url,
            },
          },
        })
      } catch (error) {
        // Clean up uploaded file on error
        if (req.file) {
          FileUploadService.deleteFile(req.file.path)
        }
        next(error)
      }
    })
  }

  /**
   * Delete profile picture
   */
  static async deleteProfilePicture(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authenticatedReq = req as AuthenticatedRequest
      const userId = authenticatedReq.user._id

      const user = await User.findById(userId)

      if (!user) {
        throw new AppError(404, 'User not found')
      }

      if (!user.profilePicture) {
        throw new AppError(400, 'No profile picture to delete')
      }

      // Delete the file from storage
      const filePath = user.profilePicture.replace('/uploads/', '')
      await FileUploadService.deleteFile(`uploads/${filePath}`)

      // Remove profile picture from user
      user.profilePicture = undefined
      await user.save()

      res.status(200).json({
        status: 'success',
        message: 'Profile picture deleted successfully',
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get profile picture info
   */
  static async getProfilePictureInfo(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> {
    try {
      const authenticatedReq = req as AuthenticatedRequest
      const userId = authenticatedReq.user._id

      const user = await User.findById(userId).select('profilePicture')

      if (!user) {
        throw new AppError(404, 'User not found')
      }

      if (!user.profilePicture) {
        return res.status(200).json({
          status: 'success',
          data: {
            hasProfilePicture: false,
            profilePicture: null,
          },
        })
      }

      // Get file info
      const filePath = user.profilePicture.replace('/uploads/', '')
      const fileInfo = FileUploadService.getFileInfo(`uploads/${filePath}`)

      res.status(200).json({
        status: 'success',
        data: {
          hasProfilePicture: true,
          profilePicture: user.profilePicture,
          fileInfo: {
            exists: fileInfo.exists,
            size: fileInfo.size,
            created: fileInfo.created,
            modified: fileInfo.modified,
          },
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Upload multiple documents/files
   */
  static uploadDocuments = (req: Request, res: Response, next: NextFunction): void => {
    // Use the general document upload middleware
    FileUploadService.documentUpload(req, res, async (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new AppError(400, 'File too large'))
        }
        return next(new AppError(400, err.message))
      }

      try {
        const authenticatedReq = req as AuthenticatedRequest
        const userId = authenticatedReq.user._id

        if (!req.file) {
          throw new AppError(400, 'No file uploaded')
        }

        // Process the uploaded file
        const fileInfo = FileUploadService.processUploadedFile(req.file)

        // You could store file metadata in a separate collection
        // For now, just return the file info

        res.status(200).json({
          status: 'success',
          message: 'Document uploaded successfully',
          data: {
            fileInfo: {
              originalName: fileInfo.originalName,
              filename: fileInfo.filename,
              size: fileInfo.size,
              mimetype: fileInfo.mimetype,
              url: fileInfo.url,
            },
          },
        })
      } catch (error) {
        // Clean up uploaded file on error
        if (req.file) {
          FileUploadService.deleteFile(req.file.path)
        }
        next(error)
      }
    })
  }

  /**
   * Get user's uploaded files (if you have a files collection)
   */
  static async getUserFiles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authenticatedReq = req as AuthenticatedRequest
      const userId = authenticatedReq.user._id

      // This would require a separate File model to track user uploads
      // For now, we'll just return a placeholder response

      res.status(200).json({
        status: 'success',
        message: 'File listing feature requires File model implementation',
        data: {
          files: [],
          total: 0,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Delete user account
   */
  static async deleteAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user._id

      // Soft delete - set active to false
      const user = await User.findByIdAndUpdate(userId, { active: false }, { new: true })

      if (!user) {
        throw new AppError(404, 'User not found')
      }

      // Clean up user's profile picture if exists
      if (user.profilePicture) {
        const filePath = user.profilePicture.replace('/uploads/', '')
        await FileUploadService.deleteFile(`uploads/${filePath}`)
      }

      res.status(200).json({
        status: 'success',
        message: 'Account deactivated successfully',
      })
    } catch (error) {
      next(error)
    }
  }

  // Admin only methods below

  /**
   * Get all users (admin only)
   */
  static async getAllUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Get pagination options from query
      const paginationOptions = PaginationUtils.getPaginationOptions(req)

      // Create query
      let query = User.find({ active: true })

      // Apply filters
      if (req.query.role) {
        query = query.find({ role: req.query.role })
      }

      if (req.query.accountStatus) {
        query = query.find({ accountStatus: req.query.accountStatus })
      }

      if (req.query.level) {
        query = query.find({ level: req.query.level })
      }

      if (req.query.district) {
        query = query.find({ district: req.query.district })
      }

      // Apply pagination
      query = PaginationUtils.applyPaginationToQuery(query, paginationOptions)

      // Execute query
      const users = await query

      // Get total count
      const total = await User.countDocuments(query.getFilter())

      // Create paginated response
      const paginatedResponse = PaginationUtils.createPaginatedResponse(
        users,
        total,
        paginationOptions
      )

      res.status(200).json({
        status: 'success',
        ...paginatedResponse,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get user by ID (admin only)
   */
  static async getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError(400, 'Invalid user ID')
      }

      const user = await User.findById(id)

      if (!user) {
        throw new AppError(404, 'User not found')
      }

      res.status(200).json({
        status: 'success',
        data: user,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Update user (admin only)
   */
  static async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const { firstName, lastName, role, accountStatus, level, impactPoints } = req.body

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError(400, 'Invalid user ID')
      }

      // Create update object with admin-allowed fields
      const updateData: Partial<IUser> = {}
      if (firstName) updateData.firstName = firstName
      if (lastName) updateData.lastName = lastName
      if (role) updateData.role = role
      if (accountStatus) updateData.accountStatus = accountStatus
      if (level) updateData.level = level
      if (impactPoints !== undefined) updateData.impactPoints = impactPoints

      const user = await User.findByIdAndUpdate(id, updateData, { new: true, runValidators: true })

      if (!user) {
        throw new AppError(404, 'User not found')
      }

      res.status(200).json({
        status: 'success',
        data: user,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Delete user (admin only)
   */
  static async deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError(400, 'Invalid user ID')
      }

      const user = await User.findById(id)

      if (!user) {
        throw new AppError(404, 'User not found')
      }

      // Clean up user's files before deletion
      if (user.profilePicture) {
        const filePath = user.profilePicture.replace('/uploads/', '')
        await FileUploadService.deleteFile(`uploads/${filePath}`)
      }

      // Hard delete for admin action
      await User.findByIdAndDelete(id)

      res.status(200).json({
        status: 'success',
        message: 'User deleted successfully',
      })
    } catch (error) {
      next(error)
    }
  }
}
