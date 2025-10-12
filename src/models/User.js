import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  username: String,
  firstName: String,
  lastName: String,
  solanaAddress: String,
  totalWon: { type: Number, default: 0 },
  racesWon: { type: Number, default: 0 },
  racesParticipated: { type: Number, default: 0 },
  airdropReceived: { type: Boolean, default: false },
  airdropAmount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('User', userSchema);