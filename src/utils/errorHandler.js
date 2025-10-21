/**
 * Enhanced Error Handling Utilities
 * Provides comprehensive error handling with logging, recovery, and user feedback
 */

class ErrorHandler {
  constructor(bot = null) {
    this.bot = bot;
    this.errorCounts = new Map();
    this.rateLimitCounters = new Map();
  }

  /**
   * Handle Telegram API errors with smart retry logic
   * @param {Error} error - Telegram API error
   * @param {Function} retryOperation - Function to retry
   * @param {number} maxRetries - Maximum retry attempts
   * @returns {Promise<any>} Result of retry operation or throws error
   */
  async handleTelegramError(error, retryOperation = null, maxRetries = 3) {
    const errorCode = error.code;
    const errorMessage = error.message || '';

    console.error(`🚨 Telegram API Error [${errorCode}]: ${errorMessage}`);

    switch (errorCode) {
      case 'ETELEGRAM':
        return this.handleETelegramError(error, retryOperation, maxRetries);
      case 'EFATAL':
        return this.handleNetworkError(error, retryOperation, maxRetries);
      default:
        return this.handleGenericError(error, retryOperation, maxRetries);
    }
  }

  /**
   * Handle ETELEGRAM specific errors (400, 429, etc.)
   * @param {Error} error - Telegram error
   * @param {Function} retryOperation - Retry function
   * @param {number} maxRetries - Max retries
   */
  async handleETelegramError(error, retryOperation, maxRetries) {
    const response = error.response;
    
    if (!response || !response.body) {
      throw error;
    }

    const statusCode = response.statusCode;
    const errorCode = response.body.error_code;
    
    console.log(`📋 Telegram Error Details: Status ${statusCode}, Code ${errorCode}`);

    switch (statusCode) {
      case 400:
        return this.handle400Error(error, response.body);
      case 429:
        return this.handle429Error(error, response.body, retryOperation, maxRetries);
      case 403:
        return this.handle403Error(error, response.body);
      case 404:
        return this.handle404Error(error, response.body);
      default:
        console.warn(`⚠️ Unhandled Telegram status code: ${statusCode}`);
        throw error;
    }
  }

  /**
   * Handle 400 Bad Request errors
   * @param {Error} error - Original error
   * @param {Object} body - Response body
   */
  async handle400Error(error, body) {
    const description = body.description || '';
    
    if (description.includes('chat not found')) {
      console.warn('⚠️ Chat not found - possibly invalid channel ID or bot not in channel');
      // Don't throw - this is expected in some cases
      return null;
    }
    
    if (description.includes('message to delete not found')) {
      console.warn('⚠️ Message to delete not found - already deleted or invalid ID');
      return null;
    }
    
    if (description.includes('message can\'t be edited')) {
      console.warn('⚠️ Message cannot be edited - too old or already edited');
      return null;
    }
    
    console.error(`❌ Unhandled 400 error: ${description}`);
    throw error;
  }

  /**
   * Handle 429 Too Many Requests (rate limiting)
   * @param {Error} error - Original error
   * @param {Object} body - Response body  
   * @param {Function} retryOperation - Retry function
   * @param {number} maxRetries - Max retries
   */
  async handle429Error(error, body, retryOperation, maxRetries) {
    const retryAfter = body.parameters?.retry_after || 5;
    
    console.warn(`🐌 Rate limited! Retrying after ${retryAfter} seconds...`);
    
    // Track rate limiting
    const rateLimitKey = this.getRateLimitKey();
    const currentCount = this.rateLimitCounters.get(rateLimitKey) || 0;
    this.rateLimitCounters.set(rateLimitKey, currentCount + 1);
    
    if (currentCount > 10) {
      console.error('🚨 Excessive rate limiting detected - backing off');
      // Exponential backoff
      await this.sleep((retryAfter + currentCount) * 1000);
    } else {
      await this.sleep(retryAfter * 1000);
    }
    
    if (retryOperation && maxRetries > 0) {
      try {
        return await retryOperation();
      } catch (retryError) {
        return this.handleTelegramError(retryError, retryOperation, maxRetries - 1);
      }
    }
    
    throw error;
  }

