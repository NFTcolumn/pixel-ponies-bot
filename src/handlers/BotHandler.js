import User from '../models/User.js';
import TempSelection from '../models/TempSelection.js';
import RaceService from '../services/RaceService.js';
import SolanaService from '../services/SolanaService.js';
import ReferralService from '../services/ReferralService.js';
import PayoutService from '../services/PayoutService.js';

class BotHandler {
  constructor(bot) {
    this.bot = bot;
    this.awaitingTwitterHandle = new Set();
    this.setupCommands();
    this.startRaceScheduler();
  }

  setupCommands() {
    // Start command (with optional referral code)
    this.bot.onText(/\/start(?:\s+([a-zA-Z0-9]+))?/, (msg, match) => this.handleStart(msg, match ? match[1] : null));
    
    // Register command
    this.bot.onText(/\/register(?:\s+(\S+)(?:\s+@?(\w+))?)?/, (msg, match) => this.handleRegister(msg, match ? match[1] : null, match ? match[2] : null));
    
    // Race commands
    this.bot.onText(/\/race/, (msg) => this.handleRace(msg));
    this.bot.onText(/\/horse\s+(\d+)/, (msg, match) => this.handleHorse(msg, parseInt(match[1])));
    this.bot.onText(/\/verify\s+(https:\/\/(?:twitter\.com|x\.com)\/\S+)/, (msg, match) => this.handleVerify(msg, match[1]));
    
    // User info commands
    this.bot.onText(/\/balance/, (msg) => this.handleBalance(msg));
    this.bot.onText(/\/airdrop/, (msg) => this.handleAirdropInfo(msg));
    
    // Referral commands
    this.bot.onText(/\/referral/, (msg) => this.handleReferral(msg));
    this.bot.onText(/\/invite/, (msg) => this.handleInvite(msg));
    
    // Twitter verification
    this.bot.onText(/\/verify_follow/, (msg) => this.handleVerifyFollow(msg));
    
    // Help command
    this.bot.onText(/\/howtoplay|\/help/, (msg) => this.handleHowToPlay(msg));
    
    // Admin commands (moved to separate method for clarity)
    this.setupAdminCommands();
    
    // Event handlers
    this.bot.on('callback_query', (query) => this.handleCallback(query));
    this.bot.on('message', (msg) => this.handleMessage(msg));
  }

  setupAdminCommands() {
    const adminIds = ['363208661', '1087968824', '1438261641'];
    
    this.bot.onText(/\/admin_airdrop\s+(\d+)/, (msg, match) => {
      if (adminIds.includes(msg.from.id.toString())) {
        this.handleAdminAirdrop(msg, match[1]);
      }
    });
    
    this.bot.onText(/\/admin_balance/, (msg) => {
      if (adminIds.includes(msg.from.id.toString())) {
        this.handleAdminBalance(msg);
      }
    });
    
    this.bot.onText(/\/airdrop_user\s+(\w+)\s+(\d+)/, (msg, match) => {
      if (adminIds.includes(msg.from.id.toString())) {
        this.handleManualAirdrop(msg, match[1], parseInt(match[2]));
      }
    });
    
    this.bot.onText(/\/list_racers/, (msg) => {
      if (adminIds.includes(msg.from.id.toString())) {
        this.handleListRacers(msg);
      }
    });
    
    this.bot.onText(/\/list_users/, (msg) => {
      if (adminIds.includes(msg.from.id.toString())) {
        this.handleListUsers(msg);
      }
    });
  }

