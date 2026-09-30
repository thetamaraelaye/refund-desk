import { cn } from './ui/cn';

// Larkfield's product drawings: one line drawing per product type, one stroke weight, on a softly
// tinted tile. Made in-house as SVG, so there are no image licences or network requests. Decorative:
// the product's name is always written next to it.
const DRAWINGS: Record<string, React.ReactNode> = {
  pour: (
    <>
      <path d="M20 20h24l-7 12H27z" />
      <path d="M22 36h20l-3 18H25z" />
      <path d="M42 40c5 0 5 9 0 9" />
    </>
  ),
  coat: (
    <>
      <path d="M24 13l8 6 8-6 7 5-3 36H20l-3-36z" />
      <path d="M32 19v35M28 30h1M28 38h1M28 46h1" />
    </>
  ),
  jacket: (
    <>
      <path d="M25 17c1-6 13-6 14 0" />
      <path d="M25 17l-7 4-2 31h32l-2-31-7-4" />
      <path d="M32 20v32M22 34h6M36 34h6" />
    </>
  ),
  lamp: (
    <>
      <path d="M18 52h22" />
      <path d="M29 52l-8-18 13-10" />
      <path d="M33 25l9-7 7 8-11 5z" />
      <circle cx="21" cy="34" r="1.5" />
    </>
  ),
  tv: (
    <>
      <rect x="10" y="14" width="44" height="28" rx="2" />
      <path d="M32 42v7M24 50h16" />
    </>
  ),
  earbuds: (
    <>
      <circle cx="23" cy="26" r="6" />
      <path d="M26 31l3 15" />
      <circle cx="41" cy="26" r="6" />
      <path d="M38 31l-3 15" />
    </>
  ),
  headphones: (
    <>
      <path d="M16 38v-5a16 16 0 0132 0v5" />
      <rect x="12" y="36" width="9" height="15" rx="3" />
      <rect x="43" y="36" width="9" height="15" rx="3" />
    </>
  ),
  plant: (
    <>
      <path d="M22 40h20l-3 14H25z" />
      <path d="M32 40V24" />
      <path d="M32 31c-7-1-11-7-10-13 7 1 11 6 10 13z" />
      <path d="M32 27c5-5 11-5 14-2-4 5-10 5-14 2z" />
    </>
  ),
  mat: (
    <>
      <circle cx="21" cy="32" r="10" />
      <circle cx="21" cy="32" r="4" />
      <path d="M21 22h24a10 10 0 010 20H21" />
    </>
  ),
  bottle: (
    <>
      <path d="M27 12h10" />
      <path d="M28 12v7c-4 2-6 6-6 10v21a4 4 0 004 4h12a4 4 0 004-4V29c0-4-2-8-6-10v-7" />
      <path d="M22 32h20" />
    </>
  ),
  speaker: (
    <>
      <rect x="20" y="11" width="24" height="42" rx="5" />
      <circle cx="32" cy="36" r="8" />
      <circle cx="32" cy="21" r="3" />
    </>
  ),
  kettle: (
    <>
      <path d="M20 50h26l-4-22H24z" />
      <path d="M27 28c0-5 12-5 12 0" />
      <path d="M22 35l-7-5" />
      <path d="M42 30c7 0 8 15 1 17" />
    </>
  ),
  blender: (
    <>
      <path d="M22 12h20l-3 26H25z" />
      <rect x="20" y="38" width="24" height="14" rx="3" />
      <circle cx="32" cy="45" r="2.5" />
    </>
  ),
  mixer: (
    <>
      <path d="M14 52h34" />
      <path d="M42 52V24" />
      <path d="M18 20h27a5 5 0 010 10H20z" />
      <path d="M20 38h18l-3 11H23z" />
      <path d="M29 30v8" />
    </>
  ),
  mugs: (
    <>
      <rect x="11" y="26" width="16" height="20" rx="2" />
      <path d="M27 31c5 0 5 10 0 10" />
      <rect x="34" y="20" width="16" height="20" rx="2" />
      <path d="M50 25c5 0 5 10 0 10" />
    </>
  ),
  press: (
    <>
      <rect x="22" y="20" width="18" height="32" rx="2" />
      <path d="M31 10v10M26 10h10" />
      <path d="M40 26c6 0 6 16 0 16" />
      <path d="M22 44h18" />
    </>
  ),
  grinder: (
    <>
      <path d="M22 11h20l-4 12H26z" />
      <rect x="24" y="23" width="16" height="23" rx="2" />
      <path d="M20 50h24" />
      <circle cx="32" cy="34" r="3" />
    </>
  ),
  shoe: (
    <>
      <path d="M11 44c0-6 4-11 9-11l6-7 10 8c5 3 11 5 16 5 2 0 3 2 3 4v5H11z" />
      <path d="M11 44h44M28 32l3 3M32 29l3 3" />
    </>
  ),
  pillow: (
    <>
      <path d="M13 21c7 2 31 2 38 0 2 8 2 16 0 24-7-2-31-2-38 0-2-8-2-16 0-24z" />
      <path d="M22 33c6 1 14 1 20 0" />
    </>
  ),
  scarf: (
    <>
      <path d="M24 11h16v24l6 16h-8l-6-12-6 12h-8l6-16z" />
      <path d="M24 17h16M18 51v4M22 51v4M40 51v4M44 51v4" />
    </>
  ),
  stand: (
    <>
      <path d="M14 48l18-22 18 22" />
      <path d="M22 38h20" />
      <path d="M20 24h24" />
    </>
  ),
  hub: (
    <>
      <rect x="16" y="20" width="32" height="22" rx="5" />
      <path d="M22 31h4M30 31h4M38 31h4" />
      <path d="M32 42v12" />
    </>
  ),
  folded: (
    <>
      <rect x="14" y="20" width="36" height="11" rx="3" />
      <rect x="14" y="33" width="36" height="11" rx="3" />
      <path d="M20 20v11M20 33v11" />
    </>
  ),
  candles: (
    <>
      <rect x="13" y="30" width="10" height="22" rx="2" />
      <rect x="27" y="22" width="10" height="30" rx="2" />
      <rect x="41" y="34" width="10" height="18" rx="2" />
      <path d="M18 24c-2 2 0 4 0 4s2-2 0-4zM32 16c-2 2 0 4 0 4s2-2 0-4zM46 28c-2 2 0 4 0 4s2-2 0-4z" />
    </>
  ),
  chair: (
    <>
      <path d="M22 12h20v20H22z" />
      <path d="M17 34h30" />
      <path d="M22 34l-3 18M42 34l3 18M32 34v10M25 44h14" />
    </>
  ),
  parcel: (
    <>
      <path d="M12 22l20-9 20 9-20 9z" />
      <path d="M12 22v20l20 9 20-9V22M32 31v20" />
    </>
  ),
};

