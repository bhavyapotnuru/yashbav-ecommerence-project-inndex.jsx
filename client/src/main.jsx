import React, { createContext, useContext, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams
} from 'react-router-dom';
import axios from 'axios';
import {
  ArrowRight, ArrowUpRight, CheckCircle2, Heart, LayoutDashboard, LogOut,
  Menu, Minus, Moon, Package, Plus, Search, ShoppingBag, SlidersHorizontal,
  Sun, Trash2, User, X
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import './style.css';
import './features.css';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });
const AppContext = createContext(null);
const useApp = () => useContext(AppContext);
const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const readStorage = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const authConfig = token => ({ headers: { Authorization: `Bearer ${token}` } });
const categories = ['Electronics', 'Fashion', 'Lifestyle', 'Home'];

function Provider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('nexora-theme') || 'light');
  const [cart, setCart] = useState(() => readStorage('nexora-cart', []));
  const [likes, setLikes] = useState(() => readStorage('nexora-likes', []));
  const [session, setSession] = useState(() => readStorage('nexora-session', null));
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('nexora-theme', theme);
  }, [theme]);
  useEffect(() => localStorage.setItem('nexora-cart', JSON.stringify(cart)), [cart]);
  useEffect(() => localStorage.setItem('nexora-likes', JSON.stringify(likes)), [likes]);
  useEffect(() => {
    if (session) localStorage.setItem('nexora-session', JSON.stringify(session));
    else localStorage.removeItem('nexora-session');
  }, [session]);
  useEffect(() => {
    if (!session?.token) return;
    let active = true;
    api.get('/auth/me', authConfig(session.token))
      .then(({ data }) => { if (active) setSession(current => current ? { ...current, user: data } : null); })
      .catch(() => { if (active) setSession(null); });
    return () => { active = false; };
  }, [session?.token]);

  const add = product => {
    if (!product.stock) return;
    setCart(current => {
      const existing = current.find(item => item._id === product._id);
      if (existing) return current.map(item => item._id === product._id
        ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) }
        : item);
      return [...current, { ...product, quantity: 1 }];
    });
    setDrawer(true);
  };
  return (
    <AppContext.Provider value={{ theme, setTheme, cart, setCart, likes, setLikes, session, setSession, drawer, setDrawer, add }}>
      {children}
    </AppContext.Provider>
  );
}

function Header() {
  const { theme, setTheme, cart, likes, session, setDrawer } = useApp();
  const [mobile, setMobile] = useState(false);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <>
      <div className="announcement">A better way to discover. <span>Complimentary delivery on orders above ₹4,999</span> <ArrowRight size={13} /></div>
      <header className="header">
        <div className="header-inner">
          <Link className="logo" to="/">NEXORA<span className="logo-dot">.</span></Link>
          <nav className={mobile ? 'nav open' : 'nav'} onClick={() => setMobile(false)}>
            <Link to="/">Discover</Link><Link to="/shop">Shop all</Link>
            <Link to="/shop?category=Fashion">Fashion</Link><Link to="/shop?category=Electronics">Tech</Link>
            <Link to="/shop?category=Home">Living</Link>
          </nav>
          <div className="header-actions">
            <Link aria-label="Search products" to="/shop"><Search size={20} /></Link>
            <Link className="header-count-link" aria-label="Wishlist" to="/wishlist"><Heart size={20} />{likes.length > 0 && <span className="count">{likes.length}</span>}</Link>
            <button aria-label="Toggle theme" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            <Link aria-label="Account" to={session ? '/account' : '/login'}><User size={20} /></Link>
            <button className="bag-btn" aria-label="Open cart" onClick={() => setDrawer(true)}>
              <ShoppingBag size={20} />{itemCount > 0 && <span className="count">{itemCount}</span>}
            </button>
            <button className="mobile-menu" aria-label="Open menu" onClick={() => setMobile(value => !value)}><Menu size={22} /></button>
          </div>
        </div>
      </header>
    </>
  );
}

function ProductCard({ product }) {
  const { add, likes, setLikes } = useApp();
  const liked = likes.includes(product._id);
  return (
    <motion.article className="product-card" initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.35 }}>
      <div className="product-media">
        <Link to={`/product/${product._id}`}><img src={product.image} alt={product.name} loading="lazy" /></Link>
        {product.compareAtPrice > product.price && <span className="discount">-{Math.round((1 - product.price / product.compareAtPrice) * 100)}%</span>}
        <button className={`like ${liked ? 'liked' : ''}`} aria-label={liked ? 'Remove from wishlist' : 'Add to wishlist'} onClick={() => setLikes(value => liked ? value.filter(id => id !== product._id) : [...value, product._id])}>
          <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
        </button>
        <button className="quick-add" onClick={() => add(product)} disabled={!product.stock}>{product.stock ? 'Add to bag' : 'Sold out'} <Plus size={16} /></button>
      </div>
      <div className="product-info">
        <span>{product.category}{product.rating > 0 ? ` · ★ ${Number(product.rating).toFixed(1)}` : ''}</span>
        <Link to={`/product/${product._id}`}>{product.name}</Link>
        <div className="price">{money(product.price)} {product.compareAtPrice > product.price && <del>{money(product.compareAtPrice)}</del>}</div>
      </div>
    </motion.article>
  );
}

