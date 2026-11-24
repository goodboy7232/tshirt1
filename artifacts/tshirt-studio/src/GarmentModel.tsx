import type { Product } from './data';
import './garment-model.css';

export type GarmentView = 'front' | 'back' | 'left' | 'right';
type Placement = 'none' | 'front' | 'back' | 'both' | 'sides' | 'all';

type GarmentModelProps = {
  color: string;
  fit: Product['fit'];
  neck: Product['neck'];
  view: GarmentView;
  placement: Placement;
  frontText: string;
  backText: string;
  artwork: string | null;
};

type PrintBox = { x: number; y: number; width: number; height: number };

function PrintZone({ box, artwork, text }: { box: PrintBox; artwork: string | null; text: string }) {
  return (
    <g className="garment-print-zone">
      <rect {...box} fill="white" fillOpacity=".025" stroke="#e84b35" strokeWidth="2" strokeDasharray="6 5" />
      {artwork ? (
        <image href={artwork} x={box.x + 8} y={box.y + 8} width={box.width - 16} height={box.height - 16} preserveAspectRatio="xMidYMid meet" />
      ) : text.trim() ? (
        <text x={box.x + box.width / 2} y={box.y + box.height / 2} textAnchor="middle" dominantBaseline="middle" fill="#252a35" fontFamily="Arial, sans-serif" fontSize={text.length > 16 ? 16 : 22} fontWeight="600">
          {text.slice(0, 24)}
        </text>
      ) : null}
    </g>
  );
}

const regularFront =
  'M210 76 Q191 70 173 79 Q146 85 123 104 L43 192 Q34 201 40 211 L83 252 Q92 260 101 250 L128 218 L125 462 Q124 482 143 486 L357 486 Q376 482 375 462 L372 218 L399 250 Q408 260 417 252 L460 211 Q466 201 457 192 L377 104 Q354 85 327 79 Q309 70 290 76 Q250 111 210 76 Z';
const oversizedFront =
  'M207 69 Q187 63 166 73 Q134 82 105 105 L18 197 Q10 207 18 217 L72 267 Q82 276 92 265 L117 236 L108 466 Q107 488 130 493 L370 493 Q393 488 392 466 L383 236 L408 265 Q418 276 428 267 L482 217 Q490 207 482 197 L395 105 Q366 82 334 73 Q313 63 293 69 Q250 107 207 69 Z';
const regularBack =
  'M210 76 Q191 70 173 79 Q146 85 123 104 L43 192 Q34 201 40 211 L83 252 Q92 260 101 250 L128 218 L138 248 L134 487 Q133 509 153 513 L347 513 Q367 509 366 487 L362 248 L372 218 L399 250 Q408 260 417 252 L460 211 Q466 201 457 192 L377 104 Q354 85 327 79 Q309 70 290 76 Q250 104 210 76 Z';
const oversizedBack =
  'M207 69 Q187 63 166 73 Q134 82 105 105 L18 197 Q10 207 18 217 L72 267 Q82 276 92 265 L117 236 L127 260 L122 490 Q121 515 143 520 L357 520 Q379 515 378 490 L373 260 L383 236 L408 265 Q418 276 428 267 L482 217 Q490 207 482 197 L395 105 Q366 82 334 73 Q313 63 293 69 Q250 99 207 69 Z';
const sideTorso =
  'M218 82 Q246 66 278 78 Q306 90 328 116 Q350 148 344 188 L338 452 Q336 480 310 492 L198 492 Q176 484 180 454 L184 248 Q178 214 184 176 Q192 126 218 82 Z';
const oversizedSideTorso =
  'M210 78 Q242 58 282 72 Q316 84 342 112 Q368 144 362 188 L354 454 Q352 488 320 498 L188 498 Q158 486 164 452 L168 252 Q160 216 168 172 Q178 122 210 78 Z';
const sideSleeve =
  'M218 96 Q188 102 162 122 Q132 142 112 164 L58 218 Q42 234 50 252 L72 268 Q88 278 104 266 L142 230 Q166 208 184 176 L224 126 Z';
const oversizedSideSleeve =
  'M210 92 Q178 98 148 120 Q116 142 92 168 L32 220 Q14 236 22 256 L50 278 Q68 290 88 276 L130 238 Q158 214 178 178 L220 124 Z';

