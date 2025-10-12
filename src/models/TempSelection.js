import mongoose from 'mongoose';

const tempSelectionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  raceId: { type: String, required: true },
  horseId: { type: Number, required: true },
  horseName: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 3600 } // Auto-delete after 1 hour
});

// Ensure one selection per user per race
tempSelectionSchema.index({ userId: 1, raceId: 1 }, { unique: true });

export default mongoose.model('TempSelection', tempSelectionSchema);