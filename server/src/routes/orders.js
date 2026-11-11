import { Router } from 'express';
import mongoose from 'mongoose';
import Coupon from '../models/Coupon.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import { auth, roles, approvedMerchant } from '../middleware/auth.js';

const r = Router();
const deliveryThreshold = Math.max(0, Number(process.env.FREE_DELIVERY_THRESHOLD) || 4999);
const deliveryFeeSetting = Math.max(0, Number(process.env.DELIVERY_FEE) || 99);
const transitions = { placed: ['processing'], processing: ['shipped'], shipped: ['delivered'], delivered: [], cancelled: [] };

function overallStatus(items) {
  const states = items.map(item => item.status || 'placed');
  if (states.every(status => status === 'delivered')) return 'delivered';
  if (states.every(status => status === 'cancelled')) return 'cancelled';
  if (states.some(status => status === 'shipped')) return 'shipped';
  if (states.some(status => status === 'processing')) return 'processing';
  return 'placed';
}

r.post('/', auth, roles('customer'), async (req, res) => {
  const { items, address, paymentMethod = 'cod', couponCode = '' } = req.body;
  const shippingAddress = String(address || '').trim();
  if (!Array.isArray(items) || !items.length || items.length > 30 || shippingAddress.length < 8 || shippingAddress.length > 1000) {
    return res.status(400).json({ message: 'Add items and a complete delivery address (8–1000 characters).' });
  }
  if (!['cod', 'simulated'].includes(paymentMethod)) return res.status(400).json({ message: 'Unsupported payment method.' });

  const quantities = new Map();
  for (const item of items) {
    const id = String(item?.product || '');
    const quantity = Number(item?.quantity);
    if (!mongoose.Types.ObjectId.isValid(id) || !Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ message: 'One or more cart items are invalid.' });
    }
    const totalQuantity = (quantities.get(id) || 0) + quantity;
    if (totalQuantity > 20) return res.status(400).json({ message: 'Maximum quantity per product is 20.' });
    quantities.set(id, totalQuantity);
  }

  const normalizedCoupon = String(couponCode || '').trim().toUpperCase();

  const reserved = [];
  let reservedCoupon = null;
  try {
    const orderItems = [];
    let subtotal = 0;
    for (const [productId, quantity] of quantities) {
      const product = await Product.findOneAndUpdate(
        { _id: productId, isActive: true, stock: { $gte: quantity } },
        { $inc: { stock: -quantity } },
        { new: true }
      );
      if (!product) throw Object.assign(new Error('A product is unavailable or has insufficient stock.'), { status: 400 });
      reserved.push({ id: product._id, quantity });
      orderItems.push({
        product: product._id,
        name: product.name,
        image: product.image,
        price: product.price,
        quantity,
        merchant: product.merchant
      });
      subtotal += product.price * quantity;
    }

    let discount = 0;
    if (normalizedCoupon) {
      const coupon = await Coupon.findOne({ code: normalizedCoupon });
      if (!coupon || !coupon.isActive || (coupon.expiresAt && coupon.expiresAt <= new Date()) || subtotal < coupon.minimumSubtotal) {
        throw Object.assign(new Error('Coupon is invalid, expired or does not meet the minimum subtotal.'), { status: 400 });
      }
      const couponFilter = { _id: coupon._id, isActive: true };
      if (coupon.usageLimit !== null && coupon.usageLimit !== undefined) couponFilter.usedCount = { $lt: coupon.usageLimit };
      if (coupon.expiresAt) couponFilter.expiresAt = { $gt: new Date() };
      const claimedCoupon = await Coupon.findOneAndUpdate(couponFilter, { $inc: { usedCount: 1 } }, { new: true });
      if (!claimedCoupon) throw Object.assign(new Error('Coupon usage limit has been reached.'), { status: 400 });
      reservedCoupon = claimedCoupon._id;
      discount = Math.min(Math.round(subtotal * claimedCoupon.discountPercent / 100), claimedCoupon.maxDiscount);
    }
    const deliveryFee = subtotal - discount >= deliveryThreshold ? 0 : deliveryFeeSetting;
    const tax = Math.round((subtotal - discount) * 0.05 * 100) / 100;
    const total = subtotal - discount + tax + deliveryFee;
    const order = await Order.create({
      customer: req.user.id,
      items: orderItems,
      subtotal,
      deliveryFee,
      discount,
      tax,
      total,
      address: shippingAddress,
      paymentMethod,
      paymentStatus: paymentMethod === 'simulated' ? 'paid' : 'pending',
      paymentReference: paymentMethod === 'simulated' ? `DEMO-${Date.now()}` : '',
      couponCode: normalizedCoupon,
      statusHistory: [{ status: 'placed', note: 'Order placed' }]
    });
    reservedCoupon = null;
    res.status(201).json(order);
  } catch (error) {
    await Promise.all(reserved.map(({ id, quantity }) => Product.updateOne({ _id: id }, { $inc: { stock: quantity } })));
    if (reservedCoupon) await Coupon.updateOne({ _id: reservedCoupon }, { $inc: { usedCount: -1 } });
    if (error.status) return res.status(error.status).json({ message: error.message });
    throw error;
  }
});

