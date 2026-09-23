const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignmentRole: { type: String, enum: ['photographer', 'videographer', 'editor'], required: true }
}, { _id: false });

const projectSchema = new mongoose.Schema({
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null, unique: true, sparse: true },
  title: { type: String, required: true, trim: true },
  projectType: { type: String, default: '' },
  type: { type: String, default: '' },
  description: { type: String, default: '' },
  shootDate: { type: Date, required: true },
  startTime: { type: String, default: '' },
  endTime: { type: String, default: '' },
  location: { type: String, default: '' },
  assignments: { type: [assignmentSchema], default: [] },
  // Retained for compatibility with Day 2 records; new assignments also sync this field.
  assignedStaff: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  description: { type: String, default: '' },
  status: { type: String, enum: ['scheduled', 'upcoming', 'in-progress', 'editing', 'completed', 'delivered', 'cancelled'], default: 'scheduled' },
  notes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);