  async handleStart(msg, referralCode = null) {
    const userId = msg.from.id.toString();
    
    // Handle referral if code provided
    if (referralCode) {
      const referralResult = await ReferralService.handleReferralLink(userId, referralCode);
      if (referralResult) {
        if (referralResult.shouldCreateUser) {
          await this.bot.sendMessage(msg.chat.id, 
            `🎉 **Welcome via referral from @${referralResult.referrerName}!**\n\n🎁 You'll get extra rewards when you complete registration!`
          );
        } else {
          await this.bot.sendMessage(msg.chat.id, 
            `🎉 **Referral linked to @${referralResult.referrerName}!**`
          );
        }
      }
    }

    const message = `
🏇 **Welcome to Pixel Ponies!**

The most exciting crypto horse racing with real $PONY rewards!

🎁 **RACING REWARDS: 500 $PONY per race!**
Plus 100 $PONY welcome bonus! Invite friends to boost the jackpot!

**How to Play:**
1. Register: \`/register YOUR_WALLET\`
2. Follow @pxponies and connect Twitter (guided)
3. Join races with \`/race\` and pick your pony
4. Tweet your pick and verify for entry
5. Earn 500 $PONY per race + jackpot winnings!

**Commands:**
/register - Start registration (wallet + Twitter)
/howtoplay - Complete step-by-step guide
/race - Current race info
/balance - Your stats
/airdrop - Check bonus status
/referral - Your referral stats & link
/invite - Invite friends for PONY rewards

💬 **You can use all commands here in private chat with @PixelPony_bot or in the group!**

**💰 Jackpot grows with community size!**
`;

    await this.bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  }

