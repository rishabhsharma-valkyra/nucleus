import { TriageCategory } from '@/types';

export function pwatColor(score: number): string {
  if (score >= 12) return 'var(--red)';
  if (score >= 8)  return 'var(--amber)';
  if (score >= 4)  return '#fde047';
  return 'var(--green)';
}

export function triageClass(t: string): string {
  const map: Record<string, string> = {
    Red: 't-red', Orange: 't-stab', Yellow: 't-yellow', Green: 't-fracture',
  };
  return map[t] ?? 't-blunt';
}

export function triageColor(t: string): string {
  const map: Record<string, string> = {
    Red: 'var(--red)', Orange: 'var(--amber)', Yellow: '#fde047', Green: 'var(--green)',
  };
  return map[t] ?? 'rgba(255,255,255,0.3)';
}

export function depthSeverityColor(s: string | null): string {
  if (!s) return 'var(--text2)';
  const map: Record<string, string> = {
    'Superficial':    'var(--green)',
    'Moderate':       '#fde047',
    'Deep':           'var(--amber)',
    'Severe':         'var(--red)',
    'Severe / Cavity':'var(--red)',
    'Cavity':         'var(--red)',
  };
  return map[s] ?? 'var(--text2)';
}

// BigQuery hands back timestamps as "2026-08-18 19:09:26.778561+00:00".
// That is NOT the Date Time String Format ECMA-262 guarantees — it uses a
// space instead of "T" and 6 fractional digits instead of 3 — so `new
// Date(...)` on it falls through to each engine's implementation-defined
// fallback parser. V8 happens to accept it; other engines are free not to,
// and a silent Invalid Date here doesn't just print wrong, it makes
// sessionStatus() report every case "Resolved" and stops the critical-case
// alerts from ever firing. Normalize to the spec shape once, here, and let
// every caller go through it.
export function parseTimestamp(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const normalized = String(raw)
    .replace(' ', 'T')
    .replace(/(\.\d{3})\d+/, '$1'); // trim sub-millisecond digits
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatTime(iso: string | null): string {
  const d = parseTimestamp(iso);
  if (!d) return '—';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(iso: string | null): string {
  const d = parseTimestamp(iso);
  if (!d) return '—';
  return d.toLocaleString([], {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function formatDateShort(iso: string | null): string {
  const d = parseTimestamp(iso);
  if (!d) return '—';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function bucketPwat(sessions: { pwat_score: number }[]) {
  const buckets = [
    { range: '0–4',   min: 0,  max: 4,  count: 0 },
    { range: '4–8',   min: 4,  max: 8,  count: 0 },
    { range: '8–12',  min: 8,  max: 12, count: 0 },
    { range: '12–16', min: 12, max: 16, count: 0 },
    { range: '16–20', min: 16, max: 20, count: 0 },
  ];
  sessions.forEach(s => {
    const b = buckets.find(b => s.pwat_score >= b.min && s.pwat_score < b.max);
    if (b) b.count++;
    else if (s.pwat_score >= 20) buckets[4].count++;
  });
  return buckets;
}

export function groupByDate(sessions: { created_at: string }[]) {
  const map: Record<string, number> = {};
  sessions.forEach(s => {
    const d = s.created_at?.slice(0, 10);
    if (d) map[d] = (map[d] || 0) + 1;
  });
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

export function groupByHour(sessions: { created_at: string }[]) {
  const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
  sessions.forEach(s => {
    // An unparseable timestamp used to yield hours[NaN], i.e. a TypeError
    // that takes the whole page down. Skip the row instead.
    const d = parseTimestamp(s.created_at);
    if (d) hours[d.getHours()].count++;
  });
  return hours;
}

export function generateIncidentId(): string {
  return `INC-${Date.now().toString().slice(-6)}`;
}

export function triageBadgeClass(t: TriageCategory | string): string {
  return `triage-badge triage-${t}`;
}
