import mongoose from 'mongoose';

const promiseSchema = new mongoose.Schema({
  // schema definition
});

export const promise = mongoose.model('promise', promiseSchema);
