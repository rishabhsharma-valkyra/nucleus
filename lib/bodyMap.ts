// Where each body region sits on the front-view figure in BodyMap.
//
// Anatomical convention: the figure FACES the viewer, so the patient's LEFT
// is drawn on the viewer's RIGHT (as on every clinical body chart). The map
// labels R / L at the figure's sides so this is never misread.
//
// Regions follow the fixed list the headset uses (body_regions.py). Older
// free-text regions ("Left forearm", "Forehead") are normalised the same way.

export type Side = 'Left' | 'Right' | null;

export interface MapPoint {
  x: number;
  y: number;
  // Back-of-body region drawn on the front figure (shown with a square marker)
  back?: boolean;
}

// Midline regions
const MIDLINE: Record<string, MapPoint> = {
  head: { x: 100, y: 24 },
  face: { x: 100, y: 42 },
  neck: { x: 100, y: 66 },
  chest: { x: 100, y: 104 },
  abdomen: { x: 100, y: 148 },
  'upper back': { x: 100, y: 112, back: true },
  'lower back': { x: 100, y: 160, back: true },
  'pelvis / groin': { x: 100, y: 190 },
};

// Paired regions: x for the PATIENT's right side (viewer's left); the
// patient's left mirrors around x = 100.
const PAIRED: Record<string, MapPoint> = {
  shoulder: { x: 66, y: 84 },
  'upper arm': { x: 54, y: 122 },
  elbow: { x: 47, y: 152 },
  forearm: { x: 41, y: 180 },
  wrist: { x: 36, y: 205 },
  hand: { x: 32, y: 224 },
  hip: { x: 82, y: 204 },
  thigh: { x: 82, y: 246 },
  knee: { x: 81, y: 290 },
  'lower leg': { x: 80, y: 334 },
  ankle: { x: 80, y: 374 },
  foot: { x: 79, y: 394 },
};

// Older free-text names → fixed-list part
const SYNONYMS: Record<string, string> = {
  forehead: 'head', scalp: 'head', skull: 'head', cheek: 'face', jaw: 'face', nose: 'face', eye: 'face', mouth: 'face',
  torso: 'chest', thorax: 'chest', breast: 'chest', belly: 'abdomen', stomach: 'abdomen',
  back: 'upper back', groin: 'pelvis / groin', pelvis: 'pelvis / groin', buttock: 'pelvis / groin',
  arm: 'upper arm', palm: 'hand', finger: 'hand', fingers: 'hand', thumb: 'hand',
  leg: 'lower leg', shin: 'lower leg', calf: 'lower leg', toe: 'foot', toes: 'foot', heel: 'foot',
};

export interface Placement {
  points: MapPoint[];      // 1 point; 2 when the side is unknown (either side)
  sideUnknown: boolean;
  back: boolean;
}

// Region text → where to draw it, or null if it can't be placed (Unspecified)
export function placeRegion(region: string | null | undefined): Placement | null {
  if (!region) return null;
  let text = region.toLowerCase().trim();
  const sideUnknown = /side unknown/.test(text);
  text = text.replace(/\(side unknown\)/, '').trim();

  let side: Side = null;
  const m = text.match(/^(left|right|l|r)\b\.?\s*/);
  if (m) {
    side = m[1].startsWith('l') ? 'Left' : 'Right';
    text = text.slice(m[0].length).trim();
  }
  const part = SYNONYMS[text] ?? text;

  if (MIDLINE[part]) {
    const p = MIDLINE[part];
    return { points: [p], sideUnknown: false, back: !!p.back };
  }
  const p = PAIRED[part];
  if (!p) return null;
  const right = p;                                  // patient's right = viewer's left
  const left = { ...p, x: 200 - p.x };              // patient's left = viewer's right
  if (side === 'Right') return { points: [right], sideUnknown: false, back: false };
  if (side === 'Left') return { points: [left], sideUnknown: false, back: false };
  return { points: [right, left], sideUnknown: true, back: false };
}
