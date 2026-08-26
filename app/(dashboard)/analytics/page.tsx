'use client';

import { useState, useRef } from 'react';
import { motion, Variants } from 'framer-motion';
import { AnimatedNumber, HoverTooltip } from '@/components/ui/MetricCard';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

// 🛡️ IMPORTS FOR PERSONALIZED VOICE TOUR
import { useSession } from 'next-auth/react';
import VoiceTour, { TourStep } from '@/components/VoiceTour';

// --- MOCK LONGITUDINAL DATA ---
const rescueTrendData = [
  { month: 'Jan', rescue: 62, fatality: 38, baseline: 55 },
  { month: 'Feb', rescue: 65, fatality: 35, baseline: 55 },
  { month: 'Mar', rescue: 71, fatality: 29, baseline: 55 },
  { month: 'Apr', rescue: 78, fatality: 22, baseline: 55 },
  { month: 'May', rescue: 86, fatality: 14, baseline: 55 },
  { month: 'Jun', rescue: 92, fatality: 8, baseline: 55 },
];

const injuryFrequencyData = [
  { type: 'Gunshot (GSW)', North: 45, South: 30, East: 20, West: 15 },
  { type: 'Blunt Trauma', North: 25, South: 40, East: 10, West: 22 },
  { type: 'Laceration', North: 15, South: 20, East: 35, West: 10 },
  { type: 'Burn / Thermal', North: 10, South: 5, East: 15, West: 30 },
  { type: 'Puncture', North: 5, South: 12, East: 8, West: 15 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: 'rgba(2, 6, 23, 0.95)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)' }}>
        <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
        {payload.map((p: any, i: number) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: p.color, boxShadow: `0 0 8px ${p.color}` }} />
            <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text2)', flex: 1 }}>{p.name}:</span>
            <span style={{ fontSize: 13, fontWeight: 'bold', fontFamily: 'var(--mono)', color: 'white' }}>{p.value}%</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const staggerReveal: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.4, ease: "easeOut" as const } }),
};

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<'30D' | '90D' | '6M' | '1Y'>('6M');
  const [regionFilter, setRegionFilter] = useState<'All' | 'North' | 'South' | 'East' | 'West'>('All');
  const [isExporting, setIsExporting] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  // 🛡️ EXTRACT USER NAME FOR PERSONALIZED SCRIPT
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(' ')[0] || 'Officer';

  // 🛡️ ANALYTICS-SPECIFIC BRIEFING SCRIPT
  const ANALYTICS_STEPS: TourStep[] = [
    {
      targetId: 'spotlight-rescue-trend',
      tag: 'LONGITUDINAL OUTCOMES',
      title: 'Rescue vs Fatality Trajectory',
      script: `Welcome to Analytics, ${firstName}. This panel monitors long-term survival metrics, showing baseline comparisons pre and post Valkyra deployment.`
    },
    {
      targetId: 'spotlight-intervention',
      tag: 'CLINICAL EFFICIENCY',
      title: 'Intervention Impact',
      script: 'Here you can evaluate relative survival increases and protocol stabilization times across network wards.'
    },
    {
      targetId: 'spotlight-demographics',
      tag: 'REGIONAL DEMOGRAPHICS',
      title: 'Trauma Distribution',
      script: 'This module categorizes trauma frequency by injury type and regional deployment zone. Analytics briefing complete.'
    }
  ];

  // --- VISUAL EXPORT ENGINE ---
  const handleExportVisualPDF = async () => {
    if (!dashboardRef.current) return;
    setIsExporting(true);
    
    try {
      const canvas = await html2canvas(dashboardRef.current, {
        backgroundColor: '#020617',
        scale: 2,
        useCORS: true,
      });

      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.setFontSize(16);
      pdf.setTextColor(40, 40, 40);
      pdf.setFont("helvetica", "bold");
      pdf.text("Valkyra Command - Analytics Brief", 14, 20);
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Generated: ${new Date().toLocaleString()}`, 14, 26);
      
      pdf.setDrawColor(200, 200, 200);
      pdf.line(14, 32, pdfWidth - 14, 32);

      pdf.addImage(imgData, 'PNG', 14, 38, pdfWidth - 28, pdfHeight * ((pdfWidth - 28) / pdfWidth));
      
      pdf.save(`Valkyra_Analytics_Snapshot_${Date.now()}.pdf`);
    } catch (error) {
      console.error('Failed to generate visual export', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="pb-10">
      
      {/* HEADER CONTROLS */}
      <div className="flex justify-end gap-4 mb-6">
        <div className="flex gap-2 items-center p-1 bg-black/40 border border-white/5 rounded-lg">
          {['30D', '90D', '6M', '1Y'].map(tr => (
            <button
              key={tr}
              onClick={() => setTimeRange(tr as any)}
              className="btn"
              style={{ fontSize: 10, padding: '4px 12px', ...(timeRange === tr ? { borderColor: 'rgba(34,211,238,0.5)', color: '#22d3ee', background: 'rgba(34,211,238,0.05)' } : { border: '1px solid transparent', background: 'transparent' }) }}
            >
              {tr}
            </button>
          ))}
        </div>
        <button 
          onClick={handleExportVisualPDF}
          disabled={isExporting}
          className="btn flex items-center gap-2 transition-all"
          style={{ fontSize: 10, padding: '6px 16px', borderColor: 'rgba(34,211,238,0.3)', color: '#22d3ee', background: isExporting ? 'rgba(34,211,238,0.15)' : 'rgba(34,211,238,0.05)' }}
        >
          {isExporting ? (
            <span className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          )}
          {isExporting ? 'GENERATING PDF...' : 'EXPORT REPORT'}
        </button>
      </div>

      {/* DASHBOARD CONTAINER */}
      <div ref={dashboardRef} className="bg-[#020617] p-2 rounded-xl -m-2">
        {/* TOP GRID: PRIMARY OUTCOMES */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          
          {/* 🛡️ TARGET 1: Rescue vs Fatality Trend */}
          <motion.div 
            id="spotlight-rescue-trend"
            custom={1} 
            initial="hidden" 
            animate="show" 
            variants={staggerReveal} 
            className="card lg:col-span-2 relative overflow-hidden"
          >
            <div className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden opacity-[0.03]">
               <motion.div className="w-full h-[1px] bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" animate={{ y: ["-100%", "800%"] }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }} />
            </div>
            
            <div className="card-header relative z-10" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              <div>
                <span className="card-title text-cyan-400">Rescue vs Fatality Rate</span>
                <p style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', marginTop: 4 }}>Pre & Post Valkyra Deployment Trajectory</p>
              </div>
              <HoverTooltip className="text-right" tooltip="Share of field incidents this month resulting in a successful rescue outcome.">
                <div style={{ fontSize: 24, fontWeight: 'bold', fontFamily: 'var(--mono)', color: 'var(--green)' }}>
                  <AnimatedNumber value={rescueTrendData[rescueTrendData.length - 1].rescue} decimals={1} />%
                </div>
                <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase' }}>Current Rescue Rate</div>
              </HoverTooltip>
            </div>
            
            <div className="h-[280px] w-full mt-4 relative z-10 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rescueTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="month" stroke="rgba(255,255,255,0.1)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.1)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'monospace' }} domain={[0, 100]} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(34,211,238,0.2)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)', paddingTop: 10 }} />
                  
                  <Line type="stepAfter" dataKey="baseline" name="Pre-Valkyra Baseline" stroke="rgba(255,255,255,0.2)" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                  <Line type="monotone" dataKey="fatality" name="Fatality Rate" stroke="#f87171" strokeWidth={3} dot={{ r: 4, fill: '#1e293b', stroke: '#f87171', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#f87171', stroke: '#fff', strokeWidth: 2 }} />
                  <Line type="monotone" dataKey="rescue" name="Rescue Rate" stroke="#4ade80" strokeWidth={3} dot={{ r: 4, fill: '#1e293b', stroke: '#4ade80', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#4ade80', stroke: '#fff', strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* 🛡️ TARGET 2: Intervention Impact */}
          <motion.div 
            id="spotlight-intervention"
            custom={2} 
            initial="hidden" 
            animate="show" 
            variants={staggerReveal} 
            className="card relative overflow-hidden flex flex-col justify-between" 
            style={{ background: 'linear-gradient(145deg, rgba(34,211,238,0.05) 0%, rgba(0,0,0,0.2) 100%)', borderColor: 'rgba(34,211,238,0.2)' }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent pointer-events-none" />
            
            <div className="relative z-10 p-2">
              <h2 style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 24 }}>Intervention Impact</h2>
              
              <div className="space-y-6">
                <HoverTooltip tooltip="Modeled improvement in survival odds compared to the pre-Valkyra deployment baseline.">
                  <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', marginBottom: 4 }}>RELATIVE SURVIVAL INCREASE</div>
                  <div style={{ fontSize: 28, fontWeight: 'bold', fontFamily: 'var(--mono)', color: 'white', display: 'flex', alignItems: 'center', gap: 12 }}>
                    +<AnimatedNumber value={37} />%
                    <span style={{ fontSize: 10, padding: '4px 8px', background: 'rgba(34, 197, 94, 0.1)', color: 'var(--green)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 4 }}>Significant</span>
                  </div>
                </HoverTooltip>

                <div style={{ height: 1, width: '100%', background: 'rgba(255,255,255,0.05)' }} />

                <HoverTooltip tooltip="Average time from incident detection to patient stabilization, compared against the pre-Valkyra baseline.">
                  <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', marginBottom: 4 }}>AVERAGE STABILIZATION TIME</div>
                  <div style={{ fontSize: 24, fontWeight: 'bold', fontFamily: 'var(--mono)', color: 'white' }}>
                    14.2 <span style={{ fontSize: 12, color: 'var(--text3)' }}>mins</span>
                  </div>
                  <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--green)', marginTop: 4 }}>↓ 4.8 mins faster than baseline</div>
                </HoverTooltip>
              </div>
            </div>

            <HoverTooltip tooltip="Share of interventions performed in line with clinical protocol, measured against a 95% target." className="relative z-10 mt-6 p-4 rounded-lg block" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Protocol Adherence</div>
              <div style={{ width: '100%', background: 'rgba(255,255,255,0.1)', height: 6, borderRadius: 3, overflow: 'hidden' }}>
                <motion.div initial={{ width: 0 }} animate={{ width: '88%' }} transition={{ duration: 1, delay: 0.5 }} style={{ height: '100%', background: 'var(--cyan)', boxShadow: '0 0 10px var(--cyan)' }} />
              </div>
              <div className="flex justify-between mt-3">
                <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>Target: 95%</span>
                <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--cyan)', fontWeight: 'bold' }}>Current: 88%</span>
              </div>
            </HoverTooltip>
          </motion.div>
        </div>

        {/* BOTTOM GRID: INJURY FREQUENCY */}
        {/* 🛡️ TARGET 3: Regional Demographics */}
        <motion.div 
          id="spotlight-demographics"
          custom={3} 
          initial="hidden" 
          animate="show" 
          variants={staggerReveal} 
          className="card relative overflow-hidden"
        >
          <div className="card-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            <div>
              <span className="card-title text-cyan-400">Regional Injury Demographics</span>
              <p style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', marginTop: 4 }}>Frequency distribution by trauma type and deployment zone</p>
            </div>
            
            <select 
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value as any)}
              className="form-select"
              style={{ fontSize: 11, padding: '6px 12px', width: 140, background: 'rgba(0,0,0,0.4)' }}
            >
              {['All', 'North', 'South', 'East', 'West'].map(r => <option key={r} value={r}>{r} Region</option>)}
            </select>
          </div>

          <div className="h-[300px] w-full mt-4 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={injuryFrequencyData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="type" stroke="rgba(255,255,255,0.1)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                <YAxis stroke="rgba(255,255,255,0.1)" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)', paddingTop: 10 }} />
                
                {(regionFilter === 'All' || regionFilter === 'North') && <Bar dataKey="North" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />}
                {(regionFilter === 'All' || regionFilter === 'South') && <Bar dataKey="South" stackId="a" fill="#22d3ee" radius={[0, 0, 0, 0]} />}
                {(regionFilter === 'All' || regionFilter === 'East') && <Bar dataKey="East" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />}
                {(regionFilter === 'All' || regionFilter === 'West') && <Bar dataKey="West" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* 🛡️ VOICE TOUR ENGINE INSTANTIATION */}
      <VoiceTour storageKey="valkyra-tour-analytics" steps={ANALYTICS_STEPS} />

    </div>
  );
}