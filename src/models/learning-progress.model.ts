import mongoose from 'mongoose';

const learning_progressSchema = new mongoose.Schema({
  // schema definition
});

export const learning_progress = mongoose.model('learning_progress', learning_progressSchema);
