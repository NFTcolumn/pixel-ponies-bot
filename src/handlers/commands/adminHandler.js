import User from '../../models/User.sqlite.js';
import RaceService from '../../services/RaceService.js';

/**
 * Admin Command Handler
 * Handles all administrative commands with proper authorization
 */
class AdminHandler {
  constructor(bot) {
    this.bot = bot;
    // Admin user IDs - should be moved to environment variables in production
    this.adminIds = ['363208661', '1087968824', '1438261641'];
  }

  /**
   * Check if user is an admin
   * @param {string} userId - User ID to check
   * @returns {boolean} True if user is admin
   */
  isAdmin(userId) {
    return this.adminIds.includes(userId.toString());
  }

  /**
   * Setup admin commands with authorization check
   * @param {Object} bot - Telegram bot instance
   */
  setupAdminCommands(bot) {
    // Admin airdrop command
    bot.onText(/\/admin_airdrop\s+(\d+)/, (msg, match) => {
      if (this.isAdmin(msg.from.id)) {
        this.handleAdminAirdrop(msg, match[1]);
      } else {
        console.log(`❌ Unauthorized admin command attempt by ${msg.from.id}`);
      }
    });
    
    // Admin balance command
    bot.onText(/\/admin_balance/, (msg) => {
      if (this.isAdmin(msg.from.id)) {
        this.handleAdminBalance(msg);
      } else {
        console.log(`❌ Unauthorized admin command attempt by ${msg.from.id}`);
      }
    });
    
    // Manual user airdrop
    bot.onText(/\/airdrop_user\s+(\w+)\s+(\d+)/, (msg, match) => {
      if (this.isAdmin(msg.from.id)) {
        this.handleManualAirdrop(msg, match[1], parseInt(match[2]));
      } else {
        console.log(`❌ Unauthorized admin command attempt by ${msg.from.id}`);
      }
    });
    
    // List racers
    bot.onText(/\/list_racers/, (msg) => {
      if (this.isAdmin(msg.from.id)) {
        this.handleListRacers(msg);
      } else {
        console.log(`❌ Unauthorized admin command attempt by ${msg.from.id}`);
      }
    });
    
    // List users
    bot.onText(/\/list_users/, (msg) => {
      if (this.isAdmin(msg.from.id)) {
        this.handleListUsers(msg);
      } else {
        console.log(`❌ Unauthorized admin command attempt by ${msg.from.id}`);
      }
    });

    // Manual race trigger
    bot.onText(/\/admin_race/, (msg) => {
      if (this.isAdmin(msg.from.id)) {
        this.handleAdminRace(msg);
      } else {
        console.log(`❌ Unauthorized admin command attempt by ${msg.from.id}`);
      }
    });
  }

  /**
   * Handle admin airdrop command
   * @param {Object} msg - Telegram message object
   * @param {string} amount - Airdrop amount
   */
  async handleAdminAirdrop(msg, amount) {
    try {
      await this.bot.sendMessage(msg.chat.id, `🔧 **Admin Airdrop**\n\nAmount: ${amount} $PONY\n\n⚠️ This feature needs implementation in PayoutService`);
    } catch (error) {
      console.error('Admin airdrop error:', error);
      await this.bot.sendMessage(msg.chat.id, '❌ Error processing admin airdrop');
    }
  }

  /**
   * Handle admin balance command
   * @param {Object} msg - Telegram message object
   */
  async handleAdminBalance(msg) {
    try {
      // TODO: Implement bot balance checking via BaseService
      await this.bot.sendMessage(msg.chat.id, `💰 **Bot Balance Check**\n\n⚠️ This feature needs implementation in BaseService`);
    } catch (error) {
      console.error('Admin balance error:', error);
      await this.bot.sendMessage(msg.chat.id, '❌ Error getting admin balance');
    }
  }

