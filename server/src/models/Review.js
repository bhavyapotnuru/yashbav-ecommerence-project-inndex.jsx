import mongoose from 'mongoose';
const schema = new mongoose.Schema({ product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true }, customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' }, rating: { type: Number, min: 1, max: 5, required: true }, title: { type: String, maxlength: 120, default: '' }, comment: { type: String, maxlength: 1500, default: '' } }, { timestamps: true });
schema.index({ product: 1, customer: 1 }, { unique: true });
export default mongoose.model('Review', schema);
