'use client';
import { useState } from 'react';
import { subDays, subMonths, startOfMonth, isAfter, isEqual, parseISO } from 'date-fns';
import { ESCALATIONS, INJURY_TYPES } from '@/config/escalations';
import { RESPONDERS, INCIDENT_TYPES } from '@/config/fleet';
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { MetricCard } from '@/components/ui/MetricCard';

// 🛡️ IMPORTS FOR THE PERSONALIZED VOICE TOUR
import { useSession } from 'next-auth/react';
import VoiceTour, { TourStep } from '@/components/VoiceTour';

type Period = 'week' | 'month' | '3months' | 'all';

const PERIOD_LABELS: Record<Period, string> = {
  week: 'This Week', month: 'This Month', '3months': 'Last 3 Months', all: 'All Time',
};

const GAP_THRESHOLD = 30;
const MIN_SAMPLE = 3;

const injuryLabel = (t: string) => INCIDENT_TYPES.find(i => i.value === t)?.label.split(' — ')[1] ?? t;
const rateColor = (pct: number) => pct >= 25 ? 'var(--red)' : pct >= 15 ? 'var(--amber)' : 'var(--green)';
const rateColorClass = (pct: number) => pct >= 25 ? 'cv-red' : pct >= 15 ? 'cv-amber' : 'cv-green';

