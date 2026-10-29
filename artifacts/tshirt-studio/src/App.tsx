import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
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
import brandLogo from '@assets/ChatGPT_Image_Sep_26,_2026,_03_50_11_PM-Photoroom_1790420243209.png';
import { categories, products, readyMadeDesigns, testimonials, type Product } from './data';
import { GarmentModel } from './GarmentModel';

type View = 'front' | 'back' | 'left' | 'right';
type Placement = 'none' | 'front' | 'back' | 'both';
type Elow = 'none' | 'one' | 'two';
type ModalStep = 'phone' | 'otp';

const colors = [
  { id: 'vermillion', name: 'Vermillion', hex: '#E84B35', label: 'Signature' },
  { id: 'ink', name: 'Ink', hex: '#252A35', label: 'Deep ink' },
  { id: 'pistachio', name: 'Pistachio', hex: '#C8D7B5', label: 'Soft green' },
  { id: 'butter', name: 'Butter', hex: '#F2D36C', label: 'Warm yellow' },
  { id: 'cloud', name: 'Cloud', hex: '#E8E5DC', label: 'Natural' },
  { id: 'cobalt', name: 'Cobalt', hex: '#3558B8', label: 'Blue' },
];
const sizes = ['XS', 'S', 'M', 'L', 'XL', '2XL'];
const money = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

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

function Header({ onLogin, isLoggedIn }: { onLogin: () => void; isLoggedIn: boolean }) {
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
        <button className="admin-nav" onClick={() => setLocation('/admin')}>Admin</button>
      </nav>
      <div className="nav-actions">
        <button className="login-button" onClick={onLogin}>{isLoggedIn ? <UserRound size={15} /> : <LogIn size={15} />} {isLoggedIn ? 'Account' : 'Login'}</button>
        <button className="bag-button" onClick={() => setLocation('/account')}><ShoppingBag size={18} /><span>Bag</span><b>0</b></button>
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

function AuthModal({ open, action, step, phone, otp, setPhone, setOtp, onClose, onSend, onVerify, onResend }: { open: boolean; action: string; step: ModalStep; phone: string; otp: string; setPhone: (value: string) => void; setOtp: (value: string) => void; onClose: () => void; onSend: () => void; onVerify: () => void; onResend: () => void }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="otp-modal" role="dialog" aria-modal="true" aria-labelledby="otp-title">
        <button className="modal-close" onClick={onClose} aria-label="Close login modal"><X size={18} /></button>
        <div className="modal-mark"><LockKeyhole size={20} /></div>
        {step === 'phone' ? (
          <>
            <p className="eyebrow"><span /> ONE QUICK STEP</p><h2 id="otp-title">Keep your<br /><em>good idea.</em></h2>
            <p className="modal-copy">Enter your phone number to {action}. We’ll send a one-time code — no password to remember.</p>
            <label className="phone-label">Mobile number<div className="phone-input"><span>+91</span><input autoFocus type="tel" inputMode="numeric" maxLength={10} value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, ''))} placeholder="98765 43210" /></div></label>
            <button className="modal-primary" disabled={phone.length !== 10} onClick={onSend}>Send one-time code <ArrowRight size={17} /></button>
          </>
        ) : (
          <>
            <p className="eyebrow"><span /> CHECK YOUR PHONE</p><h2 id="otp-title">Almost<br /><em>there.</em></h2>
            <p className="modal-copy">We sent a 4-digit code to +91 {phone.slice(0, 5)} {phone.slice(5)}. This preview accepts any 4-digit code.</p>
            <label className="phone-label">One-time code<input className="otp-input" autoFocus inputMode="numeric" maxLength={4} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))} placeholder="• • • •" /></label>
            <button className="modal-primary" disabled={otp.length !== 4} onClick={onVerify}>Verify & continue <Check size={17} /></button>
            <button className="resend-button" onClick={onResend}>Didn’t get it? Resend code</button>
          </>
        )}
        <div className="modal-safe"><LockKeyhole size={13} /> Your number stays private with us.</div>
      </div>
    </div>
  );
}

