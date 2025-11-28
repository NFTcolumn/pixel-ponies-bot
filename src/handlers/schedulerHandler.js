import cron from 'node-cron';
import RaceService from '../services/RaceService.js';
import PayoutService from '../services/PayoutService.js';
import TimeUtils from '../utils/timeUtils.js';
import Race from '../models/Race.js';

/**
 * Enhanced Race Scheduler with better UTC handling and error recovery
 */
class SchedulerHandler {
  constructor(bot) {
    this.bot = bot;
    this.scheduledJobs = new Map();
    this.isShuttingDown = false;
    this.activeRaceTimer = null;
    this.lastMessageTime = new Map(); // Rate limiting
  }

  /**
   * Start all scheduled jobs
   */
  startScheduler() {
    console.log('🕐 Starting enhanced race scheduler with UTC time handling');
    
    // Main race scheduler - exactly at 12:00 AM and 12:00 PM UTC
    const raceJob = cron.schedule(TimeUtils.getRaceCronExpression(), async () => {
      if (!this.isShuttingDown) {
        await this.runScheduledRace();
      }
    }, {
      scheduled: true,
      timezone: "UTC",
      name: "main-races"
    });
    this.scheduledJobs.set('races', raceJob);

    // 1-minute warnings before races
    const warningJob = cron.schedule(TimeUtils.getWarningCronExpression(), async () => {
      if (!this.isShuttingDown) {
        await this.sendRaceWarning();
      }
    }, {
      scheduled: true,
      timezone: "UTC",
      name: "race-warnings"
    });
    this.scheduledJobs.set('warnings', warningJob);
    
    // Hourly community reminders
    const reminderJob = cron.schedule(TimeUtils.getReminderCronExpression(), async () => {
      if (!this.isShuttingDown) {
        await this.sendHourlyReminder();
      }
    }, {
      scheduled: true,
      timezone: "UTC",
      name: "hourly-reminders"
    });
    this.scheduledJobs.set('reminders', reminderJob);

    // Cleanup job - every 30 minutes
    const cleanupJob = cron.schedule('*/30 * * * *', async () => {
      if (!this.isShuttingDown) {
        await this.performMaintenance();
      }
    }, {
      scheduled: true,
      timezone: "UTC",
      name: "maintenance"
    });
    this.scheduledJobs.set('cleanup', cleanupJob);
    
    console.log('✅ Enhanced scheduler started:');
    console.log('  🏇 Races: Every 10 minutes at :00, :10, :20, :30, :40, :50 (0,10,20,30,40,50 * * * *)');
    console.log('  ⚠️  1-min warnings: At :09, :19, :29, :39, :49, :59 (9,19,29,39,49,59 * * * *)');
    console.log('  📢 Reminders: Every hour at :30 (30 * * * *)');
    console.log('  🧹 Maintenance: Every 30 minutes (*/30 * * * *)');
  }

  /**
   * Run a scheduled race - NEW FLOW
   * At :00 and :30 - Finish previous race, immediately create new one
   */
  async runScheduledRace() {
    try {
      const now = TimeUtils.getCurrentUTC();
      console.log(`🚀 Race time at ${now.toISOString()}`);

      // Step 1: Check if there's an existing race with bets
      const existingRace = await RaceService.getCurrentRace();

      if (existingRace && existingRace.participants.length > 0) {
        console.log(`🏁 Running race ${existingRace.raceId} with ${existingRace.participants.length} participants`);

        // Run the race immediately (instant with animation)
        await this.runLiveRace(existingRace.raceId);
      } else if (existingRace) {
        console.log(`⏭️  No participants in race ${existingRace.raceId}, finishing it`);
        await RaceService.finishRace(existingRace.raceId);
      }

      // Step 2: Create NEW race immediately for betting
      const newRace = await RaceService.createRace(this.bot);
      console.log(`✅ Created new race: ${newRace.raceId} with ${newRace.prizePool.toLocaleString()} $PONY prize pool`);

      // Announce new race for betting
      await this.announceNewRace(newRace);

    } catch (error) {
      console.error('❌ Scheduled race error:', error);
      await this.notifyError('Scheduled race failed', error);
    }
  }

