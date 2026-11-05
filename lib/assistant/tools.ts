// Server-only. The assistant's tools: read-only lookups through the Hospital
// API, made AS the signed-in user (the actor passed in), so they return only
// what that user may see — the API applies the same organization scoping and
// audit trail as on every page. The tools never widen access: there is no
// lookup here that a page can't make for the same user. The model decides which to
// call; outputs are compact JSON it can reason over, and the chat panel also
// renders them (scan cards, navigation buttons) — see components/assistant.
import { tool } from 'ai';
import { z } from 'zod';
import { forwardToBackend, Actor } from '@/lib/backend';
import { Session, TriageCategory } from '@/types';
import {
  injuriesOf, groupSessionsByPatient, regionTrends, hasGps, patientHref, isAnalysing, TRIAGE_RANK,
} from '@/lib/patients';
import { parseTimestamp } from '@/lib/utils';
import { NAV_PAGES, NavPage, ScanCard } from '@/lib/assistant/types';

const TRIAGES = ['Red', 'Orange', 'Yellow', 'Green'] as const;
// The Hospital API returns up to 500 scans per call (its maximum); fine for
// the pilot. At larger volumes these filters should move into the API.
const SCAN_LIMIT = 500;
const LIVE_WINDOW_S = 120;

// Pre-computed here rather than left to the model: an LLM has no reliable
// "now", so asking it to subtract dates produces confident wrong answers.
export function humanAge(raw: string | null | undefined): string {
  const t = parseTimestamp(raw)?.getTime();
  if (t == null) return 'unknown';
  const mins = Math.floor((Date.now() - t) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days < 31) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
}

// One numbered section of an AI wound report ("5. IMMEDIATE_STEPS : ...")
function reportSection(text: string | null | undefined, name: string, max = 500): string | null {
  if (!text) return null;
  const m = text.match(new RegExp(`${name}\\s*:([\\s\\S]*?)(?=\\n\\s*\\d+\\.\\s*[A-Z_]{4,}\\s*:|$)`, 'i'));
  const v = m?.[1].replace(/\*/g, '').trim();
  return v ? v.slice(0, max) : null;
}

const round1 = (n: number | null | undefined) => (n == null || Number.isNaN(Number(n)) ? null : Math.round(Number(n) * 10) / 10);

function scanTriage(s: Session): TriageCategory {
  return injuriesOf(s).reduce<TriageCategory>(
    (w, i) => ((TRIAGE_RANK[i.triage] ?? 0) > (TRIAGE_RANK[w] ?? 0) ? i.triage : w),
    (s.triage_category as TriageCategory) || 'Unclassified',
  );
}

export function scanCard(s: Session): ScanCard {
  const injuries = injuriesOf(s);
  return {
    session_id: s.session_id,
    patient: s.patient_name || s.patient_id || 'Unidentified',
    patient_id: s.patient_id,
    recorded_at: s.created_at,
    age: humanAge(s.created_at),
    triage: scanTriage(s),
    max_pwat: round1(Math.max(...injuries.map((i) => i.pwat ?? 0), Number(s.pwat_score) || 0)),
    regions: injuries.map((i) => i.region).filter((r): r is string => !!r && !isAnalysing(r)),
    injuries: injuries.length,
    awaiting_review: injuries.filter((i) => !i.review).length,
    ai_pending: s.analysis_pending ?? 0,
    location: hasGps(s.location) ? { lat: Number(s.location.latitude), lng: Number(s.location.longitude) } : null,
    responder: s.responder?.name || s.responder?.email || null,
  };
}

