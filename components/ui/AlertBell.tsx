'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNucleusStore } from '@/store/useNucleusStore';

// Session-only history of critical-case alerts CriticalAlertWatcher has
// fired, so a toast that already auto-dismissed can still be reviewed.
export default function AlertBell() {
  const [open, setOpen] = useState(false);
  const alerts = useNucleusStore((s) => s.criticalAlerts);
  const clearCriticalAlerts = useNucleusStore((s) => s.clearCriticalAlerts);
  const setActivePatientId = useNucleusStore((s) => s.setActivePatientId);

  return (
    <div className="relative">
      <button className="btn flex items-center gap-2 relative" onClick={() => setOpen((o) => !o)} title="Critical alerts">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {alerts.length > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center"
            style={{ fontSize: 9, fontWeight: 700 }}
          >
            {alerts.length > 9 ? '9+' : alerts.length}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-[140]" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 w-80 z-[150] rounded-lg overflow-hidden"
              style={{ background: 'rgba(6,12,24,0.98)', border: '1px solid rgba(248,113,113,0.25)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}
            >
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--red)', textTransform: 'uppercase', letterSpacing: 2 }}>Critical Alerts</span>
                {alerts.length > 0 && (
                  <button onClick={clearCriticalAlerts} style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)' }} className="hover:text-white transition-colors">
                    Clear all
                  </button>
                )}
              </div>
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {alerts.length === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
                    No alerts yet this session.
                  </div>
                ) : (
                  [...alerts].reverse().map((a) => (
                    <button
                      key={a.id}
                      onClick={() => { setActivePatientId(a.sessionId); setOpen(false); }}
                      className="w-full text-left hover:bg-red-950/10 transition-colors"
                      style={{ display: 'block', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    >
                      <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text)' }}>{a.message}</div>
                      <div style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text3)', marginTop: 3 }}>{a.time}</div>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
