import type { Edge, Node } from '@xyflow/react';

/**
 * Supply-chain graph aligned with project_context.md:
 * recursive multi-tier reconstruction (Tesla → Tier-N), HSN-anchored entities.
 */
export const ANCHOR_COMPANY_NAME = 'Tesla Inc.';
export const ANCHOR_HSN = '8501.53';
export const PRODUCT_ANCHOR = 'AC traction motors (multi-phase, >750W)';

/** Risk signals from backend `Risk Assessment` (scores 0–100; higher = more concern). */
export type RiskAssessment = {
  combined_score?: number;
  sdn_score?: number;
  financial_score?: number;
  weather_score?: number;
  weather_text?: string;
  financial_notes?: string;
  sdn_notes?: string;
};

/** Traffic-light band derived from combined_score for UI badges. */
export type RiskBand = 'low' | 'medium' | 'high' | 'unknown';

export function riskBandFromCombinedScore(score: number | undefined): RiskBand {
  if (score === undefined || Number.isNaN(score)) return 'unknown';
  if (score < 34) return 'low';
  if (score < 67) return 'medium';
  return 'high';
}

export function riskBandLabel(band: RiskBand): string {
  switch (band) {
    case 'low':
      return 'Low risk';
    case 'medium':
      return 'Elevated';
    case 'high':
      return 'High risk';
    default:
      return 'Risk N/A';
  }
}

export function riskBandBadgeClass(band: RiskBand): string {
  switch (band) {
    case 'low':
      return 'border-emerald-500/45 bg-emerald-500/15 text-emerald-200';
    case 'medium':
      return 'border-amber-500/45 bg-amber-500/15 text-amber-100';
    case 'high':
      return 'border-red-500/50 bg-red-500/15 text-red-100';
    default:
      return 'border-zinc-500/40 bg-zinc-800/80 text-zinc-400';
  }
}

function numFromUnknown(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number.parseFloat(v.trim());
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function strFromUnknown(v: unknown): string | undefined {
  if (typeof v === 'string' && v.trim()) return v.trim();
  return undefined;
}

/** Normalize backend `Risk Assessment` object (may be empty `{}`). */
export function parseRiskAssessment(raw: unknown): RiskAssessment | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const combined = numFromUnknown(o.combined_score);
  const sdn = numFromUnknown(o.sdn_score);
  const fin = numFromUnknown(o.financial_score);
  const wx = numFromUnknown(o.weather_score);
  const hasAny =
    combined !== undefined ||
    sdn !== undefined ||
    fin !== undefined ||
    wx !== undefined ||
    strFromUnknown(o.weather_text) ||
    strFromUnknown(o.financial_notes) ||
    strFromUnknown(o.sdn_notes);
  if (!hasAny) return null;
  return {
    combined_score: combined,
    sdn_score: sdn,
    financial_score: fin,
    weather_score: wx,
    weather_text: strFromUnknown(o.weather_text),
    financial_notes: strFromUnknown(o.financial_notes),
    sdn_notes: strFromUnknown(o.sdn_notes),
  };
}

export type SupplyNodeData = {
  label: string;
  country: string;
  /** Street-level address from backend geocoding when available */
  address?: string;
  latitude?: number;
  longitude?: number;
  hsnCode: string;
  commodity: string;
  about: string;
  tier: number;
  /** Tier-based accent for nodes and UI chrome */
  accentColor: string;
  isRoot?: boolean;
  pathHighlight?: boolean;
  /** Parent company name for panel context */
  parentLabel?: string;
  riskAssessment?: RiskAssessment | null;
  onExpand?: (nodeId: string, companyName: string) => void;
};

type Raw = Omit<SupplyNodeData, 'pathHighlight' | 'accentColor'> & {
  id: string;
  parentId: string | null;
};

/** Tier palette: nodes, map markers, and edge color for links into that tier. */
export function tierAccent(tier: number): string {
  const palette = [
    '#00E8FF', // T0 anchor
    '#38BDF8', // T1 direct
    '#2DD4BF', // T2 sub-suppliers
    '#FBBF24', // T3 materials
    '#FB923C', // T4 raw producers
    '#A78BFA', // T5 mining inputs
    '#F472B6', // T6 terminal inputs
  ];
  return palette[Math.min(tier, palette.length - 1)] ?? '#94A3B8';
}

