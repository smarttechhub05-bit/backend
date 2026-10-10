const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, default: '', trim: true, maxlength: 500 },
  image: { type: String, default: '', trim: true, maxlength: 500 },
  discountPercentage: { type: Number, min: 1, max: 100, default: 0 },
  serviceScope: { type: String, enum: ['all', 'selected'], default: 'all' },
  services: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }],
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  active: { type: Boolean, default: false },
  published: { type: Boolean, default: false },
  buttonText: { type: String, default: '', trim: true, maxlength: 80 },
  buttonLink: { type: String, default: '', trim: true, maxlength: 500 },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('Promotion', promotionSchema);
