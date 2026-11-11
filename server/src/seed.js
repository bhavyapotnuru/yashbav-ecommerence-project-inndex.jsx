import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Product from './models/Product.js';
import User from './models/User.js';
import Coupon from './models/Coupon.js';

if (!process.env.MONGO_URI) {
  console.error('MONGO_URI is missing from server/.env');
  process.exit(1);
}

const sampleProducts = [
  ['Studio Wireless Headphones', 'Electronics', 6499, 7999, 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900', 'Aural', true],
  ['Portable Bluetooth Speaker', 'Electronics', 2899, 3599, 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=900', 'Soundform', true],
  ['Classic Analog Watch', 'Lifestyle', 7299, 8999, 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900', 'Forma', true],
  ['Everyday Leather Bag', 'Fashion', 4999, 6499, 'https://images.unsplash.com/photo-1547949003-9792a18a2601?w=900', 'Atelier', false],
  ['Clean Canvas Sneakers', 'Fashion', 3999, 4999, 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=900', 'Common Ground', true],
  ['Sculptural Table Lamp', 'Home', 3499, 4499, 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=900', 'Forma', false],
  ['Minimal Ceramic Vase', 'Home', 1899, 2499, 'https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=900', 'Clay & Co', false],
  ['Modern Lounge Chair', 'Home', 18999, 22999, 'https://images.unsplash.com/photo-1503602642458-232111445657?w=900', 'Forma', true],
  ['Everyday Smartwatch', 'Electronics', 8999, 10999, 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900', 'Aural', false],
  ['Compact Film Camera', 'Electronics', 12499, 14999, 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=900', 'Moment', false],
  ['Linen Overshirt', 'Fashion', 3299, 3999, 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=900', 'Atelier', false],
  ['Everyday Crossbody', 'Fashion', 2799, 3499, 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=900', 'Common Ground', false],
  ['Soft Knit Throw', 'Home', 2599, 3299, 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=900', 'Haven', false],
  ['Oak Desk Organizer', 'Home', 1499, 1999, 'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?w=900', 'Haven', false],
  ['Wireless Charging Stand', 'Electronics', 1999, 2499, 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=900', 'Aural', false],
  ['Over-Ear Studio Headphones', 'Electronics', 9999, 11999, 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=900', 'Soundform', true],
  ['Classic Leather Wallet', 'Lifestyle', 1799, 2299, 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=900', 'Atelier', false],
  ['Minimal Table Clock', 'Lifestyle', 2199, 2799, 'https://images.unsplash.com/photo-1501139083538-0139583c060f?w=900', 'Forma', false],
  ['Cotton Everyday Tee', 'Fashion', 1199, 1599, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=900', 'Common Ground', true],
  ['Stoneware Dinner Set', 'Home', 4299, 5299, 'https://images.unsplash.com/photo-1490312278390-ab64016e0aa9?w=900', 'Clay & Co', false]
];

try {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 12000 });

  const adminEmail = (process.env.ADMIN_EMAIL || 'nexoraecommerce1111@gmail.com').toLowerCase();
  const adminPassword = process.env.ADMIN_SEED_PASSWORD;
  if (adminPassword) {
    if (adminPassword.length < 16) throw new Error('ADMIN_SEED_PASSWORD must be at least 16 characters. Set a unique password in server/.env.');
    const existing = await User.findOne({ email: adminEmail });
    if (existing) {
      existing.role = 'admin';
      existing.merchantApproved = true;
      existing.isActive = true;
      existing.passwordHash = await bcrypt.hash(adminPassword, 12);
      await existing.save();
      console.log('Admin account secured with the password configured in server/.env.');
    } else {
      await User.create({
        name: 'NEXORA Administrator',
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 12),
        role: 'admin',
        merchantApproved: true
      });
      console.log('Admin account created for the configured email.');
    }
  } else {
    console.log('ADMIN_SEED_PASSWORD not set; skipping admin account creation.');
  }

  if (!await Coupon.exists({ code: 'NEXORA10' })) {
    await Coupon.create({ code: 'NEXORA10', discountPercent: 10, maxDiscount: 500, minimumSubtotal: 0, isActive: true });
  }

  let inserted = 0;
  for (const [index, [name, category, price, compareAtPrice, image, brand, bestSeller]] of sampleProducts.entries()) {
    const sku = `NX-${String(index + 1).padStart(4, '0')}`;
    const exists = await Product.exists({ $or: [{ sku }, { name }] });
    if (exists) continue;
    await Product.create({
      name,
      category,
      price,
      compareAtPrice,
      image,
      images: [image],
      brand,
      sku,
      stock: 25,
      featured: index < 8,
      bestSeller,
      description: 'Thoughtfully selected for everyday living, with considered details and quality made to last.',
      isActive: true
    });
    inserted += 1;
  }
  console.log(inserted ? `Added ${inserted} sample products; existing products were preserved.` : `Sample catalog already present (${sampleProducts.length} products).`);
} catch (err) {
  console.error('Seed failed:', err.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
