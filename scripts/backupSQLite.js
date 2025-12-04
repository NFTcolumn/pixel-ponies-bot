import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function backupSQLite() {
  try {
    console.log('🔄 Starting SQLite backup...');

    const dbPath = path.join(__dirname, '../data/pixel-ponies.db');
    const backupDir = path.join(__dirname, '../backups/sqlite');

    // Create backup directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      console.log('📁 Created backup directory');
    }

    // Check if database exists
    if (!fs.existsSync(dbPath)) {
      console.error('❌ Database file not found:', dbPath);
      process.exit(1);
    }

    // Get database stats
    const db = new Database(dbPath, { readonly: true });
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const raceCount = db.prepare('SELECT COUNT(*) as count FROM races').get().count;
    db.close();

    console.log(`📊 Database stats:`);
    console.log(`   Users: ${userCount}`);
    console.log(`   Races: ${raceCount}`);

    // Create timestamped backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupFile = path.join(backupDir, `backup_${timestamp}.db`);

    // Copy database file
    fs.copyFileSync(dbPath, backupFile);
    console.log(`✅ Database backed up to: ${backupFile}`);

    // Get file size
    const stats = fs.statSync(backupFile);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`💾 Backup size: ${fileSizeInMB} MB`);

    // Commit to git (if in a git repo)
    try {
      const gitRoot = path.join(__dirname, '..');
      process.chdir(gitRoot);

      // Check if there are changes
      const status = execSync('git status --porcelain data/pixel-ponies.db', { encoding: 'utf8' });

      if (status.trim()) {
        console.log('\n📝 Committing database backup to git...');

        execSync('git add data/pixel-ponies.db');

        const commitMessage = `Automated daily backup: ${userCount} users, ${raceCount} races

Database size: ${fileSizeInMB} MB
Timestamp: ${new Date().toISOString()}

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>`;

        execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`);
        console.log('✅ Changes committed to git');

        // Push to remote (with error handling)
        try {
          execSync('git push origin main', { stdio: 'inherit' });
          console.log('✅ Pushed to remote repository');
        } catch (pushError) {
          console.warn('⚠️  Failed to push to remote:', pushError.message);
          console.warn('   Commit is saved locally, will push on next sync');
        }
      } else {
        console.log('✅ No database changes detected, skipping git commit');
      }
    } catch (gitError) {
      console.warn('⚠️  Git commit skipped:', gitError.message);
    }

    // Clean up old backups (keep last 7 days)
    const backupFiles = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup_') && f.endsWith('.db'))
      .map(f => ({
        name: f,
        path: path.join(backupDir, f),
        time: fs.statSync(path.join(backupDir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);

    const keepCount = 7;
    if (backupFiles.length > keepCount) {
      console.log(`\n🧹 Cleaning up old backups (keeping last ${keepCount})...`);
      const toDelete = backupFiles.slice(keepCount);
      toDelete.forEach(file => {
        fs.unlinkSync(file.path);
        console.log(`   Deleted: ${file.name}`);
      });
      console.log(`✅ Cleaned up ${toDelete.length} old backup(s)`);
    }

    console.log('\n🎉 Backup completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  }
}

backupSQLite();
