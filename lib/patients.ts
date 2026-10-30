// Patient-centric view of the session feed.
//
// Patient → encounters → injuries → frames:
//  - Encounter: one End Scan on the headset = one session row, carrying the
//    face-login patient_id, GPS and time. A scan today and another later are
//    two encounters filed under the same patient (never merged).
//  - Injury: the responder scans every wound in one go, so an encounter holds
//    several wounds. Each frame carries its body region (fixed list, set per
//    frame by Gemini); frames with the same region are one injury.
//  - Frame: one auto-detection of a wound. Repeat detections of the same
//    wound group under it; the injury takes its WORST frame (triage up,
//    never down).
// Grouping happens here, over the sessions Nucleus already loads
// (useAllSessions), so there's no second copy of the data to keep in sync.

import { ClinicianReview, Session, TriageCategory, WoundFrame, WoundLocation } from '@/types';
import { parseTimestamp } from '@/lib/utils';

export interface Injury {
  // Unique across a patient: encounter + region
  key: string;
  // The encounter (End Scan) it was scanned in
  session: Session;
  // Region shown: the clinician's if reviewed, else the AI's fixed-list region
  // ("Left Forearm", "Forearm (side unknown)", "Unspecified"); free text on
  // older sessions; null when never recorded
  region: string | null;
  // The AI's region — the injury's stable key within its scan (selection,
  // matching reviews). Never changes when a clinician corrects the region.
  groupRegion: string | null;
  aiRegion: string | null;
  sideUnknown: boolean;
  // This wound's captures, in capture order, with their index in session.frames
  frames: WoundFrame[];
  frameIndexes: number[];
  worst: WoundFrame | null;
  // Triage shown: the clinician's if reviewed, else the worst frame's
  triage: TriageCategory;
  aiTriage: TriageCategory;
  pwat: number | null;
  // Latest clinician review of this injury, if any
  review: ClinicianReview | null;
}

export interface PatientRecord {
  patient_id: string;
  patient_name: string | null;
  // Encounters (End Scans), newest first
  incidents: Session[];
  // Injuries of the newest encounter, worst first — the patient's current state
  current_injuries: Injury[];
  first_seen: string;
  last_seen: string;
  worst_triage: TriageCategory;
  max_pwat: number | null;
  // From the newest encounter that has them
  latest_location: WoundLocation | null;
  latest_body_region: string | null;
}

export const TRIAGE_RANK: Record<string, number> = { Red: 4, Orange: 3, Yellow: 2, Green: 1, Unclassified: 0 };

// Several medium wounds can add up to a serious patient — flagged for the
// clinician, never used to raise triage automatically.
export const MULTIPLE_INJURIES = 3;

const time = (s: Session) => parseTimestamp(s.created_at)?.getTime() ?? 0;

export const regionLabel = (region: string | null | undefined) => region || 'Region not recorded';

// Injuries in a scan that no clinician has reviewed yet
export const needsReview = (injuries: Injury[]) => injuries.filter((i) => !i.review);

// Frames whose Gemini call failed carry no region; they still belong to the
// scan, shown under Unspecified rather than hidden.
const UNSPECIFIED = 'Unspecified';
// Frames recorded before their AI read arrived (it follows within seconds to
// minutes and is merged in on the next poll). Grouped together meanwhile.
export const ANALYSING = 'Analysing…';
export const isAnalysing = (region: string | null | undefined) => region === ANALYSING;

const worseFrame = (a: WoundFrame, b: WoundFrame) =>
  (TRIAGE_RANK[b.triage ?? ''] ?? 0) - (TRIAGE_RANK[a.triage ?? ''] ?? 0) || (Number(b.pwat_score) || 0) - (Number(a.pwat_score) || 0);

// Split one encounter into its injuries, worst first.
export function injuriesOf(session: Session): Injury[] {
  const frames: WoundFrame[] = session.frames ?? [];
  const pending = (f: WoundFrame) => f.analysis_status === 'pending' && !f.body_region;
  const perFrame = frames.some((f) => f.body_region || pending(f));

  // Older sessions (no per-frame region): the whole scan is one injury,
  // labelled with the session-level region.
  const groups = new Map<string | null, number[]>();
  if (!perFrame) {
    groups.set(session.body_region ?? null, frames.map((_, i) => i));
  } else {
    frames.forEach((f, i) => {
      const r = f.body_region || (pending(f) ? ANALYSING : UNSPECIFIED);
      groups.set(r, [...(groups.get(r) ?? []), i]);
    });
  }

  const injuries: Injury[] = [];
  groups.forEach((idx, region) => {
    const list = idx.map((i) => frames[i]);
    const worst = list.length ? [...list].sort(worseFrame)[0] : null;
    const aiTriage = ((worst?.triage as TriageCategory) || (perFrame ? 'Unclassified' : session.triage_category)) as TriageCategory;
    const review = (session.reviews ?? []).find((r) => (r.model_region ?? null) === (region ?? null)) ?? null;
    const shown = review?.body_region || region;
    injuries.push({
      key: `${session.session_id}::${region ?? ''}`,
      session,
      region: shown,
      groupRegion: region,
      aiRegion: region,
      sideUnknown: !!shown && /side unknown/i.test(shown),
      frames: list,
      frameIndexes: idx,
      worst,
      triage: (review?.triage as TriageCategory) || aiTriage,
      aiTriage,
      pwat: worst?.pwat_score != null ? Number(worst.pwat_score) : (perFrame ? null : session.pwat_score ?? null),
      review,
    });
  });

  return injuries.sort((a, b) =>
    (TRIAGE_RANK[b.triage] ?? 0) - (TRIAGE_RANK[a.triage] ?? 0) || (b.pwat ?? 0) - (a.pwat ?? 0));
}