function useProducts(params = {}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const query = new URLSearchParams(params).toString();
  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get(`/products${query ? `?${query}` : '?limit=60'}`)
      .then(({ data }) => { if (active) setProducts(data); })
      .catch(() => { if (active) setError('Unable to load products. Check that the API is running and the catalog has been seeded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query]);
  return { products, loading, error };
}

function Home() {
  const { products, loading, error } = useProducts({ limit: 60 });
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> THE ART OF EVERYDAY LIVING</div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>Discover things<br />that <em>move you.</em></motion.h1>
          <p>Thoughtfully curated essentials for a life less ordinary. Beautiful design, exceptional quality, and everything in between.</p>
          <Link className="primary-btn" to="/shop">Explore collection <ArrowUpRight size={18} /></Link>
          <div className="hero-meta"><span>01 / 03</span><div className="meta-line" /><span>THE NEW COLLECTION</span></div>
        </div>
        <div className="hero-image"><img src="https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?w=1600" alt="Curated modern living room" /><div className="hero-image-label">OBJECTS OF DESIRE <span>— 2026 EDITION</span></div></div>
      </section>
      <section className="benefits"><span>✦ Curated with intention</span><span>✦ Designed for living</span><span>✦ Quality without compromise</span><span>✦ Made to inspire</span></section>
      <section className="section">
        <div className="section-head"><div><div className="eyebrow">THE EDIT</div><h2>Curated for <em>you.</em></h2><p>Good design is in the details. Explore our most-loved finds.</p></div><Link className="text-link" to="/shop">Shop all products <ArrowUpRight size={18} /></Link></div>
        {error && <p className="error">{error}</p>}
        {loading ? <p>Loading collection…</p> : <div className="product-grid">{products.filter(product => product.isActive !== false).slice(0, 8).map(product => <ProductCard key={product._id} product={product} />)}</div>}
      </section>
      <section className="editorial"><div className="editorial-image"><img src="https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200" alt="Modern interiors" loading="lazy" /></div><div className="editorial-copy"><div className="eyebrow">THE NEXORA PHILOSOPHY</div><h2>Less noise.<br /><em>More meaning.</em></h2><p>We believe the things you bring into your world should make it better. Discover timeless pieces, intentional design and everyday inspiration.</p><Link className="primary-btn" to="/shop">Discover the edit <ArrowUpRight size={18} /></Link></div></section>
      <section className="newsletter"><div className="eyebrow">STAY INSPIRED</div><h2>A little something <em>extra.</em></h2><p>Our next collection is just around the corner.</p><Link className="text-link" to="/shop">Explore what’s new <ArrowRight size={18} /></Link></section>
    </>
  );
}

function Shop() {
  const location = useLocation();
  const initialParams = new URLSearchParams(location.search);
  const [category, setCategory] = useState(initialParams.get('category') || 'All');
  const [search, setSearch] = useState(initialParams.get('search') || '');
  const [sort, setSort] = useState('featured');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      setError('');
      api.get('/products', { params: { category, search, sort, page, limit: 24 } })
        .then(({ data, headers }) => { setProducts(data); setTotal(Number(headers['x-total-count']) || data.length); })
        .catch(() => setError('Unable to load the collection. Please try again.'))
        .finally(() => setLoading(false));
    }, search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [category, search, sort, page]);
  useEffect(() => { setCategory(new URLSearchParams(location.search).get('category') || 'All'); setPage(1); }, [location.search]);
  const pageCount = Math.max(1, Math.ceil(total / 24));
  return (
    <main className="shop-page">
      <div className="eyebrow">THE COMPLETE COLLECTION</div><h1>Find your <em>favorite.</em></h1><p>Considered essentials. Exceptional everyday finds.</p>
      <div className="shop-toolbar">
        <div className="category-list">{['All', ...categories].map(item => <button key={item} className={category === item ? 'active' : ''} onClick={() => { setCategory(item); setPage(1); }}>{item}</button>)}</div>
        <div className="shop-filters"><label className="search-input"><Search size={18} /><input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search products…" /></label><label className="sort-input"><SlidersHorizontal size={16} /><select aria-label="Sort products" value={sort} onChange={event => { setSort(event.target.value); setPage(1); }}><option value="featured">Featured</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="rating">Top rated</option></select></label></div>
      </div>
      <p className="result-count">{total} products</p>
      {error && <p className="error">{error}</p>}
      {loading ? <p>Loading collection…</p> : products.length ? <div className="product-grid">{products.map(product => <ProductCard key={product._id} product={product} />)}</div> : <div className="empty-state"><Search size={30} /><h2>No products found</h2><p>Try a different search or category.</p></div>}
      {!loading && pageCount > 1 && <div className="pagination"><button className="secondary-btn" disabled={page === 1} onClick={() => setPage(current => current - 1)}>Previous</button><span>Page {page} of {pageCount}</span><button className="secondary-btn" disabled={page >= pageCount} onClick={() => setPage(current => current + 1)}>Next</button></div>}
    </main>
  );
}

