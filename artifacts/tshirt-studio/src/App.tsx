import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type FormEvent } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  FileUp,
  LockKeyhole,
  LogIn,
  Menu,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Shirt,
  Settings2,
  ShoppingBag,
  Sparkles,
  Type,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import { Router as WouterRouter, useLocation } from 'wouter';
import QRCode from 'qrcode';
import brandLogo from '@assets/ChatGPT_Image_Sep_26,_2026,_03_50_11_PM-Photoroom_1790420243209.png';
import { categories, products, readyMadeDesigns, type Product, type ReadyMadeDesign } from './data';
import { GarmentModel } from './GarmentModel';
import './shop.css';
import './freeform-editor.css';

const FreeformEditor = lazy(() => import('./components/FreeformEditor').then((module) => ({ default: module.FreeformEditor })));
let activeProducts: Product[] = products;
let activeCategories = categories;
let activeReadyMadeDesigns = readyMadeDesigns;
function normalizeCatalogProduct(product: Product): Product {
  const neckText = product.neck.toLowerCase().replace(/[^a-z]/g, '');
  const typeText = product.type.toLowerCase().replace(/[^a-z]/g, '');
  const neck = neckText === 'vneck' || neckText === 'vnecck' || typeText === 'vneck' ? 'V neck' : neckText === 'polocollar' || typeText === 'polocollar' ? 'Polo collar' : 'Round neck';
  const type = neck;
  const fit = product.fit.toLowerCase().includes('oversized') ? 'Oversized' : 'Regular fit';
  return { ...product, type, neck, fit };
}

type View = 'front' | 'back' | 'left' | 'right';
type Placement = 'none' | 'front' | 'back' | 'both' | 'sides' | 'all' | 'custom';
type Elow = 'none' | 'one' | 'two';
type AuthMode = 'login' | 'signup';
type SignedInUser = { id: string; email: string; role: string };
type DesignConfig = { productId: string; color: string; placement: Placement; printSides?: View[]; elow: Elow; frontText: string; backText: string; leftText?: string; rightText?: string; size: string; quantity: number; artwork: string | null; backArtwork?: string | null; leftArtwork?: string | null; rightArtwork?: string | null; frontDocument?: string | null; backDocument?: string | null; leftDocument?: string | null; rightDocument?: string | null; hasArtwork?: boolean; hasBackArtwork?: boolean; hasLeftArtwork?: boolean; hasRightArtwork?: boolean };
type CartLine = { id: string; config: DesignConfig; unitPrice: number; lineTotal: number };
type PaymentMethod = 'full' | 'booking';
type PaymentSettings = { upiId: string; payeeName: string; fullPaymentEnabled: boolean; bookingPaymentEnabled: boolean; bookingAmount: number; codEnabled: boolean; deliveryThreshold: number; deliveryCharge: number; paymentInstructions: string };
type CatalogProduct = Product & { description?: string };
type ReadyMadeCategory = (typeof categories)[number];
type ManagedReadyMadeDesign = ReadyMadeDesign & { description?: string; tags?: string; image?: string };
type StoreOrder = { id: string; orderNumber: string; items: CartLine[]; address: Record<string, string>; subtotal: number; shipping: number; total: number; paymentMethod: PaymentMethod; paymentDue: number; status: string; paymentStatus: string; hasProof: boolean; customerEmail?: string; createdAt: string };

const colors = [
  { id: 'vermillion', name: 'Vermillion', hex: '#E84B35', label: 'Signature' },
  { id: 'ink', name: 'Ink', hex: '#252A35', label: 'Deep ink' },
  { id: 'pistachio', name: 'Pistachio', hex: '#C8D7B5', label: 'Soft green' },
  { id: 'butter', name: 'Butter', hex: '#F2D36C', label: 'Warm yellow' },
  { id: 'cloud', name: 'Cloud', hex: '#E8E5DC', label: 'Natural' },
  { id: 'cobalt', name: 'Cobalt', hex: '#3558B8', label: 'Blue' },
];
const emptyCatalogProduct: CatalogProduct = { id: '', name: '', type: 'Round neck', fit: 'Regular fit', neck: 'Round neck', price: 220, color: '#ebe8df', colorName: 'Cloud white', gsm: '180 GSM cotton', tag: 'New', description: '', image: '' };
const sizes = ['XS', 'S', 'M', 'L', 'XL', '2XL'];
const money = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;
const placementFromSides = (sides: View[]): Placement => {
  if (!sides.length) return 'none';
  if (sides.length === 4) return 'all';
  if (sides.includes('left') || sides.includes('right')) {
    if (sides.includes('left') && sides.includes('right') && sides.length === 2) return 'sides';
    return 'custom';
  }
  if (sides.includes('front') && sides.includes('back')) return 'both';
  return sides[0] as Placement;
};

async function apiJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { credentials: 'include', ...init, headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers } });
  const result = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? 'The request could not be completed.');
  return result;
}

function closestColor(hex: string) {
  const value = hex.replace('#', '');
  const target = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
  return colors.reduce((closest, color) => {
    const candidate = color.hex.replace('#', '');
    const rgb = [0, 2, 4].map((offset) => Number.parseInt(candidate.slice(offset, offset + 2), 16));
    const distance = rgb.reduce((total, channel, index) => total + (channel - target[index]) ** 2, 0);
    const closestHex = closest.hex.replace('#', '');
    const closestRgb = [0, 2, 4].map((offset) => Number.parseInt(closestHex.slice(offset, offset + 2), 16));
    const closestDistance = closestRgb.reduce((total, channel, index) => total + (channel - target[index]) ** 2, 0);
    return distance < closestDistance ? color : closest;
  });
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <a className={`brand brand-image ${compact ? 'brand-compact' : ''}`} href="/">
      <img src={brandLogo} alt="Backbenchers" />
      {!compact && <span>our product. your imagination.</span>}
    </a>
  );
}

