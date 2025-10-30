import User from '../models/User.js';
import BaseService from './BaseService.js';

class ReferralService {
  generateReferralCode(userId) {
    const timestamp = Date.now().toString(36);
    const userHash = userId.slice(-4);
    return `PP${userHash}${timestamp}`.toUpperCase();
  }

  async ensureReferralCode(user) {
    if (!user.referralCode) {
      user.referralCode = this.generateReferralCode(user.telegramId);
      await user.save();
    }
    return user.referralCode;
  }

  getReferralLink(referralCode) {
    return `https://t.me/${process.env.BOT_USERNAME}?start=${referralCode}`;
  }

  async processReferralReward(referredUser, chatId, bot) {
    if (!referredUser.referredBy) return;
    
    try {
      const referrer = await User.findOne({ telegramId: referredUser.referredBy });
      if (!referrer || !referrer.baseAddress) return;

      const referralReward = 100; // 100 $PONY for each successful referral

      // Send reward to referrer
      const result = await BaseService.sendPony(referrer.baseAddress, referralReward);

      if (result.success) {
        // Update referrer stats
        referrer.referralCount += 1;
        referrer.referralEarnings += referralReward;
        referrer.totalWon += referralReward;
        await referrer.save();

        // Notify referrer
        await bot.sendMessage(referrer.telegramId,
          `🎉 **Referral Reward!**\n\n💰 You earned ${referralReward} $PONY for inviting @${referredUser.username || referredUser.firstName}!\n\n🔗 Transaction: \`${result.hash}\`\n\n📊 Total referrals: ${referrer.referralCount}`,
          { parse_mode: 'Markdown' }
        );

        // Give bonus to referred user too
        const referredBonus = 100;
        const bonusResult = await BaseService.sendPony(referredUser.baseAddress, referredBonus);

        if (bonusResult.success) {
          referredUser.totalWon += referredBonus;
          await referredUser.save();

          await bot.sendMessage(chatId,
            `🎁 **Referral Bonus!**\n\nYou got an extra ${referredBonus} $PONY for being referred by @${referrer.username || referrer.firstName}!\n\n🔗 Transaction: \`${bonusResult.hash}\``,
            { parse_mode: 'Markdown' }
          );
        }

        console.log(`✅ Referral rewards: ${referralReward} to referrer ${referrer.telegramId}, ${referredBonus} to referred ${referredUser.telegramId}`);
      }
      
    } catch (error) {
      console.error('Referral reward processing error:', error);
    }
  }

  async handleReferralLink(userId, referralCode) {
    try {
      const referrer = await User.findOne({ referralCode });
      if (referrer && referrer.telegramId !== userId) {
        let user = await User.findOne({ telegramId: userId });
        if (!user) {
          // Create new user with referral
          return {
            shouldCreateUser: true,
            referredBy: referrer.telegramId,
            referrerName: referrer.username || referrer.firstName
          };
        } else if (!user.referredBy) {
          // Existing user without referral
          user.referredBy = referrer.telegramId;
          await user.save();
          return {
            shouldCreateUser: false,
            referrerName: referrer.username || referrer.firstName
          };
        }
      }
      return null;
    } catch (error) {
      console.error('Referral processing error:', error);
      return null;
    }
  }

  getReferralLink(referralCode) {
    return `https://t.me/${process.env.BOT_USERNAME}?start=${referralCode}`;
  }

  async ensureReferralCode(user) {
    if (!user.referralCode) {
      user.referralCode = this.generateReferralCode(user.telegramId);
      await user.save();
    }
    return user.referralCode;
  }
}

export default new ReferralService();