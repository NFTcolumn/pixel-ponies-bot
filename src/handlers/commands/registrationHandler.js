import User from '../../models/User.js';
import BaseService from '../../services/BaseService.js';
import ReferralService from '../../services/ReferralService.js';
import { REGISTRATION_TWEET_TEMPLATE, REWARDS, LINKS, formatPonyAmount } from '../../utils/tweetTemplates.js';

/**
 * Registration Command Handler
 * Handles all user registration and profile update logic
 */
class RegistrationHandler {
  constructor(bot) {
    this.bot = bot;
    this.awaitingTwitterHandle = new Set();
    this.awaitingTweetUrl = new Set();
    this.awaitingWalletAddress = new Set();
  }

  /**
   * Handle /start command with optional referral code
   * @param {Object} msg - Telegram message object
   * @param {string} referralCode - Optional referral code
   */
  async handleStart(msg, referralCode = null) {
    const userId = msg.from.id.toString();
    
    try {
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
🏇 **Welcome to Pixel Ponies on Base!**

The most exciting crypto horse racing with MASSIVE $PONY rewards!

🎁 **HUGE REWARDS:**
💎 **${formatPonyAmount(REWARDS.SIGNUP)} $PONY** signup bonus!
🏇 **${formatPonyAmount(REWARDS.PER_RACE)} $PONY** per race!
👥 **${formatPonyAmount(REWARDS.REFERRAL)} $PONY** per referral!

**How to Register & Play:**
✅ Step 1: Join our Telegram (you're here!)
✅ Step 2: Follow @pxponies on Twitter
✅ Step 3: Share registration tweet
✅ Step 4: Add your Base wallet
✅ Step 5: Race and earn!

**Start Now:**
/register - Begin your 5-step registration
/howtoplay - Detailed guide
/referral - Get your invite link

**Race Commands:**
/race - View current race
/balance - Check your stats

**Links:**
🌐 Website: ${LINKS.WEBSITE}
🔗 Token: ${LINKS.TOKEN_CA}
⛓️ Blockchain: Base ($BASE)

💰 **Instant payouts to your wallet!**
`;

      await this.bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Error in handleStart:', error);
      await this.bot.sendMessage(msg.chat.id, '❌ Error processing start command. Please try again.');
    }
  }

  /**
   * Handle /register command
   * @param {Object} msg - Telegram message object  
   * @param {string} walletAddress - Solana wallet address
   * @param {string} twitterHandle - Twitter handle (optional)
   */
  async handleRegister(msg, walletAddress, twitterHandle) {
    const userId = msg.from.id.toString();
    
    try {
      let user = await User.findOne({ telegramId: userId });
      
      // Handle existing users updating their info
      if (user && walletAddress && twitterHandle) {
        if (!BaseService.validateAddress(walletAddress)) {
          return this.bot.sendMessage(msg.chat.id, '❌ Invalid Base/Ethereum address format');
        }

        twitterHandle = twitterHandle.replace('@', '');
        user.baseAddress = walletAddress;
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
      
      if (!BaseService.validateAddress(walletAddress)) {
        return this.bot.sendMessage(msg.chat.id, '❌ Invalid Base/Ethereum address format');
      }

      if (user) {
        user.baseAddress = walletAddress;
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
          baseAddress: walletAddress,
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

  /**
   * Handle Twitter follow verification
   * @param {Object} msg - Telegram message object
   */
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

      // Create verification buttons
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

  /**
   * Handle callback query for entering Twitter handle
   * @param {Object} query - Telegram callback query
   */
  async handleTwitterCallback(query) {
    const data = query.data;
    const userId = query.from.id.toString();
    
    if (data.startsWith('enter_twitter_')) {
      const targetUserId = data.replace('enter_twitter_', '');
      if (targetUserId === userId) {
        try {
          await this.bot.editMessageText(
            `🐦 **Enter Your Twitter Handle**\n\nReply to this message with your Twitter handle (without @):\n\nExample: \`pxponies\``,
            {
              chat_id: query.message.chat.id,
              message_id: query.message.message_id,
              parse_mode: 'Markdown'
            }
          );
          this.awaitingTwitterHandle.add(userId);
        } catch (error) {
          console.error('Error editing message for Twitter callback:', error);
        }
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

  /**
   * Handle Twitter handle input message
   * @param {Object} msg - Telegram message object
   */
  async handleTwitterMessage(msg) {
    const userId = msg.from.id.toString();
    const text = msg.text;
    
    if (!text || text.startsWith('/') || !this.awaitingTwitterHandle.has(userId)) {
      return false; // Not handled
    }
    
    try {
      const twitterHandle = text.replace('@', '').trim();
      if (!twitterHandle || twitterHandle.length < 1) {
        await this.bot.sendMessage(msg.chat.id, '❌ Please enter a valid Twitter handle');
        return true; // Handled but invalid
      }
      
      const user = await User.findOne({ telegramId: userId });
      if (user) {
        user.twitterHandle = twitterHandle;
        user.twitterFollowVerified = true;
        await user.save();
        this.awaitingTwitterHandle.delete(userId);
        
        await this.bot.sendMessage(msg.chat.id,
          `✅ **Registration Complete!**\n\n🎉 Welcome @${twitterHandle}!\n💎 Wallet: ${user.baseAddress.slice(0,8)}...\n🐦 Twitter: @${twitterHandle}\n\n🏇 **You're all set!** Use /race to join the next race and earn $PONY!`,
          { parse_mode: 'Markdown' }
        );
      }
      return true; // Handled
    } catch (error) {
      console.error('Twitter handle processing error:', error);
      await this.bot.sendMessage(msg.chat.id, '❌ Error processing Twitter handle. Please try again.');
      return true; // Handled with error
    }
  }

  /**
   * Update user info from Telegram message
   * @param {Object} user - User document
   * @param {Object} msgFrom - Telegram message from object
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

export default RegistrationHandler;