function ProductCard({ product, onEdit }: { product: Product; onEdit: () => void }) {
  return (
    <article className="product-card">
      <div className="product-image"><span className="product-tag">{product.tag}</span><ShirtPreview color={product.color} mark="BB" image={product.image} compact /><button className="product-edit" onClick={onEdit}><Pencil size={14} /> Edit this tee</button></div>
      <div className="product-meta"><div><span className="product-type">{product.type}</span><h3>{product.name}</h3></div><strong>{money(product.price)}</strong></div>
      <p>{product.fit} · {product.neck} · {product.colorName}</p>
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
  const heroDesigns = [{ color: '#d94b35', mark: '07', label: 'REGULAR FIT', image: '/product-images/regular-fit-white.jpg' }, { color: '#2a3150', mark: 'PLAY', label: 'OVERSIZED', image: '/product-images/oversized-black.jpg' }, { color: '#d8b64e', mark: 'BB', label: 'V NECK', image: '/product-images/v-neck-white.jpg' }, { color: '#6b866c', mark: 'MUMBAI', label: 'POLO COLLAR', image: '/product-images/polo-navy.jpg' }];
  useEffect(() => { const timer = window.setInterval(() => setHeroIndex((value) => (value + 1) % heroDesigns.length), 2500); return () => window.clearInterval(timer); }, [heroDesigns.length]);
  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) onNotice(`${file.name} selected. We’ll check it for print quality.`); };
  const askUpload = () => { if (!isLoggedIn) { openAuth('upload your design', () => uploadInputRef.current?.click()); } else uploadInputRef.current?.click(); };
  return (
    <main>
      <section className="home-hero">
        <div className="hero-copy"><p className="eyebrow"><span /> OUR PRODUCT. YOUR IMAGINATION.</p><h1>Make what<br /><em>you mean.</em></h1><p className="hero-subtitle">Custom T-shirts for ideas, inside jokes, big days and the people you want beside you.</p><div className="hero-actions"><button className="primary-button" onClick={() => setLocation('/catalog')}>Start designing <ArrowRight size={17} /></button><button className="text-button" onClick={() => setLocation('/catalog')}>Browse catalog</button></div></div>
        <div className="hero-animation"><div className="hero-orbit orbit-a" /><div className="hero-orbit orbit-b" /><div className="hero-animation-copy"><span>0{heroIndex + 1} / 04</span><b>{heroDesigns[heroIndex].label}</b></div><div className="hero-shirt-wrap" key={heroIndex} style={{ '--hero-color': heroDesigns[heroIndex].color } as CSSProperties}><ShirtPreview color={heroDesigns[heroIndex].color} mark={heroDesigns[heroIndex].mark} image={heroDesigns[heroIndex].image} compact /></div><div className="hero-note note-top">CHANGE THE<br /><strong>MOOD.</strong></div><div className="hero-note note-bottom">real 2D product / made for print</div></div>
      </section>

      <section className="idea-section"><div className="idea-copy"><p className="eyebrow"><span /> YOU IMAGINE. WE MAKE IT.</p><h2>FROM IDEA<br />TO <em>T-SHIRT.</em></h2><p>Creating your own T-shirt is easier than you think.</p><div className="steps-list"><div><b>01</b><span><strong>CHOOSE</strong>Pick your T-shirt, fit and colour.</span></div><div><b>02</b><span><strong>CREATE</strong>Upload your artwork or create one from scratch.</span></div><div><b>03</b><span><strong>PERSONALIZE</strong>Add your name, number, text, photo, logo, QR or Instagram ID.</span></div><div><b>04</b><span><strong>WEAR</strong>Preview it. Order it. We print and deliver it.</span></div></div></div><div className="idea-mockup"><EditorMockup /><button className="mockup-cta" onClick={() => setLocation('/catalog')}>Open the editor <ArrowRight size={16} /></button></div></section>

      <section className="ready-section" id="ready-made"><div className="ready-heading"><div><p className="eyebrow"><span /> READY-MADE DESIGNS</p><h2>DON'T WANT TO DESIGN?<br /><em>WE'VE GOT YOU.</em></h2></div><p>Pick a design. Make it yours.</p></div><div className="category-strip">{categories.map((category) => <button className="category-card" key={category.slug} onClick={() => setLocation(`/category/${category.slug}`)}><span className="category-art" style={{ '--category-color': category.color } as CSSProperties}><b>{category.icon}</b><i>{category.name.slice(0, 2)}</i></span><span className="category-name">{category.name}</span><ArrowRight size={15} /><small>VIEW DESIGNS</small></button>)}</div><button className="outline-light-button" onClick={() => setLocation('/category/gaming')}>View all ready-made designs <ArrowRight size={16} /></button></section>

      <section className="upload-section" id="upload-design"><div className="upload-copy"><p className="eyebrow"><span /> UPLOAD YOUR DESIGN</p><h2>ALREADY HAVE<br /><em>A DESIGN?</em></h2><p>Upload it. Place it. Wear it.</p><small>We’ll automatically check whether your design is suitable for printing.</small></div><div className="dropzone" onClick={askUpload} onKeyDown={(event) => event.key === 'Enter' && askUpload()} role="button" tabIndex={0}><FileUp size={28} /><strong>DROP YOUR DESIGN HERE</strong><span>PNG / JPG / SVG / WEBP</span><button className="primary-button" onClick={(event) => { event.stopPropagation(); askUpload(); }}>UPLOAD YOUR DESIGN <Upload size={16} /></button><input ref={uploadInputRef} hidden type="file" accept=".png,.jpg,.jpeg,.svg,.webp,image/*" onChange={handleUpload} />{!isLoggedIn && <small className="upload-gate"><LockKeyhole size={12} /> Mobile number required before upload</small>}</div></section>

      <section className="squad-section"><div className="squad-art"><div className="squad-stack"><ShirtPreview color="#d94b35" mark="07" image="/product-images/regular-fit-white.jpg" compact /><ShirtPreview color="#29345e" mark="18" image="/product-images/oversized-black.jpg" compact /><ShirtPreview color="#d6b646" mark="23" image="/product-images/polo-navy.jpg" compact /></div><span>THE<br /><strong>SQUAD</strong></span></div><div className="squad-copy"><p className="eyebrow"><span /> DESIGN YOUR SQUAD</p><h2>ONE DESIGN.<br /><em>YOUR WHOLE SQUAD.</em></h2><p>College fest? Gaming team? Friends? Event?</p><div className="feature-pills"><span>✓ Same design</span><span>✓ Different names</span><span>✓ Different numbers</span><span>✓ Different sizes</span><span>✓ Bulk pricing</span></div><div className="squad-table"><div><span>Name</span><span>Size</span><span>Number</span></div><div><b>Rahul</b><span>L</span><span>07</span></div><div><b>Aman</b><span>XL</span><span>18</span></div><div><b>Ravi</b><span>M</span><span>23</span></div></div><button className="primary-button" onClick={() => onNotice('Squad designer request noted. Tell us your team size on WhatsApp.')}>Design your squad <ArrowRight size={17} /></button></div></section>

      <section className="business-section" id="businesses"><div className="business-heading"><p className="eyebrow"><span /> FOR BUSINESSES</p><h2>MADE FOR MORE<br />THAN JUST <em>YOU.</em></h2><p>Custom merchandise for brands, teams and businesses.</p><button className="primary-button" onClick={() => onNotice('Bulk quote request noted. We’ll connect this to the admin panel.')}>Get bulk quote <ArrowRight size={16} /></button></div><div className="business-grid">{['CORPORATE|Company T-shirts & uniforms', 'EVENTS|Events, festivals & campaigns', 'COLLEGE|Societies, fests & batches', 'GAMING|Teams & esports merchandise', 'CAFÉ / RESTAURANT|Custom staff merchandise'].map((item, index) => { const [title, detail] = item.split('|'); return <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{detail}</p><ArrowRight size={18} /></article>; })}</div></section>

      <section className="testimonials-section"><p className="eyebrow"><span /> THE BACKBENCHERS WORD</p><h2>Good ideas<br /><em>look good on you.</em></h2><div className="testimonials">{testimonials.map((item) => <article key={item.name}><div className="stars">★★★★★</div><p>“{item.quote}”</p><strong>{item.name}</strong><span>{item.detail}</span></article>)}</div></section>
    </main>
  );
}

