const mongoose = require('mongoose');

const ExpenseSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
  title: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 }
});

const TripSchema = new mongoose.Schema({
  name: { type: String },
  expenses: [ExpenseSchema]
});

const Trip = mongoose.model('TestTrip', TripSchema);

async function test() {
  try {
    const doc = new Trip({ name: 'Test' });
    doc.expenses.push({ title: 'Dinner', amount: 50 });
    console.log(doc.expenses);
  } catch (e) {
    console.error('Error:', e.message);
  }
}
test();
