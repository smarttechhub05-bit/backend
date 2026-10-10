const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  package: { type: mongoose.Schema.Types.ObjectId, ref: 'Package', default: null },
  serviceSnapshot: {
    name: { type: String, default: '' },
    price: { type: Number, default: 0 },
    duration: { type: String, default: '' }
  },
  packageSnapshot: {
    name: { type: String, default: '' },
    price: { type: Number, default: 0 },
    duration: { type: String, default: '' }
  },
  pricingSnapshot: {
    promotion: { type: mongoose.Schema.Types.ObjectId, ref: 'Promotion', default: null },
    promotionTitle: { type: String, default: '' },
    discountPercentage: { type: Number, min: 0, max: 100, default: 0 },
    originalPrice: { type: Number, min: 0, default: 0 },
    discountAmount: { type: Number, min: 0, default: 0 },
    finalPrice: { type: Number, min: 0, default: 0 }
  },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
  preferredDate: { type: Date, required: true },
  preferredTime: { type: String, default: '' },
  eventType: { type: String, default: '' },
  message: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'confirmed', 'completed', 'cancelled', 'rescheduled'], default: 'pending' },
  assignedStaff: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  notes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
