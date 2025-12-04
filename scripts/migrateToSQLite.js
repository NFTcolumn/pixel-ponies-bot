import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { initializeDatabase } from '../src/db/sqlite.js';
import UserSQLite from '../src/models/User.sqlite.js';
import RaceSQLite from '../src/models/Race.sqlite.js';
import TempSelectionSQLite from '../src/models/TempSelection.sqlite.js';

dotenv.config();

async function migrateToSQLite() {
  try {
    console.log('🚀 Starting migration from MongoDB to SQLite...\n');

    // Initialize SQLite database
    initializeDatabase();

    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;

    // Migrate Users
    console.log('👥 Migrating users...');
    const usersCollection = db.collection('users');
    const users = await usersCollection.find({}).toArray();
    console.log(`   Found ${users.length} users`);

    let userCount = 0;
    for (const user of users) {
      try {
        UserSQLite.create({
          telegramId: user.telegramId,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          baseAddress: user.baseAddress,
          twitterHandle: user.twitterHandle,
          twitterFollowVerified: user.twitterFollowVerified,
          totalWon: user.totalWon,
          racesWon: user.racesWon,
          racesParticipated: user.racesParticipated,
          raceRewardsEarned: user.raceRewardsEarned,
          airdropReceived: user.airdropReceived,
          airdropAmount: user.airdropAmount,
          referralCode: user.referralCode,
          referredBy: user.referredBy,
          referralCount: user.referralCount,
          referralEarnings: user.referralEarnings
        });
        userCount++;
      } catch (err) {
        console.log(`   ⚠️  Skipping duplicate user: ${user.telegramId}`);
      }
    }
    console.log(`✅ Migrated ${userCount} users\n`);

    // Migrate Races
    console.log('🏇 Migrating races...');
    const racesCollection = db.collection('races');
    const races = await racesCollection.find({}).toArray();
    console.log(`   Found ${races.length} races`);

    let raceCount = 0;
    for (const race of races) {
      try {
        RaceSQLite.create({
          raceId: race.raceId,
          startTime: race.startTime,
          endTime: race.endTime,
          status: race.status,
          horses: race.horses,
          winner: race.winner,
          participants: race.participants || [],
          prizePool: race.prizePool,
          totalPayout: race.totalPayout,
          temporaryMessageIds: race.temporaryMessageIds || [],
          permanentMessageIds: race.permanentMessageIds || []
        });
        raceCount++;
      } catch (err) {
        console.log(`   ⚠️  Error migrating race ${race.raceId}:`, err.message);
      }
    }
    console.log(`✅ Migrated ${raceCount} races\n`);

    // Migrate Temp Selections
    console.log('📝 Migrating temp selections...');
    const tempSelectionsCollection = db.collection('tempselections');
    const tempSelections = await tempSelectionsCollection.find({}).toArray();
    console.log(`   Found ${tempSelections.length} temp selections`);

    let tempSelectionCount = 0;
    for (const selection of tempSelections) {
      try {
        TempSelectionSQLite.create({
          userId: selection.userId,
          raceId: selection.raceId,
          horseId: selection.horseId,
          horseName: selection.horseName
        });
        tempSelectionCount++;
      } catch (err) {
        console.log(`   ⚠️  Error migrating temp selection:`, err.message);
      }
    }
    console.log(`✅ Migrated ${tempSelectionCount} temp selections\n`);

    // Summary
    console.log('🎉 Migration complete!\n');
    console.log('Summary:');
    console.log(`  👥 Users: ${userCount}/${users.length}`);
    console.log(`  🏇 Races: ${raceCount}/${races.length}`);
    console.log(`  📝 Temp Selections: ${tempSelectionCount}/${tempSelections.length}`);

    // Verify counts
    console.log('\n🔍 Verifying SQLite data...');
    console.log(`  Users in SQLite: ${UserSQLite.count()}`);
    console.log(`  Races in SQLite: ${RaceSQLite.count()}`);
    console.log(`  Temp Selections in SQLite: ${TempSelectionSQLite.count()}`);

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    console.log('\n💡 You can now update your .env to remove MONGODB_URI');
    console.log('   Your data is stored in: data/pixel-ponies.db');

    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

migrateToSQLite();
