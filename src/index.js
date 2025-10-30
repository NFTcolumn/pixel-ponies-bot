import TelegramBot from 'node-telegram-bot-api';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import BotHandler from './handlers/BotHandler.js';
import DataIntegrityManager from './utils/dataIntegrity.js';
import ErrorHandler from './utils/errorHandler.js';
import TimeUtils from './utils/timeUtils.js';

dotenv.config();

class PixelPoniesBot {
  constructor() {
    this.bot = null;
    this.botHandler = null;
    this.errorHandler = null;
    this.isShuttingDown = false;
  }

  async start() {
    try {
      console.log('🏇 Starting Pixel Ponies Bot...');
      console.log('📋 Environment check:');
      console.log('- NODE_ENV:', process.env.NODE_ENV || 'not set');
      console.log('- MONGODB_URI:', process.env.MONGODB_URI ? '✅ set' : '❌ missing');
      console.log('- TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? '✅ set' : '❌ missing');
      console.log('- BASE_RPC_URL:', process.env.BASE_RPC_URL || 'using default (https://mainnet.base.org)');
      console.log('- PONY_TOKEN_ADDRESS:', process.env.PONY_TOKEN_ADDRESS || 'using default from whitepaper');
      console.log('- wallet.json:', require('fs').existsSync('./wallet.json') ? '✅ found' : '⚠️ not found (will use env fallback)');

      // Validate required environment variables
      const required = ['MONGODB_URI', 'TELEGRAM_BOT_TOKEN'];
      const missing = required.filter(key => !process.env[key]);

      if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
      }

      // Check for wallet configuration
      const hasWalletFile = require('fs').existsSync('./wallet.json');
      const hasPrivateKeyEnv = !!process.env.BASE_PRIVATE_KEY;

      if (!hasWalletFile && !hasPrivateKeyEnv) {
        console.warn('⚠️ WARNING: No wallet configuration found!');
        console.warn('⚠️ Please create wallet.json or set BASE_PRIVATE_KEY in .env');
        console.warn('⚠️ Bot will start but blockchain transactions will fail.');
      }
      
      console.log('🔧 Connecting to MongoDB...');
      console.log('🔗 MongoDB URI (masked):', process.env.MONGODB_URI?.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
      
      // Connect to MongoDB with compatible settings for newer MongoDB driver
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000, // 10 second timeout
        connectTimeoutMS: 10000,
        maxPoolSize: 10, // Maintain up to 10 socket connections
        socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
        bufferCommands: false // Disable mongoose buffering
      });
      console.log('✅ Connected to MongoDB');
      
      // Add database connection monitoring
      mongoose.connection.on('connected', () => {
        console.log('🔗 MongoDB connected successfully');
      });
      
      mongoose.connection.on('error', (error) => {
        console.error('❌ MongoDB connection error:', error);
      });
      
      mongoose.connection.on('disconnected', () => {
        console.warn('⚠️ MongoDB disconnected. Attempting to reconnect...');
      });
      
      mongoose.connection.on('reconnected', () => {
        console.log('🔄 MongoDB reconnected successfully');
      });
      
      // Monitor connection state periodically
      setInterval(() => {
        const state = mongoose.connection.readyState;
        const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
        console.log(`📡 MongoDB connection state: ${states[state]} (${state})`);
        
        if (state === 0) { // disconnected
          console.warn('🚨 MongoDB is disconnected - this may affect participant data persistence!');
        }
      }, 60000); // Check every minute
      
      console.log('🤖 Initializing Telegram bot...');
      // Initialize Telegram bot
      this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { 
        polling: true,
        onlyFirstMatch: true 
      });
      console.log('✅ Telegram bot initialized');

      console.log('⚙️ Setting up error handler...');
      // Initialize error handler
      this.errorHandler = new ErrorHandler(this.bot);
      console.log('✅ Error handler initialized');

      console.log('⚙️ Setting up bot handlers...');
      // Setup bot handlers
      this.botHandler = new BotHandler(this.bot);
      console.log('✅ Enhanced bot handlers registered with modular architecture');

      // Run data integrity checks after startup
      console.log('🔍 Running post-deployment data integrity checks...');
      await DataIntegrityManager.verifySystemIntegrity();
      await DataIntegrityManager.recoverOrphanedSelections();
      await DataIntegrityManager.generateStatusReport();

      console.log('🚀 Pixel Ponies Bot is running successfully!');
      
      // Enhanced error handling for bot polling
      this.bot.on('polling_error', (error) => {
        this.errorHandler.handleTelegramError(error).catch(err => {
          console.error('🚨 Critical polling error:', err.message);
          console.error('📋 Full polling error:', err);
        });
      });

      // Handle uncaught exceptions
      process.on('uncaughtException', (error) => {
        console.error('🚨 Uncaught Exception:', error);
        console.error('📋 Stack:', error.stack);
        // Don't exit immediately, let Render restart
      });

      process.on('unhandledRejection', (reason, promise) => {
        console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
        // Don't exit immediately, let Render restart
      });

      // Enhanced graceful shutdown
      process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
      process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
      
    } catch (error) {
      console.error('❌ Failed to start bot:', error.message);
      console.error('📋 Full error:', error);
      
      if (error.name === 'MongooseServerSelectionError') {
        console.error('🔧 MongoDB connection troubleshooting:');
        console.error('- Check if MongoDB Atlas IP whitelist includes 0.0.0.0/0');
        console.error('- Verify username/password in connection string');
        console.error('- Ensure cluster is not paused');
      }
      
      process.exit(1);
    }
  }

  /**
   * Enhanced graceful shutdown with proper cleanup
   * @param {string} signal - Shutdown signal received
   */
  async gracefulShutdown(signal) {
    if (this.isShuttingDown) {
      console.log('🔄 Shutdown already in progress...');
      return;
    }
    
    this.isShuttingDown = true;
    console.log(`🛑 Received ${signal}, starting graceful shutdown...`);
    
    try {
      // Stop accepting new operations
      console.log('🛑 Stopping bot operations...');
      
      // Shutdown bot handlers first
      if (this.botHandler) {
        await this.botHandler.shutdown();
      }
      
      // Stop bot polling
      if (this.bot) {
        console.log('🛑 Stopping Telegram polling...');
        await this.bot.stopPolling();
      }
      
      // Close database connection
      if (mongoose.connection.readyState === 1) {
        console.log('🛑 Closing database connection...');
        await mongoose.disconnect();
      }
      
      // Log final statistics
      if (this.errorHandler) {
        const stats = this.errorHandler.getErrorStats();
        console.log('📊 Final error statistics:', stats);
      }
      
      console.log('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during graceful shutdown:', error);
      process.exit(1);
    }
  }

  /**
   * Get bot status information
   * @returns {Object} Comprehensive bot status
   */
  getStatus() {
    return {
      running: !this.isShuttingDown,
      botHandler: this.botHandler?.getBotStatus() || null,
      errorStats: this.errorHandler?.getErrorStats() || null,
      database: {
        connected: mongoose.connection.readyState === 1,
        state: mongoose.connection.readyState
      },
      nextRace: TimeUtils.getNextRaceInfo(),
      uptime: process.uptime()
    };
  }
}

// Start the bot
const bot = new PixelPoniesBot();
bot.start();