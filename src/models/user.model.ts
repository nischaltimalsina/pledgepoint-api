import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  // schema definition
});

export const user = mongoose.model('user', userSchema);