function AdminPage({ onNotice }: { onNotice: (message: string) => void }) {
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [requests, setRequests] = useState<Record<string, unknown>[]>([]);
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [readyCategories, setReadyCategories] = useState<ReadyMadeCategory[]>([]);
  const [readyDesigns, setReadyDesigns] = useState<ManagedReadyMadeDesign[]>([]);
  const [tab, setTab] = useState<'dashboard' | 'orders' | 'bulk' | 'payments' | 'catalog' | 'ready-made'>('dashboard');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const refresh = async () => {
    setError('');
    try {
      const [orderData, bulkData, settingsData, catalogData, readyData] = await Promise.all([
        apiJson<{ orders: StoreOrder[] }>('/api/admin/orders'),
        apiJson<{ requests: Record<string, unknown>[] }>('/api/admin/bulk-requests'),
        apiJson<{ settings: PaymentSettings }>('/api/admin/settings/payment'),
        apiJson<{ products: CatalogProduct[] }>('/api/admin/catalog'),
        apiJson<{ categories: ReadyMadeCategory[]; designs: ManagedReadyMadeDesign[] }>('/api/admin/ready-made'),
      ]);
      setOrders(orderData.orders);
      setRequests(bulkData.requests);
      setSettings(settingsData.settings);
      setCatalog(catalogData.products);
      setReadyCategories(readyData.categories);
      setReadyDesigns(readyData.designs);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load admin data.'); }
  };
  useEffect(() => { void refresh(); }, []);
  const review = async (order: StoreOrder, decision: 'approve' | 'reject') => {
    try {
      await apiJson(`/api/admin/orders/${order.id}/review`, { method: 'POST', body: JSON.stringify({ decision }) });
      onNotice(decision === 'approve' ? `Payment verified for ${order.orderNumber}.` : `${order.orderNumber} rejected and cancelled.`);
      await refresh();
    } catch (reason) { onNotice(reason instanceof Error ? reason.message : 'Review action failed.'); }
  };
  const updateStatus = async (order: StoreOrder, status: string) => {
    try { await apiJson(`/api/admin/orders/${order.id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); await refresh(); }
    catch (reason) { onNotice(reason instanceof Error ? reason.message : 'Could not update order.'); }
  };
  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const result = await apiJson<{ settings: PaymentSettings }>('/api/admin/settings/payment', { method: 'PATCH', body: JSON.stringify(settings) });
      setSettings(result.settings);
      onNotice('Payment settings saved.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save payment settings.'); }
    finally { setSaving(false); }
  };
  const saveCatalog = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await apiJson<{ products: CatalogProduct[] }>('/api/admin/catalog', { method: 'PATCH', body: JSON.stringify({ products: catalog }) });
      setCatalog(result.products);
      onNotice('Catalog saved. New prices will be used for future orders.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save catalog.'); }
    finally { setSaving(false); }
  };
  const updateCatalogProduct = (index: number, patch: Partial<CatalogProduct>) => setCatalog((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const uploadCatalogImage = (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) {
      setError('Use a PNG, JPG or WebP image up to 4 MB.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => updateCatalogProduct(index, { image: String(reader.result) });
    reader.onerror = () => setError('Could not read the selected product image.');
    reader.readAsDataURL(file);
  };
  const addCatalogProduct = () => setCatalog((items) => [...items, { ...emptyCatalogProduct, id: `new-product-${Date.now()}` }]);
  const removeCatalogProduct = (index: number) => setCatalog((items) => items.length > 1 ? items.filter((_, itemIndex) => itemIndex !== index) : items);
  const saveReadyMade = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await apiJson<{ categories: ReadyMadeCategory[]; designs: ManagedReadyMadeDesign[] }>('/api/admin/ready-made', { method: 'PATCH', body: JSON.stringify({ categories: readyCategories, designs: readyDesigns }) });
      setReadyCategories(result.categories);
      setReadyDesigns(result.designs);
      activeCategories = result.categories;
      activeReadyMadeDesigns = result.designs;
      onNotice('Ready-made designs saved.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save ready-made designs.'); }
    finally { setSaving(false); }
  };
  const updateReadyCategory = (index: number, patch: Partial<ReadyMadeCategory>) => setReadyCategories((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const updateReadyDesign = (index: number, patch: Partial<ManagedReadyMadeDesign>) => setReadyDesigns((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const addReadyCategory = () => setReadyCategories((items) => [...items, { slug: `category-${Date.now()}`, name: 'New category', icon: '✨', color: '#5f6bd6' }]);
  const addReadyDesign = () => setReadyDesigns((items) => [...items, { id: `design-${Date.now()}`, category: readyCategories[0]?.slug ?? '', name: 'New design', color: '#5f6bd6', accent: '#f5f1e9', mark: '✨', description: '', tags: '', image: '' }]);
  const uploadReadyDesignImage = (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) {
      setError('Use a PNG, JPG or WebP image up to 4 MB.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => updateReadyDesign(index, { image: String(reader.result) });
    reader.onerror = () => setError('Could not read the selected design image.');
    reader.readAsDataURL(file);
  };
  const filteredOrders = orders.filter((order) => {
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const haystack = `${order.orderNumber} ${order.customerEmail ?? ''} ${order.address.name} ${order.address.phone}`.toLowerCase();
    return matchesStatus && haystack.includes(query.toLowerCase().trim());
  });
  const revenue = orders.filter((order) => order.paymentStatus === 'verified').reduce((sum, order) => sum + order.total, 0);
  const orderList = <section className="admin-order-list">{filteredOrders.length ? filteredOrders.map((order) => <article className="admin-order-card" key={order.id}>
      <div className="admin-order-heading"><div><span>{order.orderNumber}</span><h2>{order.customerEmail}</h2><small>{new Date(order.createdAt).toLocaleString()} · {order.address.name}, {order.address.phone}</small></div><div><b>{money(order.total)}</b><span className={`order-status status-${order.status}`}>{order.status.replaceAll('_', ' ')}</span><small>Payment: {order.paymentStatus.replaceAll('_', ' ')}</small></div></div>
      <div className="admin-order-items">{order.items.map((item, index) => <div key={`${order.id}-${index}`}><p>{activeProducts.find((product) => product.id === item.config.productId)?.name} · {item.config.color} · {item.config.size} · qty {item.config.quantity} · {money(item.lineTotal)}</p><div className="admin-artwork-grid">{(['front', 'back', 'left', 'right'] as View[]).map((side) => { const hasArtwork = side === 'front' ? item.config.hasArtwork : side === 'back' ? item.config.hasBackArtwork : side === 'left' ? item.config.hasLeftArtwork : item.config.hasRightArtwork; return hasArtwork && <a key={side} className="admin-artwork-preview" href={`/api/admin/orders/${order.id}/artwork/${index}/${side}`} target="_blank" rel="noreferrer"><img src={`/api/admin/orders/${order.id}/artwork/${index}/${side}`} alt={`${side} print artwork`} /><span>{side} print · high quality</span></a>; })}</div></div>)}</div>
      <p className="admin-address">Deliver to: {order.address.line1}, {order.address.city}, {order.address.state} {order.address.pincode}</p>
      <div className="admin-order-actions"><span className="admin-payment-summary">{order.paymentMethod === 'booking' ? `Booking: ${money(order.paymentDue)} · Balance: ${money(order.total - order.paymentDue)}` : `Full payment: ${money(order.paymentDue)}`}</span>{order.hasProof && <a className="outline-admin-button" href={`/api/admin/orders/${order.id}/proof`} target="_blank" rel="noreferrer">View payment screenshot <ArrowRight size={14} /></a>}{order.status === 'payment_review' && <><button className="admin-approve" onClick={() => void review(order, 'approve')}>Verify payment & approve</button><button className="admin-reject" onClick={() => void review(order, 'reject')}>Reject proof & cancel</button></>}{order.status === 'processing' && <button className="admin-approve" onClick={() => void updateStatus(order, 'shipped')}>Mark shipped</button>}{order.status === 'shipped' && <button className="admin-approve" onClick={() => void updateStatus(order, 'delivered')}>Mark delivered</button>}</div>
    </article>) : <div className="empty-shop"><h2>No matching orders.</h2><p>Try changing the search or status filter.</p></div>}</section>;
  return <main className="admin-page">
    <div className="admin-heading"><div><p className="eyebrow"><span /> PRIVATE OPERATIONS</p><h1>Order<br /><em>desk.</em></h1></div><span className="admin-status"><i /> Manual payment review</span></div>
    <nav className="admin-tabs"><button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}>Dashboard</button><button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>Orders ({orders.length})</button><button className={tab === 'catalog' ? 'active' : ''} onClick={() => setTab('catalog')}>Catalog management</button><button className={tab === 'ready-made' ? 'active' : ''} onClick={() => setTab('ready-made')}>Ready-made designs</button><button className={tab === 'payments' ? 'active' : ''} onClick={() => setTab('payments')}>Payment settings</button><button className={tab === 'bulk' ? 'active' : ''} onClick={() => setTab('bulk')}>Bulk ({requests.length})</button><button onClick={() => void refresh()}>Refresh</button></nav>
    <div className="admin-stats"><div><span>ALL ORDERS</span><strong>{orders.length}</strong><small>Persistent customer orders</small></div><div><span>PAYMENT REVIEWS</span><strong>{orders.filter((order) => order.status === 'payment_review').length}</strong><small>Check bank transaction first</small></div><div><span>VERIFIED REVENUE</span><strong>{money(revenue)}</strong><small>Approved orders</small></div><div><span>IN PRODUCTION</span><strong>{orders.filter((order) => order.status === 'processing').length}</strong><small>Verified only</small></div></div>
    {error && <p className="admin-error" role="alert">{error}</p>}
    {tab === 'dashboard' && <section className="admin-dashboard"><div className="admin-dashboard-card"><h2>Payment review queue</h2><p>{orders.filter((order) => order.status === 'payment_review').length} orders need transaction verification.</p><button className="admin-approve" onClick={() => { setStatusFilter('payment_review'); setTab('orders'); }}>Open review queue</button></div><div className="admin-dashboard-card"><h2>Operations</h2><p>{orders.filter((order) => order.status === 'processing').length} orders are ready for production or dispatch.</p><button className="outline-admin-button" onClick={() => { setStatusFilter('processing'); setTab('orders'); }}>View production</button></div></section>}
    {tab === 'orders' && <><div className="admin-order-filters"><input aria-label="Search orders" placeholder="Search order, customer or phone" value={query} onChange={(event) => setQuery(event.target.value)} /><select aria-label="Filter orders" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option>{['awaiting_payment', 'payment_review', 'processing', 'shipped', 'delivered', 'cancelled'].map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></div>{orderList}</>}
    {tab === 'payments' && settings && <form className="admin-settings-card" onSubmit={(event) => void saveSettings(event)}><h2>Payment settings</h2><p>These settings control the customer checkout and UPI QR. COD is intentionally disabled.</p><label>UPI ID<input required={settings.fullPaymentEnabled || settings.bookingPaymentEnabled} value={settings.upiId} onChange={(event) => setSettings({ ...settings, upiId: event.target.value })} placeholder="business@upi" /></label><label>Payee name<input value={settings.payeeName} onChange={(event) => setSettings({ ...settings, payeeName: event.target.value })} /></label><div className="admin-settings-grid"><label><input type="checkbox" checked={settings.fullPaymentEnabled} onChange={(event) => setSettings({ ...settings, fullPaymentEnabled: event.target.checked })} /> Enable full payment</label><label><input type="checkbox" checked={settings.bookingPaymentEnabled} onChange={(event) => setSettings({ ...settings, bookingPaymentEnabled: event.target.checked })} /> Enable ₹100 booking</label><label>Booking amount<input type="number" min="1" value={settings.bookingAmount} onChange={(event) => setSettings({ ...settings, bookingAmount: Number(event.target.value) })} /></label><label>Free delivery above<input type="number" min="0" value={settings.deliveryThreshold} onChange={(event) => setSettings({ ...settings, deliveryThreshold: Number(event.target.value) })} /></label><label>Delivery charge<input type="number" min="0" value={settings.deliveryCharge} onChange={(event) => setSettings({ ...settings, deliveryCharge: Number(event.target.value) })} /></label></div><label>Payment instructions<textarea rows={4} value={settings.paymentInstructions} onChange={(event) => setSettings({ ...settings, paymentInstructions: event.target.value })} /></label><button className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save payment settings'} <ArrowRight size={16} /></button></form>}
    {tab === 'catalog' && <form className="admin-settings-card admin-catalog-card" onSubmit={(event) => void saveCatalog(event)}><div className="admin-catalog-title"><div><h2>Catalog management</h2><p>Edit products shown in the storefront. Add a new product, upload its image, and manage its details.</p></div><button type="button" className="outline-admin-button" onClick={addCatalogProduct}><Plus size={15} /> Add product</button></div><div className="admin-catalog-list">{catalog.map((product, index) => <article className="admin-catalog-row" key={`${product.id}-${index}`}><div className="admin-catalog-image">{product.image ? <img src={product.image} alt={`${product.name} product`} /> : <span style={{ background: product.color }}>BB</span>}<label className="catalog-image-button">Change image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadCatalogImage(index, event)} /></label></div><div className="admin-catalog-fields"><div className="admin-catalog-row-heading"><strong>{product.id || 'New product'}</strong><button type="button" className="catalog-remove-button" onClick={() => removeCatalogProduct(index)} disabled={catalog.length === 1}>Remove</button></div><div className="admin-settings-grid"><label>Product ID<input required value={product.id} onChange={(event) => updateCatalogProduct(index, { id: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} /></label><label>Name<input required value={product.name} onChange={(event) => updateCatalogProduct(index, { name: event.target.value })} /></label><label>Price<input required type="number" min="1" value={product.price} onChange={(event) => updateCatalogProduct(index, { price: Number(event.target.value) })} /></label><label>Tags<input value={product.tag} onChange={(event) => updateCatalogProduct(index, { tag: event.target.value })} placeholder="New, bestseller, summer" /></label><label>Color name<input value={product.colorName} onChange={(event) => updateCatalogProduct(index, { colorName: event.target.value })} /></label><label>Hex color<input type="text" pattern="#[0-9a-fA-F]{6}" value={product.color} onChange={(event) => updateCatalogProduct(index, { color: event.target.value })} /></label><label>Type<input value={product.type} onChange={(event) => updateCatalogProduct(index, { type: event.target.value as Product['type'] })} /></label><label>Fit<input value={product.fit} onChange={(event) => updateCatalogProduct(index, { fit: event.target.value as Product['fit'] })} /></label><label>Neck<input value={product.neck} onChange={(event) => updateCatalogProduct(index, { neck: event.target.value as Product['neck'] })} /></label><label>Fabric / GSM<input value={product.gsm} onChange={(event) => updateCatalogProduct(index, { gsm: event.target.value })} /></label></div><label>Description<textarea rows={3} value={product.description ?? ''} onChange={(event) => updateCatalogProduct(index, { description: event.target.value })} placeholder="Describe the fit, fabric and ideal use." /></label><label>Image URL (optional)<input value={product.image.startsWith('data:') ? '' : product.image} onChange={(event) => updateCatalogProduct(index, { image: event.target.value })} placeholder="https://... or /product-images/tee.jpg" /></label><small>Product image supports upload, HTTPS URL, or a local /product-images/ path.</small></div></article>)}</div><button className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save catalog'} <ArrowRight size={16} /></button></form>}
    {tab === 'ready-made' && <form className="admin-settings-card admin-catalog-card" onSubmit={(event) => void saveReadyMade(event)}><div className="admin-catalog-title"><div><h2>Ready-made designs</h2><p>Manage the categories and designs shown on the homepage and ready-made pages.</p></div><div className="admin-ready-actions"><button type="button" className="outline-admin-button" onClick={addReadyCategory}><Plus size={15} /> Category</button><button type="button" className="outline-admin-button" onClick={addReadyDesign}><Plus size={15} /> Design</button></div></div><h3>Categories ({readyCategories.length})</h3><div className="admin-ready-category-grid">{readyCategories.map((category, index) => <article className="admin-ready-category" key={`${category.slug}-${index}`}><label>Slug<input value={category.slug} onChange={(event) => updateReadyCategory(index, { slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} /></label><label>Name<input value={category.name} onChange={(event) => updateReadyCategory(index, { name: event.target.value })} /></label><label>Icon<input value={category.icon} onChange={(event) => updateReadyCategory(index, { icon: event.target.value })} /></label><label>Color<input type="text" pattern="#[0-9a-fA-F]{6}" value={category.color} onChange={(event) => updateReadyCategory(index, { color: event.target.value })} /></label></article>)}</div><h3>Designs ({readyDesigns.length})</h3><div className="admin-ready-design-list">{readyDesigns.map((design, index) => <article className="admin-ready-design" key={`${design.id}-${index}`}><div className="admin-ready-preview" style={{ background: design.color }}><span>{design.mark}</span>{design.image && <img src={design.image} alt="" />}</div><div className="admin-catalog-fields"><div className="admin-settings-grid"><label>ID<input value={design.id} onChange={(event) => updateReadyDesign(index, { id: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} /></label><label>Category<select value={design.category} onChange={(event) => updateReadyDesign(index, { category: event.target.value })}>{readyCategories.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}</select></label><label>Name<input value={design.name} onChange={(event) => updateReadyDesign(index, { name: event.target.value })} /></label><label>Tags<input value={design.tags ?? ''} onChange={(event) => updateReadyDesign(index, { tags: event.target.value })} placeholder="street, bold" /></label><label>Design color<input value={design.color} onChange={(event) => updateReadyDesign(index, { color: event.target.value })} /></label><label>Accent color<input value={design.accent} onChange={(event) => updateReadyDesign(index, { accent: event.target.value })} /></label></div><label>Description<textarea rows={2} value={design.description ?? ''} onChange={(event) => updateReadyDesign(index, { description: event.target.value })} /></label><label className="catalog-image-button-inline">Upload image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadReadyDesignImage(index, event)} /></label><label>Image URL (optional)<input value={design.image?.startsWith('data:') ? '' : design.image ?? ''} onChange={(event) => updateReadyDesign(index, { image: event.target.value })} placeholder="https://... or /design-images/design.png" /></label></div></article>)}</div><button className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save ready-made designs'} <ArrowRight size={16} /></button></form>}
    {tab === 'bulk' && <section className="admin-order-list">{requests.length ? requests.map((request) => <article className="admin-order-card" key={String(request.id)}><div className="admin-order-heading"><div><span>{String(request.name)} · {String(request.quantity)} tees</span><h2>{String(request.email)}</h2><small>{String(request.phone)} · {new Date(String(request.created_at)).toLocaleString()}</small></div><span className="order-status">{String(request.status)}</span></div><p>{String(request.details)}</p></article>) : <div className="empty-shop"><h2>No bulk requests yet.</h2></div>}</section>}
  </main>;
}

function NotFoundPage() {
  const [, setLocation] = useLocation();
  return <main className="not-found"><h1>That page<br /><em>is blank.</em></h1><button className="primary-button" onClick={() => setLocation('/')}>Back home <ArrowRight size={16} /></button></main>;
}

function AdminGate({ onNotice, user, onLogin }: { onNotice: (message: string) => void; user: SignedInUser | null; onLogin: () => void }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    setAllowed(null);
    fetch('/api/admin/overview', { credentials: 'include', cache: 'no-store' }).then((response) => setAllowed(response.ok)).catch(() => setAllowed(false));
  }, [user?.id, user?.role]);
  if (allowed === null) return <main className="not-found"><p>Checking access…</p></main>;
  if (!allowed) return <main className="account-page"><section className="account-card"><p className="eyebrow"><span /> PRIVATE OPERATIONS</p><h1>Admin<br /><em>sign in.</em></h1><p>{user ? 'This account does not have administrator access.' : 'Sign in with the administrator account to open the order desk.'}</p>{user ? <><p className="auth-error" role="alert">Administrator access required.</p><button className="primary-button" onClick={onLogin}>Use admin account <ArrowRight size={16} /></button></> : <button className="primary-button" onClick={onLogin}>Sign in to admin panel <ArrowRight size={16} /></button>}</section></main>;
  return <AdminPage onNotice={onNotice} />;
}

function AppShell() {
  const [location, setLocation] = useLocation();
  const [modalOpen, setModalOpen] = useState(false);
  const [protectedAction, setProtectedAction] = useState('create an account');
  const [user, setUser] = useState<SignedInUser | null>(null);
  const [notice, setNotice] = useState('');
  const [bagCount, setBagCount] = useState(0);
  const [, setCatalogVersion] = useState(0);
  const afterAuthRef = useRef<(() => void) | undefined>(undefined);
  const showNotice = useCallback((message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 3500); }, []);
  useEffect(() => { void apiJson<{ user: SignedInUser | null }>('/api/auth/me').then((result) => setUser(result.user)).catch(() => setUser(null)); }, []);
  useEffect(() => {
    void apiJson<{ products: Product[] }>('/api/catalog').then((result) => {
      activeProducts = result.products.map(normalizeCatalogProduct);
      setCatalogVersion((version) => version + 1);
    }).catch(() => undefined);
  }, []);
  useEffect(() => {
    void apiJson<{ categories: ReadyMadeCategory[]; designs: ManagedReadyMadeDesign[] }>('/api/ready-made').then((result) => {
      activeCategories = result.categories;
      activeReadyMadeDesigns = result.designs;
      setCatalogVersion((version) => version + 1);
    }).catch(() => undefined);
  }, []);
  const refreshBag = useCallback(async () => {
    if (!user) { setBagCount(0); return; }
    try { const result = await apiJson<{ items: CartLine[] }>('/api/cart'); setBagCount(result.items.reduce((total, item) => total + item.config.quantity, 0)); }
    catch { setBagCount(0); }
  }, [user]);
  useEffect(() => { void refreshBag(); }, [refreshBag, location]);
  const openAuth = (action: string, callback?: () => void) => { setProtectedAction(action); afterAuthRef.current = callback; setModalOpen(true); };
  const authSuccess = (signedInUser: SignedInUser) => { setUser(signedInUser); setModalOpen(false); showNotice('You’re signed in. Your account is ready.'); afterAuthRef.current?.(); afterAuthRef.current = undefined; };
  const addToBag = async (config: DesignConfig, resumed = false) => {
    if (!user && !resumed) { openAuth('add this design to your bag', () => void addToBag(config, true)); return; }
    try { await apiJson('/api/cart', { method: 'POST', body: JSON.stringify({ config }) }); await refreshBag(); showNotice('Design added to your bag.'); setLocation('/cart'); }
    catch (reason) { showNotice(reason instanceof Error ? reason.message : 'Could not add this design.'); }
  };
  const saveDesign = async (config: DesignConfig, resumed = false) => {
    if (!user && !resumed) { openAuth('save this design', () => void saveDesign(config, true)); return; }
    const title = `${activeProducts.find((product) => product.id === config.productId)?.name ?? 'Custom tee'} design`;
    try { await apiJson('/api/designs', { method: 'POST', body: JSON.stringify({ title, config }) }); showNotice('Design saved to your account.'); }
    catch (reason) { showNotice(reason instanceof Error ? reason.message : 'Could not save this design.'); }
  };
  const logout = async () => { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => undefined); setUser(null); setBagCount(0); showNotice('You have been logged out.'); };
  const isLoggedIn = Boolean(user);
  const page = location.startsWith('/editor') ? <EditorPage onNotice={showNotice} onSaveDesign={(config) => void saveDesign(config)} onAddToCart={(config) => void addToBag(config)} />
    : location === '/catalog' ? <CatalogPage />
    : location.startsWith('/category/') ? <CategoryPage slug={location.split('/')[2] ?? 'gaming'} />
    : location === '/cart' ? <CartPage isLoggedIn={isLoggedIn} openAuth={openAuth} onNotice={showNotice} />
    : location === '/checkout' ? <CheckoutPage isLoggedIn={isLoggedIn} openAuth={openAuth} onNotice={showNotice} />
    : location === '/account' ? <AccountPage user={user} onLogin={() => openAuth('create an account')} onLogout={logout} onNotice={showNotice} />
    : location === '/atelier-console' ? <AdminGate onNotice={showNotice} user={user} onLogin={() => openAuth('access the admin panel')} />
    : location === '/' || location.startsWith('/#') ? <HomePage onNotice={showNotice} isLoggedIn={isLoggedIn} openAuth={openAuth} />
    : <NotFoundPage />;
  return <div className="app-shell"><div className="grain" /><Header onLogin={() => openAuth('create an account')} isLoggedIn={isLoggedIn} bagCount={bagCount} />{page}<Footer /><WhatsAppButton />{notice && <div className="toast-message" role="status"><Check size={16} /> {notice}</div>}<AuthModal open={modalOpen} action={protectedAction} onClose={() => setModalOpen(false)} onSuccess={authSuccess} /></div>;
}

function App() { return <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><AppShell /></WouterRouter>; }

export default App;

function ShirtPreview({ color, view = 'front', mark = 'BB', compact = false, image }: { color: string; view?: View; mark?: string; compact?: boolean; image?: string | null }) {
  return (
    <div className={`shirt-stage ${compact ? 'shirt-stage-compact' : ''}`} style={{ '--shirt-color': color } as CSSProperties}>
      {image ? (
        <div className={`shirt-photo-frame photo-view-${view}`}>
          <img src={image} alt="T-shirt product photo" />
          <div className="photo-print">{mark}</div>
        </div>
      ) : (
        <>
          <div className={`shirt-shadow shadow-${view}`} />
          <div className={`shirt-shape shirt-${view}`}>
            <div className="shirt-sleeve sleeve-left" />
            <div className="shirt-sleeve sleeve-right" />
            <div className="shirt-neck" />
            <div className="shirt-seam seam-left" />
            <div className="shirt-seam seam-right" />
            <div className="shirt-print"><span>{mark}</span></div>
          </div>
        </>
      )}
    </div>
  );
}

function Header({ onLogin, isLoggedIn, bagCount }: { onLogin: () => void; isLoggedIn: boolean; bagCount: number }) {
  const [, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="topbar">
      <Brand />
      <nav className={`nav-links ${menuOpen ? 'nav-open' : ''}`}>
        <button onClick={() => setLocation('/')}>Home</button>
        <button onClick={() => setLocation('/catalog')}>Catalog</button>
        <button onClick={() => setLocation('/#ready-made')}>Ready-made designs</button>
        <button onClick={() => setLocation('/#upload-design')}>Upload your design</button>
      </nav>
      <div className="nav-actions">
        <button className="login-button" onClick={() => isLoggedIn ? setLocation('/account') : onLogin()}>{isLoggedIn ? <UserRound size={15} /> : <LogIn size={15} />} {isLoggedIn ? 'Account' : 'Login'}</button>
        <button className="bag-button" onClick={() => setLocation('/cart')}><ShoppingBag size={18} /><span>Bag</span><b>{bagCount}</b></button>
        <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Open menu"><Menu size={19} /></button>
      </div>
    </header>
  );
}

function Footer() {
  const [, setLocation] = useLocation();
  return (
    <footer className="footer">
      <Brand compact />
      <div className="footer-links"><button onClick={() => setLocation('/catalog')}>Catalog</button><button onClick={() => setLocation('/#upload-design')}>Upload design</button><button onClick={() => setLocation('/#businesses')}>Bulk orders</button></div>
      <span>© 2026 Backbenchers</span>
    </footer>
  );
}

function WhatsAppButton() {
  const message = encodeURIComponent('Hi Backbenchers, mujhe custom T-shirt ke baare mein baat karni hai.');
  return <a className="whatsapp-button" href={`https://wa.me/918302718516?text=${message}`} target="_blank" rel="noreferrer" aria-label="Chat with Backbenchers on WhatsApp"><span>WhatsApp</span><b>↗</b></a>;
}

function AuthModal({ open, action, onClose, onSuccess }: { open: boolean; action: string; onClose: () => void; onSuccess: (user: SignedInUser) => void }) {
  const [mode, setMode] = useState<AuthMode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open && action.includes('admin')) {
      setMode('login');
      setError('');
    }
  }, [action, open]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json().catch(() => ({})) as { user?: SignedInUser; error?: string };
      if (response.status === 404) throw new Error('The account service is not available. Start the website and API server, then try again.');
      if (!response.ok || !result.user) throw new Error(result.error ?? 'Unable to sign in right now.');
      onSuccess(result.user);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not reach the account service.');
    } finally {
      setBusy(false);
    }
  };
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="otp-modal" role="dialog" aria-modal="true" aria-labelledby="otp-title">
        <button className="modal-close" onClick={onClose} aria-label="Close login modal"><X size={18} /></button>
        <div className="modal-mark"><LockKeyhole size={20} /></div>
        <p className="eyebrow"><span /> {mode === 'signup' ? 'CREATE YOUR ACCOUNT' : 'WELCOME BACK'}</p><h2 id="otp-title">Keep your<br /><em>good idea.</em></h2>
        <p className="modal-copy">{action === 'create an account' ? 'Sign in or create an account to keep your designs close.' : `${mode === 'signup' ? 'Create an account' : 'Log in'} to ${action} and keep your designs close.`}</p>
        <form onSubmit={submit}>
          <label className="phone-label">Email address<input className="otp-input" autoFocus required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
          <label className="phone-label">Password<input className="otp-input" required type="password" minLength={8} maxLength={128} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="modal-primary" disabled={busy || !email || password.length < 8} type="submit">{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Log in'} <ArrowRight size={17} /></button>
        </form>
        <button className="resend-button" onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(''); }}>{mode === 'signup' ? 'Already have an account? Log in' : 'New here? Create an account'}</button>
        <div className="modal-safe"><LockKeyhole size={13} /> Your account details are stored securely.</div>
      </div>
    </div>
  );
}

