// Patient-centric view of the session feed.
//
// Every wound scan from the headset is one session row carrying the
// face-login patient_id. A patient's "incidents" are simply their sessions:
// a scan today and another ten days later are two incidents filed under the
// same patient. Grouping happens here, over the sessions Nucleus already
// loads (useAllSessions), so there's no second copy of the data to keep in
// sync.

import { Session, TriageCategory, WoundLocation } from '@/types';
import { parseTimestamp } from '@/lib/utils';

export interface PatientRecord {
  patient_id: string;
  patient_name: string | null;
  // Newest first
  incidents: Session[];
  first_seen: string;
  last_seen: string;
  worst_triage: TriageCategory;
  max_pwat: number | null;
  // From the newest incident that has them
  latest_location: WoundLocation | null;
  latest_body_region: string | null;
}

const TRIAGE_RANK: Record<string, number> = { Red: 4, Orange: 3, Yellow: 2, Green: 1, Unclassified: 0 };

const time = (s: Session) => parseTimestamp(s.created_at)?.getTime() ?? 0;

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
      first_seen: incidents[incidents.length - 1].created_at,
      last_seen: incidents[0].created_at,
      worst_triage: incidents.reduce<TriageCategory>(
        (w, s) => ((TRIAGE_RANK[s.triage_category] ?? 0) > (TRIAGE_RANK[w] ?? 0) ? s.triage_category : w),
        'Unclassified'
      ),
      max_pwat: scores.length ? Math.max(...scores) : null,
      latest_location: incidents.find((s) => hasGps(s.location))?.location ?? null,
      latest_body_region: incidents.find((s) => s.body_region)?.body_region ?? null,
    });
  });

  // Most recently seen patient first
  patients.sort((a, b) => (parseTimestamp(b.last_seen)?.getTime() ?? 0) - (parseTimestamp(a.last_seen)?.getTime() ?? 0));
  return { patients, unidentifiedCount };
}