  /**
   * Handle duplicate race scenario (server restart recovery)
   */
  async handleDuplicateRaceScenario() {
    try {
      const activeRace = await RaceService.getCurrentRace();
      if (activeRace) {
        console.log(`🔧 Resuming operations for existing race: ${activeRace.raceId}`);
        
        // Calculate time remaining in betting window
        const timeElapsed = Date.now() - activeRace.startTime.getTime();
        const bettingWindowMs = 15 * 60 * 1000; // 15 minutes
        const timeRemaining = Math.max(0, bettingWindowMs - timeElapsed);
        
        if (timeRemaining > 0) {
          console.log(`⏰ Betting window has ${Math.floor(timeRemaining / 1000)}s remaining`);
          
          // Schedule completion of existing race
          setTimeout(async () => {
            if (!this.isShuttingDown) {
              await this.runLiveRace(activeRace.raceId);
            }
          }, timeRemaining);
        } else {
          console.log(`⏰ Betting window expired, running race immediately`);
          await this.runLiveRace(activeRace.raceId);
        }
      }
    } catch (recoveryError) {
      console.error('❌ Error in duplicate race recovery:', recoveryError);
    }
  }

  /**
   * Send 1-minute warning before races
   */
  async sendRaceWarning() {
    const channelId = process.env.MAIN_CHANNEL_ID;
    if (!channelId) {
      console.warn('⚠️ MAIN_CHANNEL_ID not set, skipping race warning');
      return;
    }

    try {
      const raceInfo = TimeUtils.getNextRaceInfo();

      const message = `
⚠️ **1 MINUTE WARNING - BETTING CLOSES NOW!** ⚠️

🏇 Next race starts at **${raceInfo.timeString} ${raceInfo.period} UTC**
🔒 **BETTING WINDOW CLOSING IN 1 MINUTE!**

⏰ **Last chance to:**
1. Pick your horse with \`/horse NUMBER\`
2. Tweet your pick
3. \`/verify TWEET_URL\` to enter!

💰 **Earn 100M $PONY per race!**

**HURRY - BETTING CLOSES AT ${raceInfo.timeString}!** 🏆
`;

      const messageId = await this.sendMessageSafely(channelId, message, { parse_mode: 'Markdown' });
      console.log(`⚠️ Sent 1-minute race warning for ${raceInfo.timeString}`);

      // Store as temporary message
      if (messageId) {
        const currentRace = await RaceService.getCurrentRace();
        if (currentRace) {
          currentRace.temporaryMessageIds = currentRace.temporaryMessageIds || [];
          currentRace.temporaryMessageIds.push(messageId);
          await currentRace.save();
          console.log(`📌 Tracked warning message ${messageId} for race ${currentRace.raceId}`);
        }
      }

    } catch (error) {
      console.error('❌ Race warning error:', error);
    }
  }

  /**
   * Send hourly community reminders
   */
  async sendHourlyReminder() {
    const channelId = process.env.MAIN_CHANNEL_ID;
    if (!channelId) {
      console.warn('⚠️ MAIN_CHANNEL_ID not set, skipping hourly reminder');
      return;
    }

    try {
      const messages = [
        '🏇 **Pixel Ponies is LIVE!** Race now at pxpony.com! Register with `/register` and earn 100M $PONY signup bonus! 🪙',
        '🎁 **MASSIVE REWARDS!** 100M signup + 100M per race! Register now and start earning! 🏆',
        '🚀 **Race at pxpony.com!** Non-stop action on Base blockchain! Get started with `/register` and get 100M $PONY! 💰',
        '🏁 **Pixel Ponies Racing Club!** Free to join, real crypto rewards! Race now at pxpony.com! 🎯'
      ];

      const randomMessage = messages[Math.floor(Math.random() * messages.length)];

      await this.sendMessageSafely(channelId, randomMessage, { parse_mode: 'Markdown' });
      console.log('📢 Sent hourly reminder');

    } catch (error) {
      console.error('❌ Hourly reminder error:', error);
    }
  }

