import mongoose from 'mongoose';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function clearDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    console.log('\n📊 Available collections:');
    collections.forEach((col, i) => {
      console.log(`  ${i + 1}. ${col.name}`);
    });

    console.log('\n⚠️  WARNING: This will DELETE ALL DATA from selected collections!');
    console.log('\nOptions:');
    console.log('  1. Clear Users only');
    console.log('  2. Clear Races only');
    console.log('  3. Clear TempSelections only');
    console.log('  4. Clear ALL collections');
    console.log('  5. Cancel');

    rl.question('\nEnter your choice (1-5): ', async (answer) => {
      try {
        switch(answer.trim()) {
          case '1':
            await db.collection('users').deleteMany({});
            console.log('✅ Cleared Users collection');
            break;

          case '2':
            await db.collection('races').deleteMany({});
            console.log('✅ Cleared Races collection');
            break;

          case '3':
            await db.collection('tempselections').deleteMany({});
            console.log('✅ Cleared TempSelections collection');
            break;

          case '4':
            rl.question('⚠️  Type "DELETE ALL" to confirm: ', async (confirm) => {
              if (confirm === 'DELETE ALL') {
                await db.collection('users').deleteMany({});
                await db.collection('races').deleteMany({});
                await db.collection('tempselections').deleteMany({});
                console.log('✅ Cleared ALL collections');
              } else {
                console.log('❌ Cancelled - confirmation text did not match');
              }
              await cleanup();
            });
            return;

          case '5':
            console.log('❌ Cancelled');
            break;

          default:
            console.log('❌ Invalid choice');
        }

        await cleanup();
      } catch (error) {
        console.error('❌ Error:', error);
        await cleanup();
      }
    });

  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

async function cleanup() {
  rl.close();
  await mongoose.disconnect();
  console.log('✅ Disconnected from MongoDB');
  process.exit(0);
}

clearDatabase();
