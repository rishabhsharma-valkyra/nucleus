'use client';
import { useSession, signOut } from 'next-auth/react';
import { useNucleusStore } from '@/store/useNucleusStore';
import { useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { checkHealth } from '@/lib/api';
import { usePermission, useRole } from '@/hooks';
import { PERMISSIONS, ROLE_LABELS } from '@/lib/rbac';

const sectionReveal: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.35, ease: 'easeOut' } }),
};

const Switch = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    style={{
      width: 38, height: 20, borderRadius: 10, padding: 2, display: 'flex', flexShrink: 0,
      background: checked ? 'rgba(34,211,238,0.35)' : 'rgba(255,255,255,0.08)',
      border: `1px solid ${checked ? 'rgba(34,211,238,0.6)' : 'var(--border)'}`,
      cursor: 'pointer', transition: 'background 0.2s, border-color 0.2s',
    }}
  >
    <motion.div
      animate={{ x: checked ? 18 : 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      style={{ width: 14, height: 14, borderRadius: '50%', background: checked ? 'var(--cyan)' : 'var(--text3)' }}
    />
  </button>
);

export default function SettingsPage() {
  const { data: session } = useSession();
  const {
    refreshInterval, setRefreshInterval, sessionsPerPage, setSessionsPerPage,
    alertSoundEnabled, setAlertSoundEnabled,
    browserNotifyEnabled, setBrowserNotifyEnabled,
    voiceReplyEnabled, setVoiceReplyEnabled,
  } = useNucleusStore();
  const qc = useQueryClient();
  const [healthStatus, setHealthStatus] = useState<null | 'ok' | 'error'>('ok');
  const [testing, setTesting] = useState(false);
  const canManageSettings = usePermission(PERMISSIONS.SETTINGS_MANAGE);
  const role = useRole();

  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default');
  useEffect(() => {
    setNotifPermission(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  }, []);

  const requestNotifications = async () => {
    if (typeof Notification === 'undefined') return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    setBrowserNotifyEnabled(perm === 'granted');
  };

  const testConnection = async () => {
    setTesting(true);
    setHealthStatus(null);
    try { await checkHealth(); setHealthStatus('ok'); }
    catch  { setHealthStatus('error'); }
    finally { setTesting(false); }
  };

  const Section = ({ title, children, i = 0 }: any) => (
    <motion.div custom={i} initial="hidden" animate="show" variants={sectionReveal} style={{ marginBottom:24 }}>
      <div style={{ fontSize:9, color:'var(--text3)', fontFamily:'var(--mono)', letterSpacing:3, textTransform:'uppercase', marginBottom:12, paddingBottom:8, borderBottom:'1px solid var(--border)' }}>{title}</div>
      {children}
    </motion.div>
  );

  const Row = ({ label, sub, children }: any) => (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
      <div><div style={{ fontSize:12, fontWeight:500, color:'var(--text)' }}>{label}</div>{sub && <div style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)', marginTop:2 }}>{sub}</div>}</div>
      {children}
    </div>
  );

  return (
    <div style={{ maxWidth:640 }}>
      <Section title="API Configuration" i={0}>
        <Row label="Backend Endpoint" sub="GCP Cloud Run · wound_ai dataset">
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:10, fontFamily:'var(--mono)', color:'var(--text3)' }}>
              {process.env.NEXT_PUBLIC_API_BASE?.replace('https://','')}
            </span>
            <button className="btn" style={{ fontSize:11, padding:'4px 12px', display:'flex', alignItems:'center', gap:6 }} onClick={testConnection} disabled={testing}>
              {testing && (
                <motion.span
                  style={{ width:10, height:10, borderRadius:'50%', border:'2px solid rgba(255,255,255,0.25)', borderTopColor:'var(--cyan)', display:'inline-block' }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                />
              )}
              {testing ? 'Testing' : 'Test'}
            </button>
            <AnimatePresence mode="wait">
              {healthStatus === 'ok' && (
                <motion.span key="ok" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} style={{ fontSize:11, color:'var(--green)', fontFamily:'var(--mono)', display:'flex', alignItems:'center', gap:5 }}>
                  <motion.span
                    style={{ width:6, height:6, borderRadius:'50%', background:'var(--green)', display:'inline-block' }}
                    animate={{ boxShadow: ['0 0 0 0 rgba(74,222,128,0.5)', '0 0 0 5px rgba(74,222,128,0)'] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                  />
                  Online
                </motion.span>
              )}
              {healthStatus === 'error' && (
                <motion.span key="error" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} style={{ fontSize:11, color:'var(--red)', fontFamily:'var(--mono)' }}>
                  ✕ Offline
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </Row>
      </Section>

      <Section title="Display Preferences" i={1}>
        <Row label="Auto-Refresh Interval" sub="How often the dashboard polls the API">
          <select className="form-select" style={{ width:160, padding:'6px 10px', fontSize:12 }}
            value={refreshInterval} onChange={e => setRefreshInterval(Number(e.target.value))}>
            <option value={0}>Off</option>
            <option value={30000}>30 seconds</option>
            <option value={60000}>60 seconds</option>
            <option value={300000}>5 minutes</option>
          </select>
        </Row>
        <Row label="Sessions Per Page" sub="Max sessions loaded per API call">
          <select className="form-select" style={{ width:100, padding:'6px 10px', fontSize:12 }}
            value={sessionsPerPage} onChange={e => setSessionsPerPage(Number(e.target.value))}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </Row>
      </Section>

      <Section title="Alerts & Voice" i={2}>
        <Row label="Alert Sound" sub="Play a chime when a new Red-triage case appears">
          <Switch checked={alertSoundEnabled} onChange={setAlertSoundEnabled} />
        </Row>
        <Row label="Browser Notifications" sub="OS-level notification for new Red-triage cases, even in another tab">
          {notifPermission === 'unsupported' ? (
            <span style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)' }}>Not supported</span>
          ) : notifPermission === 'denied' ? (
            <span style={{ fontSize:11, color:'var(--red)', fontFamily:'var(--mono)' }}>Blocked in browser</span>
          ) : notifPermission === 'granted' ? (
            <Switch checked={browserNotifyEnabled} onChange={setBrowserNotifyEnabled} />
          ) : (
            <button className="btn" style={{ fontSize:11, padding:'4px 12px' }} onClick={requestNotifications}>Enable</button>
          )}
        </Row>
        <Row label="Valkyra Sentinel Voice Replies" sub="Speak the assistant's replies aloud (text-to-speech)">
          <Switch checked={voiceReplyEnabled} onChange={setVoiceReplyEnabled} />
        </Row>
      </Section>

      <Section title="Account" i={3}>
        <Row label={session?.user?.name ?? 'Signed In'} sub={session?.user?.email ?? ''}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {role && (
              <span style={{ fontSize:10, fontFamily:'var(--mono)', color:'var(--text3)', border:'1px solid var(--border)', borderRadius:4, padding:'3px 8px', textTransform:'uppercase', letterSpacing:1 }}>
                {ROLE_LABELS[role]}
              </span>
            )}
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="btn btn-danger" style={{ fontSize:11, padding:'5px 14px' }} onClick={() => signOut({ callbackUrl:'/auth/signin' })}>
              Sign Out
            </motion.button>
          </div>
        </Row>
      </Section>

      <Section title="System Info" i={4}>
        {[
          ['Backend',   'GCP Cloud Run'],
          ['Dataset',   'wound_ai.sessions'],
          ['Vision Model',  'Gemini Vision v3.1'],
          ['App Build', 'Valkyra Nucleus 1.0'],
        ].map(([k, v]) => (
          <Row key={k} label={k}>
            <span style={{ fontSize:11, fontFamily:'var(--mono)', color:'var(--text3)' }}>{v}</span>
          </Row>
        ))}
      </Section>

      {canManageSettings ? (
        <Section title="Danger Zone" i={5}>
          <Row label="Clear Query Cache" sub="Forces a fresh fetch of all data">
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="btn btn-danger" style={{ fontSize:11, padding:'5px 14px' }} onClick={() => qc.clear()}>
              Clear Cache
            </motion.button>
          </Row>
          <Row label="Reset App Settings" sub="Restores default refresh interval and page size">
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="btn btn-danger" style={{ fontSize:11, padding:'5px 14px' }} onClick={() => { setRefreshInterval(60000); setSessionsPerPage(20); }}>
              Reset
            </motion.button>
          </Row>
        </Section>
      ) : (
        <Section title="Danger Zone" i={5}>
          <div style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)', padding:'8px 0' }}>
            Restricted to Admins.
          </div>
        </Section>
      )}
    </div>
  );
}