  /**
   * Perform maintenance tasks
   */
  async performMaintenance() {
    try {
      console.log('🧹 Running scheduled maintenance...');
      
      // Check for and finish incomplete races
      await this.checkAndFinishIncompleteRaces();
      
      // Clean up expired temp selections
      // This would be handled by RaceHandler if we had access to it
      
      // Log system status
      const activeRaces = await Race.countDocuments({ 
        status: { $in: ['betting_open', 'racing'] } 
      });
      console.log(`📊 Maintenance complete - Active races: ${activeRaces}`);
      
    } catch (error) {
      console.error('❌ Maintenance error:', error);
    }
  }

  /**
   * Check for and complete incomplete races (system recovery)
   */
  async checkAndFinishIncompleteRaces() {
    try {
      console.log('🔍 Checking for incomplete races...');

      // Find races that are not finished and were created more than 1 hour ago
      const cutoffTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      const incompleteRaces = await Race.find({
        status: { $ne: 'finished' },
        createdAt: { $lt: cutoffTime }
      });

      if (incompleteRaces.length === 0) {
        console.log('✅ No incomplete races found');
        return;
      }

      console.log(`🏁 Found ${incompleteRaces.length} incomplete race(s), finishing them...`);

      for (const race of incompleteRaces) {
        console.log(`🏃 Finishing race ${race.raceId} (status: ${race.status})`);
        
        const finishedRace = await RaceService.finishRace(race.raceId);
        if (finishedRace) {
          await this.announceResults(finishedRace, true); // true = recovery mode
          console.log(`✅ Completed race ${race.raceId}`);
        }
      }

      console.log('🎉 All incomplete races have been resolved!');
      
    } catch (error) {
      console.error('❌ Error checking incomplete races:', error);
    }
  }

  /**
   * Send message with rate limiting and error handling
   * @param {string} channelId - Channel ID
   * @param {string} message - Message text
   * @param {object} options - Message options
   * @returns {Promise<number|null>} Message ID if successful, null otherwise
   */
  async sendMessageSafely(channelId, message, options = {}) {
    const messageKey = `${channelId}_${Date.now()}`;
    const minInterval = 1000; // 1 second minimum between messages

    try {
      // Rate limiting
      const lastTime = this.lastMessageTime.get(channelId) || 0;
      const timeSinceLastMessage = Date.now() - lastTime;

      if (timeSinceLastMessage < minInterval) {
        const delayMs = minInterval - timeSinceLastMessage;
        console.log(`⏰ Rate limiting: waiting ${delayMs}ms before sending message`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      this.lastMessageTime.set(channelId, Date.now());

      const sentMessage = await this.bot.sendMessage(channelId, message, options);
      console.log(`✅ Message sent successfully to ${channelId} (ID: ${sentMessage.message_id})`);
      return sentMessage.message_id;

    } catch (error) {
      if (error.response?.body?.error_code === 429) {
        // Rate limiting - wait and retry
        const retryAfter = error.response.body.parameters?.retry_after || 5;
        console.warn(`🚫 Rate limited, retrying after ${retryAfter} seconds`);

        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));

        try {
          const sentMessage = await this.bot.sendMessage(channelId, message, options);
          console.log(`✅ Message sent after retry (ID: ${sentMessage.message_id})`);
          return sentMessage.message_id;
        } catch (retryError) {
          console.error(`❌ Failed to send message after retry:`, retryError.message);
          return null;
        }
      } else if (error.response?.body?.error_code === 400 && error.message.includes('chat not found')) {
        console.error(`❌ Chat not found: ${channelId}. Please check MAIN_CHANNEL_ID environment variable.`);
        return null;
      } else {
        console.error(`❌ Error sending message:`, error.message);
        return null;
      }
    }
  }