export default function EscalationsPage() {
  const [period, setPeriod] = useState<Period>('month');

  const cutoff = (() => {
    const now = new Date();
    if (period === 'week') return subDays(now, 7);
    if (period === 'month') return startOfMonth(now);
    if (period === '3months') return subMonths(now, 3);
    return new Date(0);
  })();

  const filtered = ESCALATIONS.filter(e => {
    const d = parseISO(e.date);
    return isAfter(d, cutoff) || isEqual(d, cutoff);
  });

  const total = filtered.length;
  const escalatedCount = filtered.filter(e => e.escalated).length;
  const overallRate = total > 0 ? (escalatedCount / total) * 100 : 0;

  const byResponder = RESPONDERS.map(r => {
    const recs = filtered.filter(e => e.responder_id === r.id);
    const esc = recs.filter(e => e.escalated).length;
    return { id: r.id, name: r.name, rank: r.rank, count: recs.length, rate: recs.length ? (esc / recs.length) * 100 : 0 };
  });

  const byType = INJURY_TYPES.map(type => {
    const recs = filtered.filter(e => e.injury_type === type);
    const esc = recs.filter(e => e.escalated).length;
    return { type, count: recs.length, rate: recs.length ? (esc / recs.length) * 100 : 0 };
  }).sort((a, b) => b.rate - a.rate);

  const worstResponder = [...byResponder].sort((a, b) => b.rate - a.rate)[0];
  const worstType = byType[0];

  const gaps = RESPONDERS.flatMap(r => INJURY_TYPES.map(type => {
    const recs = filtered.filter(e => e.responder_id === r.id && e.injury_type === type);
    const esc = recs.filter(e => e.escalated).length;
    const rate = recs.length ? (esc / recs.length) * 100 : 0;
    return { responder: r.name, type, count: recs.length, escalated: esc, rate };
  })).filter(g => g.count >= MIN_SAMPLE && g.rate >= GAP_THRESHOLD).sort((a, b) => b.rate - a.rate);

  const customTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const p = payload[0]?.payload;
    return (
      <div style={{ background:'rgba(6,12,24,0.95)', border:'1px solid var(--border-hi)', borderRadius:8, padding:'6px 12px', fontFamily:'var(--mono)', fontSize:11 }}>
        <div style={{ color:'var(--text)' }}>{p?.name ?? p?.rank}: <strong style={{ color:'var(--accent)' }}>{Number(payload[0]?.value).toFixed(1)}%</strong></div>
      </div>
    );
  };

  // 🛡️ EXTRACT USER NAME FOR PERSONALIZED GREETING
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(' ')[0] || 'Commander';

  // 🛡️ DYNAMIC SIMULATION STEPS
  const PAGE_STEPS: TourStep[] = [
    {
      targetId: 'spotlight-escalation-metrics',
      tag: 'ESCALATION METRICS',
      title: 'Overall Call Rates',
      script: `Welcome to the Escalations dashboard, ${firstName}. Here we track the frequency at which field operators override the model to request human medical intervention.`
    },
    {
      targetId: 'spotlight-escalation-charts',
      tag: 'BEHAVIORAL ANALYSIS',
      title: 'Escalation Trends',
      script: 'These modules break down doctor call rates by individual responder and specific injury types, helping identify where the model is trusted least.'
    },
    {
      targetId: 'spotlight-escalation-gaps',
      tag: 'SYSTEM OPTIMIZATION',
      title: 'Model Reinforcement Gaps',
      script: 'The system automatically flags anomalous escalation patterns. These gaps indicate where our models require additional training data to improve field confidence. Briefing complete.'
    }
  ];

  return (
    <>
      <div style={{ background:'rgba(192,132,252,0.04)', border:'1px solid rgba(192,132,252,0.15)', borderRadius:10, padding:'10px 16px', marginBottom:20, fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)' }}>
        ℹ Escalation review data is a static demo dataset — the backend has no live "would a doctor have been called" signal. Figures are illustrative, not derived from real clinical review.
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:16 }}>
        {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
          <button key={p} className="btn" style={{ fontSize:11, padding:'5px 12px', ...(period===p ? {borderColor:'rgba(59,130,246,0.5)',color:'#93c5fd'} : {}) }} onClick={() => setPeriod(p)}>
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* 🛡️ TARGET 1: Escalation Metrics */}
      <div id="spotlight-escalation-metrics" className="metrics-grid" style={{ marginBottom:20 }}>
        <MetricCard
          tooltip="How many reviewed sessions this period resulted in a doctor being called in, out of the total reviewed."
          label="Total Escalations"
          value={escalatedCount}
          sub={`<span style="color:var(--text3)">of ${total} reviewed</span>`}
          color=""
          bg=""
        />
        <MetricCard
          tooltip="The share of reviewed sessions this period where a responder escalated to a doctor instead of relying on the automated assessment."
          label="Overall Escalation Rate"
          value={overallRate}
          decimals={1}
          suffix="%"
          color={rateColorClass(overallRate)}
          bg=""
          sub={overallRate >= 25 ? '<span class="delta-down">⚠ Elevated escalation rate</span>' : undefined}
        />
        <MetricCard
          tooltip="The injury type with the highest doctor-escalation rate in this period — where field responders trust the automated assessment least."
          label="Highest-Rate Injury Type"
          value={worstType ? injuryLabel(worstType.type) : '—'}
          color=""
          bg=""
        />
        <MetricCard
          tooltip="The responder with the highest personal escalation rate in this period."
          label="Highest-Rate Responder"
          value={worstResponder?.name ?? '—'}
          color=""
          bg=""
        />
      </div>

      {/* 🛡️ TARGET 2: Escalation Charts */}
      <div id="spotlight-escalation-charts" className="mid-grid" style={{ marginBottom:20 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">Doctor Call Rate by Responder</span><span className="badge badge-ai">STATIC DEMO</span></div>
          <div style={{ padding:'16px 18px' }}>
            {total === 0 ? (
              <div style={{ color:'var(--text3)', fontFamily:'var(--mono)', fontSize:12, textAlign:'center', padding:20 }}>No reviews in this period.</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={byResponder} barSize={28}>
                  <XAxis dataKey="rank" tick={{ fill:'rgba(240,244,255,0.35)', fontSize:10, fontFamily:'JetBrains Mono' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={customTooltip} />
                  <Bar dataKey="rate" radius={[4,4,0,0]}>
                    {byResponder.map((r,i) => <Cell key={i} fill={rateColor(r.rate)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Doctor Call Rate by Injury Type</span></div>
          <div className="acc-area">
            <div className="acc-rows">
              {byType.map(t => (
                <div key={t.type} className="acc-row">
                  <div className="acc-label">{t.type}</div>
                  <div className="acc-track"><div className="acc-fill" style={{ width:`${Math.min(t.rate, 100)}%`, background:rateColor(t.rate) }} /></div>
                  <div className="acc-pct">{t.rate.toFixed(0)}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 🛡️ TARGET 3: Model Reinforcement Gaps (Wrapped in an ID container) */}
      <div id="spotlight-escalation-gaps" className="pb-10">
        <div className="section-hd"><div className="section-title">Model Reinforcement Gaps</div><span className="badge badge-warn">{gaps.length} FLAGGED</span></div>
        <div className="card">
          {gaps.length === 0 ? (
            <div style={{ padding:'16px 18px', fontSize:12, color:'var(--text3)', fontFamily:'var(--mono)' }}>✓ No responder/injury-type combination exceeds the {GAP_THRESHOLD}% escalation threshold in this period.</div>
          ) : (
            <div style={{ padding:'6px 0' }}>
              {gaps.map((g, i) => (
                <div key={`${g.responder}-${g.type}`} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 18px', borderBottom: i < gaps.length-1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <span className="badge badge-warn">{g.rate.toFixed(0)}%</span>
                  <span style={{ fontSize:12, color:'var(--text2)' }}>
                    <strong style={{ color:'var(--text)' }}>{g.responder}</strong> × {injuryLabel(g.type)} — {g.escalated} of {g.count} reviews escalated to a doctor. Consider additional training data for {injuryLabel(g.type).toLowerCase()} assessments.
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 🛡️ INJECT THE TOUR ENGINE */}
      <VoiceTour storageKey="valkyra-tour-escalations" steps={PAGE_STEPS} />
    </>
  );
}