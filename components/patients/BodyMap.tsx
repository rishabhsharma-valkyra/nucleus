'use client';

// Front-view body chart of a patient's injuries — the first thing a
// responder or receiving clinician needs: where the wounds are and how bad.
// Patient's left is on the viewer's right (clinical convention, labelled).
// Side-unknown injuries show as dashed rings on BOTH sides — never a guess.

import { Injury, regionLabel } from '@/lib/patients';
import { placeRegion } from '@/lib/bodyMap';

const TRIAGE_FILL: Record<string, string> = {
  Red: '#f87171', Orange: '#fbbf24', Yellow: '#facc15', Green: '#4ade80', Unclassified: '#94a3b8',
};

export default function BodyMap({ injuries, onOpen, height = 300 }: {
  injuries: Injury[];
  onOpen?: (injury: Injury) => void;
  height?: number;
}) {
  const placed = injuries.map((inj) => ({ inj, place: placeRegion(inj.region) }));
  const unplaced = placed.filter((p) => !p.place).map((p) => p.inj);
  const body = 'rgba(148,163,184,0.10)';
  const edge = 'rgba(148,163,184,0.28)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg viewBox="0 0 200 410" style={{ height, width: 'auto' }} role="img" aria-label="Body map of injuries">
        {/* Figure */}
        <g fill={body} stroke={edge} strokeWidth={1.2}>
          <circle cx={100} cy={33} r={21} />
          <rect x={92} y={52} width={16} height={18} rx={4} />
          <path d="M66 74 Q100 64 134 74 L140 120 Q137 160 132 198 L68 198 Q63 160 60 120 Z" />
        </g>
        <g stroke={body} strokeLinecap="round" fill="none">
          <polyline points="64,82 50,128 44,160 34,222" strokeWidth={15} />
          <polyline points="136,82 150,128 156,160 166,222" strokeWidth={15} />
          <polyline points="84,196 82,250 81,300 80,392" strokeWidth={22} />
          <polyline points="116,196 118,250 119,300 120,392" strokeWidth={22} />
        </g>
        <g stroke={edge} strokeLinecap="round" fill="none" strokeWidth={1} opacity={0.6}>
          <polyline points="64,82 50,128 44,160 34,222" />
          <polyline points="136,82 150,128 156,160 166,222" />
          <polyline points="84,196 82,250 81,300 80,392" />
          <polyline points="116,196 118,250 119,300 120,392" />
        </g>

        {/* Side labels: the figure faces you */}
        <text x={4} y={24} fill="#cbd5e1" fontSize={16} fontWeight={700} fontFamily="monospace">R</text>
        <text x={184} y={24} fill="#cbd5e1" fontSize={16} fontWeight={700} fontFamily="monospace">L</text>
        <title>Front view — the patient&apos;s right (R) is on your left</title>

        {/* Injuries — worst drawn last so it sits on top */}
        {[...placed].reverse().map(({ inj, place }) =>
          place?.points.map((pt, i) => {
            const color = TRIAGE_FILL[inj.triage] ?? TRIAGE_FILL.Unclassified;
            const title = `${regionLabel(inj.region)} · ${inj.triage}${inj.pwat != null ? ` · PWAT ${inj.pwat.toFixed(1)}` : ''}${place.sideUnknown ? ' · side not confirmed' : ''}${place.back ? ' · back of body' : ''}`;
            const common = { style: { cursor: onOpen ? 'pointer' : 'default' }, onClick: () => onOpen?.(inj) };
            return (
              <g key={`${inj.key}-${i}`} {...common}>
                <title>{title}</title>
                <circle cx={pt.x} cy={pt.y} r={13} fill={color} opacity={0.18} />
                {place.sideUnknown ? (
                  <circle cx={pt.x} cy={pt.y} r={6.5} fill="none" stroke={color} strokeWidth={2} strokeDasharray="3 2" />
                ) : place.back ? (
                  <rect x={pt.x - 6} y={pt.y - 6} width={12} height={12} rx={2} fill={color} stroke="#020617" strokeWidth={1.5} />
                ) : (
                  <circle cx={pt.x} cy={pt.y} r={6.5} fill={color} stroke="#020617" strokeWidth={1.5} />
                )}
              </g>
            );
          })
        )}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6, fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
        <span>● wound</span>
        <span title="Side could not be seen in the scan — shown on both sides">◌ side unknown</span>
        <span>■ back</span>
      </div>
      {unplaced.length > 0 && (
        <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', marginTop: 4, textAlign: 'center' }}>
          +{unplaced.length} not placed ({unplaced.map((u) => regionLabel(u.region)).join(', ')})
        </div>
      )}
    </div>
  );
}
