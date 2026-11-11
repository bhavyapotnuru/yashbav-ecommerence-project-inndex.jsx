import { Router } from 'express';
import { z } from 'zod';
import Product from '../models/Product.js';
import Review from '../models/Review.js';
import { auth, roles, approvedMerchant } from '../middleware/auth.js';
const r = Router();
const categories = ['Electronics','Fashion','Lifestyle','Home'];
const safeRegex = value => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const productFields = {
  name: z.string().trim().min(2).max(160),
  description: z.string().max(5000).optional(),
  category: z.enum(categories),
  subcategory: z.string().max(100).optional(),
  brand: z.string().trim().max(100).optional(),
  price: z.coerce.number().finite().min(0),
  compareAtPrice: z.coerce.number().finite().min(0).optional(),
  image: z.string().trim().max(2048).optional(),
  images: z.array(z.string().trim().max(2048)).max(10).optional(),
  cloudinaryPublicId: z.string().trim().max(255).optional(),
  stock: z.coerce.number().int().min(0).max(100000),
  sku: z.string().trim().max(100).optional(),
  featured: z.boolean().optional(),
  bestSeller: z.boolean().optional(),
  isActive: z.boolean().optional()
};
const productSchema = z.object(productFields);
const productPatchSchema = productSchema.partial();
r.get('/', async (req,res) => {
  const { search, category, sort, featured, page = 1, limit = 24 } = req.query; const filter = { isActive: true };
  if (category && category !== 'All') filter.category = categories.includes(category) ? category : '__none__';
  const searchTerm = String(search || '').trim().slice(0, 100);
  if (searchTerm) filter.$or = [{ name: { $regex: safeRegex(searchTerm), $options: 'i' } }, { description: { $regex: safeRegex(searchTerm), $options: 'i' } }, { category: { $regex: safeRegex(searchTerm), $options: 'i' } }];
  if (featured === 'true') filter.featured = true;
  const sortBy = sort === 'price-asc' ? { price: 1 } : sort === 'price-desc' ? { price: -1 } : sort === 'rating' ? { rating: -1 } : { featured: -1, createdAt: -1 };
  const p = Math.max(1, Number(page) || 1), l = Math.min(60, Math.max(1, Number(limit) || 24));
  const [items,total] = await Promise.all([Product.find(filter).populate('merchant','name').sort(sortBy).skip((p-1)*l).limit(l), Product.countDocuments(filter)]);
  res.set('X-Total-Count', String(total)); res.json(items);
});
r.get('/mine', auth, roles('merchant','admin'), approvedMerchant, async (req,res) => { const filter = req.user.role === 'admin' ? {} : { merchant: req.user.id }; res.json(await Product.find(filter).sort({createdAt:-1})); });
r.get('/:id/reviews', async (req,res) => res.json(await Review.find({ product: req.params.id }).populate('customer','name').sort({createdAt:-1}).limit(100)));
r.post('/:id/reviews', auth, roles('customer'), async (req,res) => {
  const rating = Number(req.body.rating); if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({message:'Rating must be between 1 and 5.'});
  const bought = await (await import('../models/Order.js')).default.exists({ customer:req.user.id, 'items.product':req.params.id, status:{$ne:'cancelled'} }); if (!bought) return res.status(403).json({message:'Purchase this product before reviewing it.'});
  try { const review = await Review.create({ product:req.params.id, customer:req.user.id, rating, title:String(req.body.title||'').slice(0,120), comment:String(req.body.comment||'').slice(0,1500) }); const all=await Review.find({product:req.params.id}); await Product.findByIdAndUpdate(req.params.id,{rating:all.reduce((s,x)=>s+x.rating,0)/all.length,reviewCount:all.length}); res.status(201).json(review); } catch(e) { if(e.code===11000)return res.status(409).json({message:'You have already reviewed this product.'}); throw e; }
});
r.get('/:id', async (req,res) => { const p = await Product.findOne({_id:req.params.id,isActive:true}).populate('merchant','name'); if(!p)return res.status(404).json({message:'Product not found.'}); res.json(p); });
r.post('/', auth, roles('merchant','admin'), approvedMerchant, async (req,res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });
  const data = parsed.data;
  const p = await Product.create({ ...data, merchant: req.user.role === 'admin' ? null : req.user.id });
  res.status(201).json(p);
});
r.patch('/:id', auth, roles('merchant','admin'), approvedMerchant, async (req,res) => {
  const parsed = productPatchSchema.safeParse(req.body);
  if (!parsed.success || !Object.keys(parsed.data || {}).length) return res.status(400).json({ message: parsed.error?.issues[0]?.message || 'Provide product fields to update.' });
  const p = await Product.findById(req.params.id);
  if (!p) return res.status(404).json({message:'Product not found.'});
  if (req.user.role !== 'admin' && String(p.merchant) !== req.user.id) return res.status(403).json({message:'You can only edit your own products.'});
  Object.assign(p, parsed.data);
  await p.save();
  res.json(p);
});
r.delete('/:id', auth, roles('merchant','admin'), approvedMerchant, async (req,res) => { const p=await Product.findById(req.params.id); if(!p)return res.status(404).json({message:'Product not found.'}); if(req.user.role!=='admin'&&String(p.merchant)!==req.user.id)return res.status(403).json({message:'You can only delete your own products.'}); p.isActive=false; await p.save(); res.json({ok:true}); });
export default r;