  /**
   * Handle 403 Forbidden errors
   * @param {Error} error - Original error
   * @param {Object} body - Response body
   */
  async handle403Error(error, body) {
    const description = body.description || '';
    
    if (description.includes('bot was blocked by the user')) {
      console.warn('⚠️ Bot blocked by user - skipping message');
      return null;
    }
    
    if (description.includes('bot was kicked')) {
      console.warn('⚠️ Bot was kicked from group/channel');
      return null;
    }
    
    console.error(`❌ Forbidden error: ${description}`);
    throw error;
  }

  /**
   * Handle 404 Not Found errors
   * @param {Error} error - Original error
   * @param {Object} body - Response body
   */
  async handle404Error(error, body) {
    console.warn('⚠️ Resource not found (404) - skipping operation');
    return null;
  }

  /**
   * Handle network/connection errors
   * @param {Error} error - Network error
   * @param {Function} retryOperation - Retry function
   * @param {number} maxRetries - Max retries
   */
  async handleNetworkError(error, retryOperation, maxRetries) {
    const errorMessage = error.message || '';
    
    if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('ECONNRESET')) {
      console.warn(`🌐 Network timeout - retrying... (${maxRetries} attempts left)`);
      
      if (retryOperation && maxRetries > 0) {
        await this.sleep(2000); // 2 second delay
        try {
          return await retryOperation();
        } catch (retryError) {
          return this.handleNetworkError(retryError, retryOperation, maxRetries - 1);
        }
      }
    }
    
    console.error(`❌ Network error: ${errorMessage}`);
    throw error;
  }

  /**
   * Handle generic errors
   * @param {Error} error - Generic error
   * @param {Function} retryOperation - Retry function 
   * @param {number} maxRetries - Max retries
   */
  async handleGenericError(error, retryOperation, maxRetries) {
    console.error(`❌ Generic error: ${error.message}`);
    
    // Track error frequency
    const errorKey = error.name || 'UnknownError';
    const currentCount = this.errorCounts.get(errorKey) || 0;
    this.errorCounts.set(errorKey, currentCount + 1);
    
    // Log stack trace for debugging
    if (error.stack) {
      console.error(`📋 Stack trace: ${error.stack}`);
    }
    
    throw error;
  }

  /**
   * Send safe message with error handling
   * @param {string} chatId - Chat ID
   * @param {string} message - Message to send
   * @param {Object} options - Send options
   * @returns {Promise<any>} Result or null if failed
   */
  async sendMessageSafe(chatId, message, options = {}) {
    if (!this.bot) {
      console.error('❌ Bot instance not provided to ErrorHandler');
      return null;
    }

    const sendOperation = () => this.bot.sendMessage(chatId, message, options);
    
    try {
      return await sendOperation();
    } catch (error) {
      return this.handleTelegramError(error, sendOperation);
    }
  }

  /**
   * Edit message safely with error handling
   * @param {string} chatId - Chat ID
   * @param {number} messageId - Message ID to edit
   * @param {string} text - New text
   * @param {Object} options - Edit options
   * @returns {Promise<any>} Result or null if failed
   */
  async editMessageSafe(chatId, messageId, text, options = {}) {
    if (!this.bot) {
      console.error('❌ Bot instance not provided to ErrorHandler');
      return null;
    }

    const editOperation = () => this.bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      ...options
    });
    
    try {
      return await editOperation();
    } catch (error) {
      return this.handleTelegramError(error, editOperation);
    }
  }

  /**
   * Get rate limit tracking key (per hour)
   * @returns {string} Rate limit key
   */
  getRateLimitKey() {
    const now = new Date();
    return `rate_limit_${now.getUTCFullYear()}_${now.getUTCMonth()}_${now.getUTCDate()}_${now.getUTCHours()}`;
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} Sleep promise
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get error statistics
   * @returns {Object} Error statistics
   */
  getErrorStats() {
    return {
      errorCounts: Object.fromEntries(this.errorCounts),
      rateLimitCounts: Object.fromEntries(this.rateLimitCounters),
      totalErrors: Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0),
      totalRateLimits: Array.from(this.rateLimitCounters.values()).reduce((a, b) => a + b, 0)
    };
  }

  /**
   * Reset error counters (useful for periodic cleanup)
   */
  resetCounters() {
    this.errorCounts.clear();
    this.rateLimitCounters.clear();
    console.log('🧹 Error counters reset');
  }
}

export default ErrorHandler;