function BulkRequestModal({ open, onClose, onNotice }: { open: boolean; onClose: () => void; onNotice: (message: string) => void }) {
  const [values, setValues] = useState({ name: '', email: '', phone: '', quantity: '10', details: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!open) return null;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await apiJson('/api/bulk-requests', { method: 'POST', body: JSON.stringify({ ...values, quantity: Number(values.quantity) }) }); onClose(); onNotice('Bulk quote request received. Our team will contact you.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not submit your request.'); }
    finally { setBusy(false); }
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="otp-modal" role="dialog" aria-modal="true" aria-labelledby="bulk-title"><button className="modal-close" onClick={onClose} aria-label="Close bulk quote form"><X size={18} /></button><div className="modal-mark"><Shirt size={20} /></div><p className="eyebrow"><span /> SQUAD & BULK ORDERS</p><h2 id="bulk-title">Let’s make<br /><em>your batch.</em></h2><form className="bulk-form" onSubmit={(event) => void submit(event)}><label>Your name<input required minLength={2} maxLength={100} value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} /></label><label>Email<input required type="email" value={values.email} onChange={(event) => setValues({ ...values, email: event.target.value })} /></label><label>Mobile<input required inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} value={values.phone} onChange={(event) => setValues({ ...values, phone: event.target.value.replace(/\D/g, '').slice(0, 10) })} /></label><label>Quantity (10–5,000)<input required type="number" min="10" max="5000" value={values.quantity} onChange={(event) => setValues({ ...values, quantity: event.target.value })} /></label><label>What do you need?<textarea maxLength={2000} rows={3} value={values.details} onChange={(event) => setValues({ ...values, details: event.target.value })} placeholder="Sizes, event date, print idea…" /></label>{error && <p className="auth-error" role="alert">{error}</p>}<button className="modal-primary" disabled={busy}>{busy ? 'Sending…' : 'Request a quote'} <ArrowRight size={16} /></button></form></section></div>;
}

