import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function checkParticipants() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const racesCollection = db.collection('races');
    const usersCollection = db.collection('users');

    // Get current active race
    const activeRace = await racesCollection.findOne({
      status: { $in: ['betting_open', 'racing'] }
    });

    if (!activeRace) {
      console.log('❌ No active race found');
    } else {
      console.log(`✅ Active race: ${activeRace.raceId}`);
      console.log(`   Status: ${activeRace.status}`);
      console.log(`   Participants: ${activeRace.participants.length}\n`);

      if (activeRace.participants.length > 0) {
        console.log('👥 Participants in race:');
        for (const p of activeRace.participants) {
          console.log(`\n   User ID: ${p.userId}`);
          console.log(`   Username: ${p.username}`);
          console.log(`   Horse: #${p.horseId} ${p.horseName}`);

          // Check if this user exists in users collection
          const user = await usersCollection.findOne({ telegramId: p.userId });
          if (user) {
            console.log(`   ✅ Found in users DB`);
            console.log(`      Username: ${user.username || 'N/A'}`);
            console.log(`      First Name: ${user.firstName || 'N/A'}`);
            console.log(`      Base Address: ${user.baseAddress ? user.baseAddress.slice(0, 10) + '...' : 'NOT SET'}`);
            console.log(`      Twitter Verified: ${user.twitterFollowVerified ? 'Yes' : 'No'}`);
          } else {
            console.log(`   ❌ NOT found in users DB`);
          }
        }
      }
    }

    // Check all registered users
    const allUsers = await usersCollection.find({}).toArray();
    console.log(`\n\n📊 Total registered users: ${allUsers.length}\n`);

    for (const user of allUsers) {
      console.log(`User: ${user.telegramId}`);
      console.log(`  Username: ${user.username || 'N/A'}`);
      console.log(`  First Name: ${user.firstName || 'N/A'}`);
      console.log(`  Base Address: ${user.baseAddress ? user.baseAddress.slice(0, 10) + '...' : 'NOT SET'}`);
      console.log(`  Twitter Verified: ${user.twitterFollowVerified ? 'Yes' : 'No'}`);
      console.log(`  Airdrop Received: ${user.airdropReceived ? 'Yes' : 'No'}`);
      console.log('');
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

checkParticipants();
