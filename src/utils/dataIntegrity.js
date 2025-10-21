import mongoose from 'mongoose';
import Race from '../models/Race.js';
import TempSelection from '../models/TempSelection.js';

class DataIntegrityManager {
  // Check for any data inconsistencies after deployment
  async verifySystemIntegrity() {
    console.log('🔍 Starting system data integrity check...');
    
    try {
      // Check database connection
      const dbState = mongoose.connection.readyState;
      const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
      console.log(`📡 Database state: ${states[dbState]}`);
      
      if (dbState !== 1) {
        console.error('❌ Database not connected properly!');
        return false;
      }
      
      // Check for active races
      const activeRaces = await Race.find({ status: { $in: ['betting_open', 'racing'] } });
      console.log(`🏁 Active races found: ${activeRaces.length}`);
      
      for (const race of activeRaces) {
        console.log(`\n🔍 Checking race ${race.raceId}:`);
        console.log(`  - Status: ${race.status}`);
        console.log(`  - Participants: ${race.participants.length}`);
        console.log(`  - Prize Pool: ${race.prizePool}`);
        console.log(`  - Created: ${race.createdAt}`);
        
        // Check for orphaned temp selections
        const tempSelections = await TempSelection.find({ raceId: race.raceId });
        console.log(`  - Temp Selections: ${tempSelections.length}`);
        
        if (tempSelections.length > 0) {
          console.log('  📋 Found temp selections not yet converted to participants:');
          tempSelections.forEach((temp, i) => {
            console.log(`    ${i+1}. User ${temp.userId} - Horse #${temp.horseId} ${temp.horseName}`);
          });
        }
        
        // Check for participants without corresponding horses
        const invalidParticipants = race.participants.filter(p => 
          !race.horses.find(h => h.id === p.horseId)
        );
        
        if (invalidParticipants.length > 0) {
          console.warn(`  ⚠️ Found ${invalidParticipants.length} participants with invalid horse IDs`);
          invalidParticipants.forEach(p => {
            console.warn(`    - ${p.username}: Horse #${p.horseId} (not found in race horses)`);
          });
        }
      }
      
      // Check for finished races with unusual data
      const recentFinishedRaces = await Race.find({ 
        status: 'finished',
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      }).sort({ createdAt: -1 }).limit(10);
      
      console.log(`\n📊 Recent finished races (last 24h): ${recentFinishedRaces.length}`);
      
      let racesWithZeroParticipants = 0;
      recentFinishedRaces.forEach((race, i) => {
        const participantCount = race.participants.length;
        console.log(`  ${i+1}. ${race.raceId} - Participants: ${participantCount}, Prize: ${race.prizePool}`);
        
        if (participantCount === 0) {
          racesWithZeroParticipants++;
          console.warn(`    ⚠️ This race had 0 participants - possible data loss during deployment`);
        }
      });
      
      if (racesWithZeroParticipants > 0) {
        console.warn(`🚨 Found ${racesWithZeroParticipants} recent races with 0 participants - investigate potential data loss`);
      }
      
      console.log('\n✅ Data integrity check completed');
      return true;
      
    } catch (error) {
      console.error('❌ Data integrity check failed:', error);
      return false;
    }
  }
  
  // Migrate any orphaned temp selections to main race data
  async recoverOrphanedSelections() {
    console.log('🔄 Checking for orphaned temp selections to recover...');
    
    try {
      const tempSelections = await TempSelection.find({});
      console.log(`Found ${tempSelections.length} temp selections`);
      
      if (tempSelections.length === 0) {
        console.log('No temp selections to process');
        return;
      }
      
      for (const temp of tempSelections) {
        // Check if race still exists and is active
        const race = await Race.findOne({ 
          raceId: temp.raceId,
          status: { $in: ['betting_open', 'racing'] }
        });
        
        if (!race) {
          console.log(`⚠️ Temp selection for inactive/missing race ${temp.raceId}, cleaning up`);
          await TempSelection.deleteOne({ _id: temp._id });
          continue;
        }
        
        // Check if participant already exists in race
        const existingParticipant = race.participants.find(p => p.userId === temp.userId);
        if (existingParticipant) {
          console.log(`✅ User ${temp.userId} already in race ${temp.raceId}, cleaning up temp`);
          await TempSelection.deleteOne({ _id: temp._id });
          continue;
        }
        
        console.log(`🔄 Found orphaned temp selection: User ${temp.userId} for race ${temp.raceId}`);
        console.log(`   This might indicate user selected horse but verification was interrupted`);
        // Note: Don't auto-migrate without tweet verification - just log for manual review
      }
      
    } catch (error) {
      console.error('❌ Failed to recover orphaned selections:', error);
    }
  }
  
  // Generate a summary report
  async generateStatusReport() {
    console.log('\n📋 PIXEL PONIES BOT STATUS REPORT');
    console.log('================================');
    
    const dbState = mongoose.connection.readyState;
    const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
    console.log(`Database: ${states[dbState]} ${dbState === 1 ? '✅' : '❌'}`);
    
    const activeRaces = await Race.countDocuments({ status: { $in: ['betting_open', 'racing'] } });
    const totalRaces = await Race.countDocuments({});
    const tempSelections = await TempSelection.countDocuments({});
    
    console.log(`Active Races: ${activeRaces}`);
    console.log(`Total Races: ${totalRaces}`);
    console.log(`Pending Selections: ${tempSelections}`);
    
    if (activeRaces > 0) {
      const raceDetails = await Race.find({ status: { $in: ['betting_open', 'racing'] } });
      raceDetails.forEach(race => {
        console.log(`  🏁 ${race.raceId}: ${race.participants.length} participants, ${race.prizePool} $PONY`);
      });
    }
    
    console.log('================================\n');
  }
}

export default new DataIntegrityManager();