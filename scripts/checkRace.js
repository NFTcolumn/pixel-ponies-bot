import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function checkRace() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const racesCollection = db.collection('races');

    // Get current active race
    const activeRace = await racesCollection.findOne({
      status: { $in: ['betting_open', 'racing'] }
    });

    console.log('📊 Current Race Status:\n');

    if (!activeRace) {
      console.log('❌ No active race found');
      console.log('   Status: No race running');
      console.log('   Next race will start at the next :00 or :30 minute mark');

      const now = new Date();
      const currentMinute = now.getUTCMinutes();
      let nextRaceMinute;

      if (currentMinute < 30) {
        nextRaceMinute = 30 - currentMinute;
      } else {
        nextRaceMinute = 60 - currentMinute;
      }

      console.log(`   ⏰ Next race in approximately ${nextRaceMinute} minutes`);
    } else {
      console.log(`✅ Active race found: ${activeRace.raceId}`);
      console.log(`   Status: ${activeRace.status}`);
      console.log(`   Started: ${activeRace.startTime}`);
      console.log(`   Participants: ${activeRace.participants.length}`);
      console.log(`   Prize Pool: ${activeRace.prizePool.toLocaleString()} $PONY`);

      if (activeRace.participants.length > 0) {
        console.log('\n👥 Participants:');
        activeRace.participants.forEach((p, i) => {
          console.log(`   ${i+1}. ${p.username} - Horse #${p.horseId} ${p.horseName}`);
        });
      }
    }

    // Get total race count
    const totalRaces = await racesCollection.countDocuments();
    console.log(`\n📈 Total races in database: ${totalRaces}`);

    // Get recent races
    const recentRaces = await racesCollection.find()
      .sort({ startTime: -1 })
      .limit(3)
      .toArray();

    console.log('\n🏁 Last 3 races:');
    recentRaces.forEach((race, i) => {
      console.log(`   ${i+1}. ${race.raceId} - ${race.status} (${race.participants.length} participants)`);
    });

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

checkRace();
