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
      { id: 8, name: 'Golden Arrow', emoji: '🏹' },
      { id: 9, name: 'Storm Chaser', emoji: '🌪️' },
      { id: 10, name: 'Wild Spirit', emoji: '🦅' },
      { id: 11, name: 'Diamond Dash', emoji: '💎' },
      { id: 12, name: 'Phoenix Rising', emoji: '🔥' },
      { id: 13, name: 'Ice Breaker', emoji: '❄️' },
      { id: 14, name: 'Rocket Rider', emoji: '🚀' },
      { id: 15, name: 'Solar Flare', emoji: '☀️' },
      { id: 16, name: 'Cosmic Cruiser', emoji: '🌌' }
    ];
  }

  async getCurrentRace() {
    return await Race.findOne({ 
      status: { $in: ['betting_open', 'racing'] } 
    }).sort({ startTime: -1 });
  }

  async createRace() {
    const raceId = `race_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const startTime = new Date();
    
    // Generate random odds for each horse
    const horses = this.horses.map(horse => ({
      ...horse,
      odds: +(2 + Math.random() * 4).toFixed(1), // 2.0x to 6.0x odds
      finishTime: null,
      position: null
    }));

    // Dynamic prize pool: 700 base + (100 * group members)
    // For now using 30 members as mentioned, later can get actual count
    const basePot = 700;
    const groupMembers = 30; // TODO: Get actual member count
    const prizePool = basePot + (groupMembers * 100);

    const race = new Race({
      raceId,
      startTime,
      status: 'betting_open',
      horses,
      prizePool
    });

    await race.save();
    console.log(`🏁 Created race ${raceId}`);
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
      odds: horse.odds,
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