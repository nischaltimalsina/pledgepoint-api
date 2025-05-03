/**
 * Validator utility for common validation functions
 */
export class Validator {
  /**
   * Check if a string is a valid email address
   * @param email Email address to validate
   * @returns True if valid, false otherwise
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  /**
   * Check if a string is a valid URL
   * @param url URL to validate
   * @returns True if valid, false otherwise
   */
  static isValidUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Check if a string is a valid Mongoose ObjectId
   * @param id ID to validate
   * @returns True if valid, false otherwise
   */
  static isValidObjectId(id: string): boolean {
    const objectIdRegex = /^[0-9a-fA-F]{24}$/
    return objectIdRegex.test(id)
  }

  /**
   * Check if a string is a valid phone number
   * @param phone Phone number to validate
   * @returns True if valid, false otherwise
   */
  static isValidPhoneNumber(phone: string): boolean {
    // This is a simple validation - adjust for specific country formats if needed
    const phoneRegex = /^\+?[0-9]{7,15}$/
    return phoneRegex.test(phone)
  }

  /**
   * Check if a string is empty (null, undefined, or only whitespace)
   * @param str String to check
   * @returns True if empty, false otherwise
   */
  static isEmpty(str: string | null | undefined): boolean {
    return str === null || str === undefined || str.trim() === ''
  }

  /**
   * Check if a string is at least a certain length
   * @param str String to check
   * @param length Minimum length
   * @returns True if long enough, false otherwise
   */
  static isMinLength(str: string, length: number): boolean {
    return str.length >= length
  }

  /**
   * Check if a string is at most a certain length
   * @param str String to check
   * @param length Maximum length
   * @returns True if short enough, false otherwise
   */
  static isMaxLength(str: string, length: number): boolean {
    return str.length <= length
  }

  /**
   * Check if a string is a valid date
   * @param dateStr String to check
   * @returns True if valid date, false otherwise
   */
  static isValidDate(dateStr: string): boolean {
    const date = new Date(dateStr)
    return !isNaN(date.getTime())
  }

  /**
   * Check if a date is after another date
   * @param date Date to check
   * @param compareDate Date to compare against
   * @returns True if date is after compareDate, false otherwise
   */
  static isAfter(date: Date, compareDate: Date): boolean {
    return date.getTime() > compareDate.getTime()
  }

  /**
   * Check if a date is before another date
   * @param date Date to check
   * @param compareDate Date to compare against
   * @returns True if date is before compareDate, false otherwise
   */
  static isBefore(date: Date, compareDate: Date): boolean {
    return date.getTime() < compareDate.getTime()
  }

  /**
   * Check if a value is a number
   * @param value Value to check
   * @returns True if number, false otherwise
   */
  static isNumber(value: any): boolean {
    return !isNaN(parseFloat(value)) && isFinite(value)
  }

  /**
   * Check if a number is between a minimum and maximum value
   * @param num Number to check
   * @param min Minimum value
   * @param max Maximum value
   * @returns True if in range, false otherwise
   */
  static isInRange(num: number, min: number, max: number): boolean {
    return num >= min && num <= max
  }

  /**
   * Check if a string contains only alphanumeric characters
   * @param str String to check
   * @returns True if alphanumeric, false otherwise
   */
  static isAlphanumeric(str: string): boolean {
    const alphanumericRegex = /^[a-zA-Z0-9]+$/
    return alphanumericRegex.test(str)
  }

  /**
   * Check if a value is one of a set of allowed values
   * @param value Value to check
   * @param allowedValues Array of allowed values
   * @returns True if value is allowed, false otherwise
   */
  static isAllowedValue(value: any, allowedValues: any[]): boolean {
    return allowedValues.includes(value)
  }

  /**
   * Check if a string is a valid password
   * (at least 8 characters, with at least one uppercase, lowercase, number, and special character)
   * @param password Password to validate
   * @returns True if valid, false otherwise
   */
  static isStrongPassword(password: string): boolean {
    // At least 8 characters
    if (password.length < 8) {
      return false
    }

    // Check for uppercase letter
    if (!/[A-Z]/.test(password)) {
      return false
    }

    // Check for lowercase letter
    if (!/[a-z]/.test(password)) {
      return false
    }

    // Check for number
    if (!/[0-9]/.test(password)) {
      return false
    }

    // Check for special character
    if (!/[^A-Za-z0-9]/.test(password)) {
      return false
    }

    return true
  }

  /**
   * Check if an array has duplicates
   * @param arr Array to check
   * @returns True if duplicates exist, false otherwise
   */
  static hasDuplicates(arr: any[]): boolean {
    return new Set(arr).size !== arr.length
  }

  /**
   * Check if a string is a valid JSON
   * @param str String to check
   * @returns True if valid JSON, false otherwise
   */
  static isValidJson(str: string): boolean {
    try {
      JSON.parse(str)
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Check if a value is null or undefined
   * @param value Value to check
   * @returns True if null or undefined, false otherwise
   */
  static isNullOrUndefined(value: any): boolean {
    return value === null || value === undefined
  }

  /**
   * Check if a string is a valid hex color code
   * @param color Color to validate
   * @returns True if valid, false otherwise
   */
  static isValidHexColor(color: string): boolean {
    const hexColorRegex = /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/
    return hexColorRegex.test(color)
  }

  /**
   * Check if a string is a valid ISO 8601 date string
   * @param dateStr String to check
   * @returns True if valid, false otherwise
   */
  static isValidIsoDate(dateStr: string): boolean {
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?)?$/
    return isoDateRegex.test(dateStr) && this.isValidDate(dateStr)
  }

  /**
   * Check if a string contains only letters
   * @param str String to check
   * @returns True if only letters, false otherwise
   */
  static isAlphabetic(str: string): boolean {
    const alphabeticRegex = /^[a-zA-Z]+$/
    return alphabeticRegex.test(str)
  }

  /**
   * Check if a string contains only digits
   * @param str String to check
   * @returns True if only digits, false otherwise
   */
  static isNumeric(str: string): boolean {
    const numericRegex = /^[0-9]+$/
    return numericRegex.test(str)
  }
}
