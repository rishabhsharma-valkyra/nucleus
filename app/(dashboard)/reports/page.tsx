'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { useAllSessions } from '@/hooks';
import { useNucleusStore } from '@/store/useNucleusStore';
import { pwatColor, formatDate, parseTimestamp } from '@/lib/utils';
import { jsPDF } from 'jspdf';

// 🛡️ IMPORTS FOR THE PERSONALIZED VOICE TOUR
import { useSession } from 'next-auth/react';
import VoiceTour, { TourStep } from '@/components/VoiceTour';

// --- ANIMATION VARIANTS ---
const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const rowVariant: Variants = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: "easeOut" } }
};

export default function ReportsPage() {
  const { data: sessionsData, isLoading } = useAllSessions();
  const setActivePatientId = useNucleusStore((s) => s.setActivePatientId);
  const sessions = sessionsData?.sessions ?? [];

  // --- Filter & Selection States ---
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<'7D' | '30D' | '90D' | 'ALL'>('ALL');
  const [triageFilter, setTriageFilter] = useState<string>('All');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // --- Data Processing ---
  const filteredSessions = useMemo(() => {
    return sessions.filter((session: any) => {
      const matchesSearch = session.session_id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTriage = triageFilter === 'All' || session.triage_category === triageFilter;
      
      const sessionDate = parseTimestamp(session.created_at)?.getTime() ?? NaN;
      const now = Date.now();
      const daysDiff = (now - sessionDate) / (1000 * 3600 * 24);
      let matchesDate = true;
      if (dateRange === '7D') matchesDate = daysDiff <= 7;
      if (dateRange === '30D') matchesDate = daysDiff <= 30;
      if (dateRange === '90D') matchesDate = daysDiff <= 90;

      return matchesSearch && matchesTriage && matchesDate;
    });
  }, [sessions, searchQuery, triageFilter, dateRange]);

  // 🛡️ EXTRACT USER NAME AND GRAB THE FIRST AVAILABLE SESSION
  const { data: sessionData } = useSession();
  const firstName = sessionData?.user?.name?.split(' ')[0] || 'Commander';
  const firstSessionId = filteredSessions.length > 0 ? filteredSessions[0].session_id : null;

  // 🛡️ DYNAMIC SIMULATION STEPS: Combined into 3 precise steps
  const PAGE_STEPS: TourStep[] = [
    {
      targetId: 'spotlight-filters',
      tag: 'DATA FILTERS',
      title: 'Global Search & Triage',
      script: `Welcome to the Incident Reports, ${firstName}. Use this console to filter historical cases by Session ID, Date Range, or Triage severity.`
    },
    {
      targetId: 'spotlight-table',
      tag: 'INCIDENT LOGS',
      title: 'Batch Records',
      script: 'This table compiles all historical telemetry. You can select multiple rows to generate a batch CSV or PDF export.'
    },
    {
      targetId: 'spotlight-modal-container', // 🛡️ Targets the entire modal box
      tag: 'CLINICAL EXPORT',
      title: 'Detailed Case Telemetry',
      script: 'Clicking an incident opens its full telemetry file. From here, you can review frame-by-frame metrics, request automated analysis, or export a detailed clinical PDF. Briefing complete.',
      action: () => {
        // Automatically open the modal right before this step is spoken
        if (firstSessionId) setActivePatientId(firstSessionId);
      }
    }
  ];

  // --- Selection Handlers ---
  const toggleSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredSessions.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredSessions.map((s: any) => s.session_id)));
  };

  // --- EXPORT ENGINES ---
  const handleExportCSV = () => {
    const selectedData = filteredSessions.filter((s: any) => selectedIds.has(s.session_id));
    const headers = ["Session ID", "Date", "Triage", "Frame", "PWAT Score", "Depth Severity", "Wound Area %"];
    const rows: string[] = [];
    
    selectedData.forEach((s: any) => {
      const frames = s.frames && s.frames.length > 0 ? s.frames : [ s.wound_metrics || {} ];
      frames.forEach((frame: any, fIdx: number) => {
        rows.push([
          s.session_id,
          formatDate(s.created_at).replace(/,/g, ''), 
          s.triage_category || 'Unknown',
          `Frame ${fIdx + 1}`,
          frame.pwat_score ?? s.pwat_score ?? 'N/A',
          frame.depth_severity ?? 'N/A',
          frame.area_pct != null ? `${Number(frame.area_pct).toFixed(1)}%` : 'N/A'
        ].join(","));
      });
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Valkyra_Export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBatchPDF = () => {
    const doc = new jsPDF();
    const selectedData = filteredSessions.filter((s: any) => selectedIds.has(s.session_id));
    
    doc.setFontSize(16);
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.text("Valkyra Nucleus - Batch Incident Report", 14, 20);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Total Records Included: ${selectedData.length}`, 14, 34);
    
    doc.setDrawColor(200, 200, 200);
    doc.line(14, 38, 196, 38);

    let yOffset = 48;

    selectedData.forEach((s: any, idx: number) => {
      if (yOffset > 270) { doc.addPage(); yOffset = 20; }
      
      doc.setFontSize(11);
      doc.setTextColor(40, 40, 40);
      doc.setFont("helvetica", "bold");
      doc.text(`${idx + 1}. Session ID: ${s.session_id}`, 14, yOffset);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      doc.text(`Date Recorded: ${formatDate(s.created_at)}`, 14, yOffset + 6);
      doc.text(`Triage Level: ${s.triage_category || 'Unknown'}`, 14, yOffset + 12);
      
      yOffset += 20;

      const frames = s.frames && s.frames.length > 0 ? s.frames : [ s.wound_metrics || {} ];
      
      frames.forEach((frame: any, fIdx: number) => {
        if (yOffset > 270) { doc.addPage(); yOffset = 20; }
        
        const pwat = frame.pwat_score ?? s.pwat_score ?? 'N/A';
        const depth = frame.depth_severity ?? 'Unknown';
        const area = frame.area_pct != null ? `${Number(frame.area_pct).toFixed(1)}%` : 'N/A';
        
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(`Frame ${fIdx + 1}:`, 20, yOffset);
        
        doc.setFont("helvetica", "normal");
        doc.text(`PWAT: ${pwat}   |   Depth: ${depth}   |   Area: ${area}`, 38, yOffset);
        
        yOffset += 6;
      });

      yOffset += 6;
      doc.setDrawColor(230, 230, 230);
      doc.line(14, yOffset - 4, 196, yOffset - 4);
    });

    doc.save(`Valkyra_Batch_Report_${Date.now()}.pdf`);
  };

  return (
    <div className="pb-32">
      {/* 🛡️ TARGET 1: FILTER DECK */}
      <div id="spotlight-filters" style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center', background: 'var(--bg-card)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
        
        {/* Search */}
        <div style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input 
            className="form-input" 
            placeholder="Search Session ID..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', paddingLeft: '36px' }} 
          />
        </div>

        {/* Date Filters */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {['7D', '30D', '90D', 'ALL'].map(d => (
            <button 
              key={d} 
              className="btn" 
              style={{ fontSize: 11, padding: '6px 14px', ...(dateRange === d ? { borderColor: 'rgba(34,211,238,0.5)', color: '#22d3ee', background: 'rgba(34,211,238,0.05)' } : {}) }}
              onClick={() => setDateRange(d as any)}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Triage Filters */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', paddingLeft: 16, borderLeft: '1px solid var(--border)' }}>
          {['All', 'Red', 'Orange', 'Yellow', 'Green'].map(t => {
             const isSelected = triageFilter === t;
             return (
               <button 
                 key={t} 
                 className="btn" 
                 style={{ 
                   fontSize: 11, 
                   padding: '6px 14px', 
                   display: 'flex', 
                   alignItems: 'center', 
                   gap: 6, 
                   ...(isSelected ? { borderColor: 'rgba(34,211,238,0.5)', color: '#22d3ee', background: 'rgba(34,211,238,0.05)' } : {}) 
                 }}
                 onClick={() => setTriageFilter(t)}
               >
                 {t !== 'All' && <div className={`w-1.5 h-1.5 rounded-full ${t === 'Red' ? 'bg-red' : t === 'Orange' ? 'bg-amber' : t === 'Yellow' ? 'bg-yellow-400' : 'bg-green'}`} />}
                 {t}
               </button>
             );
          })}
        </div>
      </div>

      {/* 🛡️ TARGET 2: DATA LIST CARD */}
      <div id="spotlight-table" className="card" style={{ padding: 0, overflow: 'hidden' }}>
        
        {/* Table Header Area */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '16px 24px', borderBottom: '1px solid var(--border)', fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, background: 'rgba(0,0,0,0.2)' }}>
          <div style={{ width: 20, display: 'flex', justifyContent: 'center' }}>
            <input type="checkbox" className="accent-cyan-500 cursor-pointer" checked={selectedIds.size > 0 && selectedIds.size === filteredSessions.length} onChange={toggleAll} />
          </div>
          <div style={{ flex: 1 }}>Session Data</div>
          <div style={{ width: 100, textAlign: 'right' }}>Severity Index</div>
          <div style={{ width: 140, textAlign: 'right', display: 'none' }} className="sm:block">Metrics</div>
        </div>

        {/* Rows */}
        <motion.div variants={staggerContainer} initial="hidden" animate="show" style={{ display: 'flex', flexDirection: 'column' }}>
          {filteredSessions.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 12 }}>
              No records match current filters.
            </div>
          ) : (
            filteredSessions.map((s: any, i: number) => {
              const wm = s.wound_metrics || s.frames?.[0] || {};
              let displayPwat = wm.pwat_score ?? s.pwat_score ?? '—';
              
              if (displayPwat !== '—' && !isNaN(Number(displayPwat))) {
                  displayPwat = Number(displayPwat).toFixed(1);
              }

              const isSelected = selectedIds.has(s.session_id);

              return (
                <motion.div
                  variants={rowVariant}
                  key={s.session_id}
                  onClick={() => setActivePatientId(s.session_id)}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: 24, padding: '16px 24px', cursor: 'pointer', borderBottom: i === filteredSessions.length - 1 ? 'none' : '1px solid var(--border)', transition: 'background 0.2s',
                    ...(isSelected ? { background: 'rgba(34,211,238,0.05)' } : {})
                  }}
                  className="hover:bg-white/[0.02]"
                >
                  {/* Checkbox */}
                  <div style={{ width: 20, display: 'flex', justifyContent: 'center' }} onClick={(e) => toggleSelection(s.session_id, e)}>
                    <input type="checkbox" className="accent-cyan-500 cursor-pointer" checked={isSelected} readOnly />
                  </div>

                  {/* ID & Date */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text)' }}>
                        {s.session_id}
                      </span>
                      <span className={`triage-badge triage-${s.triage_category} uppercase`}>{s.triage_category}</span>
                    </div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
                      {formatDate(s.created_at)}
                    </div>
                  </div>

                  {/* PWAT Score */}
                  <div style={{ width: 100, display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ padding: '4px 12px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', borderRadius: 4 }}>
                      <span style={{ fontWeight: 700, fontFamily: 'var(--mono)', fontSize: 16, color: pwatColor(displayPwat) }}>
                        {displayPwat}
                      </span>
                    </div>
                  </div>

                  {/* Depth / Area */}
                  <div style={{ width: 140, display: 'none', flexDirection: 'column', alignItems: 'flex-end', fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)' }} className="sm:flex">
                    <div style={{ color: 'var(--text2)' }}>{wm.depth_severity || 'Unknown'}</div>
                    <div style={{ marginTop: 4 }}>{wm.area_pct != null ? `${Number(wm.area_pct).toFixed(1)}% Area` : '—'}</div>
                  </div>
                </motion.div>
              );
            })
          )}
        </motion.div>
      </div>

      {/* Tactical Floating Export Terminal */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-10 left-1/2 transform -translate-x-1/2 z-50 flex items-center p-1 rounded-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(145deg, rgba(15,23,42,0.95) 0%, rgba(2,6,23,0.98) 100%)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5), 0 0 30px rgba(34,211,238,0.15), inset 0 0 0 1px rgba(255,255,255,0.1)',
              backdropFilter: 'blur(20px)'
            }}
          >
            <div className="absolute inset-0 pointer-events-none rounded-2xl overflow-hidden">
              <motion.div 
                className="w-[200%] h-full bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent opacity-60"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              />
            </div>
            <div className="relative z-10 flex items-center gap-6 px-6 py-4">
              <div className="flex items-center gap-4">
                <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/40">
                  <span className="text-cyan-400 font-bold font-mono text-lg">{selectedIds.size}</span>
                  <motion.div 
                    className="absolute inset-0 rounded-full border border-cyan-400"
                    animate={{ scale: [1, 1.6], opacity: [0.8, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-mono text-cyan-400 tracking-[0.2em] uppercase">Data Selected</span>
                  <span className="text-xs font-mono text-white tracking-wider">READY FOR EXPORT</span>
                </div>
              </div>
              <div className="w-[1px] h-10 bg-gradient-to-b from-transparent via-white/20 to-transparent" />
              <div className="flex gap-3">
                <motion.button 
                  whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.1)' }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleBatchPDF}
                  className="group relative px-6 py-2.5 bg-white/5 border border-white/10 text-white text-[11px] font-mono tracking-widest rounded-lg transition-all overflow-hidden flex items-center gap-2"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  <svg className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                  BATCH PDF
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(34,211,238,0.4)' }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleExportCSV}
                  className="group relative px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 border border-cyan-400/50 text-white text-[11px] font-mono tracking-widest uppercase rounded-lg transition-all overflow-hidden flex items-center gap-2"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  <svg className="w-4 h-4 text-cyan-200 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  GENERATE CSV
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🛡️ INJECT THE TOUR ENGINE AND AUTO-CLOSE MODAL WHEN DONE */}
      <VoiceTour 
        storageKey="valkyra-tour-reports" 
        steps={PAGE_STEPS} 
        onTourEnd={() => setActivePatientId(null)} 
      />
    </div>
  );
}