import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function finishStaleRaces() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const racesCollection = db.collection('races');

    // Find races that are not finished and are older than 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const staleRaces = await racesCollection.find({
      status: { $ne: 'finished' },
      startTime: { $lt: oneHourAgo }
    }).toArray();

    console.log(`🔍 Found ${staleRaces.length} stale race(s)\n`);

    if (staleRaces.length === 0) {
      console.log('✅ No stale races to clean up!');
    } else {
      for (const race of staleRaces) {
        console.log(`🏁 Finishing stale race: ${race.raceId}`);
        console.log(`   Started: ${race.startTime}`);
        console.log(`   Status: ${race.status}`);
        console.log(`   Participants: ${race.participants.length}`);

        // Mark race as finished
        await racesCollection.updateOne(
          { _id: race._id },
          {
            $set: {
              status: 'finished',
              endTime: new Date()
            }
          }
        );

        console.log(`   ✅ Marked as finished\n`);
      }

      console.log(`✅ Cleaned up ${staleRaces.length} stale race(s)!`);
    }

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

finishStaleRaces();
