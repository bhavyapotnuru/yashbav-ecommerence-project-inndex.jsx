import { Router } from 'express';
import { z } from 'zod';
import Coupon from '../models/Coupon.js';
import { auth, roles } from '../middleware/auth.js';

const r = Router();
const couponInput = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/),
  discountPercent: z.coerce.number().finite().min(1).max(100),
  maxDiscount: z.coerce.number().finite().min(1),
  minimumSubtotal: z.coerce.number().finite().min(0).default(0),
  usageLimit: z.union([z.coerce.number().int().min(1), z.null()]).optional(),
  expiresAt: z.union([z.string().datetime().transform(value => new Date(value)), z.null()]).optional(),
  isActive: z.boolean().optional()
});

function isUsable(coupon, subtotal) {
  return coupon.isActive
    && (!coupon.expiresAt || coupon.expiresAt > new Date())
    && (coupon.usageLimit === null || coupon.usageLimit === undefined || coupon.usedCount < coupon.usageLimit)
    && subtotal >= coupon.minimumSubtotal;
}

r.get('/', auth, roles('admin'), async (_req, res) => {
  res.json(await Coupon.find().sort({ createdAt: -1 }).limit(200));
});

r.get('/:code', async (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase();
  const subtotal = Number(req.query.subtotal);
  if (!Number.isFinite(subtotal) || subtotal < 0) return res.status(400).json({ message: 'Provide a valid cart subtotal.' });
  const coupon = await Coupon.findOne({ code });
  if (!coupon || !isUsable(coupon, subtotal)) return res.status(400).json({ message: 'Coupon is invalid, expired, exhausted or does not meet the minimum subtotal.' });
  res.json({ code: coupon.code, discount: Math.min(Math.round(subtotal * coupon.discountPercent / 100), coupon.maxDiscount) });
});

r.post('/', auth, roles('admin'), async (req, res) => {
  const parsed = couponInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });
  try {
    const coupon = await Coupon.create(parsed.data);
    res.status(201).json(coupon);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'A coupon with that code already exists.' });
    throw error;
  }
});

r.patch('/:id', auth, roles('admin'), async (req, res) => {
  if (typeof req.body.isActive !== 'boolean') return res.status(400).json({ message: 'Provide an active boolean.' });
  const coupon = await Coupon.findByIdAndUpdate(req.params.id, { isActive: req.body.isActive }, { new: true, runValidators: true });
  if (!coupon) return res.status(404).json({ message: 'Coupon not found.' });
  res.json(coupon);
});

export default r;
