import { Router } from 'express'; import mongoose from 'mongoose'; import Product from '../models/Product.js'; import Order from '../models/Order.js'; import { auth, roles, approvedMerchant } from '../middleware/auth.js';
const r=Router();r.use(auth,roles('merchant','admin'),approvedMerchant);
r.get('/overview',async(req,res)=>{const filter=req.user.role==='admin'?{}:{merchant:req.user.id};const [products,lowStock,orders]=await Promise.all([Product.countDocuments({...filter,isActive:true}),Product.find({...filter,isActive:true,stock:{$lte:5}}).sort({stock:1}).limit(10),Order.find(req.user.role==='admin'?{}:{'items.merchant':req.user.id}).sort({createdAt:-1}).limit(300)]);const relevant=orders.map(o=>({...o.toObject(),items:req.user.role==='admin'?o.items:o.items.filter(i=>String(i.merchant)===req.user.id)}));const revenue=relevant.filter(o=>o.status!=='cancelled').reduce((s,o)=>s+o.items.reduce((v,i)=>v+i.price*i.quantity,0),0);res.json({products,lowStock,orders:relevant.length,revenue,recentOrders:relevant.slice(0,8)});});
r.get('/orders',async(req,res)=>{const orders=await Order.find(req.user.role==='admin'?{}:{'items.merchant':req.user.id}).populate('customer','name email').sort({createdAt:-1}).limit(300);res.json(orders.map(o=>{const x=o.toObject();if(req.user.role!=='admin')x.items=x.items.filter(i=>String(i.merchant)===req.user.id);return x;}));});
r.get('/reports', async (req, res) => {
  const stages = [
    { $match: { status: { $ne: 'cancelled' } } },
    { $unwind: '$items' }
  ];
  if (req.user.role !== 'admin') {
    stages.push({ $match: { 'items.merchant': new mongoose.Types.ObjectId(req.user.id) } });
  }
  stages.push(
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
        orderIds: { $addToSet: '$_id' },
        revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
      }
    },
    { $project: { orders: { $size: '$orderIds' }, revenue: 1 } },
    { $sort: { _id: 1 } },
    { $limit: 12 }
  );
  res.json({ monthly: await Order.aggregate(stages) });
});
export default r;
