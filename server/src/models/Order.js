import mongoose from 'mongoose';
const itemSchema = new mongoose.Schema({ product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }, name: String, image: String, price: Number, quantity: Number, merchant: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, status: { type: String, enum: ['placed','processing','shipped','delivered','cancelled'], default: 'placed' } }, { _id: false });
const schema = new mongoose.Schema({
  orderNumber: { type: String, unique: true, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  items: [itemSchema], subtotal: { type: Number, required: true }, deliveryFee: { type: Number, default: 0 }, discount: { type: Number, default: 0 }, tax: { type: Number, default: 0 }, total: { type: Number, required: true },
  status: { type: String, enum: ['placed','processing','shipped','delivered','cancelled'], default: 'placed', index: true },
  address: { type: String, required: true }, paymentMethod: { type: String, enum: ['cod','simulated'], default: 'cod' }, paymentStatus: { type: String, enum: ['pending','paid','failed','refunded'], default: 'pending' }, paymentReference: { type: String, default: '' }, couponCode: { type: String, default: '' }, statusHistory: [{ status: String, note: String, at: { type: Date, default: Date.now } }]
}, { timestamps: true });
schema.pre('validate', function(next) { if (!this.orderNumber) this.orderNumber = `NX${Date.now().toString().slice(-8)}${Math.floor(Math.random()*900+100)}`; next(); });
export default mongoose.model('Order', schema);