r.get('/mine', auth, roles('customer'), async (req, res) => {
  res.json(await Order.find({ customer: req.user.id }).sort({ createdAt: -1 }));
});

r.get('/all', auth, roles('admin'), async (_req, res) => {
  res.json(await Order.find().populate('customer', 'name email').sort({ createdAt: -1 }).limit(500));
});

r.get('/merchant', auth, roles('merchant', 'admin'), approvedMerchant, async (req, res) => {
  const match = req.user.role === 'admin' ? {} : { 'items.merchant': req.user.id };
  const orders = await Order.find(match).populate('customer', 'name email').sort({ createdAt: -1 }).limit(300);
  res.json(orders.map(order => {
    const result = order.toObject();
    if (req.user.role !== 'admin') result.items = result.items.filter(item => String(item.merchant) === req.user.id);
    return result;
  }));
});

r.patch('/:id/status', auth, roles('admin', 'merchant'), approvedMerchant, async (req, res) => {
  const { status } = req.body;
  if (!['processing', 'shipped', 'delivered', 'cancelled'].includes(status)) {
    return res.status(400).json({ message: 'Invalid order status.' });
  }
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found.' });
  if (order.status === 'delivered' || order.status === 'cancelled') {
    return res.status(400).json({ message: 'This order is already closed.' });
  }
  if (req.user.role === 'admin' && status === 'cancelled' && !['placed', 'processing'].includes(order.status)) {
    return res.status(400).json({ message: 'Only orders that are not yet shipped can be cancelled.' });
  }

  if (req.user.role === 'merchant') {
    if (status === 'cancelled') return res.status(403).json({ message: 'Only administrators or customers can cancel an order.' });
    const ownItems = order.items.filter(item => String(item.merchant) === req.user.id);
    if (!ownItems.length) return res.status(403).json({ message: 'This order does not contain your products.' });
    if (ownItems.some(item => !(transitions[item.status || 'placed'] || []).includes(status))) {
      return res.status(400).json({ message: 'The requested fulfillment transition is not allowed.' });
    }
    ownItems.forEach(item => { item.status = status; });
    order.markModified('items');
    order.status = overallStatus(order.items);
  } else {
    if (status === 'cancelled') {
      await Promise.all(order.items.map(item => Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } })));
      if (order.paymentStatus === 'paid') order.paymentStatus = 'refunded';
    } else if (!(transitions[order.status] || []).includes(status)) {
      return res.status(400).json({ message: 'The requested order transition is not allowed.' });
    }
    order.status = status;
    order.items.forEach(item => { item.status = status; });
  }

  order.statusHistory.push({ status: order.status, note: `Updated by ${req.user.role}` });
  await order.save();
  res.json(order);
});

r.patch('/:id/cancel', auth, roles('customer'), async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, customer: req.user.id });
  if (!order) return res.status(404).json({ message: 'Order not found.' });
  if (!['placed', 'processing'].includes(order.status)) {
    return res.status(400).json({ message: 'This order can no longer be cancelled.' });
  }
  await Promise.all(order.items.map(item => Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } })));
  order.status = 'cancelled';
  order.items.forEach(item => { item.status = 'cancelled'; });
  if (order.paymentStatus === 'paid') order.paymentStatus = 'refunded';
  order.statusHistory.push({ status: 'cancelled', note: 'Cancelled by customer' });
  await order.save();
  res.json(order);
});

export default r;
