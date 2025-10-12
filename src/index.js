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

      // Connect to MongoDB
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('✅ Connected to MongoDB');

      // Initialize Telegram bot
      this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
      console.log('✅ Telegram bot initialized');

      // Setup bot handlers
      new BotHandler(this.bot);
      console.log('✅ Bot handlers registered');

      console.log('🚀 Pixel Ponies Bot is running!');
      
    } catch (error) {
      console.error('❌ Failed to start bot:', error);
      process.exit(1);
    }
  }
}

// Start the bot
const bot = new PixelPoniesBot();
bot.start();