function ProductPage() {
  const { id } = useParams();
  const { session, add } = useApp();
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState('5');
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const loadReviews = () => api.get(`/products/${id}/reviews`).then(({ data }) => setReviews(data));
  useEffect(() => {
    let active = true;
    Promise.all([api.get(`/products/${id}`), api.get(`/products/${id}/reviews`)])
      .then(([productResponse, reviewResponse]) => { if (active) { setProduct(productResponse.data); setReviews(reviewResponse.data); } })
      .catch(() => { if (active) setError('Product not found.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);
  if (loading) return <main className="simple-page">Loading product…</main>;
  if (error || !product) return <main className="simple-page">{error || 'Product not found.'} <Link to="/shop">Return to shop</Link></main>;
  async function submitReview(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post(`/products/${id}/reviews`, { rating: Number(rating), title, comment }, authConfig(session.token));
      setTitle(''); setComment('');
      await loadReviews();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to submit review.');
    } finally { setBusy(false); }
  }
  return (
    <main className="detail-page">
      <section className="detail">
        <div className="detail-image"><img src={product.image} alt={product.name} /></div>
        <div className="detail-content">
          <div className="eyebrow">NEXORA / {product.category.toUpperCase()}</div>
          <h1>{product.name}</h1>
          <p className="detail-rating">{product.rating > 0 ? `★ ${Number(product.rating).toFixed(1)} (${product.reviewCount || reviews.length} reviews)` : 'Be the first to review this find.'}</p>
          <p className="detail-price">{money(product.price)} {product.compareAtPrice > product.price && <del>{money(product.compareAtPrice)}</del>}</p>
          <p>{product.description || 'Thoughtfully selected for everyday living.'}</p>
          {product.brand && <p><strong>Brand:</strong> {product.brand}</p>}
          <p className="stock">{product.stock > 0 ? `● In stock — ${product.stock} available` : 'Out of stock'}</p>
          <button className="primary-btn" disabled={!product.stock} onClick={() => add(product)}>Add to bag <ShoppingBag size={18} /></button>
          <div className="detail-features">Thoughtful design · Secure checkout · Easy shopping</div>
        </div>
      </section>
      <section className="reviews-section">
        <div className="section-head"><div><div className="eyebrow">CUSTOMER NOTES</div><h2>Reviews <em>({reviews.length})</em></h2></div></div>
        {session?.user?.role === 'customer' && <form className="review-form" onSubmit={submitReview}><h3>Share your experience</h3><div className="review-fields"><label>Rating<select value={rating} onChange={event => setRating(event.target.value)}>{[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value} stars</option>)}</select></label><label>Title<input maxLength={120} value={title} onChange={event => setTitle(event.target.value)} placeholder="A short headline" /></label></div><label>Review<textarea maxLength={1500} rows={4} value={comment} onChange={event => setComment(event.target.value)} placeholder="What did you think?" /></label>{error && <p className="error">{error}</p>}<button className="primary-btn" disabled={busy}>{busy ? 'Submitting…' : 'Submit review'} <ArrowRight size={17} /></button></form>}
        {!reviews.length ? <p>No reviews yet.</p> : <div className="review-list">{reviews.map(review => <article className="review-card" key={review._id}><div className="review-card-head"><strong>{review.customer?.name || 'NEXORA customer'}</strong><span>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span></div>{review.title && <h3>{review.title}</h3>}<p>{review.comment}</p><small>{new Date(review.createdAt).toLocaleDateString()}</small></article>)}</div>}
        {!session && <p><Link to="/login">Sign in</Link> to leave a review after purchasing.</p>}
      </section>
    </main>
  );
}

function CartDrawer() {
  const { cart, setCart, drawer, setDrawer, session } = useApp();
  const navigate = useNavigate();
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const change = (id, delta) => setCart(items => items.map(item => item._id === id
    ? { ...item, quantity: Math.max(1, Math.min(item.stock, item.quantity + delta)) }
    : item));
  return (
    <AnimatePresence>
      {drawer && <>
        <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} />
        <motion.aside className="cart-drawer" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 280 }}>
          <div className="drawer-head"><h2>Your bag <span>({cart.reduce((sum, item) => sum + item.quantity, 0)})</span></h2><button aria-label="Close cart" onClick={() => setDrawer(false)}><X /></button></div>
          {!cart.length ? <div className="empty-bag"><ShoppingBag size={42} /><h3>Your bag is waiting.</h3><p>Discover something worth keeping.</p><button className="primary-btn" onClick={() => { setDrawer(false); navigate('/shop'); }}>Explore collection <ArrowRight size={17} /></button></div> : <>
            <div className="cart-items">{cart.map(item => <div className="cart-item" key={item._id}><img src={item.image} alt={item.name} /><div><span className="eyebrow">{item.category}</span><h4>{item.name}</h4><p>{money(item.price)}</p><div className="quantity"><button aria-label="Decrease quantity" onClick={() => change(item._id, -1)}><Minus size={14} /></button>{item.quantity}<button aria-label="Increase quantity" disabled={item.quantity >= item.stock} onClick={() => change(item._id, 1)}><Plus size={14} /></button></div></div><button className="remove" aria-label="Remove item" onClick={() => setCart(items => items.filter(product => product._id !== item._id))}><Trash2 size={17} /></button></div>)}</div>
            <div className="cart-footer"><div className="subtotal"><span>Subtotal</span><strong>{money(total)}</strong></div><p>Delivery, discount and taxes calculated at checkout.</p><button className="primary-btn" onClick={() => { setDrawer(false); navigate(session ? '/checkout' : '/login'); }}>Continue to checkout <ArrowRight size={18} /></button></div>
          </>}
        </motion.aside>
      </>}
    </AnimatePresence>
  );
}

function CartPage() {
  const { cart, setCart } = useApp();
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return <main className="cart-page"><div className="eyebrow">YOUR SELECTION</div><h1>Your <em>bag.</em></h1>{!cart.length ? <div className="empty-state"><ShoppingBag size={32} /><h2>Your bag is empty</h2><Link className="primary-btn" to="/shop">Explore collection <ArrowRight size={17} /></Link></div> : <div className="cart-page-layout"><div className="cart-page-items">{cart.map(item => <div className="cart-page-item" key={item._id}><img src={item.image} alt={item.name} /><div><Link to={`/product/${item._id}`}><strong>{item.name}</strong></Link><p>{money(item.price)}</p></div><span>Qty {item.quantity}</span><strong>{money(item.price * item.quantity)}</strong><button className="remove" aria-label={`Remove ${item.name}`} onClick={() => setCart(items => items.filter(product => product._id !== item._id))}><Trash2 size={17} /></button></div>)}</div><aside className="checkout-summary"><h2>Summary</h2><div className="summary-row"><span>Subtotal</span><strong>{money(total)}</strong></div><p>Taxes and delivery are calculated at checkout.</p><Link className="primary-btn" to="/checkout">Continue to checkout <ArrowRight size={18} /></Link></aside></div>}</main>;
}