function ProductCard({ product, onEdit }: { product: Product; onEdit: () => void }) {
  return (
    <article className="product-card">
      <div className="product-image"><span className="product-tag">{product.tag}</span><ShirtPreview color={product.color} mark="BB" image={product.image} compact /><button className="product-edit" onClick={onEdit}><Pencil size={14} /> Edit this tee</button></div>
      <div className="product-meta"><div><span className="product-type">{product.type}</span><h3>{product.name}</h3></div><strong>{money(product.price)}</strong></div>
      <p>{product.description || `${product.fit} · ${product.neck} · ${product.colorName}`}</p>
    </article>
  );
}

function EditorMockup() {
  return (
    <div className="editor-mockup">
      <div className="mockup-toolbar"><span className="mockup-dot" /><span>BACKBENCHERS / STUDIO</span><span>CHECK PRICE</span></div>
      <div className="mockup-content">
        <div className="mockup-sidebar"><span>COLOUR</span><div className="mockup-swatches"><i /><i /><i /><i /></div><span>PLACEMENT</span><div className="mockup-lines"><b /><b /><b /></div><span>ADD TEXT</span><div className="mockup-input" /></div>
        <div className="mockup-shirt"><ShirtPreview color="#d94b35" mark="07" image="/product-images/regular-fit-white.jpg" compact /></div>
        <div className="mockup-right"><span>PREVIEW</span><b>FRONT</b><b>BACK</b><div className="mockup-button">CHECK PRICE →</div></div>
      </div>
    </div>
  );
}