function NeckDetails({ neck, back, color }: { neck: Product['neck']; back: boolean; color: string }) {
  if (back) {
    return (
      <g>
        <path d="M207 77 Q250 107 293 77" fill="none" stroke="color-mix(in srgb, currentColor 65%, #313742)" strokeWidth="8" opacity=".44" />
        <path d="M210 77 Q250 103 290 77" fill="none" stroke={color} strokeWidth="3" />
        <path d="M211 84 Q250 108 289 84" fill="none" stroke="white" strokeWidth="1.5" opacity=".5" />
      </g>
    );
  }

  if (neck === 'Polo collar') {
    return (
      <g>
        <path d="M214 77 Q250 108 286 77 L271 113 Q250 130 229 113 Z" fill="#292d35" opacity=".88" />
        <path d="M207 75 L244 99 L250 119 L228 137 L200 88 Z" fill={`color-mix(in srgb, ${color} 66%, white)`} stroke="#59606a" strokeOpacity=".48" strokeWidth="2" />
        <path d="M293 75 L256 99 L250 119 L272 137 L300 88 Z" fill={`color-mix(in srgb, ${color} 66%, white)`} stroke="#59606a" strokeOpacity=".48" strokeWidth="2" />
        <path d="M244 100 L250 119 L256 100" fill="none" stroke="#5d636e" strokeOpacity=".46" strokeWidth="1.5" />
        <path d="M239 115 Q250 119 261 115 L260 179 L240 179 Z" fill={`color-mix(in srgb, ${color} 82%, #252a34)`} stroke="#5d636e" strokeOpacity=".34" strokeWidth="1.5" />
        <path d="M250 120 L250 178" fill="none" stroke="white" strokeOpacity=".62" strokeWidth="1.5" />
        <circle cx="250" cy="137" r="2.3" fill="#4b5059" />
        <circle cx="250" cy="153" r="2.3" fill="#4b5059" />
        <circle cx="250" cy="169" r="2.3" fill="#4b5059" />
      </g>
    );
  }

  if (neck === 'V neck') {
    return (
      <g>
        <path d="M208 77 L250 132 L292 77" fill="none" stroke={`color-mix(in srgb, ${color} 54%, #252a34)`} strokeWidth="8" strokeLinejoin="round" opacity=".62" />
        <path d="M210 77 L250 127 L290 77" fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round" opacity=".52" />
      </g>
    );
  }

  return (
    <g>
      <path d="M207 76 Q250 119 293 76" fill="none" stroke={`color-mix(in srgb, ${color} 55%, #252a34)`} strokeWidth="9" opacity=".64" />
      <path d="M210 76 Q250 115 290 76" fill="none" stroke={`color-mix(in srgb, ${color} 65%, white)`} strokeWidth="3" />
      <path d="M215 78 Q250 109 285 78" fill="none" stroke="white" strokeWidth="1.5" opacity=".6" />
    </g>
  );
}

function SideNeckDetails({ neck, color }: { neck: Product['neck']; color: string }) {
  if (neck === 'Polo collar') {
    return (
      <g>
        <path d="M222 72 Q248 94 278 78 L290 92 Q260 112 216 92 Z" fill="#252a35" opacity=".92" />
        <path d="M216 78 Q236 90 256 98 L238 112 Q220 104 208 90 Z" fill={`color-mix(in srgb, ${color} 66%, white)`} stroke="#59606a" strokeOpacity=".48" strokeWidth="2" />
        <path d="M278 80 L258 98 L252 114 L276 104 L290 90 Z" fill={`color-mix(in srgb, ${color} 66%, white)`} stroke="#59606a" strokeOpacity=".42" strokeWidth="2" />
        <path d="M248 98 L258 114" stroke="#555c66" strokeOpacity=".62" strokeWidth="2" />
        <path d="M238 102 L252 118" stroke="white" strokeOpacity=".6" strokeWidth="2" />
        <circle cx="252" cy="122" r="2.4" fill="#4b5059" />
        <circle cx="250" cy="136" r="2.4" fill="#4b5059" />
      </g>
    );
  }

  if (neck === 'V neck') {
    return (
      <g fill="none" strokeLinecap="round">
        <path d="M221 76 Q238 96 257 103" stroke={`color-mix(in srgb, ${color} 54%, #252a34)`} strokeWidth="8" opacity=".62" />
        <path d="M222 75 Q239 94 256 100" stroke="white" strokeWidth="2" opacity=".5" />
      </g>
    );
  }

  return (
    <g fill="none" strokeLinecap="round">
      <path d="M220 75 Q240 98 261 101" stroke={`color-mix(in srgb, ${color} 55%, #252a34)`} strokeWidth="8" opacity=".58" />
      <path d="M222 75 Q241 95 259 98" stroke="white" strokeWidth="2" opacity=".52" />
    </g>
  );
}

