import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema({
  // schema definition
});

export const activity = mongoose.model('activity', activitySchema);
