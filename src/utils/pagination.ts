import { Request } from 'express'

/**
 * Pagination options interface
 */
export interface PaginationOptions {
  page: number
  limit: number
  sort?: string
  fields?: string
}

/**
 * Pagination result interface
 */
export interface PaginationResult<T> {
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    pages: number
    hasNextPage: boolean
    hasPrevPage: boolean
    nextPage: number | null
    prevPage: number | null
  }
}

/**
 * Pagination utilities for API responses
 */
export class PaginationUtils {
  /**
   * Extract pagination options from request query parameters
   * @param req Express request object
   * @param defaultLimit Default limit value (default: 10)
   * @param maxLimit Maximum allowed limit value (default: 100)
   * @returns Pagination options object
   */
  static getPaginationOptions(
    req: Request,
    defaultLimit: number = 10,
    maxLimit: number = 100
  ): PaginationOptions {
    // Get page and limit from query parameters
    let page = parseInt(req.query.page as string) || 1
    let limit = parseInt(req.query.limit as string) || defaultLimit

    // Ensure page is at least 1
    page = Math.max(1, page)

    // Ensure limit is between 1 and maxLimit
    limit = Math.min(Math.max(1, limit), maxLimit)

    // Get sort field and direction from query parameters
    const sort = (req.query.sort as string) || ''

    // Get fields to include from query parameters
    const fields = (req.query.fields as string) || ''

    return { page, limit, sort, fields }
  }

  /**
   * Calculate pagination metadata
   * @param total Total number of items
   * @param page Current page
   * @param limit Items per page
   * @returns Pagination metadata
   */
  static getPaginationMetadata(
    total: number,
    page: number,
    limit: number
  ): PaginationResult<any>['meta'] {
    // Calculate total pages
    const pages = Math.ceil(total / limit)

    // Check if there is a next page
    const hasNextPage = page < pages

    // Check if there is a previous page
    const hasPrevPage = page > 1

    // Calculate next page number
    const nextPage = hasNextPage ? page + 1 : null

    // Calculate previous page number
    const prevPage = hasPrevPage ? page - 1 : null

    return {
      total,
      page,
      limit,
      pages,
      hasNextPage,
      hasPrevPage,
      nextPage,
      prevPage,
    }
  }

  /**
   * Create a paginated response
   * @param data Array of data items
   * @param total Total number of items
   * @param options Pagination options
   * @returns Paginated response object
   */
  static createPaginatedResponse<T>(
    data: T[],
    total: number,
    options: PaginationOptions
  ): PaginationResult<T> {
    return {
      data,
      meta: this.getPaginationMetadata(total, options.page, options.limit),
    }
  }

  /**
   * Calculate skip value for database queries
   * @param page Page number
   * @param limit Items per page
   * @returns Skip value
   */
  static getSkipValue(page: number, limit: number): number {
    return (page - 1) * limit
  }

  /**
   * Create pagination links for HATEOAS-compliant API
   * @param req Express request object
   * @param total Total number of items
   * @param options Pagination options
   * @returns Object with pagination links
   */
  static createPaginationLinks(
    req: Request,
    total: number,
    options: PaginationOptions
  ): {
    self: string
    first: string
    last: string
    next: string | null
    prev: string | null
  } {
    // Get base URL and query parameters
    const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`
    const query = { ...req.query }

    // Remove pagination parameters from query
    delete query.page
    delete query.limit

    // Convert query parameters to string
    const queryString = Object.keys(query)
      .map((key) => `${key}=${query[key]}`)
      .join('&')

    // Create query string prefix
    const prefix = queryString ? `?${queryString}&` : '?'

    // Calculate pagination metadata
    const meta = this.getPaginationMetadata(total, options.page, options.limit)

    // Create self link
    const self = `${baseUrl}${prefix}page=${options.page}&limit=${options.limit}`

    // Create first page link
    const first = `${baseUrl}${prefix}page=1&limit=${options.limit}`

    // Create last page link
    const last = `${baseUrl}${prefix}page=${meta.pages}&limit=${options.limit}`

    // Create next page link if available
    const next = meta.hasNextPage
      ? `${baseUrl}${prefix}page=${meta.nextPage}&limit=${options.limit}`
      : null

    // Create previous page link if available
    const prev = meta.hasPrevPage
      ? `${baseUrl}${prefix}page=${meta.prevPage}&limit=${options.limit}`
      : null

    return { self, first, last, next, prev }
  }

  /**
   * Apply pagination to a MongoDB query
   * @param query Mongoose query
   * @param options Pagination options
   * @returns Mongoose query with pagination applied
   */
  static applyPaginationToQuery(query: any, options: PaginationOptions): any {
    // Apply sort if provided
    if (options.sort) {
      // Convert sort string to sort object
      // Example: "name,-createdAt" => { name: 1, createdAt: -1 }
      const sortObj = options.sort.split(',').reduce((obj, item) => {
        // Check if item starts with "-" for descending sort
        if (item.startsWith('-')) {
          return { ...obj, [item.substring(1)]: -1 }
        }
        return { ...obj, [item]: 1 }
      }, {})

      query = query.sort(sortObj)
    }

    // Apply field selection if provided
    if (options.fields) {
      // Convert fields string to projection object
      // Example: "name,email,-password" => { name: 1, email: 1, password: 0 }
      const fieldObj = options.fields.split(',').reduce((obj, item) => {
        // Check if item starts with "-" for exclusion
        if (item.startsWith('-')) {
          return { ...obj, [item.substring(1)]: 0 }
        }
        return { ...obj, [item]: 1 }
      }, {})

      query = query.select(fieldObj)
    }

    // Apply pagination
    const skip = this.getSkipValue(options.page, options.limit)
    query = query.skip(skip).limit(options.limit)

    return query
  }
}
