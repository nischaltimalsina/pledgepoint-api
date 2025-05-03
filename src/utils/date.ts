/**
 * Date utilities for the PledgePoint application
 */
export class DateUtils {
  /**
   * Format a date to a string in the specified format
   * @param date Date to format
   * @param format Format string (default: 'YYYY-MM-DD')
   * @returns Formatted date string
   */
  static formatDate(date: Date, format: string = 'YYYY-MM-DD'): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')

    // Replace format tokens with actual values
    return format
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds)
  }

  /**
   * Parse a date string to a Date object
   * @param dateString Date string to parse
   * @returns Date object or null if invalid
   */
  static parseDate(dateString: string): Date | null {
    const date = new Date(dateString)
    return isNaN(date.getTime()) ? null : date
  }

  /**
   * Check if a date is in the past
   * @param date Date to check
   * @returns True if date is in the past, false otherwise
   */
  static isPast(date: Date): boolean {
    return date.getTime() < Date.now()
  }

  /**
   * Check if a date is in the future
   * @param date Date to check
   * @returns True if date is in the future, false otherwise
   */
  static isFuture(date: Date): boolean {
    return date.getTime() > Date.now()
  }

  /**
   * Get the difference between two dates in days
   * @param date1 First date
   * @param date2 Second date (default: current date)
   * @returns Difference in days
   */
  static getDaysDifference(date1: Date, date2: Date = new Date()): number {
    const diffTime = Math.abs(date2.getTime() - date1.getTime())
    return Math.floor(diffTime / (1000 * 60 * 60 * 24))
  }

  /**
   * Get the difference between two dates in a specified unit
   * @param date1 First date
   * @param date2 Second date (default: current date)
   * @param unit Unit for result ('seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years')
   * @returns Difference in specified unit
   */
  static getTimeDifference(
    date1: Date,
    date2: Date = new Date(),
    unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years' = 'days'
  ): number {
    const diffTime = Math.abs(date2.getTime() - date1.getTime())

    switch (unit) {
      case 'seconds':
        return Math.floor(diffTime / 1000)
      case 'minutes':
        return Math.floor(diffTime / (1000 * 60))
      case 'hours':
        return Math.floor(diffTime / (1000 * 60 * 60))
      case 'days':
        return Math.floor(diffTime / (1000 * 60 * 60 * 24))
      case 'weeks':
        return Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7))
      case 'months':
        // Approximation
        return Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30))
      case 'years':
        // Approximation
        return Math.floor(diffTime / (1000 * 60 * 60 * 24 * 365))
      default:
        return Math.floor(diffTime / (1000 * 60 * 60 * 24))
    }
  }

  /**
   * Add a specified time to a date
   * @param date Base date
   * @param amount Amount to add
   * @param unit Unit of amount ('seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years')
   * @returns New date with added time
   */
  static addTime(
    date: Date,
    amount: number,
    unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years'
  ): Date {
    const result = new Date(date)

    switch (unit) {
      case 'seconds':
        result.setSeconds(result.getSeconds() + amount)
        break
      case 'minutes':
        result.setMinutes(result.getMinutes() + amount)
        break
      case 'hours':
        result.setHours(result.getHours() + amount)
        break
      case 'days':
        result.setDate(result.getDate() + amount)
        break
      case 'weeks':
        result.setDate(result.getDate() + amount * 7)
        break
      case 'months':
        result.setMonth(result.getMonth() + amount)
        break
      case 'years':
        result.setFullYear(result.getFullYear() + amount)
        break
    }

    return result
  }

  /**
   * Subtract a specified time from a date
   * @param date Base date
   * @param amount Amount to subtract
   * @param unit Unit of amount ('seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years')
   * @returns New date with subtracted time
   */
  static subtractTime(
    date: Date,
    amount: number,
    unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years'
  ): Date {
    return this.addTime(date, -amount, unit)
  }

  /**
   * Get a relative time string (e.g., "2 days ago", "in 3 hours")
   * @param date Date to get relative time for
   * @param relativeTo Date to compare to (default: current date)
   * @returns Relative time string
   */
  static getRelativeTimeString(date: Date, relativeTo: Date = new Date()): string {
    const isPast = date.getTime() < relativeTo.getTime()
    const diffSeconds = Math.floor(Math.abs(relativeTo.getTime() - date.getTime()) / 1000)

    // Less than a minute
    if (diffSeconds < 60) {
      return isPast ? 'just now' : 'in a moment'
    }

    // Less than an hour
    if (diffSeconds < 60 * 60) {
      const minutes = Math.floor(diffSeconds / 60)
      return isPast
        ? `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
        : `in ${minutes} minute${minutes !== 1 ? 's' : ''}`
    }

    // Less than a day
    if (diffSeconds < 60 * 60 * 24) {
      const hours = Math.floor(diffSeconds / (60 * 60))
      return isPast
        ? `${hours} hour${hours !== 1 ? 's' : ''} ago`
        : `in ${hours} hour${hours !== 1 ? 's' : ''}`
    }

    // Less than a week
    if (diffSeconds < 60 * 60 * 24 * 7) {
      const days = Math.floor(diffSeconds / (60 * 60 * 24))
      return isPast
        ? `${days} day${days !== 1 ? 's' : ''} ago`
        : `in ${days} day${days !== 1 ? 's' : ''}`
    }

    // Less than a month
    if (diffSeconds < 60 * 60 * 24 * 30) {
      const weeks = Math.floor(diffSeconds / (60 * 60 * 24 * 7))
      return isPast
        ? `${weeks} week${weeks !== 1 ? 's' : ''} ago`
        : `in ${weeks} week${weeks !== 1 ? 's' : ''}`
    }

    // Less than a year
    if (diffSeconds < 60 * 60 * 24 * 365) {
      const months = Math.floor(diffSeconds / (60 * 60 * 24 * 30))
      return isPast
        ? `${months} month${months !== 1 ? 's' : ''} ago`
        : `in ${months} month${months !== 1 ? 's' : ''}`
    }

    // More than a year
    const years = Math.floor(diffSeconds / (60 * 60 * 24 * 365))
    return isPast
      ? `${years} year${years !== 1 ? 's' : ''} ago`
      : `in ${years} year${years !== 1 ? 's' : ''}`
  }

  /**
   * Get the start of a time unit for a date
   * @param date Date to get start of time unit for
   * @param unit Time unit ('day', 'week', 'month', 'year')
   * @returns Date at start of specified time unit
   */
  static startOf(date: Date, unit: 'day' | 'week' | 'month' | 'year'): Date {
    const result = new Date(date)

    switch (unit) {
      case 'day':
        result.setHours(0, 0, 0, 0)
        break
      case 'week':
        const day = result.getDay()
        result.setDate(result.getDate() - day) // Go to Sunday
        result.setHours(0, 0, 0, 0)
        break
      case 'month':
        result.setDate(1)
        result.setHours(0, 0, 0, 0)
        break
      case 'year':
        result.setMonth(0, 1)
        result.setHours(0, 0, 0, 0)
        break
    }

    return result
  }

  /**
   * Get the end of a time unit for a date
   * @param date Date to get end of time unit for
   * @param unit Time unit ('day', 'week', 'month', 'year')
   * @returns Date at end of specified time unit
   */
  static endOf(date: Date, unit: 'day' | 'week' | 'month' | 'year'): Date {
    const result = new Date(date)

    switch (unit) {
      case 'day':
        result.setHours(23, 59, 59, 999)
        break
      case 'week':
        const day = result.getDay()
        result.setDate(result.getDate() + (6 - day)) // Go to Saturday
        result.setHours(23, 59, 59, 999)
        break
      case 'month':
        result.setMonth(result.getMonth() + 1, 0) // Last day of month
        result.setHours(23, 59, 59, 999)
        break
      case 'year':
        result.setMonth(11, 31) // December 31
        result.setHours(23, 59, 59, 999)
        break
    }

    return result
  }
}