function HomePage({ onNotice, isLoggedIn, openAuth }: { onNotice: (message: string) => void; isLoggedIn: boolean; openAuth: (action: string, callback?: () => void) => void }) {
  const [, setLocation] = useLocation();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const [bulkOpen, setBulkOpen] = useState(false);
  const heroDesigns = [{ color: '#d94b35', mark: '07', label: 'REGULAR FIT', image: '/product-images/regular-fit-white.jpg' }, { color: '#2a3150', mark: 'PLAY', label: 'OVERSIZED', image: '/product-images/oversized-black.jpg' }, { color: '#d8b64e', mark: 'BB', label: 'V NECK', image: '/product-images/v-neck-white.jpg' }, { color: '#6b866c', mark: 'MUMBAI', label: 'POLO COLLAR', image: '/product-images/polo-navy.jpg' }];
  useEffect(() => { const timer = window.setInterval(() => setHeroIndex((value) => (value + 1) % heroDesigns.length), 2500); return () => window.clearInterval(timer); }, [heroDesigns.length]);
  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) {
      onNotice('Choose a PNG, JPG or WebP image smaller than 4 MB.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      sessionStorage.setItem('draftArtwork', String(reader.result));
      setLocation('/editor?product=regular-white');
    };
    reader.readAsDataURL(file);
  };
  const askUpload = () => { if (!isLoggedIn) { openAuth('upload your design', () => uploadInputRef.current?.click()); } else uploadInputRef.current?.click(); };
  return (
    <main>
      <section className="home-hero">
        <div className="hero-copy"><p className="eyebrow"><span /> OUR PRODUCT. YOUR IMAGINATION.</p><h1>Make what<br /><em>you mean.</em></h1><p className="hero-subtitle">Custom T-shirts for ideas, inside jokes, big days and the people you want beside you.</p><div className="hero-actions"><button className="primary-button" onClick={() => setLocation('/catalog')}>Start designing <ArrowRight size={17} /></button><button className="text-button" onClick={() => setLocation('/catalog')}>Browse catalog</button></div></div>
        <div className="hero-animation"><div className="hero-orbit orbit-a" /><div className="hero-orbit orbit-b" /><div className="hero-animation-copy"><span>0{heroIndex + 1} / 04</span><b>{heroDesigns[heroIndex].label}</b></div><div className="hero-shirt-wrap" key={heroIndex} style={{ '--hero-color': heroDesigns[heroIndex].color } as CSSProperties}><ShirtPreview color={heroDesigns[heroIndex].color} mark={heroDesigns[heroIndex].mark} image={heroDesigns[heroIndex].image} compact /></div><div className="hero-note note-top">CHANGE THE<br /><strong>MOOD.</strong></div><div className="hero-note note-bottom">real 2D product / made for print</div></div>
      </section>

      <section className="idea-section"><div className="idea-copy"><p className="eyebrow"><span /> YOU IMAGINE. WE MAKE IT.</p><h2>FROM IDEA<br />TO <em>T-SHIRT.</em></h2><p>Creating your own T-shirt is easier than you think.</p><div className="steps-list"><div><b>01</b><span><strong>CHOOSE</strong>Pick your T-shirt, fit and colour.</span></div><div><b>02</b><span><strong>CREATE</strong>Upload your artwork or create one from scratch.</span></div><div><b>03</b><span><strong>PERSONALIZE</strong>Add your name, number, text, photo, logo, QR or Instagram ID.</span></div><div><b>04</b><span><strong>WEAR</strong>Preview it. Order it. We print and deliver it.</span></div></div></div><div className="idea-mockup"><EditorMockup /><button className="mockup-cta" onClick={() => setLocation('/catalog')}>Open the editor <ArrowRight size={16} /></button></div></section>

      <section className="ready-section" id="ready-made"><div className="ready-heading"><div><p className="eyebrow"><span /> READY-MADE DESIGNS</p><h2>DON'T WANT TO DESIGN?<br /><em>WE'VE GOT YOU.</em></h2></div><p>Pick a design. Make it yours.</p></div><div className="category-strip">{activeCategories.map((category) => <button className="category-card" key={category.slug} onClick={() => setLocation(`/category/${category.slug}`)}><span className="category-art" style={{ '--category-color': category.color } as CSSProperties}><b>{category.icon}</b><i>{category.name.slice(0, 2)}</i></span><span className="category-name">{category.name}</span><ArrowRight size={15} /><small>VIEW DESIGNS</small></button>)}</div><button className="outline-light-button" onClick={() => setLocation(`/category/${activeCategories[0]?.slug ?? 'gaming'}`)}>View all ready-made designs <ArrowRight size={16} /></button></section>

      <section className="upload-section" id="upload-design"><div className="upload-copy"><p className="eyebrow"><span /> UPLOAD YOUR DESIGN</p><h2>ALREADY HAVE<br /><em>A DESIGN?</em></h2><p>Upload it. Place it. Wear it.</p><small>PNG, JPG or WebP · 4 MB max. Your artwork is stored with your order after checkout.</small></div><div className="dropzone" onClick={askUpload} onKeyDown={(event) => event.key === 'Enter' && askUpload()} role="button" tabIndex={0}><FileUp size={28} /><strong>DROP YOUR DESIGN HERE</strong><span>PNG / JPG / WEBP · 4 MB MAX</span><button className="primary-button" onClick={(event) => { event.stopPropagation(); askUpload(); }}>UPLOAD YOUR DESIGN <Upload size={16} /></button><input ref={uploadInputRef} hidden type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" onChange={handleUpload} />{!isLoggedIn && <small className="upload-gate"><LockKeyhole size={12} /> Sign in required to continue to the editor</small>}</div></section>

      <section className="squad-section"><div className="squad-art"><div className="squad-stack"><ShirtPreview color="#d94b35" mark="07" image="/product-images/regular-fit-white.jpg" compact /><ShirtPreview color="#29345e" mark="18" image="/product-images/oversized-black.jpg" compact /><ShirtPreview color="#d6b646" mark="23" image="/product-images/polo-navy.jpg" compact /></div><span>THE<br /><strong>SQUAD</strong></span></div><div className="squad-copy"><p className="eyebrow"><span /> DESIGN YOUR SQUAD</p><h2>ONE DESIGN.<br /><em>YOUR WHOLE SQUAD.</em></h2><p>College fest? Gaming team? Friends? Event?</p><div className="feature-pills"><span>✓ Same design</span><span>✓ Different names</span><span>✓ Different numbers</span><span>✓ Different sizes</span><span>✓ Bulk pricing</span></div><div className="squad-table"><div><span>Name</span><span>Size</span><span>Number</span></div><div><b>Example</b><span>L</span><span>07</span><span /></div></div><button className="primary-button" onClick={() => setBulkOpen(true)}>Request a squad quote <ArrowRight size={17} /></button></div></section>

      <section className="business-section" id="businesses"><div className="business-heading"><p className="eyebrow"><span /> FOR BUSINESSES</p><h2>MADE FOR MORE<br />THAN JUST <em>YOU.</em></h2><p>Custom merchandise for brands, teams and businesses.</p><button className="primary-button" onClick={() => setBulkOpen(true)}>Get bulk quote <ArrowRight size={16} /></button></div><div className="business-grid">{['CORPORATE|Company T-shirts & uniforms', 'EVENTS|Events, festivals & campaigns', 'COLLEGE|Societies, fests & batches', 'GAMING|Teams & esports merchandise', 'CAFÉ / RESTAURANT|Custom staff merchandise'].map((item, index) => { const [title, detail] = item.split('|'); return <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{detail}</p><ArrowRight size={18} /></article>; })}</div></section>

      <section className="testimonials-section"><p className="eyebrow"><span /> YOUR ORDER, YOUR WAY</p><h2>Designed by you.<br /><em>Checked by us.</em></h2><div className="feature-pills"><span>01 · Pick a garment</span><span>02 · Personalize the print</span><span>03 · Pay by UPI</span><span>04 · We verify your proof</span><span>05 · Track fulfillment in your account</span></div></section>
      <BulkRequestModal open={bulkOpen} onClose={() => setBulkOpen(false)} onNotice={onNotice} />
    </main>
  );
}
function EditorPage({ onNotice, onSaveDesign, onAddToCart }: { onNotice: (message: string) => void; onSaveDesign: (config: DesignConfig) => void; onAddToCart: (config: DesignConfig) => void }) {
  const [, setLocation] = useLocation();
  const [restoredDesign] = useState<DesignConfig | null>(() => {
    const saved = typeof window !== 'undefined' ? sessionStorage.getItem('savedDesignDraft') : null;
    if (!saved) return null;
    sessionStorage.removeItem('savedDesignDraft');
    try { return JSON.parse(saved) as DesignConfig; } catch { return null; }
  });
  const productId = restoredDesign?.productId ?? (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('product') : null);
  const product = activeProducts.find((item) => item.id === productId) ?? activeProducts[0];
  const [selectedColor, setSelectedColor] = useState(() => {
    const requestedColor = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('color')?.toLowerCase() : null;
    return colors.find((item) => item.id === requestedColor || item.name.toLowerCase() === requestedColor || item.hex.toLowerCase() === requestedColor) ?? (restoredDesign ? closestColor(restoredDesign.color) : closestColor(product.color));
  });
  const [view, setView] = useState<View>(() => {
    const requestedView = new URLSearchParams(window.location.search).get('view');
    return requestedView === 'back' || requestedView === 'left' || requestedView === 'right'
      ? requestedView
      : 'front';
  });
  const [overlayHost, setOverlayHost] = useState<HTMLDivElement | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [placement, setPlacement] = useState<Placement>(restoredDesign?.placement ?? 'front');
  const [printSides, setPrintSides] = useState<View[]>(restoredDesign?.printSides ?? (restoredDesign?.placement === 'back' ? ['back'] : restoredDesign?.placement === 'both' ? ['front', 'back'] : restoredDesign?.placement === 'sides' ? ['left', 'right'] : restoredDesign?.placement === 'all' ? ['front', 'back', 'left', 'right'] : ['front']));
  const [elow, setElow] = useState<Elow>(restoredDesign?.elow ?? 'none');
  const [frontText, setFrontText] = useState(restoredDesign?.frontText ?? '');
  const [backText, setBackText] = useState(restoredDesign?.backText ?? '');
  const [leftText, setLeftText] = useState(restoredDesign?.leftText ?? '');
  const [rightText, setRightText] = useState(restoredDesign?.rightText ?? '');
  const [selectedSize, setSelectedSize] = useState(restoredDesign?.size ?? 'M');
  const [quantity, setQuantity] = useState(restoredDesign?.quantity ?? 1);
  const [uploadedImage, setUploadedImage] = useState<string | null>(() => {
    const artwork = restoredDesign?.artwork ?? (typeof window !== 'undefined' ? sessionStorage.getItem('draftArtwork') : null);
    if (artwork) sessionStorage.removeItem('draftArtwork');
    return artwork;
  });
  const [backArtwork, setBackArtwork] = useState<string | null>(restoredDesign?.backArtwork ?? null);
  const [leftArtwork, setLeftArtwork] = useState<string | null>(restoredDesign?.leftArtwork ?? null);
  const [rightArtwork, setRightArtwork] = useState<string | null>(restoredDesign?.rightArtwork ?? null);
  const [frontDocument, setFrontDocument] = useState<string | null>(restoredDesign?.frontDocument ?? null);
  const [backDocument, setBackDocument] = useState<string | null>(restoredDesign?.backDocument ?? null);
  const [leftDocument, setLeftDocument] = useState<string | null>(restoredDesign?.leftDocument ?? null);
  const [rightDocument, setRightDocument] = useState<string | null>(restoredDesign?.rightDocument ?? null);
  const [showPrice, setShowPrice] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const onUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) {
      onNotice('Choose a PNG, JPG or WebP under 4 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setUploadedImage(String(reader.result));
    reader.readAsDataURL(file);
  };
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('color', selectedColor.id);
    window.history.replaceState(null, '', url);
  }, [selectedColor.id]);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('view', view);
    window.history.replaceState(null, '', url);
  }, [view]);
  useEffect(() => {
    if (!isSpinning) return;
    const interval = window.setInterval(() => {
      setView((current) => {
        const views: View[] = ['front', 'right', 'back', 'left'];
        return views[(views.indexOf(current) + 1) % views.length];
      });
    }, 850);
    return () => window.clearInterval(interval);
  }, [isSpinning]);
  const prices = useMemo(() => {
    const hasFrontBack = printSides.includes('front') && printSides.includes('back');
    const hasAllSides = printSides.length === 4;
    const print = hasAllSides ? 300 : hasFrontBack ? 200 : (printSides.includes('front') ? 120 : 0) + (printSides.includes('back') ? 120 : 0) + (printSides.includes('left') ? 80 : 0) + (printSides.includes('right') ? 80 : 0);
    const elowCost = { none: 0, one: 50, two: 50 }[elow];
    const frontTextPrice = frontText.trim() ? 50 : 0;
    const backTextPrice = backText.trim() ? 50 : 0;
    const leftTextPrice = leftText.trim() ? 50 : 0;
    const rightTextPrice = rightText.trim() ? 50 : 0;
    const unit = product.price + print + elowCost + frontTextPrice + backTextPrice + leftTextPrice + rightTextPrice;
    return { print, elow: elowCost, frontTextPrice, backTextPrice, leftTextPrice, rightTextPrice, total: unit * quantity };
  }, [backText, elow, frontText, leftText, placement, printSides, product.price, quantity, rightText]);
  const currentDesign = (): DesignConfig => ({ productId: product.id, color: selectedColor.hex, placement, printSides, elow, frontText, backText, leftText, rightText, size: selectedSize, quantity, artwork: uploadedImage, backArtwork, leftArtwork, rightArtwork, frontDocument, backDocument, leftDocument, rightDocument });
  const updateCanvas = (change: { side: View; artwork: string | null; document: string; textContent: string }) => {
    const sideArtwork: Record<View, string | null> = { front: uploadedImage, back: backArtwork, left: leftArtwork, right: rightArtwork };
    const sideText: Record<View, string> = { front: frontText, back: backText, left: leftText, right: rightText };
    sideArtwork[change.side] = change.artwork;
    sideText[change.side] = change.textContent;
    if (change.side === 'front') {
      setUploadedImage(change.artwork); setFrontDocument(change.document); setFrontText(change.textContent);
    } else if (change.side === 'back') {
      setBackArtwork(change.artwork); setBackDocument(change.document); setBackText(change.textContent);
    } else if (change.side === 'left') {
      setLeftArtwork(change.artwork); setLeftDocument(change.document); setLeftText(change.textContent);
    } else {
      setRightArtwork(change.artwork); setRightDocument(change.document); setRightText(change.textContent);
    }
    const nextSides = (['front', 'back', 'left', 'right'] as View[]).filter((side) => Boolean(sideArtwork[side] || sideText[side]));
    setPrintSides(nextSides);
    setPlacement(placementFromSides(nextSides));
  };
  return (
    <main className="editor-page"><div className="editor-page-top"><button className="back-link" onClick={() => setLocation('/catalog')}><ChevronLeft size={16} /> Back to catalog</button><span>EDITOR / {product.name}</span><button className="save-link" onClick={() => onSaveDesign(currentDesign())}><LockKeyhole size={14} /> Save design</button></div><div className="editor-intro"><div><p className="eyebrow"><span /> THE EDITOR</p><h1>Make it<br /><em>personal.</em></h1></div><p>Choose your blank, add your idea, and check the exact price only when you’re ready.</p></div>
      <div className="editor-layout">
        <section className="editor-preview-panel">
          <div className="panel-topline">
            <span className="live-pill"><i /> live preview</span>
            <span>{product.fit} / {product.neck} / {selectedColor.name}</span>
          </div>
          <div className="editor-model-stage">
            <GarmentModel
              color={selectedColor.hex}
              fit={product.fit}
              neck={product.neck}
              view={view}
              placement="none"
              frontText=""
              backText=""
              artwork={null}
            />
            <div className="garment-edit-overlay-host" ref={setOverlayHost} />
          </div>
          <nav className="model-views" aria-label="Garment view">
            {(['front', 'back', 'right', 'left'] as View[]).map((item) => (
              <button
                key={item}
                type="button"
                className={`model-view-button ${view === item ? 'active' : ''}`}
                onClick={() => { setIsSpinning(false); setView(item); }}
                aria-label={`Show ${item} view`}
                aria-pressed={view === item}
              >
                <span className={`model-view-thumb model-view-thumb-${item}`}><Shirt size={26} strokeWidth={1.4} /></span>
                <span>{item}</span>
              </button>
            ))}
          </nav>
          <button
            className={`model-rotate-button ${isSpinning ? 'is-spinning' : ''}`}
            type="button"
            onClick={() => setIsSpinning((active) => !active)}
            aria-pressed={isSpinning}
          >
            <RotateCcw size={15} /> {isSpinning ? 'Stop 360°' : 'Try 360°'}
          </button>
        </section>
        <section className="controls-panel"><Suspense fallback={<div className="freeform-loading">Opening the design studio…</div>}><FreeformEditor side={view} onSideChange={setView} overlayHost={overlayHost} documents={{ front: frontDocument, back: backDocument, left: leftDocument, right: rightDocument }} artwork={{ front: uploadedImage, back: backArtwork, left: leftArtwork, right: rightArtwork }} text={{ front: frontText, back: backText, left: leftText, right: rightText }} onChange={updateCanvas} onNotice={onNotice} /></Suspense><div className="control-heading"><span className="step-number">01</span><div><h3>Start with a blank</h3><p>Pick the colour that feels like you.</p></div></div><div className="color-row">{colors.map((color) => <button key={color.id} className={`color-swatch ${selectedColor.id === color.id ? 'selected' : ''}`} style={{ '--swatch': color.hex } as CSSProperties} onClick={() => setSelectedColor(color)} aria-label={`Select ${color.name}`}>{selectedColor.id === color.id && <Check size={15} />}</button>)}<span className="selected-color-name">{selectedColor.name}<small>{selectedColor.label}</small></span></div><div className="control-divider" /><div className="control-heading"><span className="step-number">02</span><div><h3>Print placement</h3><p>Choose front, back, or all four sides.</p></div></div>        <div className="choice-grid">{([['none', 'No print', 'blank'], ['front', 'Front only', '₹120'], ['back', 'Back only', '₹120'], ['both', 'Front + back', '₹200'], ['all', 'All 4 sides', '₹300'], ...(placement === 'custom' ? [['custom', 'Custom sides', 'By side'] as [Placement, string, string]] : [])] as [Placement, string, string][]).map(([id, label, price]) => <button key={id} className={`choice-card ${placement === id ? 'selected' : ''}`} onClick={() => { if (id === 'custom') return; setPlacement(id); setPrintSides(id === 'none' ? [] : id === 'front' ? ['front'] : id === 'back' ? ['back'] : id === 'both' ? ['front', 'back'] : ['front', 'back', 'left', 'right']); }}><span>{label}</span><small>{price}</small>{placement === id && <Check size={14} />}</button>)}</div>        <div className="elow-row elow-featured"><div><strong>Choose ELOW</strong><span>Add sleeve detail</span></div><div className="elow-choices">{([['none', 'None', '₹0'], ['one', 'One sleeve', '₹50'], ['two', 'Two sleeves', '₹50']] as [Elow, string, string][]).map(([id, label, price]) => <button key={id} className={elow === id ? 'active' : ''} onClick={() => setElow(id)}>{label} <small>{price}</small></button>)}</div>{elow !== 'none' && <div className="elow-sleeve-toggle" role="group" aria-label="Choose sleeve"><button type="button" className={view === 'left' ? 'active' : ''} onClick={() => setView('left')}>Left Sleeve</button><button type="button" className={view === 'right' ? 'active' : ''} onClick={() => setView('right')}>Right Sleeve</button></div>}</div><div className="control-divider" /><div className="last-controls"><label><span>Size</span><div className="size-picker">{sizes.map((size) => <button key={size} className={selectedSize === size ? 'active' : ''} onClick={() => setSelectedSize(size)}>{size}</button>)}</div></label><label><span>Quantity</span><div className="quantity-picker"><button onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus size={15} /></button><b>{quantity}</b><button onClick={() => setQuantity(Math.min(9, quantity + 1))}><Plus size={15} /></button></div></label></div></section></div>
      <div className="editor-price-gate">{!showPrice ? <><CheckCircle2 size={22} /><div><strong>Design complete?</strong><span>Check your estimated item price.</span></div><button className="primary-button" onClick={() => setShowPrice(true)}>Check price <ArrowRight size={17} /></button></> : <PriceBreakdown prices={prices} productPrice={product.price} quantity={quantity} placement={placement} onCheckout={() => onAddToCart(currentDesign())} />}</div>
    </main>
  );
}

