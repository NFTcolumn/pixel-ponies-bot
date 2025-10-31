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
    const race = await Race.findOne({ 
      status: { $in: ['betting_open', 'racing'] } 
    }).sort({ startTime: -1 });
    
    if (race) {
      console.log(`🔍 Found current race: ${race.raceId} (status: ${race.status}, participants: ${race.participants.length})`);
    } else {
      console.log('🔍 No current active race found');
    }
    
    return race;
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

    // Dynamic prize pool: 1M PONY per user (capped at 1000 users)
    let groupMembers = 50; // Default fallback
    try {
      if (bot && process.env.MAIN_CHANNEL_ID) {
        const memberCount = await bot.getChatMemberCount(process.env.MAIN_CHANNEL_ID);
        groupMembers = Math.min(memberCount, 1000); // Cap at 1000 users
        console.log(`📊 Current group members: ${memberCount} (capped at ${groupMembers} for prize pool)`);
      }
    } catch (error) {
      console.error('Error getting member count:', error);
    }

    // Prize pool = 1M PONY per user (up to 1000 users)
    const prizePool = groupMembers * 1000000;
    console.log(`💰 Dynamic prize pool: ${prizePool.toLocaleString()} $PONY (${groupMembers} users × 1M)`);

    const race = new Race({
      raceId,
      startTime,
      status: 'betting_open',
      horses,
      prizePool,
      participants: [] // Explicitly initialize empty participants array
    });

    try {
      await race.save();
      console.log(`✅ Created race ${raceId} with ${prizePool} $PONY total (${groupMembers} members)`);
      console.log(`💾 Race saved to database with empty participants array`);
      return race;
    } catch (error) {
      console.error(`❌ Failed to save new race ${raceId}:`, error);
      throw error;
    }
  }

  async runRace(raceId) {
    console.log(`🔍 [DEBUG] Looking for race ${raceId} to run...`);
    
    const race = await Race.findOne({ raceId });
    if (!race) {
      console.log(`❌ Race ${raceId} not found in database`);
      return null;
    }

    console.log(`🔍 [DEBUG] Found race ${raceId}:`);
    console.log(`  - Status: ${race.status}`);
    console.log(`  - Participants array length: ${race.participants.length}`);
    console.log(`  - Raw participants data:`, JSON.stringify(race.participants, null, 2));

    console.log(`🏁 Running race ${raceId} with ${race.participants.length} participants`);
    if (race.participants.length > 0) {
      console.log('📋 Participants:');
      race.participants.forEach((p, i) => {
        console.log(`  ${i+1}. ${p.username} (${p.userId}) - Horse #${p.horseId} ${p.horseName}`);
      });
    } else {
      console.log('⚠️ [ISSUE] No participants found in race - this might be the bug!');
    }

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

    try {
      await race.save();
      console.log(`✅ Race ${raceId} finished and saved to database`);
      console.log(`🏆 Winner: ${horses[0].name} ${horses[0].emoji} - ${horses[0].finishTime.toFixed(2)}s`);
      console.log(`🥈 Second: ${horses[1].name} ${horses[1].emoji} - ${horses[1].finishTime.toFixed(2)}s`);
      console.log(`🥉 Third: ${horses[2].name} ${horses[2].emoji} - ${horses[2].finishTime.toFixed(2)}s`);
      console.log(`💾 Final participant count saved: ${race.participants.length}`);
      return race;
    } catch (error) {
      console.error(`❌ Failed to save race results for ${raceId}:`, error);
      return race; // Return the race even if save failed
    }
  }

  async addParticipant(raceId, userId, username, horseId, tweetUrl) {
    console.log(`🎯 Adding participant: ${username} (${userId}) to race ${raceId}, horse #${horseId}`);
    
    const race = await Race.findOne({ raceId });
    if (!race || race.status !== 'betting_open') {
      console.log(`❌ Cannot add participant: race ${raceId} not found or not open (status: ${race?.status})`);
      return false;
    }

    const horse = race.horses.find(h => h.id === horseId);
    if (!horse) {
      console.log(`❌ Cannot add participant: horse #${horseId} not found`);
      return false;
    }

    // Check if user already participated
    const existingParticipant = race.participants.find(p => p.userId === userId);
    if (existingParticipant) {
      console.log(`⚠️ User ${username} (${userId}) already participated in race ${raceId}`);
      return false;
    }

    const participantData = {
      userId,
      username,
      horseId,
      horseName: horse.name,
      tweetUrl,
      joinedAt: new Date()
    };

    race.participants.push(participantData);

    console.log(`🔍 [DEBUG] About to save participant to race ${raceId}:`);
    console.log(`  - Participants before save: ${race.participants.length}`);
    console.log(`  - New participant data:`, JSON.stringify(participantData, null, 2));

    try {
      const savedRace = await race.save();
      console.log(`✅ Participant added successfully: ${username} bet on #${horseId} ${horse.name} in race ${raceId}`);
      console.log(`📊 Race ${raceId} now has ${savedRace.participants.length} participants`);
      
      // Double-check by refetching the race to confirm persistence
      const verifyRace = await Race.findOne({ raceId });
      console.log(`🔍 [VERIFY] Race ${raceId} refetched - participants count: ${verifyRace.participants.length}`);
      
      return true;
    } catch (error) {
      console.error(`❌ Failed to save participant ${username} to race ${raceId}:`, error);
      return false;
    }
  }

  // Method to finish a race without running it (for cleanup)
  async finishRace(raceId) {
    console.log(`🏁 Finishing incomplete race: ${raceId}`);
    
    const race = await Race.findOne({ raceId });
    if (!race) {
      console.log(`❌ Race ${raceId} not found`);
      return null;
    }

    console.log(`📊 Race ${raceId} being finished with ${race.participants.length} participants`);

    // If race hasn't been run yet, run it first
    if (race.status !== 'finished') {
      return await this.runRace(raceId);
    }

    return race;
  }

  // Method to verify participant data integrity
  async verifyRaceIntegrity(raceId) {
    const race = await Race.findOne({ raceId });
    if (!race) return null;

    console.log(`🔍 Verifying race ${raceId} integrity:`);
    console.log(`  - Status: ${race.status}`);
    console.log(`  - Participants: ${race.participants.length}`);
    console.log(`  - Prize Pool: ${race.prizePool}`);
    
    if (race.participants.length > 0) {
      console.log('  - Participant details:');
      race.participants.forEach((p, i) => {
        console.log(`    ${i+1}. ${p.username} (${p.userId}) - #${p.horseId} ${p.horseName}`);
        console.log(`       Joined: ${p.joinedAt || 'Unknown'}, Tweet: ${p.tweetUrl ? 'Yes' : 'No'}`);
      });
    }

    return race;
  }
}

export default new RaceService();