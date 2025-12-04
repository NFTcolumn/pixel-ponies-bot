import cron from 'node-cron';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class BackupService {
  constructor() {
    this.cronJob = null;
  }

  /**
   * Start automated daily backups
   * Runs every day at 3:00 AM UTC
   */
  start() {
    // Schedule daily backup at 3:00 AM UTC
    this.cronJob = cron.schedule('0 3 * * *', async () => {
      console.log('🔄 Running scheduled database backup...');
      try {
        await this.runBackup();
        console.log('✅ Scheduled backup completed successfully');
      } catch (error) {
        console.error('❌ Scheduled backup failed:', error);
      }
    });

    console.log('✅ Daily backup scheduler started (runs at 3:00 AM UTC)');
  }

  /**
   * Stop the backup scheduler
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      console.log('🛑 Backup scheduler stopped');
    }
  }

  /**
   * Run backup manually
   */
  async runBackup() {
    try {
      const scriptPath = path.join(__dirname, '../../scripts/backupSQLite.js');
      const { stdout, stderr } = await execAsync(`node ${scriptPath}`);

      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);

      return { success: true, output: stdout };
    } catch (error) {
      console.error('❌ Backup execution failed:', error);
      throw error;
    }
  }

  /**
   * Get backup status
   */
  getStatus() {
    return {
      isRunning: this.cronJob ? true : false,
      schedule: '3:00 AM UTC daily',
      nextRun: this.cronJob ? 'Scheduled' : 'Not scheduled'
    };
  }
}

export default BackupService;
