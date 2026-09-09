// Nucleus doesn't have a dedicated incidents feed yet — Wound_Server.py
// pushes wound-assessment *sessions*, not military-style dispatch records.
// Until there's a real incidents pipeline, we treat each recent session as
// the "incident" for Live Incidents / Mortality: honest about what's real
// (triage, PWAT, depth, timing) rather than inventing fake responder/device/
// location fields that don't exist anywhere in the data.

import { parseTimestamp } from '@/lib/utils';

export const ACTIVE_WINDOW_MINUTES = 24 * 60; // 24h — a session more recent than this counts as "active"

export function sessionStatus(createdAt: string): 'Active' | 'Resolved' {
  // Goes through parseTimestamp because the backend's timestamp format is
  // not spec-parseable — see lib/utils.ts. An unparseable date lands on
  // "Resolved" (the safe, non-alerting default) rather than NaN.
  const d = parseTimestamp(createdAt);
  if (!d) return 'Resolved';
  const ageMinutes = (Date.now() - d.getTime()) / 60000;
  return ageMinutes >= 0 && ageMinutes <= ACTIVE_WINDOW_MINUTES ? 'Active' : 'Resolved';
}
