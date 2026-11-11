import jwt from 'jsonwebtoken';
import User from '../models/User.js';
export async function auth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ message: 'Authentication required.' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id).select('name email role merchantApproved isActive');
    if (!user || !user.isActive) return res.status(401).json({ message: 'Account unavailable.' });
    req.user = { id: String(user._id), name: user.name, email: user.email, role: user.role, merchantApproved: user.merchantApproved };
    next();
  } catch { return res.status(401).json({ message: 'Session expired or invalid. Please sign in again.' }); }
}
export const roles = (...allowed) => (req, res, next) => allowed.includes(req.user?.role) ? next() : res.status(403).json({ message: 'You do not have permission to perform this action.' });
export function approvedMerchant(req, res, next) {
  if (req.user?.role === 'admin') return next();
  if (req.user?.role !== 'merchant' || !req.user.merchantApproved) return res.status(403).json({ message: 'Your merchant account is awaiting admin approval.' });
  next();
}
