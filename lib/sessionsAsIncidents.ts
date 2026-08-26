// Nucleus doesn't have a dedicated incidents feed yet — Wound_Server.py
// pushes wound-assessment *sessions*, not military-style dispatch records.
// Until there's a real incidents pipeline, we treat each recent session as
// the "incident" for Live Incidents / Mortality: honest about what's real
// (triage, PWAT, depth, timing) rather than inventing fake responder/device/
// location fields that don't exist anywhere in the data.

export const ACTIVE_WINDOW_MINUTES = 24 * 60; // 24h — a session more recent than this counts as "active"

export function sessionStatus(createdAt: string): 'Active' | 'Resolved' {
  const ageMinutes = (Date.now() - new Date(createdAt).getTime()) / 60000;
  return ageMinutes >= 0 && ageMinutes <= ACTIVE_WINDOW_MINUTES ? 'Active' : 'Resolved';
}
