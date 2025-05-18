import { Router } from 'express'
import { AuthController } from '../controllers/auth.controller'
import { validate } from '../middleware/validation'
import { ValidationSchemas } from '../middleware/validation'
import { AuthMiddleware } from '../middleware/auth'
import { RateLimiter } from '../middleware/rate-limiter'

const router = Router()

// Apply rate limiting to auth routes
const authLimiter = RateLimiter.authLimiter

// Public routes (no authentication required)

// Register a new user
router.post(
  '/register',
  authLimiter,
  validate(ValidationSchemas.user.register),
  AuthController.register
)

// Login user
router.post('/login', authLimiter, validate(ValidationSchemas.user.login), AuthController.login)

// Refresh access token
router.post('/refresh-token', authLimiter, AuthController.refreshToken)

// Verify email with token
router.get('/verify-email/:token', AuthController.verifyEmail)

// Resend verification email
router.post(
  '/resend-verification',
  authLimiter,
  validate(ValidationSchemas.user.forgotPassword), // Reuse schema as it just needs email
  AuthController.resendVerificationEmail
)

// Forgot password - request reset
router.post(
  '/forgot-password',
  authLimiter,
  validate(ValidationSchemas.user.forgotPassword),
  AuthController.forgotPassword
)

// Reset password with token
router.post(
  '/reset-password/:token',
  authLimiter,
  validate(ValidationSchemas.user.resetPassword),
  AuthController.resetPassword
)

// Protected routes (require authentication)

// Logout user - requires authentication
router.post('/logout', AuthMiddleware.authenticate, AuthController.logout)

// Get current user profile
router.get('/me', AuthMiddleware.authenticate, AuthController.getMe)

// Update current user profile
router.patch(
  '/me',
  AuthMiddleware.authenticate,
  validate(ValidationSchemas.user.updateProfile),
  AuthController.updateMe
)

// Change password
router.post(
  '/change-password',
  authLimiter,
  AuthMiddleware.authenticate,
  validate(ValidationSchemas.user.changePassword),
  AuthController.changePassword
)

// Two-factor authentication routes - require authentication
router.use('/two-factor', AuthMiddleware.authenticate)

// Setup two-factor authentication
router.post('/two-factor/setup', AuthController.setupTwoFactor)

// Verify and enable two-factor authentication
router.post(
  '/two-factor/enable',
  validate(ValidationSchemas.user.twoFactorVerify),
  AuthController.verifyAndEnableTwoFactor
)

// Disable two-factor authentication
router.post(
  '/two-factor/disable',
  validate(ValidationSchemas.user.twoFactorDisable),
  AuthController.disableTwoFactor
)

export default router