  /**
   * Handle manual user airdrop
   * @param {Object} msg - Telegram message object
   * @param {string} username - Username to airdrop
   * @param {number} amount - Amount to airdrop
   */
  async handleManualAirdrop(msg, username, amount) {
    try {
      const user = await User.findOne({ 
        $or: [
          { username: username },
          { telegramId: username }
        ]
      });

      if (!user) {
        return this.bot.sendMessage(msg.chat.id, `❌ User '${username}' not found`);
      }

      await this.bot.sendMessage(msg.chat.id, 
        `🎁 **Manual Airdrop**\n\nUser: @${user.username || user.firstName} (${user.telegramId})\nAmount: ${amount} $PONY\n\n⚠️ Manual airdrop processing needs implementation`
      );
      
    } catch (error) {
      console.error('Manual airdrop error:', error);
      await this.bot.sendMessage(msg.chat.id, '❌ Error processing manual airdrop');
    }
  }

  /**
   * Handle list racers command
   * @param {Object} msg - Telegram message object
   */
  async handleListRacers(msg) {
    try {
      const currentRace = await RaceService.getCurrentRace();
      
      if (!currentRace) {
        return this.bot.sendMessage(msg.chat.id, '❌ No active race found');
      }

      const participants = currentRace.participants;
      if (participants.length === 0) {
        return this.bot.sendMessage(msg.chat.id, `📋 **Race ${currentRace.raceId}**\n\nNo participants yet`);
      }

      let message = `📋 **Race ${currentRace.raceId} - ${participants.length} Participants**\n\n`;
      participants.forEach((p, i) => {
        message += `${i + 1}. @${p.username} - Horse #${p.horseId} ${p.horseName}\n`;
      });

      await this.bot.sendMessage(msg.chat.id, message);
      
    } catch (error) {
      console.error('List racers error:', error);
      await this.bot.sendMessage(msg.chat.id, '❌ Error listing racers');
    }
  }

  /**
   * Handle list users command
   * @param {Object} msg - Telegram message object
   */
  async handleListUsers(msg) {
    try {
      const userCount = await User.countDocuments();
      const recentUsers = await User.find()
        .sort({ createdAt: -1 })
        .limit(10);

      let message = `👥 **User Statistics**\n\nTotal Users: ${userCount}\n\n**Recent Users (Last 10):**\n\n`;
      
      recentUsers.forEach((user, i) => {
        const verified = user.twitterFollowVerified ? '✅' : '❌';
        const wallet = user.baseAddress ? '💎' : '❌';
        message += `${i + 1}. @${user.username || user.firstName} ${verified} ${wallet}\n`;
      });

      await this.bot.sendMessage(msg.chat.id, message);
      
    } catch (error) {
      console.error('List users error:', error);
      await this.bot.sendMessage(msg.chat.id, '❌ Error listing users');
    }
  }

  /**
   * Handle manual race trigger
   * @param {Object} msg - Telegram message object
   */
  async handleAdminRace(msg) {
    try {
      await this.bot.sendMessage(msg.chat.id, '🏇 **Admin Manual Race Triggered!**');
      
      // Create a new race
      const race = await RaceService.createRace(this.bot);
      console.log(`✅ Admin triggered race: ${race.raceId}`);
      
      await this.bot.sendMessage(msg.chat.id, `✅ Manual race started successfully!\n\nRace ID: ${race.raceId}\nPrize Pool: ${race.prizePool} $PONY`);
      
      // Note: The race will need to be manually run or scheduled
      
    } catch (error) {
      console.error('Admin manual race error:', error);
      await this.bot.sendMessage(msg.chat.id, '❌ Error starting manual race');
    }
  }

  /**
   * Get admin status info
   * @param {string} userId - User ID to check
   * @returns {Object} Admin status information
   */
  getAdminStatus(userId) {
    return {
      isAdmin: this.isAdmin(userId),
      adminIds: this.adminIds,
      availableCommands: [
        '/admin_race - Start manual race',
        '/admin_balance - Check bot balance',
        '/admin_airdrop <amount> - Trigger airdrop',
        '/list_racers - List current race participants',
        '/list_users - List recent users',
        '/airdrop_user <username> <amount> - Manual user airdrop'
      ]
    };
  }
}

export default AdminHandler;