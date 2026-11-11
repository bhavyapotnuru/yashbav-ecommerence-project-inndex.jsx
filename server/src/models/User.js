import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['customer', 'merchant', 'admin'], default: 'customer' },
  merchantApproved: { type: Boolean, default: false },
  phone: { type: String, trim: true, default: '' },
  addresses: [{ label: String, fullName: String, phone: String, line1: String, line2: String, city: String, state: String, postalCode: String, isDefault: Boolean }],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });
export default mongoose.model('User', schema);
