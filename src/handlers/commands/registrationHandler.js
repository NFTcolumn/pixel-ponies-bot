import User from '../../models/User.js';
import BaseService from '../../services/BaseService.js';
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
   * Handle /start command
   */
  async handleStart(msg) {
    const userId = msg.from.id.toString();

    try {
      const message = `
🏇 **Welcome to Pixel Ponies on Base!**

The most exciting crypto horse racing with real $PONY rewards!

🎮 **Racing is now LIVE at pxpony.com!**

🎁 **Signup Bonus:**
💰 **${formatPonyAmount(REWARDS.SIGNUP)} $PONY** when you register!

**How to Get Started:**
1️⃣ Join our Telegram (you're here!)
2️⃣ Register your Base wallet with /register
3️⃣ Get your ${formatPonyAmount(REWARDS.SIGNUP)} $PONY bonus!
4️⃣ Visit **pxpony.com** to race!

**Commands:**
/register - Register your wallet and get ${formatPonyAmount(REWARDS.SIGNUP)} $PONY
/howtoplay - Detailed guide
/balance - Check your stats

**Links:**
🌐 Racing: **pxpony.com**
🔗 Referrals: **pxpony.com/referrals**
🔗 Token: ${LINKS.TOKEN_CA}
⛓️ Blockchain: Base ($BASE)

🏆 **Race with real $PONY at pxpony.com!**
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
        // Get bot info to create proper link
        const botInfo = await this.bot.getMe();
        const botUsername = botInfo.username;

        // Send DM instruction in group with clickable link
        const keyboard = {
          inline_keyboard: [
            [{
              text: '🔐 Register in Private DM',
              url: `https://t.me/${botUsername}?start=register`
            }]
          ]
        };

        await this.bot.sendMessage(chatId,
          `🔒 **Registration is Private!**\n\nFor your security, please click the button below to DM me and complete registration privately.`,
          { parse_mode: 'Markdown', reply_markup: keyboard }
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

🎁 **Get ${formatPonyAmount(REWARDS.SIGNUP)} $PONY just for signing up!**

**Your Progress:**
✅ Step 1: Join Telegram (Complete!)
⬜ Step 2: Follow @pxponies on Twitter
⬜ Step 3: Share registration tweet
⬜ Step 4: Submit your Base wallet
⬜ Step 5: Receive your ${formatPonyAmount(REWARDS.SIGNUP)} $PONY!

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
      console.error('❌ Registration error:', error);
      console.error('   Error details:', error.message);
      console.error('   Stack trace:', error.stack);
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
            twitterFollowVerified: true // Assumed verified
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
✅ Step 5: Receive your ${formatPonyAmount(REWARDS.SIGNUP)} $PONY!

🎉 **Welcome to Pixel Ponies!**

💎 Wallet: \`${walletAddress.slice(0,8)}...${walletAddress.slice(-6)}\`

💰 **Processing your ${formatPonyAmount(REWARDS.SIGNUP)} $PONY signup bonus...**
`;

          await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

          // Process signup bonus
          console.log(`💰 Processing signup bonus for ${userId}...`);
          await PayoutService.processParticipantBonus(user, chatId, this.bot);

          // Send final message
          setTimeout(async () => {
            await this.bot.sendMessage(chatId, `
🏇 **You're Ready to Race!**

Use these commands:
/race - Join the current race
/balance - Check your stats

💰 Earn **${formatPonyAmount(REWARDS.PER_RACE)} $PONY** per race!
🔗 **Refer friends at pxpony.com/referrals**
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
