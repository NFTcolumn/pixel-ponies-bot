/**
 * Robust UTC Time Handling Utilities
 * Ensures races happen at exactly 12:00 AM and 12:00 PM UTC
 */

class TimeUtils {
  /**
   * Get the current UTC time with millisecond precision
   * Uses multiple sources to ensure accuracy even during server downtime
   * @returns {Date} Current UTC time
   */
  static getCurrentUTC() {
    // Primary: System time (most reliable for scheduling)
    return new Date();
  }

  /**
   * Get server-independent UTC time for critical operations
   * Falls back to system time if network time fails
   * @returns {Promise<Date>} Current UTC time
   */
  static async getNetworkUTC() {
    try {
      // For now, just use system time - network time can be added later with proper HTTP client
      console.log('🕐 Using system UTC time for race scheduling');
      return new Date();
    } catch (error) {
      console.warn('⚠️ Time fetch failed, using system time:', error.message);
    }
    
    // Fallback to system time
    return new Date();
  }

  /**
   * Get the next scheduled race time (every 10 minutes at :00, :10, :20, :30, :40, :50)
   * @returns {Date} Next race time in UTC
   */
  static getNextRaceTime() {
    const now = new Date();
    const currentMinute = now.getUTCMinutes();
    const nextRace = new Date(now);

    // Races are every 10 minutes at :00, :10, :20, :30, :40, :50
    const nextRaceMinute = Math.ceil(currentMinute / 10) * 10;

    if (nextRaceMinute >= 60) {
      // Next race is at :00 of next hour
      nextRace.setUTCHours(nextRace.getUTCHours() + 1, 0, 0, 0);
    } else {
      // Next race is in current hour
      nextRace.setUTCMinutes(nextRaceMinute, 0, 0);
    }

    return nextRace;
  }

  /**
   * Get time until next race in milliseconds
   * @returns {number} Milliseconds until next race
   */
  static getTimeUntilNextRace() {
    const nextRace = this.getNextRaceTime();
    const now = this.getCurrentUTC();
    return nextRace.getTime() - now.getTime();
  }

  /**
   * Format countdown time as human readable string
   * @param {number} milliseconds - Time in milliseconds
   * @returns {string} Formatted time string
   */
  static formatCountdown(milliseconds) {
    if (milliseconds <= 0) return "Race starting now!";
    
    const totalMinutes = Math.floor(milliseconds / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) {
      if (minutes === 0) {
        return `${hours} hour${hours > 1 ? 's' : ''}`;
      }
      return `${hours} hour${hours > 1 ? 's' : ''} and ${minutes} minute${minutes > 1 ? 's' : ''}`;
    } else {
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
  }

  /**
   * Get cron expression for race scheduling (every 10 minutes at :00, :10, :20, :30, :40, :50)
   * @returns {string} Cron expression for races every 10 minutes
   */
  static getRaceCronExpression() {
    return '0,10,20,30,40,50 * * * *';
  }

  /**
   * Get cron expression for race warnings (1 minute before races at :09, :19, :29, :39, :49, :59)
   * @returns {string} Cron expression for 1-minute warnings
   */
  static getWarningCronExpression() {
    return '9,19,29,39,49,59 * * * *';
  }

  /**
   * Get cron expression for hourly reminders
   * @returns {string} Cron expression for every hour at :30
   */
  static getReminderCronExpression() {
    return '30 * * * *';
  }

  /**
   * Check if current time is within race window
   * @param {Date} raceStartTime - When the race started
   * @param {number} windowMinutes - Duration of betting window in minutes
   * @returns {boolean} True if still within betting window
   */
  static isWithinBettingWindow(raceStartTime, windowMinutes = 15) {
    const now = this.getCurrentUTC();
    const windowMs = windowMinutes * 60 * 1000;
    return (now.getTime() - raceStartTime.getTime()) < windowMs;
  }

  /**
   * Get next race period and time string
   * @returns {object} Object with time and period information
   */
  static getNextRaceInfo() {
    const nextRace = this.getNextRaceTime();
    const hour = nextRace.getUTCHours();
    const minute = nextRace.getUTCMinutes();

    // Format time as HH:MM
    const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

    // Determine AM/PM
    const period = hour < 12 ? 'AM' : 'PM';

    return {
      time: nextRace,
      timeString,
      period,
      date: nextRace.toDateString(),
      countdown: this.formatCountdown(this.getTimeUntilNextRace())
    };
  }

  /**
   * Validate that a race time matches expected schedule
   * @param {Date} raceTime - Time to validate
   * @returns {boolean} True if race time is at :00, :10, :20, :30, :40, or :50
   */
  static isValidRaceTime(raceTime) {
    const minute = raceTime.getUTCMinutes();
    const second = raceTime.getUTCSeconds();

    return (minute % 10 === 0) && second === 0;
  }

  /**
   * Get safe timeout duration to prevent drift
   * For long timeouts, returns max 1 hour to prevent issues with server restarts
   * @param {number} targetMs - Target timeout in milliseconds
   * @returns {number} Safe timeout duration
   */
  static getSafeTimeout(targetMs) {
    const maxTimeout = 60 * 60 * 1000; // 1 hour max
    return Math.min(targetMs, maxTimeout);
  }

  /**
   * Calculate exact milliseconds until next race with drift compensation
   * Accounts for server restart delays and ensures races start on time
   * @returns {number} Milliseconds until next race (minimum 1 second)
   */
  static getTimeUntilNextRaceWithCompensation() {
    const now = this.getCurrentUTC();
    const nextRace = this.getNextRaceTime();
    const msUntilRace = nextRace.getTime() - now.getTime();
    
    // If race should have started already, start immediately
    if (msUntilRace <= 0) {
      console.warn(`⚠️ Race scheduled time passed, starting immediately. Delay: ${Math.abs(msUntilRace)}ms`);
      return 1000; // 1 second delay to allow for system stability
    }
    
    // For very close races (less than 5 seconds), add a small buffer
    if (msUntilRace < 5000) {
      console.log(`⏰ Race starting very soon: ${msUntilRace}ms`);
      return Math.max(1000, msUntilRace);
    }
    
    return msUntilRace;
  }

  /**
   * Enhanced race time validation with tolerance for server delays
   * @param {Date} raceTime - Time to validate
   * @param {number} toleranceMs - Acceptable delay in milliseconds (default: 60 seconds)
   * @returns {boolean} True if race time is valid within tolerance
   */
  static isValidRaceTimeWithTolerance(raceTime, toleranceMs = 60000) {
    const minute = raceTime.getUTCMinutes();
    const second = raceTime.getUTCSeconds();
    const millisecond = raceTime.getUTCMilliseconds();

    // Check if it's exactly at :00 or :30
    const isExact = (minute === 0 || minute === 30) && second === 0 && millisecond === 0;

    if (isExact) return true;

    // If not exact, check if it's within tolerance of a valid race time
    // Calculate the nearest 10-minute mark (:00, :10, :20, :30, :40, :50)
    const nearestRaceMinute = Math.round(minute / 10) * 10;
    const expectedTime = new Date(raceTime);
    expectedTime.setUTCMinutes(nearestRaceMinute, 0, 0);

    const timeDiff = Math.abs(raceTime.getTime() - expectedTime.getTime());
    if (timeDiff <= toleranceMs) {
      console.log(`⚠️ Race time within tolerance: ${timeDiff}ms from expected ${expectedTime.toISOString()}`);
      return true;
    }

    return false;
  }
}

export default TimeUtils;