function PriceBreakdown({ prices, productPrice, quantity, placement, onCheckout }: { prices: { print: number; elow: number; frontTextPrice: number; backTextPrice: number; leftTextPrice: number; rightTextPrice: number; total: number }; productPrice: number; quantity: number; placement: Placement; onCheckout: () => void }) {
  return <div className="price-breakdown"><div><span>Base t-shirt</span><strong>{money(productPrice)}{quantity > 1 && ` × ${quantity}`}</strong></div>{prices.print > 0 && <div><span>{placement === 'both' ? 'Front + back print' : placement === 'sides' ? 'Left + right side print' : placement === 'all' ? 'All 4 sides print' : `${placement} print`}</span><strong>{money(prices.print)}{quantity > 1 && ` × ${quantity}`}</strong></div>}{prices.elow > 0 && <div><span>ELOW side detail</span><strong>{money(prices.elow)}{quantity > 1 && ` × ${quantity}`}</strong></div>}{prices.frontTextPrice > 0 && <div><span>Front text</span><strong>{money(50)}{quantity > 1 && ` × ${quantity}`}</strong></div>}{prices.backTextPrice > 0 && <div><span>Back text</span><strong>{money(50)}{quantity > 1 && ` × ${quantity}`}</strong></div>}{prices.leftTextPrice > 0 && <div><span>Left side text</span><strong>{money(50)}{quantity > 1 && ` × ${quantity}`}</strong></div>}{prices.rightTextPrice > 0 && <div><span>Right side text</span><strong>{money(50)}{quantity > 1 && ` × ${quantity}`}</strong></div>}<div className="breakdown-total"><span>Estimated item total</span><strong>{money(prices.total)}</strong><button className="primary-button" onClick={onCheckout}>Add to bag <ShoppingBag size={16} /></button></div></div>;
}

