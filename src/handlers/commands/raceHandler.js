import User from '../../models/User.js';
import TempSelection from '../../models/TempSelection.js';
import RaceService from '../../services/RaceService.js';
import PayoutService from '../../services/PayoutService.js';
import ReferralService from '../../services/ReferralService.js';
import TimeUtils from '../../utils/timeUtils.js';
import { RACE_TWEET_TEMPLATE, REWARDS, formatPonyAmount } from '../../utils/tweetTemplates.js';

/**
 * Race Command Handler
 * Handles all race-related commands and functionality
 */
class RaceHandler {
  constructor(bot) {
    this.bot = bot;
  }

  /**
   * Handle /race command - Show current race info
   * @param {Object} msg - Telegram message object
   */
  async handleRace(msg) {
    const userId = msg.from.id.toString();
    
    try {
      const race = await RaceService.getCurrentRace();
      
      if (!race) {
        return this.bot.sendMessage(msg.chat.id, 
          `⏰ **No Active Race**\n\nNext race starts soon! Check back in a few minutes.`
        );
      }

      let horsesList = '';
      race.horses.forEach((horse, index) => {
        if (index % 3 === 0 && index > 0) horsesList += '\n';
        horsesList += `${horse.id}. ${horse.emoji} ${horse.name}  `;
      });

      const userBet = race.participants.find(p => p.userId === userId);
      const betStatus = userBet ? 
        `🎯 **Your Bet:** #${userBet.horseId} ${userBet.horseName}\n` : 
        `🎯 **Your Bet:** None yet\n`;

      const message = `
🏁 **CURRENT RACE: ${race.raceId}**
🟢 Status: **${race.status.toUpperCase().replace('_', ' ')}**

${betStatus}

🐎 **Choose Your Pony:**
${horsesList}

💰 **Prize Pool:** ${formatPonyAmount(race.prizePool)} $PONY
👥 **Players:** ${race.participants.length}
🎁 **Race Reward:** ${formatPonyAmount(REWARDS.PER_RACE)} $PONY per participant!

🎯 **To Enter:**
1. Pick pony: \`/horse NUMBER\`
2. Tweet your pick
3. Verify: \`/verify TWEET_URL\`
`;

      await this.bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
      
    } catch (error) {
      console.error('Race error:', error);
      await this.bot.sendMessage(msg.chat.id, '❌ Error getting race info');
    }
  }

