'use client';

import { useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { jsPDF } from 'jspdf';
import { Session, TriageCategory } from '@/types';
import { formatDate, parseTimestamp } from '@/lib/utils';
import { PatientRecord, hasGps, gpsText, mapsUrl } from '@/lib/patients';

// Hospital pre-arrival handoff — per PATIENT, not per injury: the hospital
// receives a person, so it needs who is coming, overall priority, every
// current injury, where they were and what first aid the headset guided.
//
// Built only from recorded data. Delivery to a hospital is not connected
// yet (no receiving endpoint exists), so "Send" stays disabled rather than
// pretending to transmit; Copy / PDF hand the same summary over manually.

const TRIAGE_RANK: Record<string, number> = { Red: 4, Orange: 3, Yellow: 2, Green: 1, Unclassified: 0 };
const CURRENT_WINDOW_HOURS = 24;

// Pull the "IMMEDIATE_STEPS" section out of the Gemini report text, if any.
function firstAidSteps(text: string | null | undefined): string[] {
  if (!text) return [];
  const m = text.match(/IMMEDIATE_STEPS\s*:?([\s\S]*?)(?:\n\s*\d+\.\s*[A-Z_]{4,}\s*:|$)/);
  if (!m) return [];
  return m[1]
    .split('\n')
    .map((l) => l.replace(/^[\s\-*•\d.)]+/, '').trim())
    .filter((l) => l.length > 3)
    .slice(0, 5);
}

function buildSummary(record: PatientRecord, injuries: Session[], priority: TriageCategory, preparedBy: string): string {
  const name = record.patient_name || record.patient_id;
  const loc = record.latest_location;
  const lines = [
    'VALKYRA — HOSPITAL PRE-ARRIVAL',
    `Prepared: ${new Date().toLocaleString()}${preparedBy ? ` by ${preparedBy}` : ''}`,
    '',
    `Patient: ${name}  (ID ${record.patient_id})`,
    `Priority: ${priority}`,
    `Injuries (${injuries.length}):`,
    ...injuries.map((s) =>
      `  - ${s.body_region || 'Region not specified'} — ${s.triage_category}, PWAT ${s.pwat_score != null ? Number(s.pwat_score).toFixed(1) : '—'}, ${s.wound_metrics?.depth_severity ?? 'depth n/a'}, scanned ${formatDate(s.created_at)}`
    ),
    '',
    `Last known location: ${hasGps(loc) ? `${gpsText(loc)}${loc.captured_at ? ` (fix ${formatDate(loc.captured_at)})` : ''} — ${mapsUrl(loc)}` : 'not recorded'}`,
    'Vitals: not captured',
  ];
  const steps = injuries.flatMap((s) => firstAidSteps(s.gemini_analysis).map((st) => `  - [${s.body_region || 'wound'}] ${st}`));
  if (steps.length) lines.push('', 'First aid guided on scene (AI-suggested):', ...steps);
  return lines.join('\n');
}

