import multer from 'multer'
import path from 'path'
import crypto from 'crypto'
import fs from 'fs'
import { Request } from 'express'
import { AppError } from '../middleware/error-handler'
import { config } from '../config'
import { logger } from '../utils/logger'

/**
 * File upload service with proper multer implementation
 */
export class FileUploadService {
  /**
   * Create multer storage configuration
   */
  private static createStorage(destination: string) {
    // Ensure destination directory exists
    if (!fs.existsSync(destination)) {
      fs.mkdirSync(destination, { recursive: true })
    }

    return multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, destination)
      },
      filename: (req, file, cb) => {
        // Generate unique filename
        const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex')
        const ext = path.extname(file.originalname)
        const baseName = path.basename(file.originalname, ext)
        cb(null, `${baseName}-${uniqueSuffix}${ext}`)
      },
    })
  }

  /**
   * File filter for validation
   */
  private static createFileFilter(allowedTypes: string[]) {
    return (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true)
      } else {
        cb(new AppError(400, `File type ${file.mimetype} not allowed`))
      }
    }
  }

  /**
   * Profile picture upload middleware
   */
  static profilePictureUpload = multer({
    storage: this.createStorage(path.join(config.security.upload.destination, 'profiles')),
    fileFilter: this.createFileFilter(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']),
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
      files: 1,
    },
  }).single('profilePicture')

  /**
   * Campaign image upload middleware
   */
  static campaignImageUpload = multer({
    storage: this.createStorage(path.join(config.security.upload.destination, 'campaigns')),
    fileFilter: this.createFileFilter(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
      files: 1,
    },
  }).single('campaignImage')

  /**
   * Evidence document upload middleware
   */
  static evidenceUpload = multer({
    storage: this.createStorage(path.join(config.security.upload.destination, 'evidence')),
    fileFilter: this.createFileFilter([
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]),
    limits: {
      fileSize: config.security.upload.maxSize,
      files: 5, // Allow multiple evidence files
    },
  }).array('evidenceFiles', 5)

  /**
   * General document upload middleware
   */
  static documentUpload = multer({
    storage: this.createStorage(path.join(config.security.upload.destination, 'documents')),
    fileFilter: this.createFileFilter(config.security.upload.allowedTypes),
    limits: {
      fileSize: config.security.upload.maxSize,
      files: 1,
    },
  }).single('document')

  /**
   * Process uploaded file and return file info
   */
  static processUploadedFile(file: Express.Multer.File): {
    filename: string
    originalName: string
    path: string
    size: number
    mimetype: string
    url: string
  } {
    return {
      filename: file.filename,
      originalName: file.originalname,
      path: file.path,
      size: file.size,
      mimetype: file.mimetype,
      url: `/uploads/${path.relative(config.security.upload.destination, file.path).replace(/\\/g, '/')}`,
    }
  }

  /**
   * Delete uploaded file
   */
  static async deleteFile(filePath: string): Promise<boolean> {
    try {
      // Ensure the file path is within the upload directory for security
      const fullPath = path.resolve(filePath)
      const uploadDir = path.resolve(config.security.upload.destination)

      if (!fullPath.startsWith(uploadDir)) {
        logger.warn(`Attempted to delete file outside upload directory: ${filePath}`)
        return false
      }

      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath)
        logger.info(`File deleted: ${filePath}`)
        return true
      }

      return false
    } catch (error) {
      logger.error(`Error deleting file ${filePath}:`, error)
      return false
    }
  }

  /**
   * Get file info
   */
  static getFileInfo(filePath: string): {
    exists: boolean
    size?: number
    created?: Date
    modified?: Date
  } {
    try {
      if (!fs.existsSync(filePath)) {
        return { exists: false }
      }

      const stats = fs.statSync(filePath)
      return {
        exists: true,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
      }
    } catch (error) {
      logger.error(`Error getting file info for ${filePath}:`, error)
      return { exists: false }
    }
  }

  /**
   * Clean up old files (run as a scheduled job)
   */
  static async cleanupOldFiles(maxAge: number = 30): Promise<void> {
    try {
      const uploadDir = config.security.upload.destination
      const cutoffDate = new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000)

      const cleanupDirectory = (dir: string) => {
        const files = fs.readdirSync(dir)

        files.forEach((file) => {
          const filePath = path.join(dir, file)
          const stats = fs.statSync(filePath)

          if (stats.isDirectory()) {
            cleanupDirectory(filePath)
          } else if (stats.mtime < cutoffDate) {
            // Check if file is still referenced in database
            // This is a placeholder - you'd implement actual DB checks
            fs.unlinkSync(filePath)
            logger.info(`Cleaned up old file: ${filePath}`)
          }
        })
      }

      cleanupDirectory(uploadDir)
    } catch (error) {
      logger.error('Error during file cleanup:', error)
    }
  }
}