function EditorPage({ onNotice, openAuth }: { onNotice: (message: string) => void; openAuth: (action: string) => void }) {
  const [, setLocation] = useLocation();
  const productId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('product') : null;
  const product = products.find((item) => item.id === productId) ?? products[0];
  const [selectedColor, setSelectedColor] = useState(() => {
    const requestedColor = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('color')?.toLowerCase() : null;
    return colors.find((item) => item.id === requestedColor || item.name.toLowerCase() === requestedColor || item.hex.toLowerCase() === requestedColor) ?? closestColor(product.color);
  });
  const [view, setView] = useState<View>(() => {
    const requestedView = new URLSearchParams(window.location.search).get('view');
    return requestedView === 'back' || requestedView === 'left' || requestedView === 'right'
      ? requestedView
      : 'front';
  });
  const [isSpinning, setIsSpinning] = useState(false);
  const [placement, setPlacement] = useState<Placement>('front');
  const [elow, setElow] = useState<Elow>('none');
  const [frontText, setFrontText] = useState('');
  const [backText, setBackText] = useState('');
  const [selectedSize, setSelectedSize] = useState('M');
  const [quantity, setQuantity] = useState(1);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [showPrice, setShowPrice] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
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
    const print = { none: 0, front: 120, back: 120, both: 200 }[placement];
    const elowStandalone = { none: 0, one: 50, two: 50 }[elow];
    const combo = (placement === 'front' || placement === 'back') && elow !== 'none' ? (elow === 'one' ? 150 : 180) : print + elowStandalone;
    const frontTextPrice = frontText.trim() ? 50 : 0;
    const backTextPrice = backText.trim() ? 50 : 0;
    const unit = product.price + combo + frontTextPrice + backTextPrice;
    return { print, elow: combo - print, frontTextPrice, backTextPrice, total: unit * quantity };
  }, [backText, elow, frontText, placement, product.price, quantity]);
  const onUpload = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setUploadedImage(String(reader.result)); reader.readAsDataURL(file); onNotice(`${file.name} added to your preview.`); };
  return (
    <main className="editor-page"><div className="editor-page-top"><button className="back-link" onClick={() => setLocation('/catalog')}><ChevronLeft size={16} /> Back to catalog</button><span>EDITOR / {product.name}</span><button className="save-link" onClick={() => openAuth('save this design')}><LockKeyhole size={14} /> Save design</button></div><div className="editor-intro"><div><p className="eyebrow"><span /> THE EDITOR</p><h1>Make it<br /><em>personal.</em></h1></div><p>Choose your blank, add your idea, and check the exact price only when you’re ready.</p></div>
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
              placement={placement}
              frontText={frontText}
              backText={backText}
              artwork={uploadedImage}
            />
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
        <section className="controls-panel"><div className="control-heading"><span className="step-number">01</span><div><h3>Start with a blank</h3><p>Pick the colour that feels like you.</p></div></div><div className="color-row">{colors.map((color) => <button key={color.id} className={`color-swatch ${selectedColor.id === color.id ? 'selected' : ''}`} style={{ '--swatch': color.hex } as CSSProperties} onClick={() => setSelectedColor(color)} aria-label={`Select ${color.name}`}>{selectedColor.id === color.id && <Check size={15} />}</button>)}<span className="selected-color-name">{selectedColor.name}<small>{selectedColor.label}</small></span></div><div className="control-divider" /><div className="control-heading"><span className="step-number">02</span><div><h3>Put it somewhere</h3><p>Choose a print placement.</p></div></div><div className="choice-grid">{([['none', 'No print', 'blank'], ['front', 'Front only', '₹120'], ['back', 'Back only', '₹120'], ['both', 'Front + back', '₹200']] as [Placement, string, string][]).map(([id, label, price]) => <button key={id} className={`choice-card ${placement === id ? 'selected' : ''}`} onClick={() => setPlacement(id)}><span>{label}</span><small>{price}</small>{placement === id && <Check size={14} />}</button>)}</div><div className="elow-row"><div><strong>ELOW</strong><span>side detail</span></div><div className="elow-choices">{([['none', 'None', '₹0'], ['one', 'One side', '₹50'], ['two', 'Two sides', '₹50']] as [Elow, string, string][]).map(([id, label, price]) => <button key={id} className={elow === id ? 'active' : ''} onClick={() => setElow(id)}>{label} <small>{price}</small></button>)}</div></div><div className="control-divider" /><div className="control-heading compact"><span className="step-number">03</span><div><h3>Add a little text</h3><p>₹50 per side · optional</p></div></div><div className="text-inputs"><label><span>Front</span><div className="input-with-icon"><Type size={15} /><input value={frontText} onChange={(event) => setFrontText(event.target.value.slice(0, 24))} placeholder="e.g. stay curious" /><small>₹50</small></div></label><label><span>Back</span><div className="input-with-icon"><Type size={15} /><input value={backText} onChange={(event) => setBackText(event.target.value.slice(0, 24))} placeholder="e.g. Mumbai, 2024" /><small>₹50</small></div></label></div><div className="upload-row"><button className="upload-button" onClick={() => fileRef.current?.click()}><Upload size={16} /> {uploadedImage ? 'Replace artwork' : 'Upload artwork'}</button><input ref={fileRef} type="file" accept="image/*" onChange={onUpload} hidden /><button className="remove-bg" onClick={() => onNotice('Remove background will be connected after the image API is added.')}><Sparkles size={15} /> Remove background <span>soon</span></button></div><div className="control-divider" /><div className="last-controls"><label><span>Size</span><div className="size-picker">{sizes.map((size) => <button key={size} className={selectedSize === size ? 'active' : ''} onClick={() => setSelectedSize(size)}>{size}</button>)}</div></label><label><span>Quantity</span><div className="quantity-picker"><button onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus size={15} /></button><b>{quantity}</b><button onClick={() => setQuantity(Math.min(9, quantity + 1))}><Plus size={15} /></button></div></label></div></section></div>
      <div className="editor-price-gate">{!showPrice ? <><CheckCircle2 size={22} /><div><strong>Design complete?</strong><span>Price will appear only after you ask for it.</span></div><button className="primary-button" onClick={() => setShowPrice(true)}>Check price <ArrowRight size={17} /></button></> : <PriceBreakdown prices={prices} productPrice={product.price} quantity={quantity} placement={placement} onCheckout={() => openAuth('continue to checkout')} />}</div>
    </main>
  );
}

