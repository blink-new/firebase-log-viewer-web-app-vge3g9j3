import { parseISO, parse, isValid, format } from 'date-fns'

/**
 * Safely parse timestamp from Firebase logs
 * Handles multiple timestamp formats and returns a valid Date or fallback
 */
export function parseTimestamp(timestamp: string | Date | undefined | null): Date {
  // Return current date if timestamp is missing
  if (!timestamp) {
    return new Date()
  }

  // If already a Date object, validate it
  if (timestamp instanceof Date) {
    return isValid(timestamp) ? timestamp : new Date()
  }

  // If it's a string, try multiple parsing strategies
  if (typeof timestamp === 'string') {
    // Strategy 1: Try ISO format (2025-07-23T20:06:36.993609)
    try {
      const isoDate = parseISO(timestamp)
      if (isValid(isoDate)) {
        return isoDate
      }
    } catch (error) {
      // Continue to next strategy
    }

    // Strategy 2: Try DD/MM/YYYY HH:mm:ss.SSS format (23/07/2025 20:00:55.143)
    try {
      const ddmmyyyyDate = parse(timestamp, 'dd/MM/yyyy HH:mm:ss.SSS', new Date())
      if (isValid(ddmmyyyyDate)) {
        return ddmmyyyyDate
      }
    } catch (error) {
      // Continue to next strategy
    }

    // Strategy 3: Try DD/MM/YYYY HH:mm:ss format (without milliseconds)
    try {
      const ddmmyyyyDateNoMs = parse(timestamp, 'dd/MM/yyyy HH:mm:ss', new Date())
      if (isValid(ddmmyyyyDateNoMs)) {
        return ddmmyyyyDateNoMs
      }
    } catch (error) {
      // Continue to next strategy
    }

    // Strategy 4: Try native Date parsing as last resort
    try {
      const nativeDate = new Date(timestamp)
      if (isValid(nativeDate)) {
        return nativeDate
      }
    } catch (error) {
      // Fall through to default
    }
  }

  // Fallback: return current date if all parsing fails
  console.warn('Failed to parse timestamp:', timestamp, 'using current date as fallback')
  return new Date()
}

/**
 * Safely format a timestamp for display
 */
export function formatTimestamp(timestamp: string | Date | undefined | null, formatStr: string = 'MMM dd, yyyy HH:mm'): string {
  const date = parseTimestamp(timestamp)
  
  try {
    return format(date, formatStr)
  } catch (error) {
    console.warn('Failed to format timestamp:', timestamp, error)
    return 'Invalid Date'
  }
}

/**
 * Check if a timestamp is valid
 */
export function isValidTimestamp(timestamp: string | Date | undefined | null): boolean {
  if (!timestamp) return false
  
  try {
    const date = parseTimestamp(timestamp)
    return isValid(date)
  } catch (error) {
    return false
  }
}

/**
 * Get a safe timestamp for comparison operations
 */
export function getSafeTimestamp(timestamp: string | Date | undefined | null): number {
  const date = parseTimestamp(timestamp)
  return date.getTime()
}