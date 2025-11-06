import RegistrationHandler from './commands/registrationHandler.js';
import RaceHandler from './commands/raceHandler.js';
import InfoHandler from './commands/infoHandler.js';
import AdminHandler from './commands/adminHandler.js';
import SchedulerHandler from './schedulerHandler.js';
import TimeUtils from '../utils/timeUtils.js';

/**
 * Refactored Bot Handler - Main orchestrator for all bot functionality
 * 
 * This refactored version delegates responsibilities to specialized handlers:
 * - RegistrationHandler: User registration and Twitter verification
 * - RaceHandler: All race-related functionality and betting
 * - InfoHandler: User info, balance, referrals, help commands
 * - AdminHandler: Administrative commands with proper authorization
 * - SchedulerHandler: Race scheduling and automated operations
 * 
 * Benefits of this architecture:
 * - Separation of concerns
 * - Easier testing and maintenance 
 * - Better error isolation
 * - Cleaner code organization
 * - Enhanced reusability
 */
class BotHandler {
  constructor(bot) {
    this.bot = bot;
    
    // Initialize specialized handlers
    this.registrationHandler = new RegistrationHandler(bot);
    this.raceHandler = new RaceHandler(bot);
    this.infoHandler = new InfoHandler(bot);
    this.adminHandler = new AdminHandler(bot);
    this.schedulerHandler = new SchedulerHandler(bot);

    // Setup commands
    this.setupCommands();

    // Scheduler disabled - users directed to pxpony.com for racing
    // this.schedulerHandler.startScheduler();

    // Perform recovery operations
    this.performStartupRecovery();
  }

  /**
   * Setup all bot commands using specialized handlers
   */
  setupCommands() {
    // Registration commands
    this.bot.onText(/\/start(?:\s+([a-zA-Z0-9]+))?/, (msg, match) => 
      this.registrationHandler.handleStart(msg, match ? match[1] : null));
    
    this.bot.onText(/\/register(?:\s+(\S+)(?:\s+@?(\w+))?)?/, (msg, match) => 
      this.registrationHandler.handleRegister(msg, match ? match[1] : null, match ? match[2] : null));
    
    this.bot.onText(/\/verify_follow/, (msg) =>
      this.registrationHandler.handleVerifyFollow(msg));

    // Race commands - Disabled (users directed to pxpony.com)
    this.bot.onText(/\/race/, (msg) => this.handleRaceRedirect(msg));
    this.bot.onText(/\/horse\s+(\d+)/, (msg, match) => this.handleRaceRedirect(msg));
    this.bot.onText(/\/verify\s+(https:\/\/(?:twitter\.com|x\.com)\/\S+)/, (msg, match) => this.handleRaceRedirect(msg));
    this.bot.onText(/\/racetime/, (msg) => this.handleRaceRedirect(msg));
    
    // Info commands
    this.bot.onText(/\/balance/, (msg) => this.infoHandler.handleBalance(msg));
    this.bot.onText(/\/airdrop/, (msg) => this.infoHandler.handleAirdropInfo(msg));
    this.bot.onText(/\/referral/, (msg) => this.infoHandler.handleReferral(msg));
    this.bot.onText(/\/invite/, (msg) => this.infoHandler.handleInvite(msg));
    this.bot.onText(/\/howtoplay|\/help/, (msg) => this.infoHandler.handleHowToPlay(msg));
    
    // Admin commands
    this.adminHandler.setupAdminCommands(this.bot);
    
    // Event handlers
    this.bot.on('callback_query', (query) => this.handleCallback(query));
    this.bot.on('message', (msg) => this.handleMessage(msg));
    
    console.log('✅ Enhanced command handlers registered with specialized modules');
  }

  /**
   * Perform startup recovery operations
   */
  async performStartupRecovery() {
    try {
      console.log('🔄 Performing startup recovery operations...');
      
      // Check for incomplete races and finish them
      await this.schedulerHandler.checkAndFinishIncompleteRaces();
      
      // Clean up expired temporary selections
      await this.raceHandler.cleanupExpiredSelections();
      
      console.log('✅ Startup recovery completed');
    } catch (error) {
      console.error('❌ Error in startup recovery:', error);
    }
  }











  /**
   * Handle race command redirects to pxpony.com
   */
  async handleRaceRedirect(msg) {
    const chatId = msg.chat.id;

    const message = `🏇 **Pixel Ponies Racing is Now Live!**

🎮 Race with real $PONY at **pxpony.com**

To get started:
1️⃣ Make sure you're registered: /register
2️⃣ Get your $PONY tokens
3️⃣ Visit **pxpony.com** to race!

🏆 Race against other players and win real $PONY prizes!`;

    try {
      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Error sending race redirect:', error);
    }
  }

  /**
   * Handle callback queries (button presses)
   */
  async handleCallback(query) {
    // Delegate to registration handler for registration callbacks
    await this.registrationHandler.handleCallback(query);
  }

  /**
   * Handle general messages (delegation to specialized handlers)
   */
  async handleMessage(msg) {
    // Delegate to registration handler for wallet address input
    const handled = await this.registrationHandler.handleMessage(msg);

    if (!handled) {
      // Could add other message handling logic here if needed
      // For now, just ignore unhandled messages
    }
  }

  /**
   * Get comprehensive bot status
   * @returns {Object} Status information from all handlers
   */
  getBotStatus() {
    return {
      handlers: {
        registration: 'active',
        race: 'active', 
        info: 'active',
        admin: 'active'
      },
      scheduler: this.schedulerHandler.getStatus(),
      nextRace: TimeUtils.getNextRaceInfo(),
      uptime: process.uptime()
    };
  }

  /**
   * Graceful shutdown of all handlers
   */
  async shutdown() {
    console.log('🛑 Shutting down BotHandler...');
    
    try {
      // Stop scheduler
      this.schedulerHandler.stopScheduler();
      
      // Clean up any pending operations
      await this.raceHandler.cleanupExpiredSelections();
      
      console.log('✅ BotHandler shutdown completed');
    } catch (error) {
      console.error('❌ Error during BotHandler shutdown:', error);
    }
  }
}

export default BotHandler;