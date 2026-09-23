const mongoose = require('mongoose');

const analyticsEventSchema = new mongoose.Schema({
  eventType: { type: String, enum: ['page_view', 'portfolio_view', 'service_view', 'booking_started', 'booking_submitted', 'whatsapp_click', 'phone_click', 'gallery_view'], required: true },
  page: { type: String, default: '' },
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', default: null },
  sessionId: { type: String, default: '' },
  deviceType: { type: String, default: '' },
  country: { type: String, default: '' },
  region: { type: String, default: '' },
  city: { type: String, default: '' },
  referrer: { type: String, default: '' }
}, { timestamps: true });

analyticsEventSchema.index({ createdAt: -1 });
analyticsEventSchema.index({ eventType: 1, createdAt: -1 });
analyticsEventSchema.index({ sessionId: 1, createdAt: -1 });
analyticsEventSchema.index({ page: 1, createdAt: -1 });
analyticsEventSchema.index({ service: 1, createdAt: -1 });

module.exports = mongoose.model('AnalyticsEvent', analyticsEventSchema);
