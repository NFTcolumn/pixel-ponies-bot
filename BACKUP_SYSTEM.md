# SQLite Backup System

## Overview
Automated daily backup system for the Pixel Ponies SQLite database to ensure data persistence on Render's ephemeral filesystem.

## How It Works

### Automated Daily Backups
- **Schedule**: Runs automatically every day at **3:00 AM UTC**
- **Process**:
  1. Creates a timestamped copy of `data/pixel-ponies.db`
  2. Stores backup in `backups/sqlite/` directory
  3. Checks for database changes
  4. If changes detected, commits to git with stats
  5. Pushes to GitHub automatically
  6. Cleans up backups older than 7 days

### Manual Backup
Run a backup anytime:
```bash
npm run backup
```

## Files

### BackupService (`src/services/BackupService.js`)
- Cron scheduler that runs the backup script daily
- Integrated into bot lifecycle (starts with bot, stops on shutdown)
- Can trigger manual backups programmatically

### Backup Script (`scripts/backupSQLite.js`)
- Creates timestamped database backup
- Reports database statistics (user count, race count, file size)
- Commits changes to git with detailed message
- Maintains rolling 7-day backup window

## Benefits on Render

Render uses ephemeral storage, meaning:
- ❌ Files written during runtime are lost on restart/redeploy
- ✅ Files in git repo persist across deployments

This backup system solves the persistence problem by:
1. **Daily commits**: Database changes committed to git every day
2. **Version history**: Full git history of database changes
3. **Recovery**: Can restore to any previous day's backup
4. **Zero cost**: No external backup service needed

## Database Info

Current database: `data/pixel-ponies.db`
- **Size**: ~3.6 MB
- **Users**: 197
- **Races**: 1,509

## Monitoring

Check backup status in bot logs:
```
💾 Starting automated backup service...
✅ Daily backup scheduler started (runs at 3:00 AM UTC)
```

## Cost Savings

- **Before**: MongoDB Atlas $100/month
- **After**: SQLite $0/month
- **Annual savings**: $1,200/year! 💰