function PriceBreakdown({ prices, productPrice, quantity, placement, onCheckout }: { prices: { print: number; elow: number; frontTextPrice: number; backTextPrice: number; total: number }; productPrice: number; quantity: number; placement: Placement; onCheckout: () => void }) {
  return <div className="price-breakdown"><div><span>Base t-shirt</span><strong>{money(productPrice)}{quantity > 1 && ` × ${quantity}`}</strong></div>{prices.print > 0 && <div><span>{placement === 'both' ? 'Front + back print' : `${placement} print`}</span><strong>{money(prices.print)}{quantity > 1 && ` × ${quantity}`}</strong></div>}{prices.elow > 0 && <div><span>ELOW side detail</span><strong>{money(prices.elow)}{quantity > 1 && ` × ${quantity}`}</strong></div>}{prices.frontTextPrice > 0 && <div><span>Front text</span><strong>{money(50)}{quantity > 1 && ` × ${quantity}`}</strong></div>}{prices.backTextPrice > 0 && <div><span>Back text</span><strong>{money(50)}{quantity > 1 && ` × ${quantity}`}</strong></div>}<div className="breakdown-total"><span>Total incl. GST</span><strong>{money(prices.total)}</strong><button className="primary-button" onClick={onCheckout}>Continue to checkout <ArrowRight size={16} /></button></div></div>;
}