function scanDetail(s: Session) {
  return {
    ...scanCard(s),
    device: s.device_id ? { id: s.device_id, verified: !!s.device_verified } : null,
    closed_by: s.closed_by ?? null,
    location_captured_at: s.location?.captured_at ?? null,
    injuries: injuriesOf(s).map((i) => {
      const report = i.worst?.gemini_text;
      return {
        region: i.region,
        side_unknown: i.sideUnknown,
        triage: i.triage,
        ai_triage: i.aiTriage,
        pwat: round1(i.pwat),
        captures: i.frames.length,
        wound_type: i.review?.wound_type || reportSection(report, 'WOUND_TYPE', 160),
        severity: i.review?.severity || reportSection(report, 'SEVERITY_LEVEL', 40),
        observations: reportSection(report, 'OBSERVATIONS', 600),
        immediate_steps: reportSection(report, 'IMMEDIATE_STEPS', 600),
        still_analysing: isAnalysing(i.region),
        clinician_review: i.review
          ? { verdict: i.review.verdict, by: i.review.reviewer_name || i.review.reviewer_email,
              at: i.review.reviewed_at, notes: i.review.notes }
          : null,
      };
    }),
  };
}

const matches = (hay: string | null | undefined, needle: string) => !!hay && hay.toLowerCase().includes(needle.toLowerCase());

// The API refused this user (no organization membership, or out of scope)
class NoAccess extends Error {}
const NO_ACCESS = { error: "This account doesn't have access to that data." };

// Run a tool body; a refusal becomes an answer the model can explain, not
// a generic failure
const guarded = <A, R>(fn: (args: A) => Promise<R>) => async (args: A) => {
  try {
    return await fn(args);
  } catch (e) {
    if (e instanceof NoAccess) return NO_ACCESS;
    throw e;
  }
};

