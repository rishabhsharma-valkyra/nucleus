// Illustrative, deterministic risk model driven by the real PWAT score of a
// session (0-4 Minor · 4-8 Delayed · 8-12 Urgent · 12-20 Critical). Not a
// live clinical model — see the disclosure banner on the Mortality page.
// Previously this was keyed off a fabricated "incident type" baseline table;
// now it's derived from an actual measured value per session.

function hashToUnit(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return (hash % 1000) / 1000;
}

export function predictedRiskFromPwat(pwatScore: number, seedId: string): number {
  const safePwat = Number(pwatScore) || 0; // guards against null/undefined on older rows
  const base = safePwat * 4.5; // PWAT 20 (max) -> 90% baseline risk
  const variance = 0.85 + hashToUnit(`${seedId}-risk`) * 0.3; // 0.85x - 1.15x
  return Math.min(95, Math.max(1, Math.round(base * variance * 10) / 10));
}

export function predictedOutcomeDeceased(pwatScore: number, seedId: string): boolean {
  const safePwat = Number(pwatScore) || 0;
  const base = safePwat * 4.5;
  return hashToUnit(`${seedId}-outcome`) * 100 < base * 0.4;
}