export function GarmentModel({
  color,
  fit,
  neck,
  view,
  placement,
  frontText,
  backText,
  artwork,
}: GarmentModelProps) {
  const back = view === 'back';
  const side = view === 'left' || view === 'right';
  const shape = side
    ? fit === 'Oversized' ? oversizedSideTorso : sideTorso
    : back
      ? fit === 'Oversized' ? oversizedBack : regularBack
      : fit === 'Oversized' ? oversizedFront : regularFront;
  const printVisible = back
    ? placement === 'back' || placement === 'both' || placement === 'all'
    : side
      ? placement === 'sides' || placement === 'all'
      : placement === 'front' || placement === 'both' || placement === 'all';
  const printText = back ? backText : frontText;
  const printBox = back
    ? { x: 158, y: 145, width: 184, height: 260 }
    : { x: 160, y: 190, width: 180, height: 215 };
  const sidePrintBox = { x: 92, y: 174, width: 76, height: 68 };
  const flipSide = side && view === 'right' ? 'translate(500 0) scale(-1 1)' : undefined;
  const rasterRender = null;

  return (
    <svg
      className={`garment-model-svg garment-model-${view}`}
      viewBox="0 0 500 540"
      role="img"
      aria-label={`${fit} ${neck} T-shirt, ${view} view`}
    >
      <defs>
        <linearGradient id="garment-fabric" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={`color-mix(in srgb, ${color} 68%, #252a34)`} />
          <stop offset="12%" stopColor={`color-mix(in srgb, ${color} 82%, #252a34)`} />
          <stop offset="30%" stopColor={`color-mix(in srgb, ${color} 82%, white)`} />
          <stop offset="52%" stopColor={color} />
          <stop offset="72%" stopColor={`color-mix(in srgb, ${color} 88%, white)`} />
          <stop offset="88%" stopColor={`color-mix(in srgb, ${color} 78%, #252a34)`} />
          <stop offset="100%" stopColor={`color-mix(in srgb, ${color} 58%, #252a34)`} />
        </linearGradient>
        <linearGradient id="garment-sleeve" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={`color-mix(in srgb, ${color} 58%, #252a34)`} />
          <stop offset="22%" stopColor={`color-mix(in srgb, ${color} 84%, #252a34)`} />
          <stop offset="48%" stopColor={`color-mix(in srgb, ${color} 82%, white)`} />
          <stop offset="72%" stopColor={color} />
          <stop offset="100%" stopColor={`color-mix(in srgb, ${color} 62%, #252a34)`} />
        </linearGradient>
        <linearGradient id="garment-fold" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="white" stopOpacity=".5" />
          <stop offset="42%" stopColor="white" stopOpacity=".04" />
          <stop offset="100%" stopColor="#1f2530" stopOpacity=".34" />
        </linearGradient>
        <filter id="garment-shadow" x="-30%" y="-20%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        {rasterRender && (
          <mask id="garment-raster-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="500" height="540">
            <image href={rasterRender} x="0" y="0" width="500" height="540" preserveAspectRatio="xMidYMid meet" />
          </mask>
        )}
      </defs>

      <ellipse cx="250" cy="500" rx="151" ry="15" fill="#62666d" opacity=".17" filter="url(#garment-shadow)" />
      {side && <ellipse cx="250" cy="500" rx={fit === 'Oversized' ? 176 : 158} ry="18" fill="#1f2530" opacity=".12" filter="url(#garment-shadow)" />}
      <g transform={flipSide}>
        <g>
        {rasterRender ? (
          <>
            <rect x="0" y="0" width="500" height="540" fill={color} mask="url(#garment-raster-mask)" />
            <image
              className={`garment-raster-shading ${back ? 'garment-raster-back' : 'garment-raster-side'}`}
              href={rasterRender}
              x="0"
              y="0"
              width="500"
              height="540"
              preserveAspectRatio="xMidYMid meet"
            />
            <image className="garment-raster-highlight" href={rasterRender} x="0" y="0" width="500" height="540" preserveAspectRatio="xMidYMid meet" />
            {back ? (
              <PrintZone
                box={printBox}
                artwork={printVisible ? artwork : null}
                text={printVisible ? printText : ''}
              />
            ) : (
              printVisible ? <PrintZone box={sidePrintBox} artwork={null} text="" /> : null
            )}
          </>
        ) : (
          <>
        {side && (
          <>
            <path d={fit === 'Oversized' ? oversizedSideSleeve : sideSleeve} fill="url(#garment-sleeve)" stroke="#555c66" strokeOpacity=".48" strokeWidth="2.2" strokeLinejoin="round" />
            <path d="M58 218 Q68 238 72 268" fill="none" stroke="#4f5661" strokeOpacity=".42" strokeWidth="4" />
            <path d="M50 252 Q68 274 104 266" fill="none" stroke="#626873" strokeOpacity=".72" strokeWidth="5" />
            <path d="M54 244 Q72 264 100 258" fill="none" stroke="white" strokeOpacity=".62" strokeWidth="2" />
            <path d="M78 252 Q88 224 106 202" fill="none" stroke="white" strokeOpacity=".26" strokeWidth="8" />
          </>
        )}
        <path
          d={shape}
          fill="url(#garment-fabric)"
          stroke="#555c66"
          strokeOpacity=".42"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        {side ? (
          <>
            <g className="garment-side-details" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M204 204 Q218 276 208 350 Q204 414 212 458" stroke="url(#garment-fold)" strokeWidth="32" opacity=".64" />
              <path d="M312 150 Q306 252 314 338 L306 456" stroke="#505762" strokeOpacity=".32" strokeWidth="4" />
              <path d="M232 128 Q250 158 246 196" stroke="white" strokeOpacity=".48" strokeWidth="5" />
              <path d="M196 458 Q250 478 306 458" stroke="#626873" strokeOpacity=".68" strokeWidth="4" />
              <path d="M198 468 Q250 486 304 468" stroke="white" strokeOpacity=".62" strokeWidth="3" />
              <path d="M228 98 Q244 112 258 132" stroke="#505762" strokeOpacity=".48" strokeWidth="4" />
              <path d="M192 252 Q204 324 198 390" stroke="#59606b" strokeOpacity=".22" strokeWidth="3" />
            </g>
            <path d="M224 82 Q246 104 260 132" fill="none" stroke="#59606b" strokeOpacity=".50" strokeWidth="5" />
            <SideNeckDetails neck={neck} color={color} />
          </>
        ) : (
          <>
            {back ? (
              <>
                <path d="M164 126 Q194 110 218 98 Q250 118 282 98 Q308 110 338 126 L357 472 Q250 495 143 472 Z" fill="url(#garment-fold)" opacity=".18" />
                <path d="M211 99 Q231 116 250 120 Q269 116 289 99" fill="none" stroke="#59606b" strokeOpacity=".34" strokeWidth="2" />
                <path d="M213 101 Q191 108 170 119 M287 101 Q309 108 330 119" fill="none" stroke="#59606b" strokeOpacity=".32" strokeWidth="2" />
                <path d="M250 121 Q244 211 250 299 Q254 384 250 489" fill="none" stroke="white" strokeOpacity=".25" strokeWidth="2" />
                <path d="M145 251 Q156 282 153 335 M355 251 Q344 282 347 335" fill="none" stroke="#59606b" strokeOpacity=".22" strokeWidth="2" />
                <path d="M128 208 L100 248 Q91 256 83 250 L41 210" fill="none" stroke="#616873" strokeOpacity=".48" strokeWidth="2" />
                <path d="M372 208 L400 248 Q409 256 417 250 L459 210" fill="none" stroke="white" strokeOpacity=".48" strokeWidth="2" />
                <path d="M138 248 L134 487 Q133 509 153 513 M362 248 L366 487 Q367 509 347 513" fill="none" stroke="#59606b" strokeOpacity=".34" strokeWidth="2" />
                <path d="M136 493 Q250 507 364 493" fill="none" stroke="#59606b" strokeOpacity=".62" strokeWidth="3" />
                <path d="M137 500 Q250 514 363 500" fill="none" stroke="white" strokeOpacity=".56" strokeWidth="2" />
                <path d="M43 201 L82 239 M457 201 L418 239" fill="none" stroke="white" strokeOpacity=".54" strokeWidth="2" />
                <NeckDetails neck={neck} back color={color} />
              </>
            ) : (
              <>
                <path d="M168 110 Q190 155 183 222 L176 446 Q164 458 153 459 L159 222 Z" fill="url(#garment-fold)" opacity=".42" />
                <path d="M178 104 Q200 141 199 194" fill="none" stroke="white" strokeOpacity=".28" strokeWidth="2" />
                <path d="M128 208 L100 248 Q91 256 83 250 L41 210" fill="none" stroke="#616873" strokeOpacity=".48" strokeWidth="2" />
                <path d="M372 208 L400 248 Q409 256 417 250 L459 210" fill="none" stroke="white" strokeOpacity=".48" strokeWidth="2" />
                <path d="M133 216 L133 449 Q133 465 148 467" fill="none" stroke="#59606b" strokeOpacity=".28" strokeWidth="2" />
                <path d="M367 216 L367 449 Q367 465 352 467" fill="none" stroke="#59606b" strokeOpacity=".24" strokeWidth="2" />
                <path d="M128 456 Q250 469 372 456" fill="none" stroke="#59606b" strokeOpacity=".58" strokeWidth="3" />
                <path d="M130 463 Q250 476 370 463" fill="none" stroke="white" strokeOpacity=".54" strokeWidth="2" />
                <path d="M43 201 L82 239 M457 201 L418 239" fill="none" stroke="white" strokeOpacity=".54" strokeWidth="2" />
                <NeckDetails neck={neck} back={back} color={color} />
              </>
            )}
            {side ? (printVisible ? <PrintZone box={sidePrintBox} artwork={null} text="" /> : null) : printVisible && <PrintZone box={printBox} artwork={artwork} text={printText} />}
          </>
        )}
          </>
        )}
        </g>
      </g>
    </svg>
  );
}