export function createAssistantTools(actor: Actor) {
  const who: Actor = { ...actor, via: 'assistant' };
  const api = async (path: string) => {
    const r = await forwardToBackend(path, {}, who);
    if (r.status === 401 || r.status === 403) throw new NoAccess();
    return r;
  };

  // One load of the scan feed per chat turn, shared by every tool call in it
  let feed: Promise<Session[]> | null = null;
  const loadScans = () => {
    feed ??= api(`/patients?limit=${SCAN_LIMIT}&offset=0`).then(({ status, data }) => {
      if (status !== 200) throw new Error(`Hospital API answered ${status}`);
      return ((data as any)?.sessions ?? []) as Session[];
    });
    return feed;
  };
  const newestFirst = (list: Session[]) =>
    [...list].sort((a, b) => (parseTimestamp(b.created_at)?.getTime() ?? 0) - (parseTimestamp(a.created_at)?.getTime() ?? 0));

  return {
    get_overview: tool({
      description:
        'Live command-center snapshot: scan and patient counts, scans in the last 24 h, triage breakdown, PWAT statistics, ' +
        'injuries awaiting clinician review, AI reads still pending, and how many headsets are live. Use for any "how are we doing", ' +
        '"summary", "status" or count question.',
      inputSchema: z.object({}),
      execute: guarded(async () => {
        const [scans, summary, live] = await Promise.all([
          loadScans(),
          api('/patients/summary').then((r) => (r.status === 200 ? (r.data as any) : null)),
          api('/live-locations').then((r) => (r.status === 200 ? ((r.data as any)?.headsets ?? []) : [])),
        ]);
        const dayAgo = Date.now() - 24 * 3600_000;
        const byTriage: Record<string, number> = { Red: 0, Orange: 0, Yellow: 0, Green: 0, Unclassified: 0 };
        let awaitingReview = 0;
        let aiPending = 0;
        scans.forEach((s) => {
          byTriage[scanTriage(s)] = (byTriage[scanTriage(s)] ?? 0) + 1;
          awaitingReview += injuriesOf(s).filter((i) => !i.review).length;
          aiPending += s.analysis_pending ?? 0;
        });
        const { patients, unidentifiedCount } = groupSessionsByPatient(scans);
        const newest = newestFirst(scans)[0];
        const nowS = Date.now() / 1000;
        return {
          total_scans: scans.length,
          patients: patients.length,
          scans_without_patient: unidentifiedCount,
          scans_last_24h: scans.filter((s) => (parseTimestamp(s.created_at)?.getTime() ?? 0) >= dayAgo).length,
          scans_by_triage: byTriage,
          pwat: summary?.pwat_stats
            ? { average: round1(summary.pwat_stats.average), min: round1(summary.pwat_stats.minimum), max: round1(summary.pwat_stats.maximum) }
            : null,
          injuries_awaiting_review: awaitingReview,
          ai_reads_pending: aiPending,
          latest_scan: newest ? { session_id: newest.session_id, patient: newest.patient_name || newest.patient_id || 'Unidentified', age: humanAge(newest.created_at) } : null,
          headsets_live: live.filter((h: any) => h.last_updated_unix && nowS - h.last_updated_unix < LIVE_WINDOW_S).length,
          headsets_reporting: live.length,
        };
      }),
    }),

    list_scans: tool({
      description:
        'Find scans (one scan = one End Scan of one patient, possibly several injuries). Filter by triage, time window, patient ' +
        'name/ID, body region or review status; sort newest first or most severe first. Returns compact scan cards that the user ' +
        'also sees as clickable cards.',
      inputSchema: z.object({
        triage: z.array(z.enum(TRIAGES)).optional().describe('Only scans whose worst injury has one of these triage levels'),
        since_hours: z.number().min(1).max(24 * 365).optional().describe('Only scans recorded in the last N hours'),
        patient: z.string().max(120).optional().describe('Part of a patient name or ID'),
        body_region: z.string().max(60).optional().describe('Part of a body region, e.g. "forearm" or "Left Knee"'),
        awaiting_review: z.boolean().optional().describe('true = only scans with injuries no clinician has reviewed yet'),
        sort: z.enum(['newest', 'most_severe']).optional(),
        limit: z.number().int().min(1).max(20).optional(),
      }),
      execute: guarded(async ({ triage, since_hours, patient, body_region, awaiting_review, sort, limit }) => {
        let list = await loadScans();
        if (since_hours) {
          const from = Date.now() - since_hours * 3600_000;
          list = list.filter((s) => (parseTimestamp(s.created_at)?.getTime() ?? 0) >= from);
        }
        let cards = list.map(scanCard);
        if (triage?.length) cards = cards.filter((c) => (triage as readonly string[]).includes(c.triage));
        if (patient) cards = cards.filter((c) => matches(c.patient, patient) || matches(c.patient_id, patient));
        if (body_region) cards = cards.filter((c) => c.regions.some((r) => matches(r, body_region)));
        if (awaiting_review != null) cards = cards.filter((c) => (c.awaiting_review > 0) === awaiting_review);
        cards.sort(sort === 'most_severe'
          ? (a, b) => (TRIAGE_RANK[b.triage] ?? 0) - (TRIAGE_RANK[a.triage] ?? 0) || (b.max_pwat ?? 0) - (a.max_pwat ?? 0)
          : (a, b) => (parseTimestamp(b.recorded_at)?.getTime() ?? 0) - (parseTimestamp(a.recorded_at)?.getTime() ?? 0));
        return { total_matching: cards.length, scans: cards.slice(0, limit ?? 8) };
      }),
    }),

    get_scan: tool({
      description:
        'Full detail of one scan by its session ID: patient, time, GPS, responder, device, and every injury with region, triage, ' +
        'PWAT, AI wound type, severity, observations, immediate first-aid steps and any clinician review.',
      inputSchema: z.object({ session_id: z.string().min(8).max(80) }),
      execute: guarded(async ({ session_id }) => {
        const id = session_id.trim();
        const { status, data } = await api(`/patient/${encodeURIComponent(id)}`);
        if (status === 404) return { error: `No scan with session ID ${id}` };
        if (status !== 200) throw new Error(`Hospital API answered ${status}`);
        return { scan: scanDetail(data as Session) };
      }),
    }),

    get_patient: tool({
      description:
        'One patient across all their scans, by name or patient ID: encounters, current injuries, worst triage, last location, ' +
        'and how each body region changed between scans (getting better or worse). If several patients match, returns the ' +
        'candidates to ask the user which one.',
      inputSchema: z.object({ patient: z.string().min(1).max(120).describe('Patient name or ID (partial is fine)') }),
      execute: guarded(async ({ patient }) => {
        const { patients } = groupSessionsByPatient(await loadScans());
        const q = patient.trim().toLowerCase();
        const exact = patients.filter((p) => p.patient_id.toLowerCase() === q || (p.patient_name ?? '').toLowerCase() === q);
        const found = exact.length ? exact : patients.filter((p) => matches(p.patient_id, q) || matches(p.patient_name, q));
        if (!found.length) return { error: `No patient matching "${patient}"` };
        if (found.length > 1) {
          return { candidates: found.slice(0, 10).map((p) => ({ patient_id: p.patient_id, name: p.patient_name, last_seen: humanAge(p.last_seen) })) };
        }
        const p = found[0];
        const trends: Record<string, { age: string; pwat: number | null; triage: string }[]> = {};
        regionTrends(p.incidents).forEach((pts, region) => {
          trends[region] = pts.map((t) => ({ age: humanAge(t.at), pwat: round1(t.pwat), triage: t.triage }));
        });
        return {
          patient: {
            patient_id: p.patient_id,
            name: p.patient_name,
            encounters: p.incidents.length,
            first_seen: humanAge(p.first_seen),
            last_seen: humanAge(p.last_seen),
            worst_triage: p.worst_triage,
            max_pwat: round1(p.max_pwat),
            latest_location: p.latest_location && hasGps(p.latest_location)
              ? { lat: Number(p.latest_location.latitude), lng: Number(p.latest_location.longitude) } : null,
            current_injuries: p.current_injuries.map((i) => ({ region: i.region, triage: i.triage, pwat: round1(i.pwat), reviewed: !!i.review })),
            region_trends_oldest_first: trends,
            profile_href: patientHref(p.patient_id),
          },
          scans: p.incidents.slice(0, 10).map(scanCard),
        };
      }),
    }),

    get_live_headsets: tool({
      description: 'AR headsets reporting GPS: which are live now (updated in the last 2 minutes), where, and which patient they are on.',
      inputSchema: z.object({}),
      execute: guarded(async () => {
        const { status, data } = await api('/live-locations');
        if (status !== 200) throw new Error(`Hospital API answered ${status}`);
        const nowS = Date.now() / 1000;
        return {
          headsets: ((data as any)?.headsets ?? []).map((h: any) => ({
            device_id: h.device_id,
            patient_id: h.patient_id ?? null,
            lat: h.latitude, lng: h.longitude,
            live: !!h.last_updated_unix && nowS - h.last_updated_unix < LIVE_WINDOW_S,
            last_update: h.last_updated_unix ? humanAge(new Date(h.last_updated_unix * 1000).toISOString()) : 'unknown',
          })),
        };
      }),
    }),

    show_in_app: tool({
      description:
        'Offer the user a button that opens a page or record in Nucleus. Use when they ask to "show", "open" or "take me to" ' +
        'something, or when a page answers their question better than text (e.g. the heatmap for "where are the cases").',
      inputSchema: z.object({
        target: z.enum([...(Object.keys(NAV_PAGES) as [NavPage, ...NavPage[]]), 'patient', 'scan']),
        patient_id: z.string().max(200).optional().describe('Required when target is "patient"'),
        session_id: z.string().max(80).optional().describe('Required when target is "scan"'),
      }),
      execute: async ({ target, patient_id, session_id }) => {
        if (target === 'scan') {
          return session_id ? { action: 'open_scan' as const, session_id, label: 'Open scan' } : { error: 'session_id is required' };
        }
        if (target === 'patient') {
          return patient_id ? { action: 'navigate' as const, href: patientHref(patient_id), label: `Open ${patient_id}` } : { error: 'patient_id is required' };
        }
        const page = NAV_PAGES[target as NavPage];
        return { action: 'navigate' as const, href: page.href, label: `Open ${page.label}` };
      },
    }),
  };
}

export type AssistantTools = ReturnType<typeof createAssistantTools>;