function CatalogPage() {
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState<'All' | Product['fit'] | Product['neck']>('All');
  const filterOptions = ['All', 'Regular fit', 'Oversized', 'Round neck', 'V neck', 'Polo collar'] as const;
  const filtered = filter === 'All' ? activeProducts : activeProducts.filter((product) => product.fit === filter || product.neck === filter);
  return <main className="catalog-page"><div className="catalog-heading"><div><p className="eyebrow"><span /> THE CATALOG</p><h1>Real tees.<br /><em>Your idea.</em></h1></div><p>Choose your fit and neckline. We’ll give your design the room it deserves.</p></div><div className="catalog-controls"><div className="catalog-filters">{filterOptions.map((option) => <button key={option} className={filter === option ? 'active' : ''} onClick={() => setFilter(option)}>{option}</button>)}</div><span>{filtered.length} blanks available</span></div><div className="product-grid">{filtered.map((product) => <ProductCard key={product.id} product={product} onEdit={() => setLocation(`/editor?product=${encodeURIComponent(product.id)}&color=${encodeURIComponent(product.color)}&fit=${encodeURIComponent(product.fit)}&neck=${encodeURIComponent(product.neck)}`)} />)}</div><div className="catalog-footer"><Search size={17} /><span>Can’t find your fit? WhatsApp us and we’ll source it.</span></div></main>;
}

function CategoryPage({ slug }: { slug: string }) {
  const [, setLocation] = useLocation();
  const category = activeCategories.find((item) => item.slug === slug) ?? activeCategories[0];
  const designs = activeReadyMadeDesigns.filter((design) => design.category === category.slug);
  return <main className="category-page"><button className="back-link" onClick={() => setLocation('/#ready-made')}><ChevronLeft size={16} /> Back to ready-made</button><div className="category-heading"><span className="big-category-icon" style={{ background: category.color }}>{category.icon}</span><div><p className="eyebrow"><span /> READY-MADE / {category.name.toUpperCase()}</p><h1>{category.name}<br /><em>collection.</em></h1><p>Pick a design. Make it yours.</p></div></div>{designs.length ? <div className="design-grid">{designs.map((design) => <article className="design-card" key={design.id}><div className="design-art" style={{ '--design-color': design.color, '--design-accent': design.accent, backgroundImage: design.image ? `url(${design.image})` : undefined } as CSSProperties}><span>{design.mark}</span><small>BACKBENCHERS</small></div><div className="design-card-meta"><div><span>{category.name}</span><h3>{design.name}</h3><p>{design.description}</p></div><button aria-label={`Customize ${design.name}`} onClick={() => setLocation('/editor?product=regular-white')}><ArrowRight size={16} /></button></div></article>)}</div> : <div className="empty-shop"><h2>More designs are on the way.</h2><p>Start with a blank T-shirt and create your own instead.</p><button className="primary-button" onClick={() => setLocation('/catalog')}>Build a custom design <ArrowRight size={16} /></button></div>}</main>;
}

function CartPage({ isLoggedIn, openAuth, onNotice }: { isLoggedIn: boolean; openAuth: (action: string, callback?: () => void) => void; onNotice: (message: string) => void }) {
  const [, setLocation] = useLocation();
  const [items, setItems] = useState<CartLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const loadCart = () => apiJson<{ items: CartLine[] }>('/api/cart').then((result) => setItems(result.items)).catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load your bag.')).finally(() => setLoading(false));
  useEffect(() => { if (isLoggedIn) void loadCart(); else setLoading(false); }, [isLoggedIn]);
  const remove = async (id: string) => {
    try { await apiJson(`/api/cart/${id}`, { method: 'DELETE' }); setItems((current) => current.filter((item) => item.id !== id)); }
    catch (reason) { onNotice(reason instanceof Error ? reason.message : 'Could not remove item.'); }
  };
  if (!isLoggedIn) return <main className="account-page"><section className="account-card"><p className="eyebrow"><span /> YOUR BAG</p><h1>Sign in to<br /><em>continue.</em></h1><p>Your bag is saved to your account so you can pick up where you left off.</p><button className="primary-button" onClick={() => openAuth('view your bag', () => setLocation('/cart'))}>Sign in / Create account <ArrowRight size={16} /></button></section></main>;
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  return <main className="shop-page"><div className="shop-heading"><p className="eyebrow"><span /> YOUR BAG</p><h1>Your ideas,<br /><em>almost yours.</em></h1></div>{loading ? <p>Loading your bag…</p> : error ? <p className="auth-error" role="alert">{error}</p> : !items.length ? <section className="empty-shop"><ShoppingBag size={28} /><h2>Your bag is empty.</h2><p>Start with a blank tee and make it your own.</p><button className="primary-button" onClick={() => setLocation('/catalog')}>Explore the catalog <ArrowRight size={16} /></button></section> : <div className="cart-layout"><section className="cart-list">{items.map((item) => { const product = activeProducts.find((candidate) => candidate.id === item.config.productId); return <article className="cart-item" key={item.id}><div className="cart-item-art"><ShirtPreview color={item.config.color} mark={item.config.frontText || 'BB'} compact /></div><div className="cart-item-info"><span>{product?.name ?? item.config.productId}</span><h2>{item.config.color} · {item.config.size}</h2><p>{item.config.placement} print · {item.config.quantity} item(s){item.config.frontText ? ` · “${item.config.frontText}”` : ''}</p>{item.config.artwork && <img className="cart-artwork-thumb" src={item.config.artwork} alt="Uploaded print artwork" />}<button
      className="text-button" onClick={() => void remove(item.id)}>
      Remove
    </button></div><strong>{money(item.lineTotal)}</strong></article>; })}</section><aside className="cart-summary"><p className="eyebrow">ORDER SUMMARY</p><div><span>Items ({items.length})</span><b>{money(subtotal)}</b></div><div><span>Delivery</span><b>{subtotal > 500 ? 'Free' : money(60)}</b></div><div className="cart-grand-total"><span>Estimated total</span><strong>{money(subtotal + (subtotal > 500 ? 0 : 60))}</strong></div><small>Final total is recalculated by the server before payment. Free delivery applies above ₹500.</small><button className="primary-button" onClick={() => setLocation('/checkout')}>Continue to delivery <ArrowRight size={16} /></button><button className="text-button" onClick={() => setLocation('/catalog')}>Continue shopping</button></aside></div>}</main>;
}

