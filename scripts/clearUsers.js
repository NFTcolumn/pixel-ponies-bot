import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function clearUsers() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;

    // Get user count before deletion
    const usersCollection = db.collection('users');
    const userCount = await usersCollection.countDocuments();

    console.log(`\n📊 Found ${userCount} users in database`);
    console.log('🗑️  Clearing users collection...');

    // Delete all users
    const result = await usersCollection.deleteMany({});

    console.log(`✅ Deleted ${result.deletedCount} users`);
    console.log('✅ Users collection cleared!');

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');

    process.exit(0);

  } catch (error) {
    console.error('❌ Failed to clear users:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

clearUsers();
