import { Responder, Device } from '@/types';

export const RESPONDERS: Responder[] = [
  { id: 'torres', name: 'SGT. M. Torres', rank: 'SGT', unit: 'Unit 4', device_id: 'xreal-07', status: 'LIVE',    initials: 'MT', valkyra_usage_pct: 92, avg_response_min: 3.2, resolution_rate_pct: 96, incidents_handled: 27 },
  { id: 'chen',   name: 'CPL. A. Chen',   rank: 'CPL', unit: 'Unit 2', device_id: 'xreal-14', status: 'LIVE',    initials: 'AC', valkyra_usage_pct: 88, avg_response_min: 3.8, resolution_rate_pct: 94, incidents_handled: 22 },
  { id: 'reyes',  name: 'PFC. D. Reyes',  rank: 'PFC', unit: 'Unit 1', device_id: 'xreal-03', status: 'ONLINE',  initials: 'DR', valkyra_usage_pct: 81, avg_response_min: 4.5, resolution_rate_pct: 90, incidents_handled: 18 },
  { id: 'park',   name: 'SGT. L. Park',   rank: 'SGT', unit: 'Unit 6', device_id: 'xreal-22', status: 'IDLE',    initials: 'LP', valkyra_usage_pct: 64, avg_response_min: 5.1, resolution_rate_pct: 87, incidents_handled: 11 },
  { id: 'james',  name: 'CPL. R. James',  rank: 'CPL', unit: 'Unit 3', device_id: 'xreal-11', status: 'OFFLINE', initials: 'RJ', valkyra_usage_pct: 40, avg_response_min: 6.7, resolution_rate_pct: 78, incidents_handled: 6 },
];

export const DEVICES: Device[] = [
  { id: 'xreal-07', model: 'XREAL Air 2 Ultra', serial: '#07', unit: 'Unit 4', status: 'LIVE',    firmware: 'v2.4.1', last_sync: '30s ago', battery_pct: 94, sync_failed: false },
  { id: 'xreal-14', model: 'XREAL One Pro',     serial: '#14', unit: 'Unit 2', status: 'LIVE',    firmware: 'v2.4.1', last_sync: '1m ago',  battery_pct: 87, sync_failed: false },
  { id: 'xreal-03', model: 'XREAL Air 2 Ultra', serial: '#03', unit: 'Unit 1', status: 'ONLINE',  firmware: 'v2.3.8', last_sync: '2m ago',  battery_pct: 76, sync_failed: false },
  { id: 'xreal-22', model: 'XREAL One Pro',     serial: '#22', unit: 'Unit 6', status: 'IDLE',    firmware: 'v2.3.8', last_sync: '18m ago', battery_pct: 41, sync_failed: true  },
  { id: 'xreal-11', model: 'XREAL Air 2 Ultra', serial: '#11', unit: 'Unit 3', status: 'OFFLINE', firmware: 'v2.2.0', last_sync: '3h ago',  battery_pct: 12, sync_failed: false },
];

export const INCIDENT_TYPES = [
  { value: 'GSW',      label: 'GSW — Gunshot Wound' },
  { value: 'STAB',     label: 'STAB — Penetrating Trauma' },
  { value: 'BLUNT',    label: 'BLUNT — Blunt Force Trauma' },
  { value: 'BURN',     label: 'BURN — Thermal Injury' },
  { value: 'FRACTURE', label: 'FRACTURE — Skeletal Injury' },
  { value: 'CRUSH',    label: 'CRUSH — Crush Injury' },
];
