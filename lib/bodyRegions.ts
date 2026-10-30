// The fixed body-region list the headset's AI chooses from (mirror of
// body_regions.py in the Unity/headset repo — keep the two in sync).
// Left/Right are the PATIENT's own sides.

const MIDLINE = ['Head', 'Face', 'Neck', 'Chest', 'Abdomen', 'Upper Back', 'Lower Back', 'Pelvis / Groin'];
const PAIRED = ['Shoulder', 'Upper Arm', 'Elbow', 'Forearm', 'Wrist', 'Hand', 'Hip', 'Thigh', 'Knee', 'Lower Leg', 'Ankle', 'Foot'];

export const BODY_REGIONS: string[] = [
  ...MIDLINE,
  ...PAIRED.flatMap((p) => [`Left ${p}`, `Right ${p}`]),
  ...PAIRED.map((p) => `${p} (side unknown)`),
  'Unspecified',
];

// Same list grouped for the clinician's picker (patient's own left/right)
export const REGION_GROUPS: { label: string; regions: string[] }[] = [
  { label: 'Head, neck & trunk', regions: MIDLINE },
  { label: "Patient's left", regions: PAIRED.map((p) => `Left ${p}`) },
  { label: "Patient's right", regions: PAIRED.map((p) => `Right ${p}`) },
  { label: 'Side not seen', regions: PAIRED.map((p) => `${p} (side unknown)`) },
  { label: 'Other', regions: ['Unspecified'] },
];

export const WOUND_TYPES = [
  'Laceration', 'Abrasion', 'Avulsion', 'Puncture', 'Incision', 'Contusion',
  'Burn', 'Gunshot wound', 'Crush injury', 'Open fracture', 'Bite', 'Other',
];

export const SEVERITIES = ['Minor', 'Moderate', 'Severe', 'Critical'] as const;
export const TRIAGES = ['Red', 'Orange', 'Yellow', 'Green'] as const;

// Pull a "N. SECTION : value" line out of the AI report text
export function reportField(text: string | null | undefined, section: string): string | null {
  if (!text) return null;
  const m = text.match(new RegExp(`${section}\\s*:\\s*([^\\n]+)`, 'i'));
  return m ? m[1].replace(/[*]/g, '').trim() || null : null;
}

// Best match of the AI's free-text wound type / severity onto the lists
export function matchOption(value: string | null, options: readonly string[]): string | null {
  if (!value) return null;
  const v = value.toLowerCase();
  return options.find((o) => v.includes(o.toLowerCase())) ?? null;
}
