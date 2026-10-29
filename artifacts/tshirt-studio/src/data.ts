export type Product = {
  id: string;
  name: string;
  type: 'Round neck' | 'Polo collar';
  fit: 'Regular fit' | 'Oversized';
  neck: 'Round neck' | 'V neck' | 'Polo collar';
  price: number;
  color: string;
  colorName: string;
  gsm: string;
  tag: string;
  image: string;
};

export type ReadyMadeDesign = {
  id: string;
  category: string;
  name: string;
  color: string;
  accent: string;
  mark: string;
};

export const products: Product[] = [
  { id: 'regular-white', name: 'Regular Fit Round Neck', type: 'Round neck', fit: 'Regular fit', neck: 'Round neck', price: 220, color: '#ebe8df', colorName: 'Cloud white', gsm: '180 GSM cotton', tag: 'Best seller', image: '/product-images/regular-fit-white.jpg' },
  { id: 'regular-black', name: 'Regular Fit Black Tee', type: 'Round neck', fit: 'Regular fit', neck: 'Round neck', price: 220, color: '#202228', colorName: 'Jet black', gsm: '180 GSM cotton', tag: 'Everyday', image: '/product-images/regular-fit-white.jpg' },
  { id: 'oversized-black', name: 'Oversized Street Tee', type: 'Round neck', fit: 'Oversized', neck: 'Round neck', price: 280, color: '#202228', colorName: 'Washed black', gsm: '240 GSM heavyweight', tag: 'Oversized', image: '/product-images/oversized-black.jpg' },
  { id: 'oversized-red', name: 'Oversized Statement Tee', type: 'Round neck', fit: 'Oversized', neck: 'Round neck', price: 280, color: '#c83b2d', colorName: 'Street red', gsm: '240 GSM heavyweight', tag: 'New', image: '/product-images/regular-fit-white.jpg' },
  { id: 'v-neck-cream', name: 'V-Neck Essential', type: 'Round neck', fit: 'Regular fit', neck: 'V neck', price: 240, color: '#d9c9ae', colorName: 'Warm cream', gsm: '180 GSM cotton', tag: 'V neck', image: '/product-images/v-neck-white.jpg' },
  { id: 'polo-white', name: 'Regular Fit Polo', type: 'Polo collar', fit: 'Regular fit', neck: 'Polo collar', price: 320, color: '#ebe8df', colorName: 'Cloud white', gsm: '220 GSM pique', tag: 'Polo', image: '/product-images/polo-navy.jpg' },
  { id: 'polo-navy', name: 'Everyday Navy Polo', type: 'Polo collar', fit: 'Regular fit', neck: 'Polo collar', price: 320, color: '#273b65', colorName: 'Midnight navy', gsm: '220 GSM pique', tag: 'Premium', image: '/product-images/polo-navy.jpg' },
  { id: 'polo-green', name: 'Campus Green Polo', type: 'Polo collar', fit: 'Regular fit', neck: 'Polo collar', price: 320, color: '#38584a', colorName: 'Forest green', gsm: '220 GSM pique', tag: 'College pick', image: '/product-images/polo-navy.jpg' },
];

export const categories = [
  { slug: 'gangster', name: 'Gangster', icon: '🔥', color: '#d7422e' },
  { slug: 'gaming', name: 'Gaming', icon: '🎮', color: '#5f6bd6' },
  { slug: 'dark', name: 'Dark', icon: '💀', color: '#252935' },
  { slug: 'meme', name: 'Meme', icon: '😂', color: '#e7b93d' },
  { slug: 'couple', name: 'Couple', icon: '❤️', color: '#de5571' },
  { slug: 'music', name: 'Music', icon: '🎵', color: '#7156a8' },
  { slug: 'gym', name: 'Gym', icon: '🏋️', color: '#bc5d30' },
  { slug: 'biker', name: 'Biker', icon: '🏍️', color: '#3e4952' },
  { slug: 'coding', name: 'Coding', icon: '🧑‍💻', color: '#3a8b72' },
  { slug: 'cyberpunk', name: 'Cyberpunk', icon: '☠️', color: '#35a4a0' },
  { slug: 'india', name: 'India', icon: '🇮🇳', color: '#e58b38' },
  { slug: 'college', name: 'College', icon: '🎓', color: '#4871b6' },
];

export const readyMadeDesigns: ReadyMadeDesign[] = categories.map((category, index) => ({
  id: `${category.slug}-01`,
  category: category.slug,
  name: `${category.name} original`,
  color: category.color,
  accent: index % 2 === 0 ? '#f5f1e9' : '#1f2430',
  mark: category.icon,
}));

export const testimonials = [
  { quote: 'The preview was so easy. I ordered our whole fresher squad in one sitting.', name: 'Ananya S.', detail: 'College fest, Pune' },
  { quote: 'Finally a custom tee website where the price is clear before checkout.', name: 'Rohan M.', detail: 'Gaming team, Bengaluru' },
  { quote: 'Our café staff tees arrived exactly like the preview. The fit is excellent.', name: 'Mehul D.', detail: 'Café owner, Mumbai' },
];