'use client';

// Clinician review of one injury: the AI's read next to the doctor's
// confirmation or correction. Saved reviews are append-only (the latest one
// is shown, history is kept) and carry a snapshot of the AI read, so model
// output vs clinician can be compared when retraining.

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Injury, regionLabel, isAnalysing } from '@/lib/patients';
import { BODY_REGIONS, REGION_GROUPS, WOUND_TYPES, SEVERITIES, TRIAGES, reportField, matchOption } from '@/lib/bodyRegions';
import { postReview } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { formatDate } from '@/lib/utils';
import { useNucleusStore } from '@/store/useNucleusStore';

const box: React.CSSProperties = {
  marginBottom: 16, padding: '12px 14px', borderRadius: 8,
  background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.22)',
};
const label: React.CSSProperties = { fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', letterSpacing: 2, textTransform: 'uppercase' };
const select: React.CSSProperties = { width: '100%', fontSize: 12, padding: '6px 8px' };

export default function ClinicianReview({ injury, canReview }: { injury: Injury; canReview: boolean }) {
  const qc = useQueryClient();
  const addToast = useNucleusStore((s) => s.addToast);
  const review = injury.review;

  // What the AI said (snapshotted with the review)
  const ai = useMemo(() => {
    const text = injury.worst?.gemini_text ?? injury.session.gemini_analysis;
    const woundType = reportField(text, 'WOUND_TYPE');
    const severity = reportField(text, 'SEVERITY_LEVEL');
    return {
      region: injury.aiRegion,
      triage: injury.aiTriage,
      pwat: injury.pwat,
      depth: injury.worst?.depth_severity ?? null,
      woundType,
      severity,
      woundTypeOption: matchOption(woundType, WOUND_TYPES),
      severityOption: matchOption(severity, SEVERITIES),
      model: injury.worst?.analysis_model ?? null,
    };
  }, [injury]);

  const initial = () => ({
    region: review?.body_region ?? (ai.region && BODY_REGIONS.includes(ai.region) ? ai.region : ''),
    woundType: review?.wound_type ?? ai.woundTypeOption ?? '',
    severity: review?.severity ?? ai.severityOption ?? '',
    triage: review?.triage ?? ((TRIAGES as readonly string[]).includes(ai.triage) ? ai.triage : ''),
    notes: review?.notes ?? '',
  });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  const agreesWithAi = form.region === (ai.region ?? '') && form.triage === ai.triage
    && form.woundType === (ai.woundTypeOption ?? '') && form.severity === (ai.severityOption ?? '');
  const canSave = !!form.region && !!form.triage && !saving;

  const save = async (values: typeof form, verdict: 'confirmed' | 'corrected') => {
    setSaving(true);
    try {
      await postReview({
        session_id: injury.session.session_id,
        model_region: injury.groupRegion,
        frame_keys: injury.frames.map((f) => f.frame_key ?? '').filter(Boolean),
        patient_id: injury.session.patient_id,
        verdict,
        body_region: values.region || null,
        wound_type: values.woundType || null,
        severity: values.severity || null,
        triage: values.triage || null,
        notes: values.notes.trim() || null,
        ai_snapshot: {
          region: ai.region, triage: ai.triage, pwat: ai.pwat, depth: ai.depth,
          wound_type: ai.woundType, severity: ai.severity, model: ai.model,
          frames: injury.frames.map((f) => ({ frame_key: f.frame_key, pwat: f.pwat_score, triage: f.triage, region: f.body_region, model: f.analysis_model })),
        },
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.patient(injury.session.session_id) }),
        qc.invalidateQueries({ queryKey: queryKeys.allSessions }),
        injury.session.patient_id
          ? qc.invalidateQueries({ queryKey: queryKeys.patientWounds(injury.session.patient_id) })
          : Promise.resolve(),
      ]);
      setEditing(false);
      addToast({ type: 'success', message: verdict === 'confirmed' ? 'AI read confirmed' : 'Correction saved' });
    } catch (e: any) {
      addToast({ type: 'error', message: e?.response?.data?.detail ?? 'Could not save the review — please try again' });
    } finally {
      setSaving(false);
    }
  };

  const aiLine = (
    <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text2)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
      <span>Region <b style={{ color: 'var(--text)' }}>{regionLabel(ai.region)}</b></span>
      <span>Triage <b style={{ color: 'var(--text)' }}>{ai.triage}</b>{ai.pwat != null && ` (PWAT ${ai.pwat.toFixed(1)})`}</span>
      {ai.woundType && <span>Type <b style={{ color: 'var(--text)' }}>{ai.woundType}</b></span>}
      {ai.severity && <span>Severity <b style={{ color: 'var(--text)' }}>{ai.severity}</b></span>}
      {ai.model && <span style={{ color: 'var(--text3)' }}>{ai.model}</span>}
    </div>
  );

  // ── Saved review (read view) ─────────────────────────────────────────
  if (review && !editing) {
    const corrected = review.verdict === 'corrected';
    return (
      <div style={box}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ ...label, color: '#a78bfa' }}>Clinician review</span>
          <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: corrected ? 'var(--amber)' : 'var(--green)' }}>
            {corrected ? '✎ AI read corrected' : '✓ AI read confirmed'}
          </span>
          <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
            by {review.reviewer_name || review.reviewer_email} · {formatDate(review.reviewed_at)}
          </span>
          {canReview && (
            <button className="btn" style={{ marginLeft: 'auto', fontSize: 10, padding: '3px 10px' }} onClick={() => { setForm(initial()); setEditing(true); }}>
              Update review
            </button>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text)', display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 6 }}>
          <span>{regionLabel(review.body_region)}</span>
          {review.triage && <span className={`triage-badge triage-${review.triage}`}>{review.triage}</span>}
          {review.wound_type && <span>{review.wound_type}</span>}
          {review.severity && <span>{review.severity}</span>}
        </div>
        {review.notes && <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6, whiteSpace: 'pre-wrap' }}>{review.notes}</div>}
        {corrected && <div style={{ ...label, marginBottom: 4 }}>AI read was</div>}
        {corrected && aiLine}
      </div>
    );
  }

  // ── Not reviewed, read-only role ─────────────────────────────────────
  if (!canReview) {
    return (
      <div style={box}>
        <div style={{ ...label, color: '#a78bfa', marginBottom: 6 }}>Clinician review</div>
        <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: 6 }}>Awaiting review by a clinician.</div>
        {aiLine}
      </div>
    );
  }

  // ── Review form ──────────────────────────────────────────────────────
  const field = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const aiPending = isAnalysing(ai.region);
  return (
    <div style={box}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ ...label, color: '#a78bfa' }}>Clinician review</span>
        <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>Confirm or correct the AI read — your answer trains future models</span>
      </div>
      <div style={{ ...label, marginBottom: 4 }}>AI read</div>
      <div style={{ marginBottom: 12 }}>{aiLine}</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 10 }}>
        <label>
          <div style={{ ...label, marginBottom: 4 }}>Body region *</div>
          <select className="form-input" style={select} value={form.region} onChange={field('region')}>
            <option value="">Select…</option>
            {REGION_GROUPS.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.regions.map((r) => <option key={r} value={r}>{r}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <label>
          <div style={{ ...label, marginBottom: 4 }}>Triage *</div>
          <select className="form-input" style={select} value={form.triage} onChange={field('triage')}>
            <option value="">Select…</option>
            {TRIAGES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>
          <div style={{ ...label, marginBottom: 4 }}>Wound type</div>
          <select className="form-input" style={select} value={form.woundType} onChange={field('woundType')}>
            <option value="">—</option>
            {WOUND_TYPES.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </label>
        <label>
          <div style={{ ...label, marginBottom: 4 }}>Severity</div>
          <select className="form-input" style={select} value={form.severity} onChange={field('severity')}>
            <option value="">—</option>
            {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <textarea
        className="form-input"
        style={{ width: '100%', fontSize: 12, minHeight: 54, marginBottom: 10, resize: 'vertical' }}
        placeholder="Notes (optional) — e.g. findings on examination"
        value={form.notes}
        onChange={field('notes')}
        maxLength={4000}
      />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-accent" style={{ fontSize: 11 }} disabled={!canSave} onClick={() => save(form, agreesWithAi ? 'confirmed' : 'corrected')}>
          {saving ? 'Saving…' : agreesWithAi ? '✓ Confirm AI read' : 'Save correction'}
        </button>
        {editing && <button className="btn" style={{ fontSize: 11 }} disabled={saving} onClick={() => setEditing(false)}>Cancel</button>}
        <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
          {!form.region || !form.triage ? 'Body region and triage are required'
            : aiPending ? 'AI read still in progress — your values are saved as the clinician read'
            : agreesWithAi ? 'Matches the AI read' : 'Differs from the AI read — saved as a correction'}
        </span>
      </div>
    </div>
  );
}