function CatalogPage() {
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState<'All' | Product['fit'] | Product['neck']>('All');
  const filterOptions = ['All', 'Regular fit', 'Oversized', 'Round neck', 'V neck', 'Polo collar'] as const;
  const filtered = filter === 'All' ? products : products.filter((product) => product.fit === filter || product.neck === filter);
  return <main className="catalog-page"><div className="catalog-heading"><div><p className="eyebrow"><span /> THE CATALOG</p><h1>Real tees.<br /><em>Your idea.</em></h1></div><p>Choose your fit and neckline. We’ll give your design the room it deserves.</p></div><div className="catalog-controls"><div className="catalog-filters">{filterOptions.map((option) => <button key={option} className={filter === option ? 'active' : ''} onClick={() => setFilter(option)}>{option}</button>)}</div><span>{filtered.length} blanks available</span></div><div className="product-grid">{filtered.map((product) => <ProductCard key={product.id} product={product} onEdit={() => setLocation(`/editor?product=${product.id}`)} />)}</div><div className="catalog-footer"><Search size={17} /><span>Can’t find your fit? WhatsApp us and we’ll source it.</span></div></main>;
}

function CategoryPage({ slug }: { slug: string }) {
  const [, setLocation] = useLocation();
  const category = categories.find((item) => item.slug === slug) ?? categories[0];
  const designs = readyMadeDesigns.filter((design) => design.category === category.slug);
  const extended = [...designs, ...designs.map((design, index) => ({ ...design, id: `${design.id}-${index + 2}`, name: `${category.name} edit ${index + 2}`, accent: index % 2 ? '#f5f1e9' : '#1f2430' }))];
  return <main className="category-page"><button className="back-link" onClick={() => setLocation('/#ready-made')}><ChevronLeft size={16} /> Back to ready-made</button><div className="category-heading"><span className="big-category-icon" style={{ background: category.color }}>{category.icon}</span><div><p className="eyebrow"><span /> READY-MADE / {category.name.toUpperCase()}</p><h1>{category.name}<br /><em>collection.</em></h1><p>Pick a design. Make it yours.</p></div></div><div className="design-grid">{extended.map((design) => <article className="design-card" key={design.id}><div className="design-art" style={{ '--design-color': design.color, '--design-accent': design.accent } as CSSProperties}><span>{design.mark}</span><small>BACKBENCHERS</small></div><div className="design-card-meta"><div><span>{category.name}</span><h3>{design.name}</h3></div><button onClick={() => setLocation('/editor')}><ArrowRight size={16} /></button></div></article>)}</div></main>;
}

