import mongoose from 'mongoose';

const learning_moduleSchema = new mongoose.Schema({
  // schema definition
});

export const learning_module = mongoose.model('learning_module', learning_moduleSchema);