function CheckoutPage({ isLoggedIn, openAuth, onNotice }: { isLoggedIn: boolean; openAuth: (action: string, callback?: () => void) => void; onNotice: (message: string) => void }) {
  const [, setLocation] = useLocation();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [order, setOrder] = useState<StoreOrder | null>(null);
  const [qr, setQr] = useState('');
  const [proofMode, setProofMode] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('full');
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [address, setAddress] = useState({ name: '', phone: '', line1: '', city: '', state: '', pincode: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const upiId = paymentSettings?.upiId ?? '';
  const upiConfigured = Boolean(paymentSettings && /^[\w.-]+@[\w.-]+$/.test(upiId));
  const payee = paymentSettings?.payeeName || 'Backbenchers';
  const requestedOrderId = new URLSearchParams(window.location.search).get('order');
  useEffect(() => {
    if (!isLoggedIn) return;
    void apiJson<{ settings: PaymentSettings }>('/api/payment/settings').then((result) => setPaymentSettings(result.settings)).catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load payment settings.'));
    if (requestedOrderId) {
      void apiJson<{ order: StoreOrder }>(`/api/orders/${encodeURIComponent(requestedOrderId)}`).then((result) => setOrder(result.order)).catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load this order.'));
      return;
    }
    void apiJson<{ items: CartLine[] }>('/api/cart').then((result) => setCart(result.items)).catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load bag.'));
  }, [isLoggedIn, requestedOrderId]);
  useEffect(() => {
    if (!order || order.status !== 'awaiting_payment' || !upiConfigured) return;
    const paymentUri = `upi://pay?${new URLSearchParams({ pa: upiId, pn: payee, am: order.paymentDue.toFixed(2), cu: 'INR', tn: `Order ${order.orderNumber}` })}`;
    void QRCode.toDataURL(paymentUri, { width: 280, margin: 2, errorCorrectionLevel: 'M' }).then(setQr).catch(() => setError('Could not generate the payment QR code.'));
  }, [order, payee, upiConfigured, upiId]);
  const placeOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError('');
    try { const result = await apiJson<{ order: StoreOrder }>('/api/orders', { method: 'POST', body: JSON.stringify({ address, paymentMethod }) }); setOrder(result.order); setCart([]); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not place order.'); }
    finally { setBusy(false); }
  };
  const uploadProof = async () => {
    if (!order || !proofFile) return;
    setBusy(true); setError('');
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read the payment screenshot.')); reader.readAsDataURL(proofFile); });
      await apiJson(`/api/orders/${order.id}/proof`, { method: 'POST', body: JSON.stringify({ dataUrl }) });
      setOrder({ ...order, status: 'payment_review', paymentStatus: 'proof_submitted', hasProof: true });
      setProofMode(false); onNotice(`Payment screenshot submitted for ${order.orderNumber}. We’ll verify it before production.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not submit screenshot.'); }
    finally { setBusy(false); }
  };
  if (!isLoggedIn) return <main className="account-page"><section className="account-card"><p className="eyebrow"><span /> CHECKOUT</p><h1>Sign in to<br /><em>order.</em></h1><p>Your designs and order updates are linked to your account.</p><button className="primary-button" onClick={() => openAuth('continue to checkout', () => setLocation('/checkout'))}>Sign in / Create account <ArrowRight size={16} /></button></section></main>;
  if (order?.status === 'cancelled') return <main className="shop-page"><div className="shop-heading"><p className="eyebrow"><span /> ORDER {order.orderNumber}</p><h1>Order<br /><em>cancelled.</em></h1><p>Payment proof was not verified. Contact support if you believe this is a mistake.</p><button className="primary-button" onClick={() => setLocation('/account')}>Back to my orders <ArrowRight size={16} /></button></div></main>;
  if (order && ['processing', 'shipped', 'delivered'].includes(order.status)) return <main className="shop-page"><div className="shop-heading"><p className="eyebrow"><span /> ORDER {order.orderNumber}</p><h1>Payment verified.<br /><em>{order.status}.</em></h1><p>Your payment was reviewed by our team. Follow fulfillment progress in your account orders.</p><button className="primary-button" onClick={() => setLocation('/account')}>View my orders <ArrowRight size={16} /></button></div></main>;
  if (order) return <main className="shop-page"><div className="shop-heading"><p className="eyebrow"><span /> ORDER {order.orderNumber}</p><h1>{order.status === 'payment_review' ? <>Proof received.<br /><em>We’ll verify it.</em></> : <>One last step.<br /><em>Complete payment.</em></>}</h1><p>Payment proof is reviewed by our team before production begins.</p></div><section className="payment-panel"><div className="payment-amount"><span>{order.paymentMethod === 'booking' ? 'PAY BOOKING AMOUNT' : 'PAY IN FULL'}</span><strong>{money(order.paymentDue)}</strong><small>Order total {money(order.total)} · Delivery {order.shipping ? money(order.shipping) : 'Free'}</small></div>{qr ? <div className="payment-qr"><img src={qr} alt={`UPI QR for order ${order.orderNumber}`} /><p>Scan with any UPI app</p><span>{upiId}</span></div> : <div className="payment-config-warning"><strong>UPI QR is not configured yet.</strong><p>Add your merchant UPI ID as VITE_UPI_ID in artifacts/tshirt-studio/.env.local, then restart Vite.</p></div>}{order.status === 'payment_review' ? <div className="review-pending"><CheckCircle2 size={22} /><div><strong>Screenshot submitted</strong><span>Order is in the admin verification queue. Production starts after approval.</span></div></div> : !proofMode ? <button className="primary-button" onClick={() => setProofMode(true)}>I have paid <ArrowRight size={16} /></button> : <div className="proof-upload"><label>Upload payment screenshot (PNG/JPG/WebP, max 4 MB)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0] ?? null; if (file && (file.size > 4 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type))) { setError('Choose a PNG, JPG or WebP screenshot under 4 MB.'); setProofFile(null); return; } setProofFile(file); setError(''); }} /></label><p>Only submit after payment. Screenshots are manually checked.</p><button className="primary-button" disabled={!proofFile || busy} onClick={() => void uploadProof()}>{busy ? 'Submitting…' : 'Submit screenshot'} <ArrowRight size={16} /></button></div>}{error && <p className="auth-error" role="alert">{error}</p>}<button className="text-button" onClick={() => setLocation('/account')}>View my orders</button></section></main>;
  const subtotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);
  const threshold = paymentSettings?.deliveryThreshold ?? 500;
  const deliveryCharge = paymentSettings?.deliveryCharge ?? 60;
  return <main className="shop-page"><div className="shop-heading"><p className="eyebrow"><span /> CHECKOUT / DELIVERY</p><h1>Where should<br /><em>we send it?</em></h1></div>{!cart.length ? <section className="empty-shop"><p>Your bag is empty.</p><button className="primary-button" onClick={() => setLocation('/catalog')}>Back to catalog <ArrowRight size={16} /></button></section> : <div className="checkout-layout"><form className="checkout-form" onSubmit={placeOrder}><h2>Delivery details</h2><label>Full name<input required autoComplete="name" value={address.name} onChange={(event) => setAddress({ ...address, name: event.target.value })} /></label><label>Mobile number<input required inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} autoComplete="tel" value={address.phone} onChange={(event) => setAddress({ ...address, phone: event.target.value.replace(/\D/g, '').slice(0, 10) })} /></label><label>Street address<input required autoComplete="street-address" value={address.line1} onChange={(event) => setAddress({ ...address, line1: event.target.value })} /></label><div className="checkout-two-col"><label>City<input required autoComplete="address-level2" value={address.city} onChange={(event) => setAddress({ ...address, city: event.target.value })} /></label><label>State<input required autoComplete="address-level1" value={address.state} onChange={(event) => setAddress({ ...address, state: event.target.value })} /></label><label>PIN code<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="postal-code" value={address.pincode} onChange={(event) => setAddress({ ...address, pincode: event.target.value.replace(/\D/g, '').slice(0, 6) })} /></label></div><fieldset className="payment-methods"><legend>Choose payment</legend>{paymentSettings?.fullPaymentEnabled && <label><input type="radio" name="payment-method" checked={paymentMethod === 'full'} onChange={() => setPaymentMethod('full')} /> Pay full amount</label>}{paymentSettings?.bookingPaymentEnabled && <label><input type="radio" name="payment-method" checked={paymentMethod === 'booking'} onChange={() => setPaymentMethod('booking')} /> Book your order · pay {money(paymentSettings.bookingAmount)} now</label>}<label className="payment-disabled"><input type="radio" name="payment-method" disabled /> Cash on delivery · currently unavailable</label></fieldset>{error && <p className="auth-error" role="alert">{error}</p>}{!upiConfigured && <p className="payment-config-warning">Checkout is paused until the admin adds a valid merchant UPI ID.</p>}<button className="primary-button" disabled={busy || !upiConfigured}>{busy ? 'Creating secure order…' : 'Continue to payment'} <ArrowRight size={16} /></button><small>{paymentSettings?.paymentInstructions ?? 'Your order is sent to admin verification after payment screenshot submission.'}</small></form><aside className="cart-summary"><p className="eyebrow">PAYMENT SUMMARY</p>{cart.map((item) => <div key={item.id}><span>{activeProducts.find((product) => product.id === item.config.productId)?.name} × {item.config.quantity}</span><b>{money(item.lineTotal)}</b></div>)}<div><span>Items subtotal</span><b>{money(subtotal)}</b></div><div><span>Delivery</span><b>{subtotal > threshold ? 'Free' : money(deliveryCharge)}</b></div><div className="cart-grand-total"><span>Order total</span><strong>{money(subtotal + (subtotal > threshold ? 0 : deliveryCharge))}</strong></div><small>Free delivery on orders above {money(threshold)}. Price is recalculated and stored by the server.</small></aside></div>}</main>;
}

function AccountPage({ user, onLogin, onLogout, onNotice }: { user: SignedInUser | null; onLogin: () => void; onLogout: () => void; onNotice: (message: string) => void }) {
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [designs, setDesigns] = useState<{ id: string; title: string; config: DesignConfig; createdAt: string }[]>([]);
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (!user) return;
    void Promise.all([apiJson<{ orders: StoreOrder[] }>('/api/orders'), apiJson<{ designs: typeof designs }>('/api/designs')])
      .then(([o, d]) => { setOrders(o.orders); setDesigns(d.designs); })
      .catch((e) => onNotice(e instanceof Error ? e.message : 'Account data unavailable.'));
  }, [user, onNotice]);
  const openDesign = (config: DesignConfig) => { sessionStorage.setItem('savedDesignDraft', JSON.stringify(config)); setLocation(`/editor?product=${config.productId}`); };
  const removeDesign = async (id: string) => { try { await apiJson(`/api/designs/${id}`, { method: 'DELETE' }); setDesigns((items) => items.filter((item) => item.id !== id)); } catch (e) { onNotice(e instanceof Error ? e.message : 'Could not delete design.'); } };
  return <main className="shop-page account-shop">
    <section className="account-card"><div className="account-icon"><UserRound size={22} /></div><p className="eyebrow"><span /> YOUR ACCOUNT</p>{user ? <><h1>Welcome<br /><em>back.</em></h1><p>Signed in as {user.email}</p><button className="text-button" onClick={onLogout}>Log out</button></> : <><h1>Keep your<br /><em>ideas.</em></h1><button className="primary-button" onClick={onLogin}>Create account / Login</button></>}</section>
    {user && <><section className="account-data-section"><div className="account-section-heading"><h2>Your orders</h2><span>{orders.length} total</span></div>{orders.length ? <div className="account-order-list">{orders.map((order) => <article key={order.id}><strong>{order.orderNumber}</strong><span className={`order-status status-${order.status}`}>{order.status.replaceAll('_', ' ')}</span><b>{money(order.total)}</b><small>Payment: {order.paymentStatus.replaceAll('_', ' ')}</small>{order.status === 'awaiting_payment' && <button className="text-button" onClick={() => setLocation('/checkout')}>Continue payment</button>}</article>)}</div> : <p>No orders yet.</p>}</section>
    <section className="account-data-section"><div className="account-section-heading"><h2>Saved designs</h2><span>{designs.length} saved</span></div>{designs.map((design) => <article className="saved-design-row" key={design.id}><strong>{design.title}</strong><button className="text-button" onClick={() => openDesign(design.config)}>Edit again</button><button className="text-button" onClick={() => void removeDesign(design.id)}>Delete</button></article>)}</section></>}
  </main>;
}