function WishlistPage() {
  const { likes } = useApp();
  const { products, loading, error } = useProducts({ limit: 60 });
  const saved = products.filter(product => likes.includes(product._id));
  return <main className="shop-page"><div className="eyebrow">YOUR PERSONAL EDIT</div><h1>Saved <em>finds.</em></h1>{error && <p className="error">{error}</p>}{loading ? <p>Loading wishlist…</p> : saved.length ? <div className="product-grid">{saved.map(product => <ProductCard key={product._id} product={product} />)}</div> : <div className="empty-state"><Heart size={30} /><h2>No favorites saved yet</h2><p>Tap the heart on anything you love.</p><Link className="primary-btn" to="/shop">Explore the collection <ArrowRight size={17} /></Link></div>}</main>;
}

function Auth() {
  const [register, setRegister] = useState(false);
  const [accountRole, setAccountRole] = useState('customer');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { setSession } = useApp();
  const navigate = useNavigate();
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const { data } = await api.post(`/auth/${register ? 'register' : 'login'}`, register ? { name, email, password, role: accountRole } : { email, password });
      setSession(data); navigate('/account');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to connect to the server.');
    } finally { setBusy(false); }
  }
  return (
    <main className="auth-page">
      <div className="auth-art"><img src="https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1100" alt="Beautiful interior" /><div>Make room for<br /><em>better things.</em></div></div>
      <form className="auth-form" onSubmit={submit}><div className="eyebrow">WELCOME TO NEXORA</div><h1>{register ? 'Join the collective.' : 'Welcome back.'}</h1><p>{register ? 'Create a customer or merchant account. Merchant selling access starts after admin approval.' : 'Sign in to continue your discovery.'}</p>
        {register && <label>Full name<input required minLength={2} maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="Your name" /></label>}
        {register && <label>Account type<select value={accountRole} onChange={event => setAccountRole(event.target.value)}><option value="customer">Customer</option><option value="merchant">Merchant (requires admin approval)</option></select></label>}
        <label>Email address<input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></label>
        <label>Password<input required type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 8 : 1} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} placeholder="••••••••" /></label>
        {error && <p className="error">{error}</p>}<button className="primary-btn" disabled={busy}>{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'} <ArrowRight size={18} /></button>
        <p className="auth-switch">{register ? 'Already have an account?' : 'New to NEXORA?'} <button type="button" onClick={() => { setRegister(!register); setError(''); }}>{register ? 'Sign in' : 'Create an account'}</button></p>
      </form>
    </main>
  );
}

