import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function checkUser() {
  const userId = process.argv[2];

  if (!userId) {
    console.log('Usage: node scripts/checkUser.js <telegram_user_id>');
    console.log('Example: node scripts/checkUser.js 123456789');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ telegramId: userId });

    if (!user) {
      console.log(`❌ No user found with ID: ${userId}`);
      console.log('\n📊 Total users in database:', await usersCollection.countDocuments());
    } else {
      console.log(`✅ Found user: ${user.username || user.firstName}`);
      console.log('\n📋 User Details:');
      console.log(`   Telegram ID: ${user.telegramId}`);
      console.log(`   Username: @${user.username || 'not set'}`);
      console.log(`   First Name: ${user.firstName || 'not set'}`);
      console.log(`   Base Address: ${user.baseAddress || '❌ NOT SET'}`);
      console.log(`   Twitter Handle: @${user.twitterHandle || 'not set'}`);
      console.log(`   Twitter Verified: ${user.twitterFollowVerified ? '✅ Yes' : '❌ No'}`);
      console.log(`   Airdrop Received: ${user.airdropReceived ? '✅ Yes' : '❌ No'}`);
      console.log(`   Referral Code: ${user.referralCode || 'not set'}`);
      console.log(`   Races Participated: ${user.racesParticipated || 0}`);
      console.log(`   Total Won: ${user.totalWon || 0} $PONY`);
      console.log(`   Created: ${user.createdAt}`);

      console.log('\n🔍 Registration Status:');
      const hasWallet = !!user.baseAddress;
      const hasTwitter = !!user.twitterFollowVerified;

      console.log(`   ${hasWallet ? '✅' : '❌'} Has wallet address`);
      console.log(`   ${hasTwitter ? '✅' : '❌'} Twitter verified`);
      console.log(`   ${hasWallet && hasTwitter ? '✅ FULLY REGISTERED' : '⚠️  INCOMPLETE REGISTRATION'}`);
    }

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

checkUser();
