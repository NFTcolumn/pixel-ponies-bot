import User from '../models/User.js';
import Race from '../models/Race.js';
import TempSelection from '../models/TempSelection.js';
import RaceService from '../services/RaceService.js';
import SolanaService from '../services/SolanaService.js';

class BotHandler {
  constructor(bot) {
    this.bot = bot;
    this.setupCommands();
    this.startRaceScheduler();
  }

  setupCommands() {
    // Start command
    this.bot.onText(/\/start/, (msg) => this.handleStart(msg));
    
    // Register command
    this.bot.onText(/\/register\s+(.+)/, (msg, match) => this.handleRegister(msg, match[1]));
    
    // Race command
    this.bot.onText(/\/race/, (msg) => this.handleRace(msg));
    
    // Horse selection
    this.bot.onText(/\/horse\s+(\d+)/, (msg, match) => this.handleHorse(msg, parseInt(match[1])));
    
    // Tweet verification
    this.bot.onText(/\/verify\s+(https:\/\/(?:twitter\.com|x\.com)\/\S+)/, (msg, match) => this.handleVerify(msg, match[1]));
    
    // Balance command
    this.bot.onText(/\/balance/, (msg) => this.handleBalance(msg));
    
    // Airdrop info command
    this.bot.onText(/\/airdrop/, (msg) => this.handleAirdropInfo(msg));
    
    // Admin command to manually trigger airdrop (for testing)
    this.bot.onText(/\/admin_airdrop\s+(\d+)/, (msg, match) => this.handleAdminAirdrop(msg, match[1]));
    
    // Admin command to check bot wallet balance
    this.bot.onText(/\/admin_balance/, (msg) => this.handleAdminBalance(msg));
    
    // Button callbacks
    this.bot.on('callback_query', (query) => this.handleCallback(query));
  }

  async handleStart(msg) {
    const message = `
🏇 **Welcome to Pixel Ponies!**

The most exciting crypto horse racing with real $PONY rewards!

🎁 **PARTICIPANT BONUS: 100 FREE $PONY!**
Thanks for playing with us! Invite friends to increase the pot!

**How to Play:**
1. Register with /register YOUR_WALLET
2. Use /race to see current race
3. Pick your pony with /horse NUMBER
4. Tweet about your pick
5. Verify tweet with /verify TWEET_URL
6. Get 100 $PONY participant bonus + race winnings!

**Commands:**
/register - Register your wallet
/race - Current race info  
/balance - Your stats
/airdrop - Check participant bonus status
`;

    await this.bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  }

  async handleRegister(msg, walletAddress) {
    const userId = msg.from.id.toString();
    
    if (!SolanaService.validateSolanaAddress(walletAddress)) {
      return this.bot.sendMessage(msg.chat.id, '❌ Invalid Solana address format');
    }

    try {
      let user = await User.findOne({ telegramId: userId });
      
      if (user) {
        user.solanaAddress = walletAddress;
        user.username = msg.from.username;
        user.firstName = msg.from.first_name;
        user.lastName = msg.from.last_name;
      } else {
        user = new User({
          telegramId: userId,
          username: msg.from.username,
          firstName: msg.from.first_name,
          lastName: msg.from.last_name,
          solanaAddress: walletAddress
        });
      }
      
      await user.save();
      
      await this.bot.sendMessage(msg.chat.id, 
        `✅ **Registration Complete!**\n\n🎯 Ready to race!\n\nUse /race to see the current race!`
      );
      
    } catch (error) {
      console.error('Registration error:', error);
      await this.bot.sendMessage(msg.chat.id, '❌ Registration failed. Try again.');
    }
  }

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
        if (index % 2 === 0 && index > 0) horsesList += '\n';
        horsesList += `${horse.id}. ${horse.emoji} ${horse.name} (${horse.odds.toFixed(1)}x)  `;
      });

      // Check user's current bet
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