// Label for every frame of an encounter by its own injury ("Left Forearm · 2"),
// keyed by the frame's index in session.frames
export function frameLabelsOf(session: Session): (frameIndex: number) => string {
  const labels = new Map<number, string>();
  injuriesOf(session).forEach((inj) => inj.frameIndexes.forEach((fi, n) => labels.set(fi, frameLabel(inj.region, n))));
  return (fi) => labels.get(fi) ?? frameLabel(session.body_region, fi);
}

// Region of one frame (its own, else the encounter's on older scans)
export const frameRegion = (session: Session, frameIndex: number) =>
  session.frames?.[frameIndex]?.body_region ?? session.body_region ?? null;

// Regions in one encounter, worst first ("Left Forearm, Face")
export function regionsText(session: Session): string | null {
  const regions = injuriesOf(session).map((i) => i.region).filter(Boolean);
  return regions.length ? regions.join(', ') : null;
}

export interface RegionTrendPoint { at: string; pwat: number | null; triage: TriageCategory; sessionId: string }

// Same body region across encounters, oldest first — reassessment shows
// whether a wound is getting worse. Only regions seen in 2+ encounters.
export function regionTrends(encounters: Session[]): Map<string, RegionTrendPoint[]> {
  const byRegion = new Map<string, RegionTrendPoint[]>();
  [...encounters].sort((a, b) => time(a) - time(b)).forEach((s) => {
    injuriesOf(s).forEach((inj) => {
      if (!inj.region || inj.region === UNSPECIFIED || inj.region === ANALYSING) return;
      const pts = byRegion.get(inj.region) ?? [];
      pts.push({ at: s.created_at, pwat: inj.pwat, triage: inj.triage, sessionId: s.session_id });
      byRegion.set(inj.region, pts);
    });
  });
  byRegion.forEach((pts, r) => { if (pts.length < 2) byRegion.delete(r); });
  return byRegion;
}

// Route id for the bucket of scans that carry no patient (recorded before
// face login was linked). Not a valid face-login id.
export const UNIDENTIFIED_ID = '__unidentified__';

export const patientHref = (patientId: string) => `/incidents/${encodeURIComponent(patientId)}`;

// Frames are repeated captures of one wound — label them by its body region.
export function frameLabel(bodyRegion: string | null | undefined, index: number): string {
  return `${bodyRegion || 'Frame'} · ${index + 1}`;
}

export function hasGps(loc: WoundLocation | null | undefined): loc is WoundLocation {
  return !!loc && loc.latitude != null && loc.longitude != null;
}

export function mapsUrl(loc: WoundLocation): string {
  return `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`;
}

export function gpsText(loc: WoundLocation): string {
  return `${Number(loc.latitude).toFixed(5)}, ${Number(loc.longitude).toFixed(5)}`;
}

export function groupSessionsByPatient(sessions: Session[]): {
  patients: PatientRecord[];
  unidentifiedCount: number;
} {
  const byPatient = new Map<string, Session[]>();
  let unidentifiedCount = 0;

  for (const s of sessions) {
    if (!s.patient_id) { unidentifiedCount++; continue; }
    const list = byPatient.get(s.patient_id) ?? [];
    list.push(s);
    byPatient.set(s.patient_id, list);
  }

  const patients: PatientRecord[] = [];
  byPatient.forEach((list, patient_id) => {
    const incidents = [...list].sort((a, b) => time(b) - time(a));
    const scores = incidents.map((s) => Number(s.pwat_score)).filter((n) => !isNaN(n));
    patients.push({
      patient_id,
      patient_name: incidents.find((s) => s.patient_name)?.patient_name ?? null,
      incidents,
      current_injuries: injuriesOf(incidents[0]),
      first_seen: incidents[incidents.length - 1].created_at,
      last_seen: incidents[0].created_at,
      // Worst injury across scans (clinician triage where reviewed)
      worst_triage: incidents.flatMap(injuriesOf).reduce<TriageCategory>(
        (w, i) => ((TRIAGE_RANK[i.triage] ?? 0) > (TRIAGE_RANK[w] ?? 0) ? i.triage : w),
        'Unclassified'
      ),
      max_pwat: scores.length ? Math.max(...scores) : null,
      latest_location: incidents.find((s) => hasGps(s.location))?.location ?? null,
      latest_body_region: incidents.map(regionsText).find(Boolean) ?? null,
    });
  });

  // Most recently seen patient first
  patients.sort((a, b) => (parseTimestamp(b.last_seen)?.getTime() ?? 0) - (parseTimestamp(a.last_seen)?.getTime() ?? 0));
  return { patients, unidentifiedCount };
}
