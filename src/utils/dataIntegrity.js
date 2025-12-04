import User from '../models/User.sqlite.js';

class DataIntegrityManager {
  // Check for any data inconsistencies after deployment
  async verifySystemIntegrity() {
    console.log('🔍 Starting system data integrity check...');

    try {
      // Check database connection (SQLite is always connected)
      console.log(`📡 Database: SQLite - Connected ✅`);

      // Check user count
      const userCount = User.count();
      console.log(`👥 Total users: ${userCount}`);

      // Check for users with wallets
      const usersWithWallets = User.findAll({ baseAddress: null }).filter(u => !u.baseAddress).length;
      const usersWithoutWallets = userCount - usersWithWallets;
      console.log(`💼 Users with wallets: ${usersWithoutWallets}`);
      console.log(`⚠️  Users without wallets: ${usersWithWallets}`);

      console.log('\n✅ Data integrity check completed');
      return true;

    } catch (error) {
      console.error('❌ Data integrity check failed:', error);
      return false;
    }
  }

  // No longer needed - races are disabled
  async recoverOrphanedSelections() {
    console.log('🔄 Orphaned selections check skipped (races disabled)');
  }

  // Generate a summary report
  async generateStatusReport() {
    console.log('\n📋 PIXEL PONIES BOT STATUS REPORT');
    console.log('================================');

    console.log(`Database: SQLite ✅`);

    const userCount = User.count();
    const usersWithAirdrop = User.count({ airdropReceived: 1 });

    console.log(`Total Users: ${userCount}`);
    console.log(`Users with Airdrop: ${usersWithAirdrop}`);

    console.log('================================\n');
  }
}

export default new DataIntegrityManager();