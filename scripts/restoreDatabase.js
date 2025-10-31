import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function restoreDatabase() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    // List available backups
    const backupsDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupsDir)) {
      console.error('❌ No backups directory found!');
      process.exit(1);
    }

    const backupFiles = fs.readdirSync(backupsDir).filter(f => f.endsWith('.json'));
    if (backupFiles.length === 0) {
      console.error('❌ No backup files found!');
      process.exit(1);
    }

    console.log('📦 Available backups:');
    backupFiles.forEach((file, i) => {
      const filePath = path.join(backupsDir, file);
      const stats = fs.statSync(filePath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`  ${i + 1}. ${file} (${sizeMB} MB) - ${stats.mtime.toLocaleString()}`);
    });

    rl.question('\nEnter backup number to restore (or 0 to cancel): ', async (answer) => {
      try {
        const choice = parseInt(answer);

        if (choice === 0 || isNaN(choice) || choice < 1 || choice > backupFiles.length) {
          console.log('❌ Cancelled or invalid choice');
          rl.close();
          process.exit(0);
        }

        const backupFile = path.join(backupsDir, backupFiles[choice - 1]);
        console.log(`\n📂 Loading backup: ${backupFiles[choice - 1]}`);

        // Read backup
        const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
        const collections = Object.keys(backupData);

        console.log(`📊 Backup contains ${collections.length} collections`);

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;

        // Restore each collection
        for (const collectionName of collections) {
          const documents = backupData[collectionName];
          if (documents.length === 0) {
            console.log(`⏭️  Skipping empty collection: ${collectionName}`);
            continue;
          }

          console.log(`📥 Restoring ${collectionName} (${documents.length} docs)...`);

          const collection = db.collection(collectionName);

          // Clear existing data
          await collection.deleteMany({});

          // Insert backup data
          if (documents.length > 0) {
            await collection.insertMany(documents);
          }

          console.log(`   ✅ Restored ${documents.length} documents`);
        }

        console.log('\n✅ Restore completed!');
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');

        rl.close();
        process.exit(0);

      } catch (error) {
        console.error('❌ Restore error:', error);
        rl.close();
        await mongoose.disconnect();
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('❌ Failed to list backups:', error);
    rl.close();
    process.exit(1);
  }
}

restoreDatabase();
