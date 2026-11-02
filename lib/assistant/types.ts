// Shared by the assistant's tools (server) and the chat panel (client).

export const NAV_PAGES = {
  overview: { href: '/overview', label: 'Overview' },
  incidents: { href: '/incidents', label: 'Patient Incidents' },
  analytics: { href: '/analytics', label: 'Analytics' },
  heatmaps: { href: '/heatmaps', label: 'Heatmaps' },
  responders: { href: '/responders', label: 'Responders' },
  devices: { href: '/devices', label: 'AR Devices' },
  escalations: { href: '/escalations', label: 'Escalation Frequency' },
  mortality: { href: '/mortality', label: 'Mortality Rate' },
  ai_performance: { href: '/ai-performance', label: 'Model Performance' },
  training_intel: { href: '/training-intel', label: 'Training Intelligence' },
  settings: { href: '/settings', label: 'Settings' },
} as const;

export type NavPage = keyof typeof NAV_PAGES;

export interface ScanCard {
  session_id: string;
  patient: string;
  patient_id: string | null;
  recorded_at: string;
  age: string;
  triage: string;
  max_pwat: number | null;
  regions: string[];
  injuries: number;
  awaiting_review: number;
  ai_pending: number;
  location: { lat: number; lng: number } | null;
  responder: string | null;
}

export type NavAction =
  | { action: 'navigate'; href: string; label: string }
  | { action: 'open_scan'; session_id: string; label: string };

// What each tool is doing, for the chat panel's activity line
export const TOOL_LABELS: Record<string, { active: string; done: string }> = {
  get_overview: { active: 'Reading the live overview', done: 'Read the live overview' },
  list_scans: { active: 'Searching scans', done: 'Searched scans' },
  get_scan: { active: 'Opening the scan', done: 'Opened the scan' },
  get_patient: { active: 'Looking up the patient', done: 'Looked up the patient' },
  get_live_headsets: { active: 'Checking live headsets', done: 'Checked live headsets' },
  show_in_app: { active: 'Preparing a link', done: 'Link ready' },
};
