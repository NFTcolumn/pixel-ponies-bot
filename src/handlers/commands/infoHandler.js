import User from '../../models/User.js';
import ReferralService from '../../services/ReferralService.js';

/**
 * Information Command Handler
 * Handles user info, balance, airdrop status, help commands
 */
class InfoHandler {
  constructor(bot) {
    this.bot = bot;
  }

  /**
   * Handle /balance command - Show user stats and balance
   * @param {Object} msg - Telegram message object
   */
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
🏁 Racing Rewards: ${user.raceRewardsEarned || 0} $PONY
💸 Total Earned: ${user.totalWon} $PONY
🎁 ${airdropStatus}
👥 Referrals: ${user.referralCount} (${user.referralEarnings || 0} $PONY earned)
🐦 Twitter Follow: ${user.twitterFollowVerified ? '✅ Verified' : '❌ Not verified'}
📅 Member Since: ${user.createdAt.toDateString()}

💎 Wallet: \`${user.baseAddress ? user.baseAddress.slice(0,8) + '...' : 'Not set'}\`
👤 Twitter: @${user.twitterHandle || 'Not set'}

🔗 **Use /referral to get your invite link!**
`;

      await this.bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Balance error:', error);
      await this.bot.sendMessage(msg.chat.id, '❌ Error getting balance');
    }
  }

  /**
   * Handle /airdrop command - Show airdrop status and info
   * @param {Object} msg - Telegram message object
   */
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
          `🎁 **Airdrop Status: AVAILABLE** 🎯\n\n💰 You can still claim: **100 $PONY**\n\n📋 To claim:\n${user.baseAddress ? '✅ Wallet registered' : '❌ Register wallet first'}\n❌ Verify your first tweet in any race\n\n🏇 Pick a horse and tweet to claim!`
        );
      }
      
    } catch (error) {
      console.error('Airdrop info error:', error);
      await this.bot.sendMessage(msg.chat.id, '❌ Error getting airdrop info');
    }
  }

  /**
   * Handle /referral command - Show referral stats and link
   * @param {Object} msg - Telegram message object
   */
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

  /**
   * Handle /invite command - Show invite interface
   * @param {Object} msg - Telegram message object
   */
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

  /**
   * Handle /howtoplay and /help commands - Show complete guide
   * @param {Object} msg - Telegram message object
   */
  async handleHowToPlay(msg) {
    const message = `
🏇 **WELCOME TO PIXEL PONIES!**

🎮 **Racing is now LIVE at pxpony.com!**

📝 **HOW TO GET STARTED:**

**STEP 1: REGISTER YOUR WALLET**
• Use: \`/register YOUR_BASE_WALLET\`
• Example: \`/register 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb\`
• Your Base wallet will receive $PONY rewards

**STEP 2: GET $PONY TOKENS**
• Make sure you have $PONY tokens in your wallet
• You'll need these to race on pxpony.com

**STEP 3: VISIT PXPONY.COM TO RACE!**
• Go to **pxpony.com**
• Connect your wallet
• Race against other players with real $PONY!

🎁 **Referral Program:**
• Earn 100 $PONY for each friend you invite!
• Use \`/referral\` to get your unique invite link
• Both you and your friend get rewards!

⚡ **QUICK START:**
1. \`/register YOUR_BASE_WALLET\`
2. Get $PONY tokens
3. Visit **pxpony.com** to race!

💰 **Commands:**
• \`/balance\` - Check your stats
• \`/referral\` - Get your invite link
• \`/help\` - Show this message

🏆 **Race with real $PONY at pxpony.com!**
`;

    await this.bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  }

  /**
   * Update user info from message
   * @param {Object} user - User document
   * @param {Object} msgFrom - Message from object
   */
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
}

export default InfoHandler;