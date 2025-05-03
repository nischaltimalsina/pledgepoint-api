import mongoose from 'mongoose';

const badgeSchema = new mongoose.Schema({
  // schema definition
});

export const badge = mongoose.model('badge', badgeSchema);