  /**
   * Handle /horse command - Select a horse for betting
   * @param {Object} msg - Telegram message object
   * @param {number} horseNumber - Horse number (1-12)
   */
  async handleHorse(msg, horseNumber) {
    const userId = msg.from.id.toString();
    
    try {
      // Check user registration
      const user = await User.findOne({ telegramId: userId });
      if (!user || !user.baseAddress) {
        return this.bot.sendMessage(msg.chat.id,
          '❌ Please complete registration first with /register'
        );
      }

      if (!user.twitterFollowVerified) {
        return this.bot.sendMessage(msg.chat.id,
          '❌ **Registration Incomplete!**\n\n🐦 Please complete your registration with /register to participate in races and receive rewards!'
        );
      }

      // Get current race
      const race = await RaceService.getCurrentRace();
      if (!race || race.status !== 'betting_open') {
        return this.bot.sendMessage(msg.chat.id,
          `❌ No active race for betting\n\nTry again when the next race starts!`
        );
      }

      // Check if betting is closed (1 minute before race)
      if (!TimeUtils.isWithinBettingWindow(race.startTime, 29)) {
        const nextRaceInfo = TimeUtils.getNextRaceInfo();
        return this.bot.sendMessage(msg.chat.id,
          `🔒 **Betting Closed!**\n\nBetting closes 1 minute before each race.\n\n⏰ Next race: ${nextRaceInfo.timeString} ${nextRaceInfo.period} UTC\n⏳ Betting opens right after the race!`
        );
      }

      // Validate horse number
      const horse = race.horses.find(h => h.id === horseNumber);
      if (!horse) {
        return this.bot.sendMessage(msg.chat.id, `❌ Invalid horse number. Choose 1-12.`);
      }

      // Check if user already bet on this race
      const existingParticipant = race.participants.find(p => p.userId === userId);
      if (existingParticipant) {
        return this.bot.sendMessage(msg.chat.id, 
          `⚠️ You already picked ${existingParticipant.horseName} in this race!`
        );
      }

      // Store temporary selection with enhanced error handling
      try {
        await TempSelection.findOneAndUpdate(
          { userId, raceId: race.raceId },
          { 
            horseId: horseNumber, 
            horseName: horse.name,
            createdAt: new Date() // Explicitly set creation time
          },
          { upsert: true, new: true }
        );
        
        console.log(`💾 Saved temp selection: User ${userId}, Horse #${horseNumber} ${horse.name}, Race ${race.raceId}`);
      } catch (tempError) {
        console.error('Error saving temp selection:', tempError);
        return this.bot.sendMessage(msg.chat.id, '❌ Error saving your selection. Please try again.');
      }

      // Generate tweet text using template
      const tweetText = RACE_TWEET_TEMPLATE(horseNumber, formatPonyAmount(REWARDS.PER_RACE));

      const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
      const keyboard = {
        inline_keyboard: [
          [{ text: '🐦 Tweet Now', url: tweetUrl }],
          [{ text: '📝 Tweet Text', callback_data: `tweet_${horseNumber}` }]
        ]
      };

      await this.bot.sendMessage(msg.chat.id, 
        `🐎 **Great Choice: ${horse.name} ${horse.emoji}**\n\n🎯 **Next Steps:**\n1. Click "Tweet Now" below\n2. Copy your tweet URL after posting\n3. Use: /verify YOUR_TWEET_URL\n\n⚠️ **Must tweet to win $PONY!**`,
        { parse_mode: 'Markdown', reply_markup: keyboard }
      );
      
    } catch (error) {
      console.error('Horse selection error:', error);
      await this.bot.sendMessage(msg.chat.id, '❌ Error selecting horse');
    }
  }

  /**
   * Handle /verify command - Verify tweet URL and complete registration
   * @param {Object} msg - Telegram message object
   * @param {string} tweetUrl - Tweet URL to verify
   */
  async handleVerify(msg, tweetUrl) {
    const userId = msg.from.id.toString();
    
    try {
      // Get user
      const user = await User.findOne({ telegramId: userId });
      if (!user) {
        return this.bot.sendMessage(msg.chat.id, '❌ Please register first');
      }

      // Get current race
      const race = await RaceService.getCurrentRace();
      if (!race || race.status !== 'betting_open') {
        return this.bot.sendMessage(msg.chat.id, '❌ No active race for betting. Next race starts soon!');
      }

      // Check if betting is closed (1 minute before race)
      if (!TimeUtils.isWithinBettingWindow(race.startTime, 29)) {
        const nextRaceInfo = TimeUtils.getNextRaceInfo();
        return this.bot.sendMessage(msg.chat.id,
          `🔒 **Betting Closed!**\n\nBetting closes 1 minute before each race.\n\n⏰ Next race: ${nextRaceInfo.timeString} ${nextRaceInfo.period} UTC\n⏳ Betting opens right after the race!`
        );
      }

      // Get temporary selection
      const tempSelection = await TempSelection.findOne({ userId, raceId: race.raceId });
      if (!tempSelection) {
        return this.bot.sendMessage(msg.chat.id, 
          '❌ **Horse Selection Required!**\n\nPlease select your horse first with /horse NUMBER'
        );
      }

      // Add participant to race
      const success = await RaceService.addParticipant(
        race.raceId, userId, user.username || user.firstName, tempSelection.horseId, tweetUrl
      );

      if (success) {
        console.log(`🗑️ Cleaning up temp selection for user ${userId} in race ${race.raceId}`);
        await TempSelection.deleteOne({ userId, raceId: race.raceId });
        
        console.log(`🎁 Processing rewards for verified participant ${user.username || user.firstName} (${userId})`);
        
        // Process racing rewards and bonuses
        await this.processParticipantRewards(user, msg.chat.id);
        
        await this.bot.sendMessage(msg.chat.id, 
          `✅ **Tweet Verified!**\n\n🎉 You're in the race!\n🎁 Racing reward sent!\n🍀 Good luck!`
        );
      } else {
        console.log(`❌ Failed to add participant ${user.username || user.firstName} (${userId}) to race ${race.raceId}`);
        await this.bot.sendMessage(msg.chat.id, '❌ Verification failed');
      }
    } catch (error) {
      console.error('Verify error:', error);
      await this.bot.sendMessage(msg.chat.id, '❌ Error verifying tweet');
    }
  }