function Account() {
  const { session, setSession, likes } = useApp();
  const [orders, setOrders] = useState([]);
  const [name, setName] = useState(session?.user?.name || '');
  const [phone, setPhone] = useState(session?.user?.phone || '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    if (!session?.token) return;
    api.get('/orders/mine', authConfig(session.token)).then(({ data }) => setOrders(data)).catch(requestError => setError(requestError.response?.data?.message || 'Unable to load orders.'));
  }, [session?.token]);
  if (!session) return <main className="simple-page"><Link to="/login">Sign in to view your account</Link></main>;
  async function saveProfile(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const { data } = await api.patch('/auth/profile', { name, phone }, authConfig(session.token));
      setSession(current => ({ ...current, user: { ...current.user, ...data } }));
      setMessage('Profile updated.');
    } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to update profile.'); }
    finally { setBusy(false); }
  }
  async function cancelOrder(id) {
    setError('');
    try {
      const { data } = await api.patch(`/orders/${id}/cancel`, {}, authConfig(session.token));
      setOrders(current => current.map(order => order._id === id ? data : order));
    } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to cancel order.'); }
  }
  return (
    <main className="account-page">
      <div className="eyebrow">YOUR PERSONAL SPACE</div><h1>Hello, <em>{session.user.name}.</em></h1><p>Welcome to your NEXORA account.</p>
      <div className="account-stats"><div><Package /><strong>{orders.length}</strong><span>Orders placed</span></div><div><Heart /><strong>{likes.length}</strong><span>Saved favorites</span></div><div><User /><strong>{session.user.role}</strong><span>Account role</span></div></div>
      {session.user.role === 'merchant' && !session.user.merchantApproved && <div className="notice">Your merchant application is under review. Selling tools become available after administrator approval.</div>}
      {['merchant', 'admin'].includes(session.user.role) && <Link className="text-link" to="/dashboard">Open workspace <ArrowUpRight size={17} /></Link>}
      {session.user.role === 'admin' && <Link className="text-link admin-link" to="/admin">Administrator controls <ArrowUpRight size={17} /></Link>}
      <div className="account-layout">
        <form className="profile-form" onSubmit={saveProfile}><h2>Profile details</h2><label>Name<input required minLength={2} maxLength={80} value={name} onChange={event => setName(event.target.value)} /></label><label>Email<input value={session.user.email} readOnly /></label><label>Phone<input maxLength={30} value={phone} onChange={event => setPhone(event.target.value)} /></label>{message && <p className="success-message">{message}</p>}{error && <p className="error">{error}</p>}<button className="secondary-btn" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button></form>
        <section className="account-orders"><div className="section-head"><h2>Your orders</h2><Link to="/wishlist">Saved favorites ({likes.length})</Link></div>{error && <p className="error">{error}</p>}{orders.length ? orders.map(order => <div className="order-row" key={order._id}><div><strong>Order #{order.orderNumber || order._id.slice(-8).toUpperCase()}</strong><p>{new Date(order.createdAt).toLocaleDateString()} · {order.items.length} items</p><p>{order.items.map(item => `${item.name} × ${item.quantity}`).join(', ')}</p></div><span>{order.status}</span><strong>{money(order.total)}</strong>{['placed', 'processing'].includes(order.status) && <button className="secondary-btn compact-btn" onClick={() => cancelOrder(order._id)}>Cancel</button>}</div>) : <p>No orders yet. <Link to="/shop">Start exploring.</Link></p>}</section>
      </div>
      <button className="secondary-btn signout-btn" onClick={() => { setSession(null); navigate('/'); }}>Sign out <LogOut size={17} /></button>
    </main>
  );
}

function Checkout() {
  const { session, cart, setCart } = useApp();
  const [address, setAddress] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponInfo, setCouponInfo] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const navigate = useNavigate();
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  useEffect(() => {
    const code = couponCode.trim();
    if (!code) {
      setCouponInfo(null); setCouponError(''); setCouponLoading(false);
      return undefined;
    }
    let active = true;
    setCouponInfo(null); setCouponError(''); setCouponLoading(true);
    const timer = setTimeout(() => {
      api.get(`/coupons/${encodeURIComponent(code)}`, { params: { subtotal } })
        .then(({ data }) => { if (active) setCouponInfo(data); })
        .catch(requestError => { if (active) setCouponError(requestError.response?.data?.message || 'Unable to validate coupon.'); })
        .finally(() => { if (active) setCouponLoading(false); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [couponCode, subtotal]);
  const discount = couponInfo?.discount || 0;
  const taxable = subtotal - discount;
  const deliveryFee = taxable >= 4999 ? 0 : (cart.length ? 99 : 0);
  const tax = Math.round(taxable * 0.05 * 100) / 100;
  const estimatedTotal = taxable + deliveryFee + tax;
  if (!session) return <main className="simple-page"><Link to="/login">Sign in to check out</Link></main>;
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const { data } = await api.post('/orders', { items: cart.map(item => ({ product: item._id, quantity: item.quantity })), address, couponCode, paymentMethod }, authConfig(session.token));
      setDone(data); setCart([]);
    } catch (requestError) { setError(requestError.response?.data?.message || 'Checkout failed. Please review your cart and try again.'); }
    finally { setBusy(false); }
  }
  if (done) return <main className="success-page"><CheckCircle2 size={54} /><h1>Order placed.</h1><p>Your order #{done.orderNumber || done._id.slice(-8).toUpperCase()} is confirmed.</p><p>Final total: <strong>{money(done.total)}</strong></p><button className="primary-btn" onClick={() => navigate('/account')}>View my orders <ArrowRight size={18} /></button></main>;
  return (
    <main className="checkout-page"><div className="eyebrow">THE FINAL STEP</div><h1>Checkout.</h1><div className="checkout-layout">
      <form onSubmit={submit}><h2>Delivery details</h2><label>Delivery address<textarea required minLength={8} maxLength={1000} value={address} onChange={event => setAddress(event.target.value)} placeholder="Full address, city, state, postal code" rows={5} /></label>
        <label>Coupon code<input maxLength={40} value={couponCode} onChange={event => setCouponCode(event.target.value)} placeholder="Try NEXORA10" /></label>
        {couponLoading && <p>Checking coupon…</p>}{couponInfo && <p className="success-message">Coupon {couponInfo.code} applied: save {money(discount)}.</p>}{couponError && <p className="error">{couponError}</p>}
        <fieldset className="payment-options"><legend>Payment method</legend><label><input type="radio" name="payment" value="cod" checked={paymentMethod === 'cod'} onChange={event => setPaymentMethod(event.target.value)} /> Cash on delivery</label><label><input type="radio" name="payment" value="simulated" checked={paymentMethod === 'simulated'} onChange={event => setPaymentMethod(event.target.value)} /> Simulated online payment <small>(demo only; no real charge)</small></label></fieldset>
        {error && <p className="error">{error}</p>}<button className="primary-btn" disabled={busy || !cart.length || Boolean(couponCode && !couponInfo)}>{busy ? 'Placing order…' : 'Place order'} <ArrowRight size={18} /></button>
      </form>
      <div className="checkout-summary"><h2>Order summary</h2>{cart.map(item => <div key={item._id} className="summary-row"><span>{item.name} × {item.quantity}</span><strong>{money(item.price * item.quantity)}</strong></div>)}<div className="summary-row"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>{discount > 0 && <div className="summary-row"><span>Coupon discount</span><strong>-{money(discount)}</strong></div>}<div className="summary-row"><span>Delivery</span><strong>{deliveryFee ? money(deliveryFee) : 'Free'}</strong></div><div className="summary-row"><span>Tax (5%)</span><strong>{money(tax)}</strong></div><div className="summary-total"><span>Estimated total</span><strong>{money(estimatedTotal)}</strong></div><small>The server verifies current prices and stock before placing your order.</small></div>
    </div></main>
  );
}

function MerchantFulfillmentSelect({ item, order, onChange }) {
  const status = item.status || 'placed';
  const nextStatus = { placed: 'processing', processing: 'shipped', shipped: 'delivered' }[status];
  return (
    <select aria-label={`Update fulfillment for ${item.name}`} value={status} disabled={['cancelled', 'delivered'].includes(status) || ['cancelled', 'delivered'].includes(order.status)} onChange={event => onChange(order._id, event.target.value)}>
      <option value={status}>{status}</option>
      {nextStatus && <option value={nextStatus}>Mark {nextStatus}</option>}
    </select>
  );
}

const emptyProduct = { name: '', category: 'Home', brand: '', sku: '', price: '', compareAtPrice: '', stock: '', image: '', description: '' };
function Operations() {
  const { session } = useApp();
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [userPage, setUserPage] = useState(1);
  const [userTotal, setUserTotal] = useState(0);
  const [coupons, setCoupons] = useState([]);
  const [couponForm, setCouponForm] = useState({ code: '', discountPercent: '10', maxDiscount: '500', minimumSubtotal: '0', usageLimit: '', expiresAt: '' });
  const [overview, setOverview] = useState(null);
  const [reports, setReports] = useState([]);
  const [form, setForm] = useState(emptyProduct);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const isAdmin = session?.user?.role === 'admin';
  const isMerchant = session?.user?.role === 'merchant';
  const headers = authConfig(session?.token);

  async function load() {
    if (!session?.token) return;
    setLoading(true); setError('');
    try {
      const requests = [
        api.get('/products/mine', headers),
        api.get(isAdmin ? '/orders/all' : '/orders/merchant', headers),
        api.get(isAdmin ? '/admin/overview' : '/merchant/overview', headers)
      ];
      if (isAdmin) requests.push(api.get(`/admin/users?page=${userPage}`, headers));
      requests.push(api.get(isAdmin ? '/admin/reports' : '/merchant/reports', headers));
      if (isAdmin) requests.push(api.get('/coupons', headers));
      const results = await Promise.all(requests);
      setProducts(results[0].data);
      setOrders(results[1].data);
      setOverview(results[2].data);
      if (isAdmin) {
        setUsers(results[3].data.users);
        setUserTotal(results[3].data.total);
      }
      setReports(results[isAdmin ? 4 : 3].data.monthly);
      if (isAdmin) setCoupons(results[5].data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load workspace data.');
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [session?.token, isAdmin, userPage]);
  if (!session || (!isAdmin && !isMerchant)) return <main className="simple-page">Merchant or administrator access is required.</main>;
  if (isMerchant && !session.user.merchantApproved) return <main className="simple-page"><h1>Application under review.</h1><p>Your merchant account needs administrator approval before you can list products or process orders.</p></main>;

  function resetForm() { setForm(emptyProduct); setEditing(null); }
  async function saveProduct(event) {
    event.preventDefault(); setError(''); setNotice('');
    const payload = {
      ...form,
      price: Number(form.price),
      compareAtPrice: form.compareAtPrice === '' ? 0 : Number(form.compareAtPrice),
      stock: Number(form.stock)
    };
    try {
      if (editing) await api.patch(`/products/${editing}`, payload, headers);
      else await api.post('/products', payload, headers);
      resetForm(); setNotice(editing ? 'Product changes saved.' : 'Product created.'); await load();
    } catch (requestError) { setError(requestError.response?.data?.message || 'Could not save product.'); }
  }
  async function uploadImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true); setError('');
    const data = new FormData(); data.append('image', file);
    try {
      const response = await api.post('/uploads/image', data, headers);
      setForm(current => ({ ...current, image: response.data.url, cloudinaryPublicId: response.data.publicId }));
      setNotice('Image uploaded.');
    } catch (requestError) { setError(requestError.response?.data?.message || 'Image upload failed. Check Cloudinary configuration.'); }
    finally { setUploading(false); event.target.value = ''; }
  }
  async function removeProduct(id) {
    if (!window.confirm('Remove this product from the storefront?')) return;
    try { await api.delete(`/products/${id}`, headers); setNotice('Product removed from the storefront.'); await load(); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Unable to remove product.'); }
  }
  async function changeOrderStatus(id, status) {
    setError('');
    try { await api.patch(`/orders/${id}/status`, { status }, headers); await load(); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Could not update order status.'); }
  }
  async function updateUser(id, data) {
    setError('');
    try {
      const endpoint = data.role ? `/admin/users/${id}/role` : `/admin/users/${id}/active`;
      await api.patch(endpoint, data, headers);
      setNotice('Account updated.');
      await load();
    } catch (requestError) { setError(requestError.response?.data?.message || 'Could not update account.'); }
  }
  async function approveMerchant(id, approved) {
    setError('');
    try { await api.patch(`/admin/merchants/${id}/approval`, { approved }, headers); setNotice(approved ? 'Merchant approved.' : 'Merchant approval revoked.'); await load(); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Could not update merchant approval.'); }
  }
  async function createCoupon(event) {
    event.preventDefault(); setError(''); setNotice('');
    const payload = {
      ...couponForm,
      code: couponForm.code.trim().toUpperCase(),
      discountPercent: Number(couponForm.discountPercent),
      maxDiscount: Number(couponForm.maxDiscount),
      minimumSubtotal: Number(couponForm.minimumSubtotal),
      usageLimit: couponForm.usageLimit ? Number(couponForm.usageLimit) : null,
      expiresAt: couponForm.expiresAt ? new Date(couponForm.expiresAt).toISOString() : null
    };
    try {
      await api.post('/coupons', payload, headers);
      setCouponForm({ code: '', discountPercent: '10', maxDiscount: '500', minimumSubtotal: '0', usageLimit: '', expiresAt: '' });
      setNotice('Coupon created.'); await load();
    } catch (requestError) { setError(requestError.response?.data?.message || 'Could not create coupon.'); }
  }
  async function setCouponActive(coupon) {
    try {
      await api.patch(`/coupons/${coupon._id}`, { isActive: !coupon.isActive }, headers);
      setNotice('Coupon status updated.'); await load();
    } catch (requestError) { setError(requestError.response?.data?.message || 'Could not update coupon.'); }
  }
  const revenue = isAdmin ? overview?.revenue : overview?.revenue;
  return (
    <main className="dashboard operations-page">
      <div className="eyebrow">NEXORA OPERATIONS</div><h1>{isAdmin ? 'Administrator' : 'Merchant'} <em>workspace.</em></h1><p>Manage your catalog, orders and marketplace activity.</p>
      {error && <p className="error">{error}</p>}{notice && <p className="success-message">{notice}</p>}
      {loading && !overview ? <p>Loading workspace…</p> : <>
        <div className="account-stats"><div><Package /><strong>{isAdmin ? overview?.products || 0 : products.length}</strong><span>Active products</span></div><div><ShoppingBag /><strong>{isAdmin ? overview?.orders || 0 : overview?.orders || orders.length}</strong><span>Orders</span></div><div><LayoutDashboard /><strong>{money(revenue)}</strong><span>{isAdmin ? 'Marketplace revenue' : 'Your product revenue'}</span></div>{isAdmin && <div><User /><strong>{overview?.pendingMerchants || 0}</strong><span>Pending merchants</span></div>}</div>
        {isAdmin && <div className="admin-shortcuts"><Link className="secondary-btn" to="/admin#users">Account controls</Link><Link className="secondary-btn" to="/admin#reports">Reports and analytics</Link></div>}
        <section className="orders-admin analytics-section" id="reports"><h2>Monthly sales report</h2>{reports.length ? <div className="analytics-table"><div className="analytics-row analytics-heading"><span>Month</span><span>Orders</span><span>Revenue</span></div>{reports.map(row => <div className="analytics-row" key={row._id}><span>{row._id}</span><span>{row.orders}</span><strong>{money(row.revenue)}</strong></div>)}</div> : <p>No completed sales data yet.</p>}</section>
        <section className="orders-admin inventory-alerts"><h2>Low-stock inventory</h2>{overview?.lowStock?.length ? overview.lowStock.map(product => <div className="analytics-row" key={product._id}><span>{product.name}</span><span>{product.stock} left</span><span>{product.category}</span></div>) : <p>No low-stock products.</p>}</section>
        <div className="dashboard-layout operations-layout">
          <form className="dashboard-form" onSubmit={saveProduct}>
            <h2>{editing ? 'Edit product' : 'Add a product'}</h2>
            <label>Product name<input required minLength={2} maxLength={160} value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} /></label>
            <label>Category<select value={form.category} onChange={event => setForm(current => ({ ...current, category: event.target.value }))}>{categories.map(category => <option key={category}>{category}</option>)}</select></label>
            <label>Brand<input maxLength={100} value={form.brand} onChange={event => setForm(current => ({ ...current, brand: event.target.value }))} /></label>
            <label>SKU<input maxLength={100} value={form.sku} onChange={event => setForm(current => ({ ...current, sku: event.target.value }))} /></label>
            <div className="form-two"><label>Price (₹)<input required type="number" min="0" step="0.01" value={form.price} onChange={event => setForm(current => ({ ...current, price: event.target.value }))} /></label><label>Compare price<input type="number" min="0" step="0.01" value={form.compareAtPrice} onChange={event => setForm(current => ({ ...current, compareAtPrice: event.target.value }))} /></label></div>
            <label>Stock<input required type="number" min="0" step="1" value={form.stock} onChange={event => setForm(current => ({ ...current, stock: event.target.value }))} /></label>
            <label>Description<textarea maxLength={5000} rows={4} value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} /></label>
            <label>Product image URL<input maxLength={2048} value={form.image} onChange={event => setForm(current => ({ ...current, image: event.target.value }))} placeholder="https://…" /></label>
            <label className="upload-field">Or upload image<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={uploadImage} disabled={uploading} /></label>
            {uploading && <p>Uploading image…</p>}{form.image && <img className="upload-preview" src={form.image} alt="Product preview" />}
            <button className="primary-btn" disabled={uploading}>{editing ? 'Save changes' : 'Create product'} <Plus size={17} /></button>
            {editing && <button type="button" className="secondary-btn" onClick={resetForm}>Cancel edit</button>}
          </form>
          <section className="operations-list"><h2>Product catalog ({products.length})</h2>{products.map(product => <div className="admin-row" key={product._id}><img src={product.image} alt="" /><div className="admin-row-copy"><strong>{product.name}</strong><p>{money(product.price)} · {product.stock} in stock · {product.isActive ? 'Published' : 'Hidden'}</p></div><button className="secondary-btn compact-btn" onClick={() => { setEditing(product._id); setForm({ name: product.name, category: product.category, brand: product.brand || '', sku: product.sku || '', price: product.price, compareAtPrice: product.compareAtPrice || '', stock: product.stock, image: product.image || '', cloudinaryPublicId: product.cloudinaryPublicId || '', description: product.description || '' }); }}>Edit</button><button className="secondary-btn compact-btn" aria-label={`Remove ${product.name}`} onClick={() => removeProduct(product._id)}><Trash2 size={16} /></button></div>)}</section>
        </div>
        <section className="orders-admin"><h2>Order fulfillment ({orders.length})</h2>{!orders.length ? <p>No orders yet.</p> : orders.map(order => <article className="operations-order" key={order._id}>
          <div className="operations-order-head"><div><strong>#{order.orderNumber || order._id.slice(-8).toUpperCase()}</strong><p>{order.customer?.name || 'Customer'} · {new Date(order.createdAt).toLocaleDateString()}</p></div><span className={`status-pill status-${order.status}`}>{order.status}</span><strong>{money(order.total)}</strong></div>
          <div className="operations-order-items">{order.items.map((item, index) => <div className="operations-order-item" key={`${item.product}-${index}`}><span>{item.name} × {item.quantity}</span><span>{isAdmin ? item.status || order.status : item.status || 'placed'}</span>{isAdmin ? <select aria-label={`Update status for order ${order.orderNumber}`} value={order.status} disabled={['cancelled', 'delivered'].includes(order.status)} onChange={event => changeOrderStatus(order._id, event.target.value)}>{['placed', 'processing', 'shipped', 'delivered', 'cancelled'].map(status => <option key={status} value={status}>{status}</option>)}</select> : <MerchantFulfillmentSelect item={item} order={order} onChange={changeOrderStatus} />}</div>)}</div>
          {isAdmin && <details className="admin-order-details"><summary>Delivery and payment details</summary><p>{order.address}</p><small>{order.paymentMethod} · {order.paymentStatus}</small></details>}
        </article>)}</section>
        {isAdmin && <section className="orders-admin admin-users" id="users"><h2>Accounts and merchant approvals ({userTotal})</h2>{users.map(user => <div className="admin-user-row" key={user._id}><div><strong>{user.name}</strong><p>{user.email}</p></div><span>{user.role}</span>{user.role === 'merchant' && <span className={user.merchantApproved ? 'approved-label' : 'pending-label'}>{user.merchantApproved ? 'Approved' : 'Pending'}</span>}{user.role === 'merchant' && <button className="secondary-btn compact-btn" onClick={() => approveMerchant(user._id, !user.merchantApproved)}>{user.merchantApproved ? 'Revoke approval' : 'Approve'}</button>}{user.role !== 'admin' && <select aria-label={`Change role for ${user.name}`} value={user.role} onChange={event => updateUser(user._id, { role: event.target.value })}><option value="customer">Customer</option><option value="merchant">Merchant</option></select>}{user.role !== 'admin' && <button className="secondary-btn compact-btn" onClick={() => updateUser(user._id, { active: !user.isActive })}>{user.isActive ? 'Suspend' : 'Reactivate'}</button>}</div>)}{userTotal > 50 && <div className="pagination"><button className="secondary-btn" disabled={userPage === 1} onClick={() => setUserPage(page => page - 1)}>Previous users</button><span>Page {userPage} of {Math.ceil(userTotal / 50)}</span><button className="secondary-btn" disabled={userPage >= Math.ceil(userTotal / 50)} onClick={() => setUserPage(page => page + 1)}>Next users</button></div>}</section>}
        {isAdmin && <section className="orders-admin coupon-manager"><h2>Coupon management</h2><form className="coupon-form" onSubmit={createCoupon}><label>Code<input required pattern="[A-Za-z0-9_-]{3,30}" maxLength={30} value={couponForm.code} onChange={event => setCouponForm(current => ({ ...current, code: event.target.value }))} /></label><label>Discount %<input required type="number" min="1" max="100" value={couponForm.discountPercent} onChange={event => setCouponForm(current => ({ ...current, discountPercent: event.target.value }))} /></label><label>Max discount (₹)<input required type="number" min="1" step="1" value={couponForm.maxDiscount} onChange={event => setCouponForm(current => ({ ...current, maxDiscount: event.target.value }))} /></label><label>Minimum subtotal (₹)<input type="number" min="0" step="1" value={couponForm.minimumSubtotal} onChange={event => setCouponForm(current => ({ ...current, minimumSubtotal: event.target.value }))} /></label><label>Use limit (optional)<input type="number" min="1" step="1" value={couponForm.usageLimit} onChange={event => setCouponForm(current => ({ ...current, usageLimit: event.target.value }))} /></label><label>Expiry (optional)<input type="datetime-local" value={couponForm.expiresAt} onChange={event => setCouponForm(current => ({ ...current, expiresAt: event.target.value }))} /></label><button className="primary-btn">Create coupon <Plus size={16} /></button></form>{coupons.map(coupon => <div className="coupon-row" key={coupon._id}><div><strong>{coupon.code}</strong><p>{coupon.discountPercent}% off · up to {money(coupon.maxDiscount)} · {coupon.usedCount}{coupon.usageLimit ? `/${coupon.usageLimit}` : ''} uses</p></div><span>{coupon.isActive ? 'Active' : 'Inactive'}</span><button className="secondary-btn compact-btn" onClick={() => setCouponActive(coupon)}>{coupon.isActive ? 'Deactivate' : 'Activate'}</button></div>)}</section>}
      </>}
    </main>
  );
}

function Footer() {
  return <footer className="footer"><div><Link className="logo" to="/">NEXORA<span className="logo-dot">.</span></Link><p>Objects with purpose. A life with meaning.</p></div><div><strong>Explore</strong><Link to="/shop">Shop all</Link><Link to="/shop?category=Fashion">Fashion</Link><Link to="/shop?category=Home">Living</Link></div><div><strong>Your account</strong><Link to="/account">My account</Link><Link to="/wishlist">Wishlist</Link><Link to="/login">Sign in</Link></div><div><strong>Connect</strong><span>Designed for discovery.</span><span>Made with intention.</span></div><div className="footer-bottom">© 2026 NEXORA. Crafted for better living. <span>Privacy · Terms · Accessibility</span></div></footer>;
}

function RoutedApp() {
  const location = useLocation();
  return <>
    <Header />
    <Routes location={location} key={`${location.pathname}${location.search}`}>
      <Route path="/" element={<Home />} />
      <Route path="/shop" element={<Shop />} />
      <Route path="/product/:id" element={<ProductPage />} />
      <Route path="/cart" element={<CartPage />} />
      <Route path="/wishlist" element={<WishlistPage />} />
      <Route path="/login" element={<Auth />} />
      <Route path="/account" element={<Account />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/dashboard" element={<Operations />} />
      <Route path="/admin" element={<Operations />} />
      <Route path="*" element={<main className="simple-page">Page not found. <Link to="/">Go home</Link></main>} />
    </Routes>
    <Footer />
    <CartDrawer />
  </>;
}

createRoot(document.getElementById('root')).render(<BrowserRouter><Provider><RoutedApp /></Provider></BrowserRouter>);
