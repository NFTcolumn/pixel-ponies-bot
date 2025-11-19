import User from '../models/User.js';
import BaseService from './BaseService.js';

class PayoutService {
  async payoutParticipant(participant, payout, place, channelId, bot) {
    const user = await User.findOne({ telegramId: participant.userId });
    if (!user || !user.baseAddress) {
      await bot.sendMessage(channelId,
        `❌ Cannot pay @${participant.username} - no wallet address`
      );
      return;
    }

    const result = await BaseService.sendPony(user.baseAddress, payout);
    if (result.success) {
      user.totalWon += payout;
      if (place === "1ST PLACE") user.racesWon += 1;
      await user.save();

      await bot.sendMessage(channelId,
        `🏆 **${place} WINNER!** 🏆\n\n🎉 @${participant.username}\n🐎 Horse: ${participant.horseName}\n💰 **Won:** ${payout} $PONY\n💎 **Total Earned:** ${user.totalWon} $PONY\n🔗 **Proof:** https://basescan.org/tx/${result.hash}`,
        { parse_mode: 'Markdown' }
      );

      // Send personal notification
      try {
        const emoji = place === "1ST PLACE" ? "🥇" : place === "2ND PLACE" ? "🥈" : "🥉";
        await bot.sendMessage(participant.userId,
          `${emoji} **${place}!** ${emoji}\n\n🐎 Your horse ${participant.horseName} finished ${place.split(' ')[0].toLowerCase()}!\n💰 **Prize:** ${payout} $PONY\n💎 **Your Total:** ${user.totalWon} $PONY\n\n🔗 **Transaction Proof:**\nhttps://basescan.org/tx/${result.hash}\n\n🎊 Great job! Keep racing!`,
          { parse_mode: 'Markdown' }
        );
      } catch (dmError) {
        console.log(`Could not send DM to ${place} winner ${participant.userId}`);
      }
    } else {
      await bot.sendMessage(channelId,
        `❌ Failed to send $PONY to @${participant.username} - please contact support`
      );
    }
  }

  async processRacePayouts(race, channelId, bot) {
    if (race.participants.length === 0) {
      await bot.sendMessage(channelId, 
        `🏁 **No participants this race**\n\nNext race starting soon! Don't miss it! 🚀`
      );
      return;
    }

    const winner = race.horses.find(h => h.position === 1);
    const second = race.horses.find(h => h.position === 2);
    const third = race.horses.find(h => h.position === 3);

    // New payout structure: 1st: 85%, 2nd: 12.5%, 3rd: 2.5%
    const firstPlaceWinners = race.participants.filter(p => p.horseId === winner.id);
    const secondPlaceWinners = race.participants.filter(p => p.horseId === second.id);
    const thirdPlaceWinners = race.participants.filter(p => p.horseId === third.id);
    
    const firstPlacePrize = Math.floor(race.prizePool * 0.85);
    const secondPlacePrize = Math.floor(race.prizePool * 0.125);
    const thirdPlacePrize = Math.floor(race.prizePool * 0.025);
    
    // Check if nobody won any prizes
    const totalWinners = firstPlaceWinners.length + secondPlaceWinners.length + thirdPlaceWinners.length;
    
    if (totalWinners === 0) {
      await bot.sendMessage(channelId, `
😢 **NO WINNERS THIS RACE!** 

${race.participants.length} players participated but nobody picked the winning horses! 🐎

🏆 **Winner:** ${winner.name} ${winner.emoji}
🥈 **Second:** ${second.name} ${second.emoji}  
🥉 **Third:** ${third.name} ${third.emoji}

💰 Prize pool of ${race.prizePool} $PONY rolls over to next race!
🍀 Better luck next time!

🏁 **Next race starting soon!**
`);
      return;
    }
    
    await bot.sendMessage(channelId, `
🎉 **RACE PAYOUTS**

🥇 **1st Place:** ${firstPlacePrize} $PONY (85%)
🥈 **2nd Place:** ${secondPlacePrize} $PONY (12.5%)
🥉 **3rd Place:** ${thirdPlacePrize} $PONY (2.5%)

💸 **Sending prizes now...**
`);

    // Pay out 1st place winners
    if (firstPlaceWinners.length > 0) {
      const individualPayout = Math.floor(firstPlacePrize / firstPlaceWinners.length);
      await bot.sendMessage(channelId, 
        `🥇 **1ST PLACE WINNERS (${firstPlaceWinners.length} players):** ${individualPayout} $PONY each`
      );
      
      for (const participant of firstPlaceWinners) {
        await this.payoutParticipant(participant, individualPayout, "1ST PLACE", channelId, bot);
      }
    }
    
    // Pay out 2nd place winners
    if (secondPlaceWinners.length > 0) {
      const individualPayout = Math.floor(secondPlacePrize / secondPlaceWinners.length);
      await bot.sendMessage(channelId, 
        `🥈 **2ND PLACE WINNERS (${secondPlaceWinners.length} players):** ${individualPayout} $PONY each`
      );
      
      for (const participant of secondPlaceWinners) {
        await this.payoutParticipant(participant, individualPayout, "2ND PLACE", channelId, bot);
      }
    }
    
    // Pay out 3rd place winners
    if (thirdPlaceWinners.length > 0) {
      const individualPayout = Math.floor(thirdPlacePrize / thirdPlaceWinners.length);
      await bot.sendMessage(channelId, 
        `🥉 **3RD PLACE WINNERS (${thirdPlaceWinners.length} players):** ${individualPayout} $PONY each`
      );
      
      for (const participant of thirdPlaceWinners) {
        await this.payoutParticipant(participant, individualPayout, "3RD PLACE", channelId, bot);
      }
    }

    setTimeout(async () => {
      await bot.sendMessage(channelId, 
        `🏁 **RACE COMPLETE!** Next race starting soon! 🚀\n\n⏰ Get ready for the next one!`
      );
    }, 5000);
  }

