import Race from '../models/Race.js';

class RaceService {
  constructor() {
    this.horses = [
      { id: 1, name: 'Thunder Bolt', emoji: '⚡' },
      { id: 2, name: 'Magic Mane', emoji: '🦄' },
      { id: 3, name: 'Lightning Storm', emoji: '🌩️' },
      { id: 4, name: 'Speed Demon', emoji: '💨' },
      { id: 5, name: 'Star Gazer', emoji: '⭐' },
      { id: 6, name: 'Flame Runner', emoji: '🔥' },
      { id: 7, name: 'Midnight Shadow', emoji: '🌙' },
      { id: 8, name: 'Golden Galloper', emoji: '🏆' },
      { id: 9, name: 'Rainbow Dash', emoji: '🌈' },
      { id: 10, name: 'Wind Walker', emoji: '💨' },
      { id: 11, name: 'Diamond Dust', emoji: '💎' },
      { id: 12, name: 'Cosmic Comet', emoji: '☄️' }
    ];
  }

  async getCurrentRace() {
    return await Race.findOne({ 
      status: { $in: ['betting_open', 'racing'] } 
    }).sort({ startTime: -1 });
  }

  async createRace(bot = null) {
    const raceId = `race_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const startTime = new Date();
    
    // Prepare horses for race
    const horses = this.horses.map(horse => ({
      ...horse,
      finishTime: null,
      position: null
    }));

    // Dynamic prize pool with tiered scaling
    let groupMembers = 50; // Default fallback
    try {
      if (bot && process.env.MAIN_CHANNEL_ID) {
        const memberCount = await bot.getChatMemberCount(process.env.MAIN_CHANNEL_ID);
        groupMembers = memberCount;
        console.log(`📊 Current group members: ${groupMembers}`);
      }
    } catch (error) {
      console.error('Error getting member count:', error);
    }
    
    // Tiered prize pool calculation (cumulative)
    // 1-50: 1000 PONY each = 50,000
    // 51-100: 500 each = 25,000 (total: 75,000)  
    // 101-150: 250 each = 12,500 (total: 87,500), etc.
    let prizePool = 0;
    let currentTierStart = 1;
    let basePonyPerMember = 1000;
    
    while (currentTierStart <= groupMembers) {
      const tierEnd = Math.min(currentTierStart + 49, groupMembers); // 50 members per tier
      const membersInTier = tierEnd - currentTierStart + 1;
      const ponyForThisTier = membersInTier * basePonyPerMember;
      prizePool += ponyForThisTier;
      
      console.log(`  Tier ${currentTierStart}-${tierEnd}: ${membersInTier} members × ${basePonyPerMember} = ${ponyForThisTier} PONY (running total: ${prizePool})`);
      
      currentTierStart += 50;
      basePonyPerMember = Math.floor(basePonyPerMember / 2); // Half for next tier
    }

    const race = new Race({
      raceId,
      startTime,
      status: 'betting_open',
      horses,
      prizePool
    });

    await race.save();
    console.log(`🏁 Created race ${raceId} with ${prizePool} $PONY total (${groupMembers} members, tiered scaling)`);
    return race;
  }

  async runRace(raceId) {
    const race = await Race.findOne({ raceId });
    if (!race) return null;

    // Simulate race by generating random finish times
    const horses = race.horses.map(horse => ({
      id: horse.id,
      name: horse.name,
      emoji: horse.emoji,
      finishTime: 60 + Math.random() * 30, // 60-90 seconds
      position: null
    }));

    // Sort by finish time to determine positions
    horses.sort((a, b) => a.finishTime - b.finishTime);
    horses.forEach((horse, index) => {
      horse.position = index + 1;
    });

    // Update race with results
    race.horses = horses;
    race.winner = {
      horseId: horses[0].id,
      horseName: horses[0].name
    };
    race.status = 'finished';
    race.endTime = new Date();

    await race.save();
    console.log(`🏁 Race ${raceId} finished`);
    console.log(`🏆 Winner: ${horses[0].name} ${horses[0].emoji} - ${horses[0].finishTime.toFixed(2)}s`);
    console.log(`🥈 Second: ${horses[1].name} ${horses[1].emoji} - ${horses[1].finishTime.toFixed(2)}s`);
    console.log(`🥉 Third: ${horses[2].name} ${horses[2].emoji} - ${horses[2].finishTime.toFixed(2)}s`);
    return race;
  }

  async addParticipant(raceId, userId, username, horseId, tweetUrl) {
    const race = await Race.findOne({ raceId });
    if (!race || race.status !== 'betting_open') return false;

    const horse = race.horses.find(h => h.id === horseId);
    if (!horse) return false;

    // Check if user already participated
    const existingParticipant = race.participants.find(p => p.userId === userId);
    if (existingParticipant) return false;

    race.participants.push({
      userId,
      username,
      horseId,
      horseName: horse.name,
      tweetUrl
    });

    await race.save();
    return true;
  }
}

export default new RaceService();