💰 **Prize Pool:** ${race.prizePool} $PONY
👥 **Players:** ${race.participants.length}

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

  async handleHorse(msg, horseNumber) {
    const userId = msg.from.id.toString();
    
    try {
      const user = await User.findOne({ telegramId: userId });
      if (!user || !user.solanaAddress) {
        return this.bot.sendMessage(msg.chat.id, 
          '❌ Please register first with /register YOUR_WALLET'
        );
      }

      const race = await RaceService.getCurrentRace();
      console.log(`🐎 Horse selection: User ${userId}, Race: ${race ? race.raceId : 'none'}, Status: ${race ? race.status : 'N/A'}`);
      
      if (!race || race.status !== 'betting_open') {
        return this.bot.sendMessage(msg.chat.id, 
          `❌ No active race for betting\n\nRace status: ${race ? race.status : 'No race found'}\n\nTry again when the next race starts!`
        );
      }

      const horse = race.horses.find(h => h.id === horseNumber);
      if (!horse) {
        return this.bot.sendMessage(msg.chat.id, `❌ Invalid horse number. Choose 1-16.`);
      }

      // Check if already participated in THIS race
      const existingParticipant = race.participants.find(p => p.userId === userId);
      console.log(`🔍 Participation check: User ${userId} in race ${race.raceId}, existing: ${existingParticipant ? 'yes' : 'no'}`);
      
      if (existingParticipant) {
        return this.bot.sendMessage(msg.chat.id, 
          `⚠️ You already picked ${existingParticipant.horseName} in this race!\n\nWait for the next race to start.`
        );
      }

      // Store the user's horse selection temporarily
      await TempSelection.findOneAndUpdate(
        { userId, raceId: race.raceId },
        { 
          horseId: horseNumber,
          horseName: horse.name
        },
        { upsert: true }
      );

      const tweetText = `🏇 I'm backing ${horse.name} ${horse.emoji} in the #PixelPonies race!

🎯 Race ID: ${race.raceId}
🐎 My Champion: #${horseNumber} ${horse.name}

Join the most exciting crypto racing! 🚀
#SolanaMemes #CryptoRacing $PONY`;

      const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;

      const message = `
🐎 **Great Choice: ${horse.name} ${horse.emoji}**

🎯 **Next Steps:**
1. Click "Tweet Now" below
2. Copy your tweet URL after posting
3. Use: /verify YOUR_TWEET_URL

⚠️ **Must tweet to win $PONY!**
`;

      const keyboard = {
        inline_keyboard: [
          [{ text: '🐦 Tweet Now', url: tweetUrl }],
          [{ text: '📝 Tweet Text', callback_data: `tweet_${horseNumber}` }]
        ]
      };

      await this.bot.sendMessage(msg.chat.id, message, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
      
    } catch (error) {
      console.error('Horse selection error:', error);
      await this.bot.sendMessage(msg.chat.id, '❌ Error selecting horse');
    }
  }

  async handleVerify(msg, tweetUrl) {
    const userId = msg.from.id.toString();
    
    try {
      const user = await User.findOne({ telegramId: userId });
      if (!user) {
        return this.bot.sendMessage(msg.chat.id, '❌ Please register first');
      }

      const race = await RaceService.getCurrentRace();
      if (!race || race.status !== 'betting_open') {
        return this.bot.sendMessage(msg.chat.id, '❌ No active race');
      }

      // Get the user's stored horse selection
      const tempSelection = await TempSelection.findOne({ userId, raceId: race.raceId });
      if (!tempSelection) {
        return this.bot.sendMessage(msg.chat.id, 
          '❌ **Horse Selection Required!**\n\nPlease select your horse first with /horse NUMBER'
        );
      }

      const success = await RaceService.addParticipant(
        race.raceId, 
        userId, 
        user.username || user.firstName,
        tempSelection.horseId, // Use the actual horse ID they selected
        tweetUrl
      );

      // Clean up temp selection after verification
      if (success) {
        await TempSelection.deleteOne({ userId, raceId: race.raceId });
        
        // Check if user is eligible for participant bonus (first time verification)  
        if (!user.airdropReceived && user.solanaAddress) {
          await this.processParticipantBonus(user, msg.chat.id);
        }
        
        await this.bot.sendMessage(msg.chat.id, 
          `✅ **Tweet Verified!**\n\n🎉 You're in the race!\n🍀 Good luck!`
        );
      } else {
        await this.bot.sendMessage(msg.chat.id, '❌ Verification failed');
      }
      
    } catch (error) {
      console.error('Verify error:', error);
      await this.bot.sendMessage(msg.chat.id, '❌ Error verifying tweet');
    }
  }

  async handleBalance(msg) {
    const userId = msg.from.id.toString();
    
    try {
      const user = await User.findOne({ telegramId: userId });
      if (!user) {
        return this.bot.sendMessage(msg.chat.id, '❌ Please register first');
      }

      const airdropStatus = user.airdropReceived ? 
        `✅ Welcome Airdrop: ${user.airdropAmount} $PONY` : 
        `❌ Airdrop: Verify a tweet to get 100 $PONY!`;

      const message = `
💰 **Your Pixel Ponies Stats**

🏆 Races Won: ${user.racesWon}
🎯 Races Entered: ${user.racesParticipated}
💸 Total Earned: ${user.totalWon} $PONY
🎁 ${airdropStatus}
📅 Member Since: ${user.createdAt.toDateString()}

💎 Wallet: \`${user.solanaAddress ? user.solanaAddress.slice(0,8) + '...' : 'Not set'}\`
`;

      await this.bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
      
    } catch (error) {
      console.error('Balance error:', error);
      await this.bot.sendMessage(msg.chat.id, '❌ Error getting balance');
    }
  }

  async handleAirdropInfo(msg) {
    const userId = msg.from.id.toString();
    
    try {
      const user = await User.findOne({ telegramId: userId });
      
      if (!user) {
        return this.bot.sendMessage(msg.chat.id, 
          `🎁 **PIXEL PONIES AIRDROP**\n\n💰 **Get 100 FREE $PONY!**\n\n📝 How to claim:\n1. Register with /register WALLET\n2. Pick a horse in any race\n3. Tweet your pick\n4. Verify with /verify TWEET_URL\n\n✅ One-time bonus for new players!`
        );
      }

      if (user.airdropReceived) {
        await this.bot.sendMessage(msg.chat.id, 
          `🎁 **Airdrop Status: CLAIMED** ✅\n\n💰 You received: ${user.airdropAmount} $PONY\n🎉 Welcome bonus already sent to your wallet!\n\n🏇 Keep racing to win more $PONY!`
        );
      } else {
        await this.bot.sendMessage(msg.chat.id, 
          `🎁 **Airdrop Status: AVAILABLE** 🎯\n\n💰 You can still claim: **100 $PONY**\n\n📋 To claim:\n${user.solanaAddress ? '✅ Wallet registered' : '❌ Register wallet first'}\n❌ Verify your first tweet in any race\n\n🏇 Pick a horse and tweet to claim!`
        );
      }
      
    } catch (error) {
      console.error('Airdrop info error:', error);
      await this.bot.sendMessage(msg.chat.id, '❌ Error getting airdrop info');
    }
  }

  async handleAdminAirdrop(msg, targetUserId) {
    const adminIds = ['363208661', '1087968824', '1438261641']; // Add multiple admins
    
    // Check if sender is admin
    if (!adminIds.includes(msg.from.id.toString())) {
      return this.bot.sendMessage(msg.chat.id, `❌ Admin only command (Your ID: ${msg.from.id})`);
    }

    try {
      const user = await User.findOne({ telegramId: targetUserId });
      if (!user) {
        return this.bot.sendMessage(msg.chat.id, `❌ User ${targetUserId} not found`);
      }

      if (user.airdropReceived) {
        return this.bot.sendMessage(msg.chat.id, 
          `❌ User @${user.username} already received airdrop (${user.airdropAmount} $PONY)`
        );
      }

      if (!user.solanaAddress) {
        return this.bot.sendMessage(msg.chat.id, 
          `❌ User @${user.username} has no wallet address`
        );
      }

      await this.bot.sendMessage(msg.chat.id, 
        `🎁 **ADMIN AIRDROP**\n\nSending 100 $PONY to @${user.username}...\n⏳ Processing...`
      );

      await this.processParticipantBonus(user, msg.chat.id);
      
    } catch (error) {
      console.error('Admin airdrop error:', error);
      await this.bot.sendMessage(msg.chat.id, '❌ Error processing admin airdrop');
    }
  }

  async handleAdminBalance(msg) {
    const adminIds = ['363208661', '1087968824', '1438261641'];
    
    if (!adminIds.includes(msg.from.id.toString())) {
      return this.bot.sendMessage(msg.chat.id, '❌ Admin only command');
    }

    try {
      await this.bot.sendMessage(msg.chat.id, '🔍 **Checking bot wallet balance...**');
      
      // This will trigger the same wallet checks as a real transfer
      const testResult = await SolanaService.sendPony(
        SolanaService.botWallet.publicKey.toBase58(), // Send to self as test
        0.001 // Tiny amount for testing
      );
      
      await this.bot.sendMessage(msg.chat.id, 
        `🤖 **Bot Wallet Status:**\n\n` +
        `📍 Address: \`${SolanaService.botWallet.publicKey.toBase58()}\`\n` +
        `🪙 Token: $PONY\n` +
        `🔗 Test result: ${testResult.success ? '✅ Ready' : '❌ Failed'}\n` +
        `${testResult.success ? `Transaction: ${testResult.signature}` : `Error: ${testResult.error}`}`,
        { parse_mode: 'Markdown' }
      );
      
    } catch (error) {
      console.error('Admin balance check error:', error);
      await this.bot.sendMessage(msg.chat.id, `❌ Error checking balance: ${error.message}`);
    }
  }

  async handleCallback(query) {
    await this.bot.answerCallbackQuery(query.id);
    // Handle button callbacks here
  }

  async processParticipantBonus(user, chatId) {
    const airdropAmount = 100; // 100 $PONY
    
    try {
      await this.bot.sendMessage(chatId, 
        `🎁 **PARTICIPANT BONUS!**\n\n💰 Sending you ${airdropAmount} $PONY for playing with us!\n\n⏳ Processing...`
      );

      // Send the airdrop
      const result = await SolanaService.sendPony(user.solanaAddress, airdropAmount);
      
      if (result.success) {
        // Mark user as having received airdrop
        user.airdropReceived = true;
        user.airdropAmount = airdropAmount;
        user.totalWon += airdropAmount; // Add to their total winnings
        await user.save();
        
        await this.bot.sendMessage(chatId, 
          `🎉 **BONUS SUCCESSFUL!**\n\n✅ ${airdropAmount} $PONY sent to your wallet!\n💎 Transaction: \`${result.signature}\`\n\n🏇 Thanks for playing with us! Invite friends to increase the pot!`,
          { parse_mode: 'Markdown' }
        );

        console.log(`✅ Airdrop sent: ${airdropAmount} $PONY to user ${user.telegramId} (${user.username})`);
        
        // Announce to the main channel
        const channelId = process.env.MAIN_CHANNEL_ID;
        if (channelId) {
          await this.bot.sendMessage(channelId, 
            `🎁 **PARTICIPANT BONUS!**\n\n🎉 Thanks for playing @${user.username || user.firstName}!\n💰 ${airdropAmount} $PONY sent!\n\n🏇 Invite friends to increase the pot!`
          );
        }
        
      } else {
        await this.bot.sendMessage(chatId, 
          `❌ **Airdrop Failed**\n\nSorry, there was an error sending your welcome $PONY. Please contact support.\n\nError: ${result.error}`
        );
        console.error(`❌ Airdrop failed for user ${user.telegramId}:`, result.error);
      }
      
    } catch (error) {
      console.error('Airdrop processing error:', error);
      await this.bot.sendMessage(chatId, '❌ Error processing airdrop. Please contact support.');
    }
  }

  startRaceScheduler() {
    console.log('🏁 Starting race scheduler...');
    
    // Simple scheduler: Create race, wait 30s for betting, run race, wait 4m30s, repeat
    const runRaceLoop = async () => {
      try {
        // Create new race
        console.log('🚀 Creating new race...');
        const race = await RaceService.createRace();
        console.log(`✅ Created race: ${race.raceId} with ${race.prizePool} $PONY`);
        await this.announceNewRace(race);
        
        // Wait 5 minutes for betting
        console.log('⏰ 5 minutes for betting...');
        setTimeout(async () => {
          console.log(`🏁 Running race: ${race.raceId}`);
          await this.runLiveRace(race.raceId);
          
          // Start next race immediately after this one finishes
          setTimeout(() => {
            runRaceLoop(); // Start next race
          }, 60000); // 1 minute break between races
          
        }, 300000); // 5 minutes
        
      } catch (error) {
        console.error('❌ Race loop error:', error);
        // Try again in 30 seconds if error
        setTimeout(() => runRaceLoop(), 30000);
      }
    };
    
    // Start the first race after 5 seconds
    setTimeout(() => {
      runRaceLoop();
    }, 5000);
    
    // Countdown announcer - much less frequent to avoid rate limits
    setInterval(async () => {
      try {
        const race = await RaceService.getCurrentRace();
        if (race && race.status === 'betting_open') {
          const timeLeft = 300000 - (Date.now() - race.startTime.getTime());
          const secondsLeft = Math.ceil(timeLeft / 1000);
          const minutesLeft = Math.ceil(secondsLeft / 60);
          
          // Only announce at 1 minute left to reduce spam
          if (minutesLeft === 1 && secondsLeft > 55) {
            const channelId = process.env.MAIN_CHANNEL_ID;
            if (channelId) {
              await this.bot.sendMessage(channelId, 
                `⏰ **1 MINUTE** left to enter the race!`
              );
            }
          }
        }
      } catch (error) {
        console.error('Countdown error:', error);
      }
    }, 30000); // Every 30 seconds instead of 5 seconds
  }

  async announceCountdown(minutesLeft) {
    const channelId = process.env.MAIN_CHANNEL_ID;
    console.log(`📢 Announcing countdown: ${minutesLeft} minutes, channel: ${channelId}`);
    if (!channelId) {
      console.log('❌ No channel ID configured for announcements');
      return;
    }

    const messages = {
      4: "⏰ **4 MINUTES** until the next Pixel Ponies race! Get ready to pick your champion! 🏇",
      3: "⏰ **3 MINUTES** remaining! Time to register and pick your horse! 🐎",
      2: "⏰ **2 MINUTES** left! Last chance to get in the race! 🚀",
      1: "⏰ **1 MINUTE** warning! Race starting very soon! 🔥"
    };

    if (messages[minutesLeft]) {
      await this.bot.sendMessage(channelId, messages[minutesLeft], { parse_mode: 'Markdown' });
    }
  }

  async announceNewRace(race) {
    const channelId = process.env.MAIN_CHANNEL_ID;
    console.log(`📢 Announcing new race: ${race.raceId}, channel: ${channelId}`);
    if (!channelId) {
      console.log('❌ No channel ID configured for race announcements');
      return;
    }

    let horsesList = '';
    race.horses.forEach((horse, index) => {
      if (index % 2 === 0 && index > 0) horsesList += '\n';
      horsesList += `${horse.id}. ${horse.emoji} ${horse.name} (${horse.odds.toFixed(1)}x)  `;
    });

    const message = `
🚨 **RACE IS STARTING NOW!** 🚨
📺 **LIVE FROM PIXEL PONIES RACETRACK** 

🏁 Race ID: ${race.raceId}

🐎 **TODAY'S FIELD:**
${horsesList}

💰 **Prize Pool:** ${race.prizePool} $PONY
⚡ **5 MINUTES** to enter!

🎯 Use /horse NUMBER to pick your champion!
🐦 Tweet your pick and /verify your tweet!

**AND THEY'RE AT THE STARTING GATE!** 🏁
`;

    await this.bot.sendMessage(channelId, message, { parse_mode: 'Markdown' });
  }

  async runLiveRace(raceId) {
    const channelId = process.env.MAIN_CHANNEL_ID;
    if (!channelId) return;

    // Close betting
    await this.bot.sendMessage(channelId, 
      `🚪 **BETTING IS NOW CLOSED!**\n\n📺 **AND THEY'RE OFF!** The horses are charging out of the gate! 🐎💨`
    );

    // Run the actual race
    const finishedRace = await RaceService.runRace(raceId);
    if (!finishedRace) return;

    // Live commentary during race (5-second intervals)
    const commentary = [
      "🏁 They're coming around the first turn!",
      "⚡ It's neck and neck down the backstretch!",
      "🔥 They're entering the final stretch!",
      "🎯 What a finish! Photo finish at the wire!",
      "🏆 **THE RESULTS ARE IN!**"
    ];

    for (let i = 0; i < commentary.length; i++) {
      setTimeout(async () => {
        await this.bot.sendMessage(channelId, commentary[i]);
      }, i * 5000);
    }

    // Announce results after commentary
    setTimeout(async () => {
      await this.announceResults(finishedRace);
    }, 25000); // 25 seconds for commentary, then results
  }

  async announceResults(race) {
    const channelId = process.env.MAIN_CHANNEL_ID;
    if (!channelId) return;

    const winner = race.horses.find(h => h.position === 1);
    const second = race.horses.find(h => h.position === 2);
    const third = race.horses.find(h => h.position === 3);

    await this.bot.sendMessage(channelId, `
🎺 **OFFICIAL RACE RESULTS** 🎺

🥇 **WINNER:** ${winner.emoji} ${winner.name} (${winner.finishTime.toFixed(2)}s)
🥈 **PLACE:** ${second.emoji} ${second.name} (${second.finishTime.toFixed(2)}s)
🥉 **SHOW:** ${third.emoji} ${third.name} (${third.finishTime.toFixed(2)}s)
`, { parse_mode: 'Markdown' });

    if (race.participants.length > 0) {
      const winners = race.participants.filter(p => p.horseId === winner.id);
      
      if (winners.length > 0) {
        const payout = Math.floor(race.prizePool / winners.length);
        
        await this.bot.sendMessage(channelId, `
🎉 **CONGRATULATIONS TO OUR WINNERS!**

👥 **Winners:** ${winners.length} player(s)
💰 **Payout:** ${payout} $PONY each

💸 **Sending prizes now...**
`);

        // Send payouts with live updates
        for (const participant of winners) {
          const user = await User.findOne({ telegramId: participant.userId });
          if (user && user.solanaAddress) {
            await this.bot.sendMessage(channelId, 
              `💳 Sending ${payout} $PONY to @${participant.username}...`
            );
            
            const result = await SolanaService.sendPony(user.solanaAddress, payout);
            if (result.success) {
              user.totalWon += payout;
              user.racesWon += 1;
              await user.save();
              
              await this.bot.sendMessage(channelId, 
                `✅ ${payout} $PONY sent to @${participant.username}! 🎊`
              );
            } else {
              await this.bot.sendMessage(channelId, 
                `❌ Failed to send $PONY to @${participant.username} - please contact support`
              );
            }
          }
        }
        
        setTimeout(async () => {
          await this.bot.sendMessage(channelId, 
            `🏁 **RACE COMPLETE!** Next race starting soon! 🚀\n\n⏰ Get ready for the next one!`
          );
        }, 5000);
        
      } else {
        await this.bot.sendMessage(channelId, 
          `😢 **No winners this race!** Better luck next time! 🍀\n\n🏁 Next race starting soon!`
        );
      }
    } else {
      await this.bot.sendMessage(channelId, 
        `🏁 **No participants this race**\n\nNext race starting soon! Don't miss it! 🚀`
      );
    }
  }
}

export default BotHandler;