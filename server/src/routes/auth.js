import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import User from '../models/User.js';
import { auth } from '../middleware/auth.js';
const r = Router();
const schema = z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().email().max(160), password: z.string().min(8).max(128), role: z.enum(['customer','merchant']).optional() });
const publicUser = u => ({ id: String(u._id), name: u.name, email: u.email, phone: u.phone || '', role: u.role, merchantApproved: Boolean(u.merchantApproved) });
const sign = u => jwt.sign({ id: String(u._id) }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d', issuer: 'nexora-api' });
r.post('/register', async (req,res) => {
  const parsed = schema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });
  const data = parsed.data; const email = data.email.toLowerCase();
  if (await User.exists({ email })) return res.status(409).json({ message: 'Email already registered.' });
  try {
    const role = data.role === 'merchant' ? 'merchant' : 'customer';
    const user = await User.create({ name: data.name, email, role, merchantApproved: false, passwordHash: await bcrypt.hash(data.password, 12) });
    res.status(201).json({ token: sign(user), user: publicUser(user), message: role === 'merchant' ? 'Merchant application submitted. Admin approval is required before selling.' : 'Account created successfully.' });
  } catch (e) { if (e.code === 11000) return res.status(409).json({ message: 'Email already registered.' }); res.status(500).json({ message: 'Could not create account.' }); }
});
r.post('/login', async (req,res) => {
  const email = String(req.body.email || '').trim().toLowerCase(); const password = String(req.body.password || '');
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: 'Invalid email or password.' });
  res.json({ token: sign(user), user: publicUser(user) });
});
r.get('/me', auth, async (req,res) => { const user = await User.findById(req.user.id); if (!user) return res.status(404).json({ message: 'User not found.' }); res.json(publicUser(user)); });
r.patch('/profile', auth, async (req,res) => {
  const updates = {};
  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (name.length < 2 || name.length > 80) return res.status(400).json({ message: 'Name must be between 2 and 80 characters.' });
    updates.name = name;
  }
  if (req.body.phone !== undefined) {
    const phone = String(req.body.phone).trim();
    if (phone.length > 30) return res.status(400).json({ message: 'Phone number must be 30 characters or fewer.' });
    updates.phone = phone;
  }
  const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true, runValidators: true });
  if (!user) return res.status(404).json({ message: 'User not found.' });
  res.json(publicUser(user));
});
export default r;