  /**
   * Delete temporary race messages
   * @param {Array<number>} messageIds - Array of message IDs to delete
   * @param {string} channelId - Channel ID
   */
  async deleteRaceMessages(messageIds, channelId) {
    if (!messageIds || messageIds.length === 0) {
      return;
    }

    console.log(`🗑️ Deleting ${messageIds.length} temporary race messages...`);

    for (const messageId of messageIds) {
      try {
        await this.bot.deleteMessage(channelId, messageId);
        console.log(`✅ Deleted message ${messageId}`);
      } catch (error) {
        // Message might already be deleted or not exist
        console.warn(`⚠️ Could not delete message ${messageId}:`, error.message);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`✅ Finished deleting temporary messages`);
  }

  /**
   * Announce new race in channel with enhanced error handling
   * @param {Object} race - Race object
   */
  async announceNewRace(race) {
    const channelId = process.env.MAIN_CHANNEL_ID;
    if (!channelId) {
      console.warn('⚠️ MAIN_CHANNEL_ID not set, skipping race announcement');
      return;
    }

    try {
      let horsesList = '';
      race.horses.forEach((horse, index) => {
        if (index % 3 === 0 && index > 0) horsesList += '\n';
        horsesList += `${horse.id}. ${horse.emoji} ${horse.name}  `;
      });

      const message = `
🎯 **BETTING NOW OPEN!** 🎯
📺 **PIXEL PONIES - NEXT RACE**

🏁 Race ID: ${race.raceId}

🐎 **CHOOSE YOUR CHAMPION:**
${horsesList}

💰 **Prize Pool:** ${race.prizePool.toLocaleString()} $PONY
⏰ **Betting open until 1 minute before race!**

🎯 Use /horse NUMBER to pick your champion!
🐦 Tweet your pick and /verify your tweet!
💎 **Earn 100M $PONY per race!**

**🏇 RACES EVERY 10 MINUTES!**
`;

      const messageId = await this.sendMessageSafely(channelId, message, { parse_mode: 'Markdown' });

      // Store as temporary message (will be deleted when race finishes)
      if (messageId) {
        race.temporaryMessageIds = race.temporaryMessageIds || [];
        race.temporaryMessageIds.push(messageId);
        await race.save();
        console.log(`📌 Tracked race announcement message ${messageId} for race ${race.raceId}`);
      }
    } catch (error) {
      console.error('❌ Error announcing new race:', error);
    }
  }

  /**
   * Run live race with commentary
   * @param {string} raceId - Race ID to run
   */
  async runLiveRace(raceId) {
    const channelId = process.env.MAIN_CHANNEL_ID;
    if (!channelId) return;

    try {
      // Get the race object to track messages
      const race = await Race.findOne({ raceId });
      if (!race) return;

      race.temporaryMessageIds = race.temporaryMessageIds || [];

      // Send "BETTING IS NOW CLOSED" message
      const closedMsg = await this.bot.sendMessage(channelId,
        `🚪 **BETTING IS NOW CLOSED!**\n\n📺 **AND THEY'RE OFF!** The horses are charging out of the gate! 🐎💨`
      );
      if (closedMsg?.message_id) {
        race.temporaryMessageIds.push(closedMsg.message_id);
        console.log(`📌 Tracked betting closed message ${closedMsg.message_id}`);
      }

      const finishedRace = await RaceService.runRace(raceId);
      if (!finishedRace) return;

      // Race commentary with timing
      const commentary = [
        "🏁 They're coming around the first turn!",
        "⚡ It's neck and neck down the backstretch!",
        "🔥 They're entering the final stretch!",
        "🎯 What a finish! Photo finish at the wire!",
        "🏆 **THE RESULTS ARE IN!**"
      ];

      for (let i = 0; i < commentary.length; i++) {
        await new Promise(resolve => setTimeout(resolve, i * 5000));
        if (this.isShuttingDown) break;

        try {
          const commentaryMsg = await this.bot.sendMessage(channelId, commentary[i]);
          if (commentaryMsg?.message_id) {
            race.temporaryMessageIds.push(commentaryMsg.message_id);
            console.log(`📌 Tracked commentary message ${commentaryMsg.message_id}`);
          }
        } catch (msgError) {
          console.error(`Error sending commentary ${i}:`, msgError);
        }
      }

      // Save all tracked temporary messages
      await race.save();
      console.log(`📌 Total temporary messages tracked: ${race.temporaryMessageIds.length}`);

      // Wait a bit more then announce results
      await new Promise(resolve => setTimeout(resolve, 5000));
      if (!this.isShuttingDown) {
        await this.announceResults(finishedRace);
      }
    } catch (error) {
      console.error('❌ Error running live race:', error);
    }
  }

  /**
   * Announce race results
   * @param {Object} race - Finished race object
   * @param {boolean} isRecovery - Whether this is a system recovery
   */
  async announceResults(race, isRecovery = false) {
    const channelId = process.env.MAIN_CHANNEL_ID;
    if (!channelId) return;

    try {
      const winner = race.horses.find(h => h.position === 1);
      const second = race.horses.find(h => h.position === 2);
      const third = race.horses.find(h => h.position === 3);

      // Initialize permanent message IDs array
      race.permanentMessageIds = race.permanentMessageIds || [];

      // Only show official results if there were participants
      if (race.participants.length > 0) {
        const recoveryNote = isRecovery ? ' (System Recovery)' : '';
        const resultsMsg = await this.bot.sendMessage(channelId, `
🎺 **OFFICIAL RACE RESULTS** 🎺${recoveryNote}

🥇 **WINNER:** ${winner.emoji} ${winner.name} (${winner.finishTime.toFixed(2)}s)
🥈 **PLACE:** ${second.emoji} ${second.name} (${second.finishTime.toFixed(2)}s)
🥉 **SHOW:** ${third.emoji} ${third.name} (${third.finishTime.toFixed(2)}s)
`, { parse_mode: 'Markdown' });

        if (resultsMsg?.message_id) {
          race.permanentMessageIds.push(resultsMsg.message_id);
          await race.save();
          console.log(`📌 Tracked results message ${resultsMsg.message_id} as permanent`);
        }
      }

      // Process payouts (passes scheduler handler for message deletion)
      await PayoutService.processRacePayouts(race, channelId, this.bot, this);
    } catch (error) {
      console.error('❌ Error announcing results:', error);
    }
  }

  /**
   * Notify about errors (could send to admin chat)
   * @param {string} title - Error title
   * @param {Error} error - Error object
   */
  async notifyError(title, error) {
    try {
      // Could implement admin notification here
      console.error(`🚨 ${title}:`, error.message);
    } catch (notifyError) {
      console.error('Error in error notification:', notifyError);
    }
  }

  /**
   * Stop all scheduled jobs
   */
  stopScheduler() {
    console.log('🛑 Stopping race scheduler...');
    this.isShuttingDown = true;
    
    // Clear active race timer
    if (this.activeRaceTimer) {
      clearTimeout(this.activeRaceTimer);
      this.activeRaceTimer = null;
      console.log('✅ Cleared active race timer');
    }
    
    // Stop all cron jobs
    for (const [name, job] of this.scheduledJobs) {
      try {
        job.stop();
        job.destroy();
        console.log(`✅ Stopped ${name} scheduler`);
      } catch (error) {
        console.error(`❌ Error stopping ${name} scheduler:`, error);
      }
    }
    
    this.scheduledJobs.clear();
    console.log('✅ All schedulers stopped');
  }

  /**
   * Get scheduler status
   * @returns {Object} Status information
   */
  getStatus() {
    const jobs = Array.from(this.scheduledJobs.keys());
    return {
      running: !this.isShuttingDown,
      jobs,
      nextRaceInfo: TimeUtils.getNextRaceInfo()
    };
  }
}

export default SchedulerHandler;