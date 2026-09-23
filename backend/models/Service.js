const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, enum: ['Photography', 'Videography', 'Events', 'Portraits', 'Weddings', 'Commercial', 'Other'], required: true },
  description: { type: String, default: '' },
  price: { type: Number, min: 0, default: 0 },
  image: { type: String, default: '' },
  duration: { type: String, default: '' },
  active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Service', serviceSchema);
