import TelegramBot from 'node-telegram-bot-api';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import BotHandler from './handlers/BotHandler.js';

dotenv.config();

class PixelPoniesBot {
  constructor() {
    this.bot = null;
  }

  async start() {
    try {
      console.log('🏇 Starting Pixel Ponies Bot...');
      console.log('📋 Environment check:');
      console.log('- NODE_ENV:', process.env.NODE_ENV || 'not set');
      console.log('- MONGODB_URI:', process.env.MONGODB_URI ? '✅ set' : '❌ missing');
      console.log('- TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? '✅ set' : '❌ missing');
      console.log('- SOLANA_PRIVATE_KEY:', process.env.SOLANA_PRIVATE_KEY ? '✅ set' : '❌ missing');
      
      // Validate required environment variables
      const required = ['MONGODB_URI', 'TELEGRAM_BOT_TOKEN', 'SOLANA_PRIVATE_KEY', 'PONY_TOKEN_MINT'];
      const missing = required.filter(key => !process.env[key]);
      
      if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
      }
      
      console.log('🔧 Connecting to MongoDB...');
      console.log('🔗 MongoDB URI (masked):', process.env.MONGODB_URI?.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
      
      // Connect to MongoDB with timeout
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000, // 10 second timeout
        connectTimeoutMS: 10000,
      });
      console.log('✅ Connected to MongoDB');
      
      console.log('🤖 Initializing Telegram bot...');
      // Initialize Telegram bot
      this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { 
        polling: true,
        onlyFirstMatch: true 
      });
      console.log('✅ Telegram bot initialized');

      console.log('⚙️ Setting up bot handlers...');
      // Setup bot handlers
      new BotHandler(this.bot);
      console.log('✅ Bot handlers registered');

      console.log('🚀 Pixel Ponies Bot is running successfully!');
      
      // Add error handling for bot polling
      this.bot.on('polling_error', (error) => {
        console.error('🚨 Polling error:', error.message);
        console.error('📋 Full polling error:', error);
        // Don't exit on polling errors, just log them
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

      // Add graceful shutdown
      process.on('SIGTERM', () => {
        console.log('🛑 Received SIGTERM, shutting down gracefully...');
        this.bot?.stopPolling();
        mongoose.disconnect();
        process.exit(0);
      });

      process.on('SIGINT', () => {
        console.log('🛑 Received SIGINT, shutting down gracefully...');
        this.bot?.stopPolling();
        mongoose.disconnect();
        process.exit(0);
      });
      
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
}

// Start the bot
const bot = new PixelPoniesBot();
bot.start();