  async processParticipantBonus(user, chatId, bot) {
    const airdropAmount = 10000000000; // 10B $PONY signup bonus
    
    try {
      await bot.sendMessage(chatId, 
        `🎁 **PARTICIPANT BONUS!**\n\n💰 Sending you ${airdropAmount} $PONY for playing with us!\n\n⏳ Processing...`
      );

      // Send the airdrop
      const result = await BaseService.sendPony(user.baseAddress, airdropAmount);
      
      if (result.success) {
        // Mark user as having received airdrop
        user.airdropReceived = true;
        user.airdropAmount = airdropAmount;
        user.totalWon += airdropAmount; // Add to their total winnings
        await user.save();
        
        await bot.sendMessage(chatId,
          `🎉 **BONUS SUCCESSFUL!**\n\n✅ ${airdropAmount} $PONY sent to your wallet!\n💎 Transaction: \`${result.hash}\`\n\n🏇 Thanks for playing with us! Invite friends to increase the pot!`,
          { parse_mode: 'Markdown' }
        );

        console.log(`✅ Airdrop sent: ${airdropAmount} $PONY to user ${user.telegramId} (${user.username})`);
        
        // Announce to the main channel
        const channelId = process.env.MAIN_CHANNEL_ID;
        if (channelId) {
          await bot.sendMessage(channelId, 
            `🎁 **PARTICIPANT BONUS!**\n\n🎉 Thanks for playing @${user.username || user.firstName}!\n💰 ${airdropAmount} $PONY sent!\n\n🏇 Invite friends to increase the pot!`
          );
        }
        
      } else {
        await bot.sendMessage(chatId, 
          `❌ **Airdrop Failed**\n\nSorry, there was an error sending your welcome $PONY. Please contact support.\n\nError: ${result.error}`
        );
        console.error(`❌ Airdrop failed for user ${user.telegramId}:`, result.error);
      }
      
    } catch (error) {
      console.error('Airdrop processing error:', error);
      await bot.sendMessage(chatId, '❌ Error processing airdrop. Please contact support.');
    }
  }

  async processRacingReward(user) {
    const raceReward = 100000000; // 100M $PONY per race
    
    try {
      // Check supplies limit - for now, let's set a reasonable limit
      const maxRaceRewards = 100000; // 100k $PONY total supply for racing rewards
      
      if (user.raceRewardsEarned >= maxRaceRewards) {
        // Supplies exhausted for this user - could implement global supply tracking
        return;
      }
      
      // Send the racing reward
      const result = await BaseService.sendPony(user.baseAddress, raceReward);
      
      if (result.success) {
        // Update user's racing rewards
        user.raceRewardsEarned += raceReward;
        user.totalWon += raceReward;
        user.racesParticipated += 1;
        await user.save();
        
        console.log(`🏁 Racing reward sent: ${raceReward} $PONY to user ${user.telegramId} (${user.username})`);
        
      } else {
        console.error(`❌ Racing reward failed for user ${user.telegramId}:`, result.error);
      }
      
    } catch (error) {
      console.error('Racing reward processing error:', error);
    }
  }
}

export default new PayoutService();