import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  slug: { type: String, index: true },
  description: { type: String, default: '', maxlength: 5000 },
  category: { type: String, required: true, enum: ['Electronics','Fashion','Lifestyle','Home'] },
  subcategory: { type: String, default: '' },
  brand: { type: String, trim: true, maxlength: 100, default: '' },
  price: { type: Number, required: true, min: 0 },
  compareAtPrice: { type: Number, min: 0, default: 0 },
  image: { type: String, default: '' },
  images: [{ type: String }],
  cloudinaryPublicId: { type: String, default: '' },
  stock: { type: Number, default: 0, min: 0 },
  sku: { type: String, trim: true, default: '' },
  featured: { type: Boolean, default: false },
  bestSeller: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  reviewCount: { type: Number, default: 0 },
  merchant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });
schema.index({ name: 'text', description: 'text', category: 'text' });
export default mongoose.model('Product', schema);
