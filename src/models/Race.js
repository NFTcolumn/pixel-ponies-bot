import mongoose from 'mongoose';

const raceSchema = new mongoose.Schema({
  raceId: { type: String, required: true, unique: true },
  startTime: { type: Date, required: true },
  endTime: Date,
  status: { 
    type: String, 
    enum: ['upcoming', 'betting_open', 'racing', 'finished'], 
    default: 'upcoming' 
  },
  horses: [{
    id: Number,
    name: String,
    emoji: String,
    odds: Number,
    finishTime: Number,
    position: Number
  }],
  winner: {
    horseId: Number,
    horseName: String
  },
  participants: [{
    userId: { type: String, required: true },
    username: { type: String, required: true },
    horseId: { type: Number, required: true },
    horseName: { type: String, required: true },
    tweetUrl: String,
    joinedAt: { type: Date, default: Date.now },
    payout: { type: Number, default: 0 }
  }],
  prizePool: { type: Number, default: 700 },
  totalPayout: { type: Number, default: 0 }
});

export default mongoose.model('Race', raceSchema);