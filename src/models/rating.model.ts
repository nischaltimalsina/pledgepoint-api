import mongoose from 'mongoose';

const ratingSchema = new mongoose.Schema({
  // schema definition
});

export const rating = mongoose.model('rating', ratingSchema);
