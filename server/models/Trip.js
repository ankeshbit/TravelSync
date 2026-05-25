const mongoose = require('mongoose');

const PlaceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String, required: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  dayNumber: { type: Number, required: true },
  orderIndex: { type: Number, required: true },
  category: { type: String, enum: ['attraction', 'food', 'hotel', 'transport', 'activity'], default: 'attraction' },
  duration: { type: Number, default: 60 },
  note: { type: String, default: "" }
});

const ExpenseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: "INR" },
  category: { type: String, enum: ['food', 'transport', 'accommodation', 'activity', 'shopping', 'other'], default: 'other' },
  receiptUrl: { type: String, default: '' },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  splitAmong: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
});

const TripSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  destination: { type: String, required: true, trim: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, enum: ['planning', 'active', 'completed'], default: 'planning' },
  coverImageUrl: { type: String, default: '' },
  budgetPerPerson: { type: Number, default: 0 },
  currency: { type: String, default: 'INR' },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  places: [PlaceSchema],
  expenses: [ExpenseSchema],
  activity: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      action: { type: String },
      detail: { type: String },
      createdAt: { type: Date, default: Date.now }
    }
  ],
  createdAt: { type: Date, default: Date.now }
});

TripSchema.virtual('durationDays').get(function () {
  if (!this.startDate || !this.endDate) {
    return 0;
  }

  const start = new Date(this.startDate);
  const end = new Date(this.endDate);
  const diffInMs = end.getTime() - start.getTime();

  if (Number.isNaN(diffInMs)) {
    return 0;
  }

  return Math.max(0, Math.ceil(diffInMs / (1000 * 60 * 60 * 24)) + 1);
});

TripSchema.index({ ownerId: 1, createdAt: -1 });
TripSchema.index({ members: 1 });

module.exports = mongoose.model('Trip', TripSchema);