  /**
   * Handle /racetime command - Show next race countdown
   * @param {Object} msg - Telegram message object
   */
  async handleRaceTime(msg) {
    try {
      const raceInfo = TimeUtils.getNextRaceInfo();
      
      const message = `
🕐 **NEXT RACE COUNTDOWN**

⏰ **Next Race:** ${raceInfo.timeString} ${raceInfo.period} UTC
⏳ **Time Until Race:** ${raceInfo.countdown}
📅 **Date:** ${raceInfo.date}

🏇 **RACE SCHEDULE:**
⚡ **Every 30 minutes** at :00 and :30
🔥 **48 races per day!**

⏱️ **Betting:** 15 minutes per race
💰 **Race Reward:** ${formatPonyAmount(REWARDS.PER_RACE)} $PONY per participant!
🎁 **Signup Bonus:** ${formatPonyAmount(REWARDS.SIGNUP)} $PONY!

🎯 Use \`/register\` to join!
🔄 Use \`/racetime\` anytime for updates
`;

      await this.bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Race time error:', error);
      await this.bot.sendMessage(msg.chat.id, '❌ Error getting race time info');
    }
  }

  /**
   * Process participant rewards (racing rewards, airdrop, referrals)
   * @param {Object} user - User document
   * @param {string} chatId - Chat ID for notifications
   */
  async processParticipantRewards(user, chatId) {
    try {
      // Always give racing reward
      await PayoutService.processRacingReward(user, chatId, this.bot);
      
      // First-time bonuses
      if (!user.airdropReceived && user.baseAddress) {
        console.log(`🎁 Processing first-time bonuses for ${user.username || user.firstName}`);
        await PayoutService.processParticipantBonus(user, chatId, this.bot);
        await ReferralService.processReferralReward(user, chatId, this.bot);
      }
    } catch (error) {
      console.error('Error processing participant rewards:', error);
      // Don't throw - let the race participation succeed even if rewards fail
    }
  }

  /**
   * Clean up expired temp selections
   * Called periodically to prevent database bloat
   */
  async cleanupExpiredSelections() {
    try {
      const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      const result = await TempSelection.deleteMany({ createdAt: { $lt: cutoff } });
      if (result.deletedCount > 0) {
        console.log(`🧹 Cleaned up ${result.deletedCount} expired temp selections`);
      }
    } catch (error) {
      console.error('Error cleaning up temp selections:', error);
    }
  }

  /**
   * Recover orphaned temp selections after system restart
   * @param {string} raceId - Current active race ID
   */
  async recoverOrphanedSelections(raceId) {
    try {
      const orphaned = await TempSelection.find({ raceId });
      if (orphaned.length > 0) {
        console.log(`🔄 Found ${orphaned.length} orphaned selections for race ${raceId}`);
        // Log for manual review - don't auto-verify without tweets
        orphaned.forEach(temp => {
          console.log(`  - User ${temp.userId}: Horse #${temp.horseId} ${temp.horseName}`);
        });
      }
    } catch (error) {
      console.error('Error recovering orphaned selections:', error);
    }
  }
}

export default RaceHandler;