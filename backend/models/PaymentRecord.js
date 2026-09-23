const mongoose = require('mongoose');

const paymentRecordSchema = new mongoose.Schema({
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
  amount: { type: Number, required: true, min: 0 },
  paymentMethod: { type: String, enum: ['Cash', 'Mobile Money', 'Bank Transfer', 'Other'], required: true },
  paymentDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'partial', 'paid'], default: 'pending' },
  reference: { type: String, default: '' },
  notes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('PaymentRecord', paymentRecordSchema);