function hashUnit(id: string, salt: string): number {
  const s = `${id}:${salt}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 2 ** 32;
}

/**
 * Slight horizontal/vertical jitter so layouts feel less rigid.
 * `spread` scales jitter — use <1 for API-backed graphs so labels stay apart when spacing is wider.
 */
function organicOffset(
  id: string,
  tier: number,
  spread = 1
): { dx: number; dy: number } {
  const u = hashUnit(id, 'x');
  const v = hashUnit(id, 'y');
  // Reduced wave amplitude and base jitter for cleaner hierarchy
  const wave = Math.sin(tier * 1.17 + u * 6.28) * 12 * spread;
  return {
    dx: ((u - 0.5) * 42 + wave) * spread,
    dy: ((v - 0.5) * 22 + Math.cos(tier * 0.88) * 8) * spread,
  };
}

/** Tree-shaped rows from project_context.md (parent → single primary upstream link). */
const RAW: Raw[] = [
  {
    id: 't0-tesla',
    parentId: null,
    tier: 0,
    isRoot: true,
    label: ANCHOR_COMPANY_NAME,
    country: 'USA',
    hsnCode: ANCHOR_HSN,
    commodity: 'AC traction motors (multi-phase, >750W)',
    about:
      'Anchor company — HSN selected from import history. Motor-relevant supply network after BOM-style filtering.',
  },
  // Tier 1 — direct suppliers
  {
    id: 't1-nidec',
    parentId: 't0-tesla',
    tier: 1,
    label: 'Nidec Corporation',
    parentLabel: ANCHOR_COMPANY_NAME,
    country: 'Japan',
    hsnCode: '8501.53',
    commodity: 'EV traction motor assemblies',
    about: 'Primary motor supplier; ships to Tesla Fremont & Gigafactory.',
  },
  {
    id: 't1-borgwarner',
    parentId: 't0-tesla',
    tier: 1,
    label: 'BorgWarner Inc.',
    parentLabel: ANCHOR_COMPANY_NAME,
    country: 'USA',
    hsnCode: '8501.53',
    commodity: 'eMotor drive units',
    about: 'Integrated motor–inverter units for drive systems.',
  },
  {
    id: 't1-moog',
    parentId: 't0-tesla',
    tier: 1,
    label: 'Moog Inc.',
    parentLabel: ANCHOR_COMPANY_NAME,
    country: 'USA',
    hsnCode: '8503.00',
    commodity: 'Motor stator & rotor components',
    about: 'Precision wound stator assemblies.',
  },
  {
    id: 't1-denso',
    parentId: 't0-tesla',
    tier: 1,
    label: 'Denso Corporation',
    parentLabel: ANCHOR_COMPANY_NAME,
    country: 'Japan',
    hsnCode: '8501.53',
    commodity: 'Motor assemblies (EV-grade)',
    about: 'Long-term Tesla partner; axle motor units.',
  },
  {
    id: 't1-hitachi-astemo',
    parentId: 't0-tesla',
    tier: 1,
    label: 'Hitachi Astemo',
    parentLabel: ANCHOR_COMPANY_NAME,
    country: 'Japan',
    hsnCode: '8501.40',
    commodity: 'DC motors & actuator assemblies',
    about: 'Formerly Hitachi Automotive; axle-integrated units.',
  },
  {
    id: 't1-remy',
    parentId: 't0-tesla',
    tier: 1,
    label: 'Remy International',
    parentLabel: ANCHOR_COMPANY_NAME,
    country: 'USA',
    hsnCode: '8503.00',
    commodity: 'Stator & rotor subassemblies',
    about: 'Specialist EV stator winding; domestic US supplier.',
  },
  // Tier 2
  {
    id: 't2-nidec-dalian',
    parentId: 't1-nidec',
    tier: 2,
    label: 'Nidec Dalian',
    parentLabel: 'Nidec Corporation',
    country: 'China',
    hsnCode: '8503.00',
    commodity: 'Motor stator assemblies',
    about: 'Manufacturing arm of Nidec; ships wound stators.',
  },
  {
    id: 't2-sumitomo',
    parentId: 't1-nidec',
    tier: 2,
    label: 'Sumitomo Electric',
    parentLabel: 'Nidec Corporation',
    country: 'Japan',
    hsnCode: '7408.11',
    commodity: 'Copper winding wire (>6mm)',
    about: 'Magnet wire for motor coils; JIS C 3202 grade.',
  },
  {
    id: 't2-posco',
    parentId: 't1-nidec',
    tier: 2,
    label: 'POSCO',
    parentLabel: 'Nidec Corporation',
    country: 'South Korea',
    hsnCode: '7225.19',
    commodity: 'Flat-rolled silicon electrical steel',
    about: 'Rotor & stator lamination stock; HGO grade.',
  },
  {
    id: 't2-valeo',
    parentId: 't1-borgwarner',
    tier: 2,
    label: 'Valeo SA',
    parentLabel: 'BorgWarner Inc.',
    country: 'France',
    hsnCode: '8503.00',
    commodity: 'Rotor lamination stacks',
    about: 'Precision stamped electrical steel laminations.',
  },
  {
    id: 't2-proterial',
    parentId: 't1-moog',
    tier: 2,
    label: 'Proterial Ltd.',
    parentLabel: 'Moog Inc.',
    country: 'Japan',
    hsnCode: '7408.19',
    commodity: 'Fine copper conductor wire',
    about: 'Formerly Hitachi Metals; specialty winding wire.',
  },
  {
    id: 't2-furukawa',
    parentId: 't1-denso',
    tier: 2,
    label: 'Furukawa Electric',
    parentLabel: 'Denso Corporation',
    country: 'Japan',
    hsnCode: '7408.11',
    commodity: 'Copper magnet wire',
    about: 'Enamelled copper wire for motor windings.',
  },
  {
    id: 't2-nippon-steel',
    parentId: 't1-hitachi-astemo',
    tier: 2,
    label: 'Nippon Steel Corp.',
    parentLabel: 'Hitachi Astemo',
    country: 'Japan',
    hsnCode: '7225.19',
    commodity: 'Grain-oriented electrical steel',
    about: 'JNEX-Core grade; ultra-low loss for EV motors.',
  },
  {
    id: 't2-thyssenkrupp',
    parentId: 't1-borgwarner',
    tier: 2,
    label: 'Thyssenkrupp Steel',
    parentLabel: 'BorgWarner Inc.',
    country: 'Germany',
    hsnCode: '7225.19',
    commodity: 'Non-oriented electrical steel (NOES)',
    about: 'Motor-grade flat-rolled; ships to EU fabricators.',
  },
  {
    id: 't2-ls-cable',
    parentId: 't1-moog',
    tier: 2,
    label: 'LS Cable & System',
    parentLabel: 'Moog Inc.',
    country: 'South Korea',
    hsnCode: '7408.11',
    commodity: 'Industrial copper wire rod',
    about: 'Drawn copper rod for winding wire production.',
  },
  {
    id: 't2-goldwind',
    parentId: 't1-remy',
    tier: 2,
    label: 'Xinjiang Goldwind',
    parentLabel: 'Remy International',
    country: 'China',
    hsnCode: '8503.00',
    commodity: 'Permanent magnet motor components',
    about: 'Rotor magnet assemblies; rare-earth NdFeB based.',
  },
  // Tier 3 — material producers
  {
    id: 't3-jiangxi',
    parentId: 't2-nidec-dalian',
    tier: 3,
    label: 'Jiangxi Copper',
    parentLabel: 'Nidec Dalian',
    country: 'China',
    hsnCode: '7403.11',
    commodity: 'Refined copper cathodes (99.99%)',
    about: 'Primary copper refiner; feeds wire drawing plants globally.',
  },
  {
    id: 't3-aurubis',
    parentId: 't2-sumitomo',
    tier: 3,
    label: 'Aurubis AG',
    parentLabel: 'Sumitomo Electric',
    country: 'Germany',
    hsnCode: '7407.10',
    commodity: 'Continuous cast copper rod',
    about: 'Largest copper recycler in EU; rod for extrusion.',
  },
  {
    id: 't3-nlmk',
    parentId: 't2-posco',
    tier: 3,
    label: 'NLMK Group',
    parentLabel: 'POSCO',
    country: 'Russia / EU',
    hsnCode: '7225.19',
    commodity: 'Electrical steel coils (grain-oriented)',
    about: 'Cold-rolled silicon steel for core laminations.',
  },
  {
    id: 't3-baotou',
    parentId: 't2-nippon-steel',
    tier: 3,
    label: 'Baotou Steel',
    parentLabel: 'Nippon Steel Corp.',
    country: 'China',
    hsnCode: '7225.11',
    commodity: 'Grain-oriented electrical steel (GOES)',
    about: 'Transformer and motor grade silicon steel.',
  },
  {
    id: 't3-kme',
    parentId: 't2-proterial',
    tier: 3,
    label: 'KME Group',
    parentLabel: 'Proterial Ltd.',
    country: 'Germany',
    hsnCode: '7407.10',
    commodity: 'Copper rod & semifabricates',
    about: 'Downstream of smelters; specialty copper profiles.',
  },
  {
    id: 't3-wieland',
    parentId: 't2-furukawa',
    tier: 3,
    label: 'Wieland Group',
    parentLabel: 'Furukawa Electric',
    country: 'Germany',
    hsnCode: '7408.19',
    commodity: 'Copper strips & fine wire',
    about: 'Precision copper for EV winding applications.',
  },
  {
    id: 't3-arcelor',
    parentId: 't2-thyssenkrupp',
    tier: 3,
    label: 'ArcelorMittal',
    parentLabel: 'Thyssenkrupp Steel',
    country: 'Luxembourg',
    hsnCode: '7225.19',
    commodity: 'Electrical steel sheet (NOES)',
    about: 'Wide-strip NOES for motor laminations; global supply.',
  },
  {
    id: 't3-cleveland',
    parentId: 't2-valeo',
    tier: 3,
    label: 'Cleveland-Cliffs',
    parentLabel: 'Valeo SA',
    country: 'USA',
    hsnCode: '7225.19',
    commodity: 'Grain-oriented electrical steel (AK)',
    about: 'Only US-based GOES producer; AK Steel subsidiary.',
  },
  {
    id: 't3-ningbo',
    parentId: 't2-ls-cable',
    tier: 3,
    label: 'Ningbo Tongding',
    parentLabel: 'LS Cable & System',
    country: 'China',
    hsnCode: '7408.11',
    commodity: 'Drawn copper wire (fine gauge)',
    about: 'High-volume magnet wire for motor winding.',
  },
  {
    id: 't3-inner-mongolia',
    parentId: 't2-nidec-dalian',
    tier: 3,
    label: 'Inner Mongolia Copper',
    parentLabel: 'Nidec Dalian',
    country: 'China',
    hsnCode: '7403.11',
    commodity: 'Refined copper cathodes',
    about: 'State-linked refiner; feeds Jiangxi & Nidec Dalian supply paths.',
  },
  // Tier 4 — raw material producers
  {
    id: 't4-codelco',
    parentId: 't3-jiangxi',
    tier: 4,
    label: 'Codelco',
    parentLabel: 'Jiangxi Copper',
    country: 'Chile',
    hsnCode: '2603.00',
    commodity: 'Copper ore & concentrates',
    about: "World's largest copper producer; feeds Aurubis & Jiangxi.",
  },
  {
    id: 't4-bhp',
    parentId: 't3-jiangxi',
    tier: 4,
    label: 'BHP / Escondida',
    parentLabel: 'Jiangxi Copper',
    country: 'Chile',
    hsnCode: '2603.00',
    commodity: 'Copper ore & concentrates',
    about: 'Escondida is single largest copper mine globally.',
  },
  {
    id: 't4-freeport',
    parentId: 't3-aurubis',
    tier: 4,
    label: 'Freeport-McMoRan',
    parentLabel: 'Aurubis AG',
    country: 'USA / Indonesia',
    hsnCode: '2603.00',
    commodity: 'Copper ore & concentrates',
    about: 'Grasberg mine; major global copper source.',
  },
  {
    id: 't4-glencore',
    parentId: 't3-kme',
    tier: 4,
    label: 'Glencore',
    parentLabel: 'KME Group',
    country: 'Switzerland / DRC',
    hsnCode: '2603.00',
    commodity: 'Copper ore & concentrates',
    about: 'Katanga & Mutanda mines (DRC); cobalt by-product.',
  },
  {
    id: 't4-antofagasta',
    parentId: 't3-baotou',
    tier: 4,
    label: 'Antofagasta plc',
    parentLabel: 'Baotou Steel',
    country: 'Chile',
    hsnCode: '2603.00',
    commodity: 'Copper ore (Los Pelambres)',
    about: 'Mid-tier copper miner; feeds Asian smelters.',
  },
  {
    id: 't4-anglo',
    parentId: 't3-wieland',
    tier: 4,
    label: 'Anglo American',
    parentLabel: 'Wieland Group',
    country: 'UK / Chile',
    hsnCode: '2603.00',
    commodity: 'Copper ore (Los Bronces)',
    about: 'Integrated miner; concentrate to Aurubis pipeline.',
  },
  {
    id: 't4-zijin',
    parentId: 't3-ningbo',
    tier: 4,
    label: 'Zijin Mining Group',
    parentLabel: 'Ningbo Tongding',
    country: 'China',
    hsnCode: '2603.00',
    commodity: 'Copper ore & gold concentrate',
    about: 'Owns Timok & Buritica mines; growing global footprint.',
  },
  {
    id: 't4-vale',
    parentId: 't3-nlmk',
    tier: 4,
    label: 'Vale S.A.',
    parentLabel: 'NLMK Group',
    country: 'Brazil',
    hsnCode: '2601.11',
    commodity: 'Iron ore (non-agglomerated)',
    about: 'Feeds POSCO, NLMK, ArcelorMittal blast furnaces.',
  },
  {
    id: 't4-rio',
    parentId: 't3-arcelor',
    tier: 4,
    label: 'Rio Tinto',
    parentLabel: 'ArcelorMittal',
    country: 'Australia / UK',
    hsnCode: '2601.11',
    commodity: 'Iron ore (Pilbara fines & lump)',
    about: 'Largest iron ore operation; Western Australia.',
  },
  {
    id: 't4-fortescue',
    parentId: 't3-cleveland',
    tier: 4,
    label: 'Fortescue Metals',
    parentLabel: 'Cleveland-Cliffs',
    country: 'Australia',
    hsnCode: '2601.11',
    commodity: 'Iron ore (Pilbara)',
    about: 'Third-largest iron ore exporter; feeds East Asian mills.',
  },
  // Tier 5 — mining inputs & extraction services
  {
    id: 't5-sandvik',
    parentId: 't4-codelco',
    tier: 5,
    label: 'Sandvik AB',
    parentLabel: 'Codelco',
    country: 'Sweden',
    hsnCode: '8430.31',
    commodity: 'Drilling & rock-cutting equipment',
    about: 'Tunnelling & open-pit drilling rigs for copper mines.',
  },
  {
    id: 't5-caterpillar',
    parentId: 't4-bhp',
    tier: 5,
    label: 'Caterpillar Inc.',
    parentLabel: 'BHP / Escondida',
    country: 'USA',
    hsnCode: '8429.52',
    commodity: 'Mining trucks & excavators',
    about: '797F haul trucks; dominant at Escondida & Grasberg.',
  },
  {
    id: 't5-komatsu',
    parentId: 't4-freeport',
    tier: 5,
    label: 'Komatsu Ltd.',
    parentLabel: 'Freeport-McMoRan',
    country: 'Japan',
    hsnCode: '8429.52',
    commodity: 'Ultra-class mining machinery',
    about: '930E electric-drive haul trucks; competes with CAT.',
  },
  {
    id: 't5-orica',
    parentId: 't4-glencore',
    tier: 5,
    label: 'Orica Ltd.',
    parentLabel: 'Glencore',
    country: 'Australia',
    hsnCode: '3602.00',
    commodity: 'Mining explosives (ANFO / emulsions)',
    about: 'Largest explosives supplier to open-cut copper mines.',
  },
  {
    id: 't5-basf',
    parentId: 't4-antofagasta',
    tier: 5,
    label: 'BASF SE',
    parentLabel: 'Antofagasta plc',
    country: 'Germany',
    hsnCode: '3824.99',
    commodity: 'Flotation chemicals & reagents',
    about: 'Xanthate collectors; copper sulphide flotation process.',
  },
  {
    id: 't5-cytec',
    parentId: 't4-anglo',
    tier: 5,
    label: 'Cytec Solvay',
    parentLabel: 'Anglo American',
    country: 'Belgium',
    hsnCode: '3824.99',
    commodity: 'Mineral processing reagents',
    about: 'Specialty frothers and depressants for copper circuits.',
  },
  {
    id: 't5-nalco',
    parentId: 't4-zijin',
    tier: 5,
    label: 'Nalco Water (Ecolab)',
    parentLabel: 'Zijin Mining Group',
    country: 'USA',
    hsnCode: '3824.99',
    commodity: 'Process water treatment chemicals',
    about: 'Scale/corrosion inhibitors for heap leach operations.',
  },
  {
    id: 't5-atlas',
    parentId: 't4-vale',
    tier: 5,
    label: 'Atlas Copco',
    parentLabel: 'Vale S.A.',
    country: 'Sweden',
    hsnCode: '8425.31',
    commodity: 'Compressors & underground equipment',
    about: 'Pneumatic & hydraulic tools for underground mining.',
  },
  {
    id: 't5-flsmidth',
    parentId: 't4-rio',
    tier: 5,
    label: 'FLSmidth',
    parentLabel: 'Rio Tinto',
    country: 'Denmark',
    hsnCode: '8474.20',
    commodity: 'Crushing & grinding mills',
    about: 'SAG & ball mills for ore comminution at copper plants.',
  },
  {
    id: 't5-metso',
    parentId: 't4-fortescue',
    tier: 5,
    label: 'Metso Outotec',
    parentLabel: 'Fortescue Metals',
    country: 'Finland',
    hsnCode: '8474.20',
    commodity: 'Mineral processing equipment',
    about: 'Flotation cells, thickeners, smelting furnace tech.',
  },
  // Tier 6 — terminal industrial inputs
  {
    id: 't6-air-products',
    parentId: 't5-sandvik',
    tier: 6,
    label: 'Air Products',
    parentLabel: 'Sandvik AB',
    country: 'USA',
    hsnCode: '2804.40',
    commodity: 'Industrial oxygen (smelting)',
    about: 'Oxygen-enriched blast for copper smelter flash furnaces.',
  },
  {
    id: 't6-linde',
    parentId: 't5-basf',
    tier: 6,
    label: 'Linde plc',
    parentLabel: 'BASF SE',
    country: 'Ireland / Germany',
    hsnCode: '2804.40',
    commodity: 'Industrial & specialty gases',
    about: 'Nitrogen, argon, oxygen supply to processing plants.',
  },
  {
    id: 't6-shell-bp',
    parentId: 't5-caterpillar',
    tier: 6,
    label: 'Shell / BP',
    parentLabel: 'Caterpillar Inc.',
    country: 'Netherlands',
    hsnCode: '2710.19',
    commodity: 'Diesel & heavy fuel oil',
    about: 'Mine fleet fuel; bulk delivered to Atacama & Pilbara.',
  },
  {
    id: 't6-dyno',
    parentId: 't5-orica',
    tier: 6,
    label: 'Dyno Nobel',
    parentLabel: 'Orica Ltd.',
    country: 'Australia / USA',
    hsnCode: '3602.00',
    commodity: 'ANFO & emulsion explosives (bulk)',
    about: 'Upstream of Orica; precursor ammonium nitrate supply.',
  },
  {
    id: 't6-vulcan',
    parentId: 't5-flsmidth',
    tier: 6,
    label: 'Vulcan Materials',
    parentLabel: 'FLSmidth',
    country: 'USA',
    hsnCode: '2517.10',
    commodity: 'Grinding media (steel balls)',
    about: 'Consumable grinding media for ball mill circuits.',
  },
  {
    id: 't6-saint-gobain',
    parentId: 't5-basf',
    tier: 6,
    label: 'Saint-Gobain',
    parentLabel: 'BASF SE',
    country: 'France',
    hsnCode: '6902.20',
    commodity: 'Refractory bricks & linings',
    about: 'Furnace lining for copper smelters and converters.',
  },
  {
    id: 't6-yara',
    parentId: 't5-orica',
    tier: 6,
    label: 'Yara International',
    parentLabel: 'Orica Ltd.',
    country: 'Norway',
    hsnCode: '3102.10',
    commodity: 'Ammonium nitrate (ANFO precursor)',
    about: 'Fertiliser-grade AN; converted to mining explosive.',
  },
  {
    id: 't6-siemens',
    parentId: 't5-metso',
    tier: 6,
    label: 'Siemens Energy',
    parentLabel: 'Metso Outotec',
    country: 'Germany',
    hsnCode: '8504.40',
    commodity: 'Static converters / drive systems',
    about: 'Variable frequency drives for SAG mills & conveyors.',
  },
  {
    id: 't6-abb',
    parentId: 't5-flsmidth',
    tier: 6,
    label: 'ABB Ltd.',
    parentLabel: 'FLSmidth',
    country: 'Switzerland',
    hsnCode: '8501.64',
    commodity: 'High-voltage AC motors (mill drives)',
    about: 'Gearless mill drive motors for grinding operations.',
  },
  {
    id: 't6-hitachi-energy',
    parentId: 't5-atlas',
    tier: 6,
    label: 'Hitachi Energy',
    parentLabel: 'Atlas Copco',
    country: 'Switzerland',
    hsnCode: '8504.21',
    commodity: 'Power transformers (mine substation)',
    about: 'HV transformers powering mine electrical infrastructure.',
  },
];

const CYAN = '#00E8FF';

type LayoutSlot = { left: number; right: number };

/** Classic top-down tree: leaf order → horizontal slots, centered under parent. */
function layoutTreeX(
  rootId: string,
  children: Map<string, string[]>,
): Map<string, number> {
  const xCenter = new Map<string, number>();
  let leaf = 0;

  function dfs(id: string): LayoutSlot {
    const ch = children.get(id) ?? [];
    if (ch.length === 0) {
      const p = leaf;
      leaf += 1;
      xCenter.set(id, p);
      return { left: p, right: p };
    }
    const parts = ch.map(dfs);
    const L = Math.min(...parts.map((p) => p.left));
    const R = Math.max(...parts.map((p) => p.right));
    const cx = (L + R) / 2;
    xCenter.set(id, cx);
    return { left: L, right: R };
  }

  dfs(rootId);
  const values = [...xCenter.values()];
  const mid = (Math.min(...values) + Math.max(...values)) / 2;
  const shifted = new Map<string, number>();
  xCenter.forEach((v, k) => shifted.set(k, v - mid));
  return shifted;
}

export function buildSupplyChainGraph(): {
  nodes: Node<SupplyNodeData>[];
  edges: Edge[];
  rootId: string;
} {
  const rootId = 't0-tesla';
  const edges: Edge[] = [];
  const children = new Map<string, string[]>();

  for (const r of RAW) {
    if (r.parentId) {
      edges.push({
        id: `e-${r.parentId}-${r.id}`,
        source: r.parentId,
        target: r.id,
        type: 'straight',
        animated: false,
        style: { stroke: CYAN, strokeWidth: 1.9, opacity: 0.55 },
      });
      if (!children.has(r.parentId)) children.set(r.parentId, []);
      children.get(r.parentId)!.push(r.id);
    }
  }
  for (const arr of children.values()) arr.sort((a, b) => a.localeCompare(b));

  const xMap = layoutTreeX(rootId, children);
  /** Vertical / horizontal spacing — larger keeps sibling labels from colliding. */
  const TIER_GAP_Y = 340;
  const X_SCALE = 260;

  const nodes: Node<SupplyNodeData>[] = RAW.map((r) => {
    const { id, parentId, ...rest } = r;
    void parentId;
    const accent = tierAccent(r.tier);
    const { dx, dy } = organicOffset(id, r.tier);
    return {
      id,
      type: 'knowledge' as const,
      selected: r.tier === 0,
      position: {
        x: (xMap.get(id) ?? 0) * X_SCALE + dx,
        y: r.tier * TIER_GAP_Y + dy,
      },
      data: {
        ...rest,
        accentColor: accent,
      },
    };
  });

  return { nodes, edges, rootId };
}

export type BackendNode = {
  'Company Name': string;
  Country: string;
  Address?: string;
  Latitude?: number | string;
  Longitude?: number | string;
  'Product Category': string;
  'Company Description': string;
  Tier: number;
  /** Backend nested risk object */
  'Risk Assessment'?: Record<string, unknown>;
};

export type BackendEdge = {
  Company1: string;
  Company2: string;
  Product: string;
  'Product Description': string;
  'HSN Code of Products': string;
  'Possible Shipment Route': string;
};

export type BackendData = {
  top_products: string[];
  hsn_options?: string[];
  selected_anchor_hsn?: string;
  nodes: BackendNode[];
  edges: BackendEdge[];
};

/** One persisted graph from `company_graph_store.json` / GET /all_companies_data */
export type StoredGraphRecord = {
  company_key: string;
  company_input: string;
  selected_anchor_hsn?: string;
  max_tier: number;
  limit: number;
  updated_at: string;
  payload: BackendData;
};

export function transformBackendDataToGraph(data: BackendData): {
  nodes: Node<SupplyNodeData>[];
  edges: Edge[];
  rootId: string;
  hsnOptions: string[];
} {
  const { nodes: backendNodes, edges: backendEdges } = data;

  const rootNode = backendNodes.find((n) => n.Tier === 0);
  if (!rootNode) {
    throw new Error('Root node (Tier 0) not found in backend data');
  }
  const rootId = rootNode['Company Name'];

  // Map to store HSN codes for nodes (captured from edges where node is target)
  const nodeHsnMap = new Map<string, string>();
  // Map to store parents for context
  const parentMap = new Map<string, string>();

  const edges: Edge[] = backendEdges.map((be) => {
    const id = `e-${be.Company1}-${be.Company2}`;
    nodeHsnMap.set(be.Company2, be['HSN Code of Products']);
    parentMap.set(be.Company2, be.Company1);

    return {
      id,
      source: be.Company1,
      target: be.Company2,
      type: 'straight' as const,
      data: { hsnCode: be['HSN Code of Products'] },
      animated: false,
      style: { stroke: CYAN, strokeWidth: 1.15, opacity: 0.38 },
    };
  });

  const children = new Map<string, string[]>();
  for (const e of edges) {
    const s = String(e.source);
    const t = String(e.target);
    if (!children.has(s)) children.set(s, []);
    children.get(s)!.push(t);
  }
  for (const arr of children.values()) arr.sort((a, b) => a.localeCompare(b));

  const xMap = layoutTreeX(rootId, children);
  /** Extra gaps for long company names + straight edges meeting at parent handles. */
  const TIER_GAP_Y = 340;
  const X_SCALE = 260;

  const nodes: Node<SupplyNodeData>[] = backendNodes.map((bn) => {
    const id = bn['Company Name'];
    const accent = tierAccent(bn.Tier);
    const { dx, dy } = organicOffset(id, bn.Tier, 0.42);

    const latNum =
      typeof bn.Latitude === 'number' ? bn.Latitude : Number(bn.Latitude);
    const lngNum =
      typeof bn.Longitude === 'number' ? bn.Longitude : Number(bn.Longitude);
    const addr =
      typeof bn.Address === 'string' && bn.Address.trim() && bn.Address !== 'N/A'
        ? bn.Address.trim()
        : undefined;
    const riskAssessment = parseRiskAssessment(bn['Risk Assessment']);

    return {
      id,
      type: 'knowledge' as const,
      selected: bn.Tier === 0,
      position: {
        x: (xMap.get(id) ?? 0) * X_SCALE + dx,
        y: bn.Tier * TIER_GAP_Y + dy,
      },
      data: {
        label: bn['Company Name'],
        country: bn.Country || 'Unknown',
        address: addr,
        latitude: Number.isFinite(latNum) ? latNum : undefined,
        longitude: Number.isFinite(lngNum) ? lngNum : undefined,
        hsnCode: nodeHsnMap.get(id) || 'N/A',
        commodity: bn['Product Category'] || 'N/A',
        about: bn['Company Description'] || 'N/A',
        tier: bn.Tier,
        accentColor: accent,
        isRoot: bn.Tier === 0,
        parentLabel: parentMap.get(id),
        riskAssessment,
      },
    };
  });

  return { nodes, edges, rootId, hsnOptions: data.hsn_options ?? [] };
}
