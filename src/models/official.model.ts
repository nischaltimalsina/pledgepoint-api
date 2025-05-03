import mongoose from 'mongoose';

const officialSchema = new mongoose.Schema({
  // schema definition
});

export const official = mongoose.model('official', officialSchema);
