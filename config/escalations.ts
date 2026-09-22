import { IncidentType } from '@/types';
import { RESPONDERS } from './fleet';

// Static demo dataset — the Express backend has no concept of "would a doctor
// have been called in" for a review; this is a counterfactual clinical judgment,
// not something ingested live. Aggregate figures are tuned to roughly reconcile
// with the "Doctor Calls (Static): 18 this month" / "Escalation Rate: 12.3%"
// figures already shown on the Model Performance page.
export interface EscalationRecord {
  id: string;
  responder_id: string;
  injury_type: IncidentType;
  date: string; // ISO date (YYYY-MM-DD)
  escalated: boolean;
}

export const INJURY_TYPES: IncidentType[] = ['GSW', 'STAB', 'BLUNT', 'BURN', 'FRACTURE', 'CRUSH'];

const ESCALATION_LIKELIHOOD: Record<IncidentType, number> = {
  GSW: 0.22, CRUSH: 0.20, BURN: 0.15, STAB: 0.12, BLUNT: 0.08, FRACTURE: 0.05,
};

// FNV-1a hash — the simple polynomial rolling hash this replaced had poor
// avalanche behavior on short, near-identical seeds (e.g. "torres-GSW-0-0" vs
// "torres-GSW-0-1"), which skewed per-type escalation rates far from their
// intended likelihood. FNV-1a spreads these evenly.
function seededFraction(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  hash >>>= 0;
  return (hash % 10000) / 10000;
}

function firstOfMonthMinus(n: number): Date {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  return d;
}

export const ESCALATIONS: EscalationRecord[] = (() => {
  const records: EscalationRecord[] = [];
  const today = new Date();

  for (let m = 0; m < 6; m++) {
    const monthDate = firstOfMonthMinus(m);
    const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
    const maxDay = m === 0 ? Math.max(today.getDate(), 1) : daysInMonth;

    RESPONDERS.forEach((r) => {
      INJURY_TYPES.forEach((type) => {
        const countSeed = seededFraction(`${r.id}-${type}-count-${m}`);
        const reviewCount = 2 + Math.floor(countSeed * 4); // 2-5 reviews per responder/type/month

        for (let i = 0; i < reviewCount; i++) {
          const seed = `${r.id}-${type}-${m}-${i}`;
          const day = 1 + Math.floor(seededFraction(seed + 'day') * maxDay);
          const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day).toISOString().slice(0, 10);
          const escalated = seededFraction(seed + 'esc') < ESCALATION_LIKELIHOOD[type];
          records.push({ id: `ESC-${r.id}-${type}-${m}-${i}`, responder_id: r.id, injury_type: type, date, escalated });
        }
      });
    });
  }

  return records;
})();
