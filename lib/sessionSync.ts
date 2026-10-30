// Incremental session sync for the dashboard.
//
// A full load pulls every scan once (and again every FULL_RELOAD_MS, which
// also picks up deletions). In between, each poll asks only for scans that
// were delivered or got a new AI read since the server's last `as_of` — a
// tiny query on the partitioned table instead of re-reading everything.
// Scans are replaced by session_id, so a re-delivered or newly-analysed scan
// simply updates in place.

import { Session } from '@/types';
import { parseTimestamp } from '@/lib/utils';

export interface SessionsSnapshot {
  total_returned: number;
  sessions: Session[];
  // Server time to send as `since` next; absent when the API doesn't support it
  asOf?: string;
  fullLoadedAt: number;
}

export const FULL_RELOAD_MS = 10 * 60_000;
// While a scan still has frames "Analysing…", poll faster so the AI read
// shows up within seconds of arriving.
export const POLL_MS = 60_000;
export const POLL_PENDING_MS = 15_000;

const time = (s: Session) => parseTimestamp(s.created_at)?.getTime() ?? 0;

// Changed scans replace their earlier copy; result is newest first.
export function mergeSessions(prev: Session[], changed: Session[]): Session[] {
  if (!changed.length) return prev;
  const byId = new Map(prev.map((s) => [s.session_id, s]));
  changed.forEach((s) => byId.set(s.session_id, s));
  return Array.from(byId.values()).sort((a, b) => time(b) - time(a));
}

export function hasPendingAnalysis(sessions: Session[] | undefined): boolean {
  return !!sessions?.some((s) => (s.analysis_pending ?? 0) > 0);
}

export function shouldReloadFully(prev: SessionsSnapshot | undefined, now = Date.now()): boolean {
  return !prev || !prev.asOf || now - prev.fullLoadedAt >= FULL_RELOAD_MS;
}