function AccountPage({ isLoggedIn, onLogin }: { isLoggedIn: boolean; onLogin: () => void }) {
  return <main className="account-page"><div className="account-card"><div className="account-icon"><UserRound size={22} /></div>{isLoggedIn ? <><p className="eyebrow"><span /> YOUR ACCOUNT</p><h1>Welcome<br /><em>back.</em></h1><p>Your saved designs, squad orders and order tracking will live here.</p><div className="account-stats"><span><b>0</b> Saved designs</span><span><b>0</b> Orders</span></div></> : <><p className="eyebrow"><span /> YOUR ACCOUNT</p><h1>Keep your<br /><em>ideas.</em></h1><p>Sign in with your mobile number to save designs, upload artwork and track your orders.</p><button className="primary-button" onClick={onLogin}>Create account / Login <ArrowRight size={17} /></button></>}</div></main>;
}

function AdminPage({ onNotice }: { onNotice: (message: string) => void }) {
  const [items, setItems] = useState(products);
  const adminUploadRef = useRef<HTMLInputElement>(null);
  const addCatalogItem = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; setItems((current) => [...current, { id: `uploaded-${Date.now()}`, name: file.name.replace(/\.[^/.]+$/, ''), type: 'Round neck', fit: 'Regular fit', neck: 'Round neck', price: 220, color: '#8e7f74', colorName: 'Uploaded sample', gsm: 'Awaiting details', tag: 'New upload', image: URL.createObjectURL(file) }]); onNotice('Catalog item added to this admin preview.'); };
  return <main className="admin-page"><div className="admin-heading"><div><p className="eyebrow"><span /> SUPER ADMIN</p><h1>Control<br /><em>room.</em></h1></div><span className="admin-status"><i /> Preview mode</span></div><div className="admin-tabs"><button className="active">Overview</button><button>Catalog</button><button>Design uploads</button><button>Orders</button><button>Pricing rules</button></div><div className="admin-stats"><div><span>CATALOG ITEMS</span><strong>{items.length}</strong><small>+ seeded blanks</small></div><div><span>DESIGN UPLOADS</span><strong>12</strong><small>4 need review</small></div><div><span>OPEN ORDERS</span><strong>0</strong><small>Waiting for first drop</small></div><div><span>BULK QUOTES</span><strong>3</strong><small>Need a reply</small></div></div><section className="admin-content"><div className="admin-panel"><div className="admin-panel-heading"><div><span className="eyebrow">CATALOG</span><h2>Manage blanks</h2></div><button className="primary-button" onClick={() => adminUploadRef.current?.click()}><Upload size={15} /> Upload item</button><input ref={adminUploadRef} hidden type="file" accept="image/*" onChange={addCatalogItem} /></div><div className="admin-table"><div className="admin-row admin-row-head"><span>Item</span><span>Type</span><span>Base price</span><span>Status</span><span /></div>{items.slice(0, 8).map((item) => <div className="admin-row" key={item.id}><span className="admin-item"><i style={{ background: item.color }} /><b>{item.name}</b></span><span>{item.type}</span><span>{money(item.price)}</span><span className="status-pill">Live</span><button><Settings2 size={15} /></button></div>)}</div></div><div className="admin-side-panels"><div className="admin-mini-panel"><span className="eyebrow">RECENT UPLOADS</span><h3>Customer designs</h3><p>3 artwork files are waiting for print-quality review.</p><button onClick={() => onNotice('Design review queue opened in preview mode.')}>Open queue <ArrowRight size={15} /></button></div><div className="admin-mini-panel"><span className="eyebrow">PRICING ENGINE</span><h3>Current rules</h3><p>Base ₹220 · front ₹120 · back ₹120 · both ₹200 · text ₹50/side.</p><button onClick={() => onNotice('Pricing rules are ready for API persistence.')}>Edit rules <ArrowRight size={15} /></button></div></div></section></main>;
}

