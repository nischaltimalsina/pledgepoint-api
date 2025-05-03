import mongoose from 'mongoose';

const districtSchema = new mongoose.Schema({
  // schema definition
});

export const district = mongoose.model('district', districtSchema);
