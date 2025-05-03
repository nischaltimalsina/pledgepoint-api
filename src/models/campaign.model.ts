import mongoose from 'mongoose';

const campaignSchema = new mongoose.Schema({
  // schema definition
});

export const campaign = mongoose.model('campaign', campaignSchema);
