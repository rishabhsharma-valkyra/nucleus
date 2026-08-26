'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { HoverTooltip } from '@/components/ui/MetricCard';
import { DEVICES, RESPONDERS } from '@/config/fleet';
import { useNucleusStore } from '@/store/useNucleusStore';
import { usePermission } from '@/hooks';
import { PERMISSIONS } from '@/lib/rbac';
import { getDeviceAlerts, DeviceAlertSeverity } from '@/lib/deviceAlerts';
import { getResponderForDevice, getDeviceForResponder } from '@/lib/deviceAssignments';

// 🛡️ IMPORTS FOR THE PERSONALIZED VOICE TOUR
import { useSession } from 'next-auth/react';
import VoiceTour, { TourStep } from '@/components/VoiceTour';

type FilterType = 'all' | 'LIVE' | 'ONLINE' | 'IDLE' | 'OFFLINE';

const batteryColor = (pct: number) => pct >= 60 ? 'var(--green)' : pct >= 30 ? 'var(--amber)' : 'var(--red)';
const severityBadgeClass = (s: DeviceAlertSeverity) => s === 'critical' ? 'badge-red' : 'badge-warn';

export default function DevicesPage() {
  const [filter, setFilter] = useState<FilterType>('all');
  const canManage = usePermission(PERMISSIONS.DEVICES_MANAGE);
  const assignments = useNucleusStore((s) => s.deviceAssignments);
  const assignDevice = useNucleusStore((s) => s.assignDevice);
  const unassignDevice = useNucleusStore((s) => s.unassignDevice);
  const addToast = useNucleusStore((s) => s.addToast);

  const stats = { live: DEVICES.filter(d=>d.status==='LIVE').length, online: DEVICES.filter(d=>d.status==='ONLINE').length, idle: DEVICES.filter(d=>d.status==='IDLE').length, offline: DEVICES.filter(d=>d.status==='OFFLINE').length };
  const totalOnline = stats.live + stats.online;
  const total = DEVICES.length;

  const filtered = filter === 'all' ? DEVICES : DEVICES.filter(d => d.status === filter);
  const alerts = getDeviceAlerts(DEVICES);

  const dotClass = (s: string) => s === 'LIVE' || s === 'ONLINE' ? 'd-online' : s === 'IDLE' ? 'd-idle' : 'd-offline';

  const onlinePct = Math.round((totalOnline / total) * 100);
  const r = 40, circ = 2 * Math.PI * r;

  const handleAssignChange = (deviceId: string, responderId: string) => {
    if (!responderId) {
      unassignDevice(deviceId);
      addToast({ type: 'success', message: `Device ${deviceId} unassigned.` });
      return;
    }
    const responder = RESPONDERS.find(resp => resp.id === responderId);
    assignDevice(deviceId, responderId);
    addToast({ type: 'success', message: `Device ${deviceId} assigned to ${responder?.name ?? responderId}.` });
  };

  // 🛡️ EXTRACT USER NAME FOR PERSONALIZED GREETING
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(' ')[0] || 'Commander';

  // 🛡️ DYNAMIC SIMULATION STEPS
  const PAGE_STEPS: TourStep[] = [
    {
      targetId: 'spotlight-fleet-health',
      tag: 'SYSTEM DIAGNOSTICS',
      title: 'Fleet Health Overview',
      script: `Welcome to Device Management, ${firstName}. This diagnostic panel provides real-time connectivity status across your entire AR hardware fleet.`
    },
    {
      targetId: 'spotlight-fleet-alerts',
      tag: 'AUTOMATED OVERSIGHT',
      title: 'Active Hardware Alerts',
      script: 'Any critical hardware failures, battery warnings, or synchronization drops will be immediately flagged here for your attention.'
    },
    {
      targetId: 'spotlight-device-table',
      tag: 'INVENTORY CONTROL',
      title: 'Device Assignment Registry',
      script: 'This registry tracks individual unit telemetry. Administrators can use this interface to securely assign hardware to specific field responders. Briefing complete.'
    }
  ];

  return (
    <div className="pb-24">
      {/* 🛡️ TARGET 1: Fleet Health Stats */}
      <div id="spotlight-fleet-health" style={{ display:'flex', gap:12, marginBottom:20 }}>
        <HoverTooltip className="flex-1" tooltip="Percentage of the AR device fleet currently online (LIVE or ONLINE), out of all registered hardware.">
          <div style={{ background:'var(--glass)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'16px 18px', display:'flex', alignItems:'center', gap:20, height:'100%' }}>
            <svg width={100} height={100} viewBox="0 0 100 100">
              <circle cx={50} cy={50} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} />
              <circle cx={50} cy={50} r={r} fill="none" stroke="var(--green)" strokeWidth={10}
                strokeDasharray={circ} strokeDashoffset={circ * (1 - onlinePct/100)}
                strokeLinecap="round" transform="rotate(-90 50 50)" style={{ filter:'drop-shadow(0 0 6px var(--green))' }} />
              <text x={50} y={50} textAnchor="middle" dominantBaseline="middle" fill="#86efac" fontSize={18} fontWeight={700} fontFamily="Syne">{totalOnline}/{total}</text>
            </svg>
            <div>
              <div style={{ fontSize:9, color:'var(--text3)', fontFamily:'var(--mono)', letterSpacing:2, marginBottom:8, textTransform:'uppercase' }}>Fleet Health</div>
              <div style={{ fontSize:28, fontWeight:800, color:'var(--green)', letterSpacing:-1 }}>{onlinePct}%</div>
              <div style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)' }}>Online · {totalOnline} of {total} devices</div>
            </div>
          </div>
        </HoverTooltip>
        {[
          {label:'LIVE',value:stats.live,color:'var(--green)',tooltip:'Devices actively streaming wound telemetry right now.'},
          {label:'ONLINE',value:stats.online,color:'var(--cyan)',tooltip:'Devices connected and ready, but not currently in an active session.'},
          {label:'IDLE',value:stats.idle,color:'var(--amber)',tooltip:'Devices powered on but inactive for an extended period.'},
          {label:'OFFLINE',value:stats.offline,color:'var(--text3)',tooltip:'Devices not currently connected to the network.'},
        ].map(s => (
          <HoverTooltip key={s.label} className="flex-1" tooltip={s.tooltip}>
            <div style={{ background:'var(--glass)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'14px 18px', textAlign:'center' }}>
              <div style={{ fontSize:9, color:'var(--text3)', fontFamily:'var(--mono)', letterSpacing:2, marginBottom:6, textTransform:'uppercase' }}>{s.label}</div>
              <div style={{ fontSize:28, fontWeight:800, color:s.color, letterSpacing:-1 }}>{s.value}</div>
            </div>
          </HoverTooltip>
        ))}
      </div>

      {/* 🛡️ TARGET 2: Fleet Alerts */}
      <div id="spotlight-fleet-alerts" className="card" style={{ marginBottom:20 }}>
        <div className="card-header">
          <span className="card-title">Fleet Alerts</span>
          {alerts.length > 0
            ? <span className="badge badge-red">{alerts.length} ACTIVE</span>
            : <span className="badge badge-live">ALL CLEAR</span>}
        </div>
        {alerts.length === 0 ? (
          <div style={{ padding:'16px 18px', fontSize:12, color:'var(--text3)', fontFamily:'var(--mono)' }}>✓ All systems nominal — no offline, low-battery, or sync-failure devices.</div>
        ) : (
          <div style={{ padding:'6px 0' }}>
            {alerts.map((a, i) => (
              <div key={`${a.deviceId}-${a.type}-${i}`} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 18px', borderBottom: i < alerts.length-1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <span className={`badge ${severityBadgeClass(a.severity)}`}>{a.severity === 'critical' ? 'CRITICAL' : 'WARNING'}</span>
                <span style={{ fontSize:12, color:'var(--text2)' }}>{a.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:14 }}>
        {(['all','LIVE','ONLINE','IDLE','OFFLINE'] as const).map(f => (
          <button key={f} className="btn" style={{ fontSize:11, padding:'5px 12px', ...(filter===f ? {borderColor:'rgba(59,130,246,0.5)',color:'#93c5fd'} : {}) }} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f}
          </button>
        ))}
      </div>

      {/* 🛡️ TARGET 3: Device Registry Table */}
      <div id="spotlight-device-table" className="card">
        <div className="card-header">
          <span className="card-title">AR Device Fleet · XREAL Systems</span>
          <span style={{ fontSize:10, fontFamily:'var(--mono)', color:'var(--text3)' }}>{filtered.length} devices</span>
        </div>
        <div style={{ overflowX:'auto' }}>
        <table className="data-table">
          <thead><tr><th>Device</th><th>Model</th><th>Firmware</th><th>Battery</th><th>Assigned To</th><th>Unit</th><th>Status</th><th>Last Sync</th></tr></thead>
          <tbody>
            {filtered.map(d => {
              const assignedResponder = getResponderForDevice(d.id, assignments);
              return (
              <tr key={d.id}>
                <td style={{ fontFamily:'var(--mono)', fontSize:12, fontWeight:700, color:'var(--text)' }}>
                  {d.serial}
                  {d.sync_failed && <span className="badge badge-warn" style={{ marginLeft:8 }}>SYNC FAILED</span>}
                </td>
                <td style={{ color:'var(--text)' }}>{d.model}</td>
                <td style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text3)' }}>{d.firmware}</td>
                <td>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:44, height:5, borderRadius:3, background:'rgba(255,255,255,0.06)', overflow:'hidden' }}>
                      <div style={{ width:`${d.battery_pct}%`, height:'100%', borderRadius:3, background:batteryColor(d.battery_pct), position:'relative', overflow:'hidden' }}>
                        {(d.status === 'LIVE' || d.status === 'ONLINE') && (
                          <motion.div
                            className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                            animate={{ x: ['-100%', '300%'] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                          />
                        )}
                      </div>
                    </div>
                    <span style={{ fontSize:11, fontFamily:'var(--mono)', fontWeight:600, color:batteryColor(d.battery_pct) }}>{d.battery_pct}%</span>
                  </div>
                </td>
                <td style={{ fontFamily:'var(--mono)', fontSize:11 }}>
                  {canManage ? (
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <select
                        className="form-select"
                        style={{ padding:'4px 8px', fontSize:11, width:170 }}
                        value={assignedResponder?.id ?? ''}
                        onChange={(e) => handleAssignChange(d.id, e.target.value)}
                      >
                        <option value="">— Unassigned —</option>
                        {RESPONDERS.map(resp => {
                          const otherDevice = getDeviceForResponder(resp.id, assignments);
                          const hint = otherDevice && otherDevice.id !== d.id ? ` (currently on ${otherDevice.serial})` : '';
                          return <option key={resp.id} value={resp.id}>{resp.name}{hint}</option>;
                        })}
                      </select>
                      {assignedResponder && (
                        <button className="btn" style={{ fontSize:10, padding:'4px 8px' }} onClick={() => handleAssignChange(d.id, '')}>Unassign</button>
                      )}
                    </div>
                  ) : (
                    assignedResponder?.name ?? <span style={{ color:'var(--text3)' }}>Unassigned</span>
                  )}
                </td>
                <td style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text3)' }}>{d.unit}</td>
                <td>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ position:'relative', width:8, height:8 }}>
                      {d.status === 'LIVE' && (
                        <motion.div
                          style={{ position:'absolute', inset:0, borderRadius:'50%', border:'1px solid var(--green)' }}
                          animate={{ boxShadow: ['0 0 0 0 rgba(74,222,128,0.5)', '0 0 0 6px rgba(74,222,128,0)'] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                        />
                      )}
                      <div className={`d-status ${dotClass(d.status)}`} style={{ position:'absolute', inset:0 }} />
                    </div>
                    <span style={{ fontSize:10, fontFamily:'var(--mono)', color: d.status==='LIVE'||d.status==='ONLINE' ? 'var(--green)' : d.status==='IDLE' ? 'var(--amber)' : 'var(--text3)' }}>{d.status}</span>
                  </div>
                </td>
                <td style={{ fontFamily:'var(--mono)', fontSize:11, color:d.status==='LIVE'?'var(--green)':'var(--text3)' }}>{d.last_sync}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* 🛡️ INJECT THE TOUR ENGINE */}
      <VoiceTour storageKey="valkyra-tour-devices" steps={PAGE_STEPS} />
    </div>
  );
}