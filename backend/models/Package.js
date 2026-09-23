const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  description: { type: String, default: '' },
  price: { type: Number, min: 0, default: 0 },
  features: { type: [String], default: [] },
  selectionLimit: { type: Number, min: 0, default: null },
  duration: { type: String, default: '' },
  image: { type: String, default: '' },
  active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Package', packageSchema);
