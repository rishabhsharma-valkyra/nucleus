'use client';

import { motion } from 'framer-motion';
import { HoverTooltip } from '@/components/ui/MetricCard';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

// 🛡️ IMPORTS FOR THE PERSONALIZED VOICE TOUR
import { useSession } from 'next-auth/react';
import VoiceTour, { TourStep } from '@/components/VoiceTour';

// --- MOCK PERFORMANCE DATA ---
const escalationData = [
  { injury: 'GSW - Torso', escalations: 45, aiResolved: 55 },
  { injury: 'Blunt Trauma Head', escalations: 38, aiResolved: 82 },
  { injury: 'Burn - Severe', escalations: 65, aiResolved: 15 },
  { injury: 'Laceration - Major', escalations: 12, aiResolved: 95 },
];

const mortalityData = [
  { hour: '00:00', predictedRisk: 85, actualMortality: 80 },
  { hour: '04:00', predictedRisk: 72, actualMortality: 75 },
  { hour: '08:00', predictedRisk: 60, actualMortality: 58 },
  { hour: '12:00', predictedRisk: 45, actualMortality: 42 },
  { hour: '16:00', predictedRisk: 65, actualMortality: 70 },
  { hour: '20:00', predictedRisk: 88, actualMortality: 85 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: 'rgba(2, 6, 23, 0.95)', border: '1px solid var(--border)', padding: '12px 16px', borderRadius: '8px', backdropFilter: 'blur(10px)' }}>
        <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
        {payload.map((p: any, i: number) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: p.color }} />
            <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text2)' }}>{p.name}:</span>
            <span style={{ fontSize: 13, fontWeight: 'bold', fontFamily: 'var(--mono)', color: 'white' }}>{p.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function AIPerformancePage() {
  // 🛡️ EXTRACT USER NAME FOR PERSONALIZED GREETING
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(' ')[0] || 'Commander';

  // 🛡️ DYNAMIC SIMULATION STEPS
  const PAGE_STEPS: TourStep[] = [
    {
      targetId: 'spotlight-mortality',
      tag: 'PREDICTIVE MODELING',
      title: 'Mortality Prediction Engine',
      script: `Welcome to Model Performance, ${firstName}. This module correlates the model's real-time mortality risk predictions against actual post-incident outcomes to verify clinical accuracy.`
    },
    {
      targetId: 'spotlight-escalation',
      tag: 'SYSTEM AUTONOMY',
      title: 'Doctor Escalation Frequency',
      script: 'This chart tracks human intervention rates by injury classification, highlighting exactly when field responders bypass the model to call a licensed MD. Briefing complete.'
    }
  ];

  return (
    <div className="pb-32">

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* 🛡️ TARGET 1: MORTALITY TRACKING DASHBOARD */}
        <motion.div id="spotlight-mortality" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -3, boxShadow: '0 8px 28px rgba(0,0,0,0.35)' }} transition={{ type: 'spring', stiffness: 260, damping: 22 }} className="card" style={{ padding: 24 }}>
          <HoverTooltip tooltip="Compares the model's predicted mortality risk at time of dispatch against the actual outcome recorded after the incident closed — the gap between the two lines is model error." style={{ marginBottom: 24, display: 'block' }}>
            <h2 style={{ fontSize: 14, fontFamily: 'var(--mono)', color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: 1 }}>Mortality Prediction Engine</h2>
            <p style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: 4 }}>Real-time Risk Prediction vs Post-Incident Actual Outcomes</p>
          </HoverTooltip>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mortalityData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f87171" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f87171" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="hour" stroke="rgba(255,255,255,0.1)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                <YAxis stroke="rgba(255,255,255,0.1)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'monospace' }} domain={[0, 100]} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)', paddingTop: 10 }} />
                <Area type="monotone" dataKey="predictedRisk" name="Predicted Risk %" stroke="#22d3ee" fillOpacity={1} fill="url(#colorPredicted)" strokeWidth={2} />
                <Area type="monotone" dataKey="actualMortality" name="Actual Mortality %" stroke="#f87171" fillOpacity={1} fill="url(#colorActual)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* 🛡️ TARGET 2: ESCALATION FREQUENCY */}
        <motion.div id="spotlight-escalation" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} whileHover={{ y: -3, boxShadow: '0 8px 28px rgba(0,0,0,0.35)' }} className="card" style={{ padding: 24 }}>
          <HoverTooltip tooltip="For each injury type, how often a field responder bypassed the model's recommendation and called in a licensed doctor instead." style={{ marginBottom: 24, display: 'block' }}>
            <h2 style={{ fontSize: 14, fontFamily: 'var(--mono)', color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: 1 }}>Doctor Escalation Frequency</h2>
            <p style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: 4 }}>Human Intervention Rate by Injury Classification</p>
          </HoverTooltip>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={escalationData} layout="vertical" margin={{ top: 10, right: 0, left: 40, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" stroke="rgba(255,255,255,0.1)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="injury" stroke="rgba(255,255,255,0.1)" tick={{ fill: 'rgba(255,255,255,0.8)', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)', paddingTop: 10 }} />
                <Bar dataKey="escalations" name="Bypassed Model (Doctor Called)" stackId="a" fill="#fbbf24" radius={[0, 0, 0, 0]} />
                <Bar dataKey="aiResolved" name="Resolved by Protocol" stackId="a" fill="#34d399" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

      </div>

      {/* 🛡️ INJECT THE TOUR ENGINE */}
      <VoiceTour storageKey="valkyra-tour-ai-performance" steps={PAGE_STEPS} />
      
    </div>
  );
}