export default function HospitalHandoff({ record }: { record: PatientRecord }) {
  const { data: session } = useSession();

  // Default selection: injuries from the last 24h; if none, the latest one.
  const defaultIds = useMemo(() => {
    const now = Date.now();
    const recent = record.incidents.filter((s) => {
      const t = parseTimestamp(s.created_at)?.getTime();
      return t != null && (now - t) / 3_600_000 <= CURRENT_WINDOW_HOURS;
    });
    return new Set((recent.length ? recent : record.incidents.slice(0, 1)).map((s) => s.session_id));
  }, [record]);

  const [selected, setSelected] = useState<Set<string>>(defaultIds);
  const [copied, setCopied] = useState(false);

  const injuries = record.incidents.filter((s) => selected.has(s.session_id));
  const priority = injuries.reduce<TriageCategory>(
    (w, s) => ((TRIAGE_RANK[s.triage_category] ?? 0) > (TRIAGE_RANK[w] ?? 0) ? s.triage_category : w),
    'Unclassified'
  );
  const summary = buildSummary(record, injuries, priority, session?.user?.email ?? '');
  const loc = record.latest_location;

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked — the PDF still works */ }
  };

  const downloadPdf = () => {
    const doc = new jsPDF();
    doc.setFont('courier', 'normal');
    doc.setFontSize(10);
    const wrapped = doc.splitTextToSize(summary, 180);
    let y = 16;
    wrapped.forEach((line: string) => {
      if (y > 285) { doc.addPage(); y = 16; }
      doc.text(line, 14, y);
      y += 5;
    });
    doc.save(`Valkyra_PreArrival_${record.patient_id}_${Date.now()}.pdf`);
  };

  const label: React.CSSProperties = { fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', letterSpacing: 2, textTransform: 'uppercase' };

  return (
    <div id="hospital-handoff" style={{ marginBottom: 18, background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.2)', borderRadius: 10, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 10, color: 'var(--cyan)', fontFamily: 'var(--mono)', letterSpacing: 2, fontWeight: 700 }}>HOSPITAL PRE-ARRIVAL</div>
        <span className={`triage-badge triage-${priority}`}>Priority {priority}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn" style={{ fontSize: 11 }} onClick={copy} disabled={injuries.length === 0}>
            {copied ? '✓ Copied' : 'Copy summary'}
          </button>
          <button className="btn" style={{ fontSize: 11, borderColor: 'var(--cyan)', color: 'var(--cyan)' }} onClick={downloadPdf} disabled={injuries.length === 0}>
            📄 Handoff PDF
          </button>
          <button
            className="btn btn-accent"
            style={{ fontSize: 11, opacity: 0.45, cursor: 'not-allowed' }}
            disabled
            title="Hospital delivery isn't connected yet — no receiving hospital or endpoint is configured. Use Copy summary or Handoff PDF for now."
          >
            Send to hospital
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        {/* What goes to the hospital */}
        <div>
          <div style={{ ...label, marginBottom: 8 }}>Injuries to include</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {record.incidents.map((s) => (
              <label key={s.session_id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, cursor: 'pointer', padding: '4px 0' }}>
                <input type="checkbox" className="accent-cyan-500" checked={selected.has(s.session_id)} onChange={() => toggle(s.session_id)} />
                <span className={`triage-badge triage-${s.triage_category}`}>{s.triage_category}</span>
                <span style={{ color: 'var(--text)', fontWeight: 600 }}>{s.body_region || 'Region not specified'}</span>
                <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>{formatDate(s.created_at)}</span>
              </label>
            ))}
          </div>
          <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', marginTop: 8 }}>
            Pre-selected: injuries from the last {CURRENT_WINDOW_HOURS}h (or the latest one).
          </div>
        </div>

        {/* Manifest */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>
          <div style={{ ...label, marginBottom: 2 }}>Manifest</div>
          <div><strong style={{ color: 'var(--text)' }}>Patient:</strong> {record.patient_name || record.patient_id}</div>
          <div><strong style={{ color: 'var(--text)' }}>Priority:</strong> {priority} · {injuries.length} injur{injuries.length === 1 ? 'y' : 'ies'}</div>
          <div>
            <strong style={{ color: 'var(--text)' }}>Last location:</strong>{' '}
            {hasGps(loc) ? <a href={mapsUrl(loc)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cyan)', textDecoration: 'underline' }}>{gpsText(loc)} ↗</a> : 'not recorded'}
          </div>
          <div><strong style={{ color: 'var(--text)' }}>Vitals:</strong> not captured</div>
          <div><strong style={{ color: 'var(--text)' }}>Destination / ETA:</strong> not set — needs a connected hospital</div>
        </div>
      </div>

      <details style={{ marginTop: 14 }}>
        <summary style={{ ...label, cursor: 'pointer' }}>Preview handoff text</summary>
        <pre style={{ marginTop: 8, padding: 12, background: 'rgba(0,0,0,0.35)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, lineHeight: 1.6, color: 'var(--text2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'var(--mono)' }}>
          {summary}
        </pre>
      </details>
    </div>
  );
}
