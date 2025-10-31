import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function backupDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    console.log('📊 Found collections:', collections.map(c => c.name).join(', '));

    // Create backups directory if it doesn't exist
    const backupsDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir);
      console.log('📁 Created backups directory');
    }

    // Create timestamped backup filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupFile = path.join(backupsDir, `backup_${timestamp}.json`);

    const backup = {};

    // Backup each collection
    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      console.log(`📦 Backing up ${collectionName}...`);

      const collection = db.collection(collectionName);
      const documents = await collection.find({}).toArray();

      backup[collectionName] = documents;
      console.log(`   ✅ Backed up ${documents.length} documents`);
    }

    // Write backup to file
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
    console.log(`\n✅ Backup completed!`);
    console.log(`📄 File: ${backupFile}`);
    console.log(`📊 Total collections: ${collections.length}`);

    // Calculate total documents
    const totalDocs = Object.values(backup).reduce((sum, docs) => sum + docs.length, 0);
    console.log(`📑 Total documents: ${totalDocs}`);

    // File size
    const stats = fs.statSync(backupFile);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`💾 File size: ${fileSizeInMB} MB`);

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);

  } catch (error) {
    console.error('❌ Backup failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

backupDatabase();