function NotFoundPage() { const [, setLocation] = useLocation(); return <main className="not-found"><h1>That page<br /><em>is blank.</em></h1><button className="primary-button" onClick={() => setLocation('/')}>Back home <ArrowRight size={16} /></button></main>; }

function AppShell() {
  const [location] = useLocation();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<ModalStep>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [protectedAction, setProtectedAction] = useState('create an account');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [notice, setNotice] = useState('');
  const afterAuthRef = useRef<(() => void) | undefined>(undefined);
  const showNotice = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 3000); };
  const openAuth = (action: string, callback?: () => void) => { setProtectedAction(action); afterAuthRef.current = callback; setModalStep('phone'); setModalOpen(true); };
  const verifyOtp = () => { if (otp.length !== 4) return; setIsLoggedIn(true); setModalOpen(false); setOtp(''); showNotice('Account ready. Your next step is unlocked.'); afterAuthRef.current?.(); afterAuthRef.current = undefined; };
  const page = location.startsWith('/editor') ? <EditorPage onNotice={showNotice} openAuth={openAuth} /> : location === '/catalog' ? <CatalogPage /> : location.startsWith('/category/') ? <CategoryPage slug={location.split('/')[2] ?? 'gaming'} /> : location === '/account' ? <AccountPage isLoggedIn={isLoggedIn} onLogin={() => openAuth('create an account')} /> : location.startsWith('/admin') ? <AdminPage onNotice={showNotice} /> : location === '/' || location.startsWith('/#') ? <HomePage onNotice={showNotice} isLoggedIn={isLoggedIn} openAuth={openAuth} /> : <NotFoundPage />;
  return <div className="app-shell"><div className="grain" /><Header onLogin={() => openAuth('create an account')} isLoggedIn={isLoggedIn} />{page}<Footer /><WhatsAppButton />{notice && <div className="toast-message" role="status"><Check size={16} /> {notice}</div>}<AuthModal open={modalOpen} action={protectedAction} step={modalStep} phone={phone} otp={otp} setPhone={setPhone} setOtp={setOtp} onClose={() => setModalOpen(false)} onSend={() => setModalStep('otp')} onVerify={verifyOtp} onResend={() => showNotice('A fresh code is on its way.')} /></div>;
}

function App() { return <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><AppShell /></WouterRouter>; }

export default App;