import User from '../../models/User.js';
import BaseService from '../../services/BaseService.js';
import ReferralService from '../../services/ReferralService.js';
import PayoutService from '../../services/PayoutService.js';
import { REGISTRATION_TWEET_TEMPLATE, REWARDS, LINKS, formatPonyAmount } from '../../utils/tweetTemplates.js';

/**
 * NEW Registration Handler - 5-Step Process
 * Clean implementation for Base network
 */
class RegistrationHandler {
  constructor(bot) {
    this.bot = bot;
  }

  /**
   * Handle /start command with optional referral code
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
              `🎉 **Welcome via referral from @${referralResult.referrerName}!**\n\n🎁 Complete registration to get your ${formatPonyAmount(REWARDS.SIGNUP)} $PONY bonus!`
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
   * Handle /register command - NEW 5-STEP FLOW (PRIVATE DM ONLY)
   */
  async handleRegister(msg) {
    const userId = msg.from.id.toString();
    const chatId = msg.chat.id;

    try {
      // Check if this is a private chat (DM)
      if (msg.chat.type !== 'private') {
        // Send DM instruction in group
        await this.bot.sendMessage(chatId,
          `🔒 **Registration is Private!**\n\nFor your security, please DM me to register.\n\nClick here to start: @${process.env.BOT_USERNAME || 'PixelPonyBot'}`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Check if user already registered
      let user = await User.findOne({ telegramId: userId });

      if (user && user.baseAddress && user.twitterFollowVerified) {
        return this.bot.sendMessage(chatId,
          `✅ **Already Registered!**\n\n🎉 You're all set to race!\n\n💰 Use /balance to see your stats\n🏇 Use /race to join the current race`
        );
      }

      // Start registration process
      const message = `
🏇 **5-STEP REGISTRATION**

Get **${formatPonyAmount(REWARDS.SIGNUP)} $PONY** for completing registration!

**Your Progress:**
✅ Step 1: Join Telegram (Complete!)
⬜ Step 2: Follow @pxponies on Twitter
⬜ Step 3: Share registration tweet
⬜ Step 4: Submit your Base wallet
⬜ Step 5: Start racing!

**Let's begin Step 2:**
Click the button below to follow @pxponies on Twitter!
`;

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: '🐦 Follow @pxponies on Twitter',
              url: LINKS.TWITTER
            }
          ],
          [
            {
              text: '✅ I followed! Continue →',
              callback_data: `reg_step2_${userId}`
            }
          ]
        ]
      };

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

    } catch (error) {
      console.error('Registration error:', error);
      await this.bot.sendMessage(chatId, '❌ Registration error. Please try /register again.');
    }
  }

  /**
   * Handle callback queries for registration flow
   */
  async handleCallback(query) {
    const data = query.data;
    const userId = query.from.id.toString();
    const chatId = query.message.chat.id;

    try {
      // Step 2: Twitter follow confirmed
      if (data.startsWith('reg_step2_')) {
        await this.bot.answerCallbackQuery(query.id);

        // Show Step 3: Tweet template
        const tweetText = encodeURIComponent(REGISTRATION_TWEET_TEMPLATE);
        const tweetUrl = `https://twitter.com/intent/tweet?text=${tweetText}`;

        const message = `
✅ **Step 2 Complete!**

**Your Progress:**
✅ Step 1: Join Telegram
✅ Step 2: Follow @pxponies
⬜ Step 3: Share registration tweet
⬜ Step 4: Submit your Base wallet
⬜ Step 5: Start racing!

**Step 3: Share Your Registration Tweet**

Click the button below to post the pre-written tweet.
After posting, come back and click "I tweeted!"
`;

        const keyboard = {
          inline_keyboard: [
            [
              {
                text: '🐦 Post Registration Tweet',
                url: tweetUrl
              }
            ],
            [
              {
                text: '✅ I tweeted! Continue →',
                callback_data: `reg_step3_${userId}`
              }
            ]
          ]
        };

        await this.bot.editMessageText(message, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      }

      // Step 3: Tweet confirmed
      else if (data.startsWith('reg_step3_')) {
        await this.bot.answerCallbackQuery(query.id);

        const message = `
✅ **Step 3 Complete!**

**Your Progress:**
✅ Step 1: Join Telegram
✅ Step 2: Follow @pxponies
✅ Step 3: Share registration tweet
⬜ Step 4: Submit your Base wallet
⬜ Step 5: Start racing!

**Step 4: Add Your Base Wallet**

Reply to this message with your Base (Ethereum) wallet address to receive your **${formatPonyAmount(REWARDS.SIGNUP)} $PONY** signup bonus!

Example:
\`0x1234567890abcdef1234567890abcdef12345678\`
`;

        await this.bot.editMessageText(message, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'Markdown'
        });

        // Mark user as waiting for wallet
        let user = await User.findOne({ telegramId: userId });
        if (!user) {
          user = new User({
            telegramId: userId,
            username: query.from.username || 'User',
            firstName: query.from.first_name || 'User',
            lastName: query.from.last_name,
            twitterFollowVerified: true, // Assumed verified
            referralCode: ReferralService.generateReferralCode(userId)
          });
          await user.save();
        } else {
          user.twitterFollowVerified = true;
          user.username = query.from.username || user.username;
          user.firstName = query.from.first_name || user.firstName;
          await user.save();
        }
      }

    } catch (error) {
      console.error('Callback error:', error);
      await this.bot.answerCallbackQuery(query.id, { text: '❌ Error. Please try again.' });
    }
  }

  /**
   * Handle wallet address submission
   */
  async handleMessage(msg) {
    const userId = msg.from.id.toString();
    const chatId = msg.chat.id;
    const text = msg.text;

    // Skip if it's a command
    if (text && text.startsWith('/')) return false;

    // Only handle messages in private chats
    if (msg.chat.type !== 'private') return false;

    try {
      const user = await User.findOne({ telegramId: userId });

      console.log(`📝 Message received from user ${userId}:`, {
        hasUser: !!user,
        twitterVerified: user?.twitterFollowVerified,
        hasWallet: !!user?.baseAddress,
        messageText: text?.substring(0, 20)
      });

      // Check if user is in registration and waiting for wallet
      if (user && user.twitterFollowVerified && !user.baseAddress && text) {
        console.log(`💼 Processing wallet submission for user ${userId}: ${text.trim()}`);

        // Validate as ethereum address
        if (BaseService.validateAddress(text.trim())) {
          const walletAddress = text.trim();
          console.log(`✅ Valid wallet address for ${userId}: ${walletAddress}`);

          // Save wallet
          user.baseAddress = walletAddress;
          await user.save();
          console.log(`💾 Wallet saved to database for user ${userId}`);

          // Send completion message
          const message = `
✅ **REGISTRATION COMPLETE!**

**Your Progress:**
✅ Step 1: Join Telegram
✅ Step 2: Follow @pxponies
✅ Step 3: Share registration tweet
✅ Step 4: Submit Base wallet
✅ Step 5: Start racing!

🎉 **Welcome to Pixel Ponies!**

💎 Wallet: \`${walletAddress.slice(0,8)}...${walletAddress.slice(-6)}\`

⏳ **Processing your ${formatPonyAmount(REWARDS.SIGNUP)} $PONY signup bonus...**
`;

          await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

          // Process signup bonus
          console.log(`🎁 Processing signup bonus for ${userId}...`);
          await PayoutService.processParticipantBonus(user, chatId, this.bot);

          // Process referral reward if applicable
          console.log(`👥 Processing referral reward for ${userId}...`);
          await ReferralService.processReferralReward(user, chatId, this.bot);

          // Send final message
          setTimeout(async () => {
            await this.bot.sendMessage(chatId, `
🏇 **You're Ready to Race!**

Use these commands:
/race - Join the current race
/balance - Check your stats
/referral - Get your invite link

💰 Earn **${formatPonyAmount(REWARDS.PER_RACE)} $PONY** per race!
👥 Earn **${formatPonyAmount(REWARDS.REFERRAL)} $PONY** per referral!
`);
          }, 3000);

          return true; // Message handled
        } else {
          console.log(`❌ Invalid wallet address from ${userId}: ${text.trim()}`);
          await this.bot.sendMessage(chatId, '❌ Invalid wallet address. Please send a valid Base/Ethereum address (starts with 0x)');
          return true;
        }
      } else if (text && !text.startsWith('/')) {
        console.log(`⚠️ Message ignored for ${userId}: user not ready for wallet submission`);
      }

    } catch (error) {
      console.error('Message handling error:', error);
      console.error(error.stack);
    }

    return false; // Message not handled
  }

  /**
   * Update user info from Telegram message
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