  async handleRegister(msg, walletAddress, twitterHandle) {
    const userId = msg.from.id.toString();
    
    try {
      let user = await User.findOne({ telegramId: userId });
      
      // Handle existing users updating their info
      if (user && walletAddress && twitterHandle) {
        if (!SolanaService.validateSolanaAddress(walletAddress)) {
          return this.bot.sendMessage(msg.chat.id, '❌ Invalid Solana address format');
        }
        
        twitterHandle = twitterHandle.replace('@', '');
        user.solanaAddress = walletAddress;
        user.twitterHandle = twitterHandle;
        user.twitterFollowVerified = false;
        await ReferralService.ensureReferralCode(user);
        await user.save();
        
        return this.bot.sendMessage(msg.chat.id, 
          `✅ **Profile Updated!**\n\n👤 Twitter: @${twitterHandle}\n💎 Wallet: ${walletAddress.slice(0,8)}...\n\n📱 Please use /verify_follow to verify your Twitter follow!`
        );
      }
      
      // New user registration
      if (!walletAddress) {
        return this.bot.sendMessage(msg.chat.id, 
          '❌ **Registration Required:**\n\n`/register YOUR_WALLET`\n\nExample:\n`/register 7xKXt...abc123`'
        );
      }
      
      if (!SolanaService.validateSolanaAddress(walletAddress)) {
        return this.bot.sendMessage(msg.chat.id, '❌ Invalid Solana address format');
      }

      if (user) {
        user.solanaAddress = walletAddress;
        // Always update username/name info in case it changed
        user.username = msg.from.username || user.username;
        user.firstName = msg.from.first_name || user.firstName;
        user.lastName = msg.from.last_name || user.lastName;
        await ReferralService.ensureReferralCode(user);
      } else {
        user = new User({
          telegramId: userId,
          username: msg.from.username || 'UnknownUser',
          firstName: msg.from.first_name || 'User',
          lastName: msg.from.last_name,
          solanaAddress: walletAddress,
          referralCode: ReferralService.generateReferralCode(userId)
        });
      }
      
      await user.save();
      
      // Show Twitter follow flow
      const keyboard = {
        inline_keyboard: [
          [{ text: '🐦 Follow @pxponies', url: 'https://x.com/pxponies' }],
          [{ text: '✅ I followed - Enter Twitter Handle', callback_data: `enter_twitter_${userId}` }]
        ]
      };
      
      await this.bot.sendMessage(msg.chat.id, 
        `✅ **Step 1/2 Complete!**\n\n💎 Wallet registered: ${walletAddress.slice(0,8)}...\n\n🐦 **Step 2: Follow & Connect Twitter**\n\n⚠️ **Required for airdrops and rewards!**\n\n1. Follow @pxponies on Twitter\n2. Click button below to enter your handle`,
        { parse_mode: 'Markdown', reply_markup: keyboard }
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
      if (!user || !user.solanaAddress || !user.twitterHandle) {
        return this.bot.sendMessage(msg.chat.id, 
          '❌ Please register first with /register YOUR_WALLET @your_twitter'
        );
      }

      if (!user.twitterFollowVerified) {
        return this.bot.sendMessage(msg.chat.id, 
          '❌ **Follow Required for Airdrops & Rewards!**\n\n🐦 Please follow @pxponies first with /verify_follow to participate in races and receive rewards!'
        );
      }

      const race = await RaceService.getCurrentRace();
      if (!race || race.status !== 'betting_open') {
        return this.bot.sendMessage(msg.chat.id, 
          `❌ No active race for betting\n\nTry again when the next race starts!`
        );
      }

      const horse = race.horses.find(h => h.id === horseNumber);
      if (!horse) {
        return this.bot.sendMessage(msg.chat.id, `❌ Invalid horse number. Choose 1-12.`);
      }

      const existingParticipant = race.participants.find(p => p.userId === userId);
      if (existingParticipant) {
        return this.bot.sendMessage(msg.chat.id, 
          `⚠️ You already picked ${existingParticipant.horseName} in this race!`
        );
      }

      // Store selection temporarily
      await TempSelection.findOneAndUpdate(
        { userId, raceId: race.raceId },
        { horseId: horseNumber, horseName: horse.name },
        { upsert: true }
      );

      const tweetText = `🏇 I'm backing ${horse.name} ${horse.emoji} in the #PixelPonies race!

🎯 Race ID: ${race.raceId}
🐎 My Champion: #${horseNumber} ${horse.name}

Join the most exciting crypto racing! 🚀
#SolanaMemes #CryptoRacing $PONY`;

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

  async handleVerify(msg, tweetUrl) {
    const userId = msg.from.id.toString();
    
    try {
      const user = await User.findOne({ telegramId: userId });
      if (!user) return this.bot.sendMessage(msg.chat.id, '❌ Please register first');

      const race = await RaceService.getCurrentRace();
      if (!race || race.status !== 'betting_open') {
        return this.bot.sendMessage(msg.chat.id, '❌ No active race');
      }

      const tempSelection = await TempSelection.findOne({ userId, raceId: race.raceId });
      if (!tempSelection) {
        return this.bot.sendMessage(msg.chat.id, 
          '❌ **Horse Selection Required!**\n\nPlease select your horse first with /horse NUMBER'
        );
      }

      const success = await RaceService.addParticipant(
        race.raceId, userId, user.username || user.firstName, tempSelection.horseId, tweetUrl
      );

      if (success) {
        await TempSelection.deleteOne({ userId, raceId: race.raceId });
        
        await PayoutService.processRacingReward(user, msg.chat.id, this.bot);
        
        if (!user.airdropReceived && user.solanaAddress) {
          await PayoutService.processParticipantBonus(user, msg.chat.id, this.bot);
          await ReferralService.processReferralReward(user, msg.chat.id, this.bot);
        }
        
        await this.bot.sendMessage(msg.chat.id, 
          `✅ **Tweet Verified!**\n\n🎉 You're in the race!\n🎁 Racing reward sent!\n🍀 Good luck!`
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
      if (!user) return this.bot.sendMessage(msg.chat.id, '❌ Please register first');

      const airdropStatus = user.airdropReceived ? 
        `✅ Welcome Airdrop: ${user.airdropAmount} $PONY` : 
        `❌ Airdrop: Verify a tweet to get 100 $PONY!`;

      const message = `
💰 **Your Pixel Ponies Stats**

🏆 Races Won: ${user.racesWon}
🎯 Races Entered: ${user.racesParticipated}
🏁 Racing Rewards: ${user.raceRewardsEarned || 0} $PONY
💸 Total Earned: ${user.totalWon} $PONY
🎁 ${airdropStatus}
👥 Referrals: ${user.referralCount} (${user.referralEarnings || 0} $PONY earned)
🐦 Twitter Follow: ${user.twitterFollowVerified ? '✅ Verified' : '❌ Not verified'}
📅 Member Since: ${user.createdAt.toDateString()}

💎 Wallet: \`${user.solanaAddress ? user.solanaAddress.slice(0,8) + '...' : 'Not set'}\`
👤 Twitter: @${user.twitterHandle || 'Not set'}

🔗 **Use /referral to get your invite link!**
`;

      await this.bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Balance error:', error);
      await this.bot.sendMessage(msg.chat.id, '❌ Error getting balance');
    }
  }

  async updateUserInfo(user, msgFrom) {
    let updated = false;
    if (msgFrom.username && user.username !== msgFrom.username) {
      user.username = msgFrom.username;
      updated = true;
    }
    if (msgFrom.first_name && user.firstName !== msgFrom.first_name) {
      user.firstName = msgFrom.first_name;
      updated = true;
    }
    if (msgFrom.last_name !== undefined && user.lastName !== msgFrom.last_name) {
      user.lastName = msgFrom.last_name;
      updated = true;
    }
    
    if (updated) {
      await user.save();
      console.log(`✅ Updated user info for ${user.telegramId}: ${user.username || user.firstName}`);
    }
  }

  async handleReferral(msg) {
    const userId = msg.from.id.toString();
    
    try {
      let user = await User.findOne({ telegramId: userId });
      if (!user) {
        return this.bot.sendMessage(msg.chat.id, '❌ Please register first with /register YOUR_WALLET');
      }

      // Update user info
      await this.updateUserInfo(user, msg.from);

      const referralCode = await ReferralService.ensureReferralCode(user);
      const referralLink = ReferralService.getReferralLink(referralCode);
      
      const message = `
🎁 **Your Referral Program**

🔗 **Your Referral Link:**
\`${referralLink}\`

📊 **Your Stats:**
👥 People Invited: ${user.referralCount}
💰 Referral Earnings: ${user.referralEarnings} $PONY
🎯 Reward per Invite: 100 $PONY

**How it works:**
1. Share your link with friends
2. When they register & verify a tweet
3. You both get 100 $PONY!

**Share this message:**
🏇 Join Pixel Ponies and get FREE $PONY! 
Use my referral: ${referralLink}
`;

      await this.bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Referral error:', error);
      await this.bot.sendMessage(msg.chat.id, '❌ Error getting referral info');
    }
  }

  async handleInvite(msg) {
    const userId = msg.from.id.toString();
    
    try {
      let user = await User.findOne({ telegramId: userId });
      if (!user) {
        return this.bot.sendMessage(msg.chat.id, '❌ Please register first with /register YOUR_WALLET');
      }

      const referralCode = await ReferralService.ensureReferralCode(user);
      const referralLink = ReferralService.getReferralLink(referralCode);
      
      const shareMessage = `🏇 **Join Pixel Ponies - Win Real $PONY!**

🎁 FREE crypto horse racing with instant rewards!
💰 500 $PONY per race + 100 $PONY welcome bonus

🚀 Join now: ${referralLink}

Race, win, earn! 🏆`;

      const keyboard = {
        inline_keyboard: [
          [{ text: '📢 Share on Twitter', url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}` }],
          [{ text: '💬 Share in Telegram', switch_inline_query: shareMessage }]
        ]
      };

      await this.bot.sendMessage(msg.chat.id, 
        `🎁 **Invite Friends & Earn $PONY!**\n\nYour referral link:\n\`${referralLink}\`\n\n📊 Invited: ${user.referralCount} • Earned: ${user.referralEarnings} $PONY`,
        { parse_mode: 'Markdown', reply_markup: keyboard }
      );
    } catch (error) {
      console.error('Invite error:', error);
      await this.bot.sendMessage(msg.chat.id, '❌ Error getting invite info');
    }
  }

  async handleVerifyFollow(msg) {
    const userId = msg.from.id.toString();
    
    try {
      const user = await User.findOne({ telegramId: userId });
      if (!user || !user.twitterHandle) {
        return this.bot.sendMessage(msg.chat.id, 
          '❌ Please register first with /register YOUR_WALLET @your_twitter'
        );
      }

      if (user.twitterFollowVerified) {
        return this.bot.sendMessage(msg.chat.id, 
          `✅ **Already Verified!**\n\n🐦 @${user.twitterHandle} is verified as a follower!\n\n🏇 You can now participate in races!`
        );
      }

      // For now, we'll use a simple verification (in production, you'd check via Twitter API)
      const keyboard = {
        inline_keyboard: [
          [
            { 
              text: '✅ I followed @pxponies', 
              callback_data: `confirm_follow_${userId}` 
            }
          ],
          [
            { 
              text: '🐦 Follow @pxponies', 
              url: 'https://x.com/pxponies' 
            }
          ]
        ]
      };

      console.log(`🔗 Creating follow verification for user ${userId} (@${user.twitterHandle})`);

      await this.bot.sendMessage(msg.chat.id, 
        `🐦 **Twitter Follow Verification**\n\n📱 Please follow @pxponies on Twitter, then click the button below to confirm.\n\n⚠️ **Note:** You must follow us to receive airdrops and community rewards!`,
        { 
          parse_mode: 'Markdown',
          reply_markup: keyboard
        }
      );
      
    } catch (error) {
      console.error('Follow verification error:', error);
      await this.bot.sendMessage(msg.chat.id, '❌ Error with follow verification');
    }
  }

  async handleCallback(query) {
    await this.bot.answerCallbackQuery(query.id);
    const data = query.data;
    const userId = query.from.id.toString();
    
    if (data.startsWith('enter_twitter_')) {
      const targetUserId = data.replace('enter_twitter_', '');
      if (targetUserId === userId) {
        await this.bot.editMessageText(
          `🐦 **Enter Your Twitter Handle**\n\nReply to this message with your Twitter handle (without @):\n\nExample: \`pxponies\``,
          {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
            parse_mode: 'Markdown'
          }
        );
        this.awaitingTwitterHandle.add(userId);
      }
    }
    
    // Handle follow confirmation
    if (data.startsWith('confirm_follow_')) {
      const targetUserId = data.replace('confirm_follow_', '');
      console.log(`📝 Follow confirmation: target=${targetUserId}, user=${userId}`);
      
      if (targetUserId === userId) {
        try {
          const user = await User.findOne({ telegramId: userId });
          console.log(`👤 User found: ${user ? user.username : 'null'}, verified: ${user ? user.twitterFollowVerified : 'n/a'}`);
          
          if (user && !user.twitterFollowVerified) {
            user.twitterFollowVerified = true;
            await user.save();
            console.log(`✅ User ${userId} follow verified successfully`);
            
            await this.bot.editMessageText(
              `✅ **Follow Verified!**\n\n🎉 Welcome @${user.twitterHandle}!\n🏇 You can now receive airdrops and community rewards!\n\n💡 Use /race to see the current race!`,
              {
                chat_id: query.message.chat.id,
                message_id: query.message.message_id,
                parse_mode: 'Markdown'
              }
            );
          } else if (user && user.twitterFollowVerified) {
            console.log(`⚠️ User ${userId} already verified`);
            await this.bot.editMessageText(
              `✅ **Already Verified!**\n\n🎉 You're already verified @${user.twitterHandle}!\n🏇 You can participate in races!`,
              {
                chat_id: query.message.chat.id,
                message_id: query.message.message_id,
                parse_mode: 'Markdown'
              }
            );
          }
        } catch (error) {
          console.error('Follow confirmation error:', error);
          console.error(error.stack);
        }
      } else {
        console.log(`❌ User ID mismatch: expected ${targetUserId}, got ${userId}`);
      }
    }
  }

  async handleMessage(msg) {
    const userId = msg.from.id.toString();
    const text = msg.text;
    
    if (!text || text.startsWith('/') || !this.awaitingTwitterHandle.has(userId)) {
      return;
    }
    
    try {
      const twitterHandle = text.replace('@', '').trim();
      if (!twitterHandle || twitterHandle.length < 1) {
        return this.bot.sendMessage(msg.chat.id, '❌ Please enter a valid Twitter handle');
      }
      
      const user = await User.findOne({ telegramId: userId });
      if (user) {
        user.twitterHandle = twitterHandle;
        user.twitterFollowVerified = true;
        await user.save();
        this.awaitingTwitterHandle.delete(userId);
        
        await this.bot.sendMessage(msg.chat.id, 
          `✅ **Registration Complete!**\n\n🎉 Welcome @${twitterHandle}!\n💎 Wallet: ${user.solanaAddress.slice(0,8)}...\n🐦 Twitter: @${twitterHandle}\n\n🏇 **You're all set!** Use /race to join the next race and earn $PONY!`,
          { parse_mode: 'Markdown' }
        );
      }
    } catch (error) {
      console.error('Twitter handle processing error:', error);
      this.bot.sendMessage(msg.chat.id, '❌ Error processing Twitter handle. Please try again.');
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

  async handleHowToPlay(msg) {
    const message = `
📚 **HOW TO PLAY PIXEL PONIES - COMPLETE GUIDE**

🎯 **STEP 1: REGISTER YOUR WALLET**
• Use: \`/register YOUR_SOLANA_WALLET\`
• Example: \`/register 7xKXtWuQmLYqhKSxP2abc123...\`
• This saves your wallet for $PONY payouts

🐦 **STEP 2: FOLLOW & CONNECT TWITTER**
• After registering, you'll get buttons to:
  1. Follow @pxponies on Twitter/X
  2. Enter your Twitter handle
• This is **REQUIRED** for all rewards!

🏁 **STEP 3: JOIN A RACE**
• Use: \`/race\` to see current race
• Pick your horse: \`/horse 1\` (numbers 1-12)
• You'll get a pre-written tweet to post

🐦 **STEP 4: TWEET & VERIFY**
• Post the generated tweet about your horse
• Copy your tweet URL 
• Use: \`/verify YOUR_TWEET_URL\`
• Example: \`/verify https://x.com/yourname/status/123...\`

💰 **STEP 5: GET PAID!**
• **500 $PONY** instantly for participating
• **100 $PONY** welcome bonus (first time)
• **Share of jackpot** if your horse wins!

🎁 **REWARDS SUMMARY:**
• 500 $PONY per race (while supplies last)
• 100 $PONY welcome bonus
• Jackpot winnings (tiered scaling: 1000/500/250/125 PONY per 50 members, split 85%/12.5%/2.5%)
• Must follow @pxponies for all rewards

**Referral Program:**
🎁 Earn 100 $PONY for each friend you invite!
🔗 Use \`/referral\` to get your unique invite link
💰 Both you and your friend get rewards!

⚡ **QUICK START:**
1. \`/register wallet\` → Follow @pxponies → Enter Twitter
2. \`/race\` → \`/horse NUMBER\` → Tweet → \`/verify URL\`
3. Earn $PONY! 🚀

**Need help?** Use \`/balance\` to check your stats anytime!
`;

    await this.bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  }

  startRaceScheduler() {
    const runRaceLoop = async () => {
      try {
        console.log('🚀 Creating new race...');
        const race = await RaceService.createRace(this.bot);
        console.log(`✅ Created race: ${race.raceId} with ${race.prizePool} $PONY`);
        await this.announceNewRace(race);
        
        setTimeout(async () => {
          console.log(`🏁 Running race: ${race.raceId}`);
          await this.runLiveRace(race.raceId);
          
          setTimeout(() => {
            runRaceLoop();
          }, 60000); // 1 minute break between races
          
        }, 300000); // 5 minutes
        
      } catch (error) {
        console.error('❌ Race loop error:', error);
        setTimeout(() => runRaceLoop(), 30000);
      }
    };
    
    setTimeout(() => {
      runRaceLoop();
    }, 5000);
  }

  async announceNewRace(race) {
    const channelId = process.env.MAIN_CHANNEL_ID;
    if (!channelId) return;

    let horsesList = '';
    race.horses.forEach((horse, index) => {
      if (index % 3 === 0 && index > 0) horsesList += '\n';
      horsesList += `${horse.id}. ${horse.emoji} ${horse.name}  `;
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

    await this.bot.sendMessage(channelId, 
      `🚪 **BETTING IS NOW CLOSED!**\n\n📺 **AND THEY'RE OFF!** The horses are charging out of the gate! 🐎💨`
    );

    const finishedRace = await RaceService.runRace(raceId);
    if (!finishedRace) return;

    // Race commentary
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

    setTimeout(async () => {
      await this.announceResults(finishedRace);
    }, 25000);
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

    await PayoutService.processRacePayouts(race, channelId, this.bot);
  }
}

export default BotHandler;