const BY_SKU: Record<string, keyof typeof DRAWINGS> = {
  'KIT-POUR-01': 'pour',
  'APP-COAT-MW': 'coat',
  'APP-RAIN-JK': 'jacket',
  'LGT-DESK-02': 'lamp',
  'ELC-TV-55': 'tv',
  'AUD-EARB-01': 'earbuds',
  'AUD-HEAD-02': 'headphones',
  'AUD-SPKR-01': 'speaker',
  'GDN-PLNT-03': 'plant',
  'FIT-MAT-01': 'mat',
  'FIT-BOTL-02': 'bottle',
  'KIT-KETL-01': 'kettle',
  'KIT-BLND-01': 'blender',
  'KIT-MIXR-01': 'mixer',
  'KIT-MUGS-04': 'mugs',
  'KIT-PRES-01': 'press',
  'KIT-GRND-01': 'grinder',
  'APP-SHOE-RN': 'shoe',
  'BED-PILW-SK': 'pillow',
  'APP-SCRF-SK': 'scarf',
  'OFF-STND-01': 'stand',
  'OFF-HUB-07': 'hub',
  'OFF-CHAIR-01': 'chair',
  'BTH-TOWL-GR': 'folded',
  'HOM-NAPK-04': 'folded',
  'HOM-CNDL-03': 'candles',
};

// Three quiet tile tints by department, so a grid has rhythm without shouting.
const TINTS: Record<string, string> = {
  KIT: 'bg-moss-tint',
  HOM: 'bg-moss-tint',
  GDN: 'bg-moss-tint',
  APP: 'bg-sand',
  BED: 'bg-sand',
  BTH: 'bg-sand',
  FIT: 'bg-sand',
};

export function ProductArt({ sku, className }: { sku: string; className?: string }) {
  const drawing = DRAWINGS[BY_SKU[sku] ?? 'parcel'];
  const tint = TINTS[sku.slice(0, 3)] ?? 'bg-mist';
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex aspect-square items-center justify-center rounded-[10px] text-ink-soft',
        tint,
        className,
      )}
    >
      <svg
        viewBox="0 0 64 64"
        className="h-3/5 w-3/5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {drawing}
      </svg>
    </span>
  );
}
