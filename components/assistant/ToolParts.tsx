'use client';

// How the assistant's tool calls appear in the chat panel:
//  - an activity line per call ("Searching scans…" -> "Searched scans · 6 found")
//  - the scans a tool returned, as clickable cards (open the scan)
//  - "Open …" buttons from show_in_app
import { motion } from 'framer-motion';
import { NavAction, ScanCard, TOOL_LABELS } from '@/lib/assistant/types';

const TRIAGE_COLOR: Record<string, string> = {
  Red: '#f87171', Orange: '#fb923c', Yellow: '#facc15', Green: '#4ade80', Unclassified: '#64748b',
};

export const isToolPart = (p: any) => typeof p?.type === 'string' && (p.type.startsWith('tool-') || p.type === 'dynamic-tool');
const toolName = (p: any) => (p.type === 'dynamic-tool' ? p.toolName : String(p.type).slice(5));

function resultNote(name: string, output: any): string | null {
  if (!output || typeof output !== 'object') return null;
  if (output.error) return String(output.error);
  if (name === 'list_scans') return `${output.total_matching} found`;
  if (name === 'get_patient' && output.candidates) return `${output.candidates.length} possible matches`;
  if (name === 'get_live_headsets') return `${(output.headsets ?? []).filter((h: any) => h.live).length} live`;
  return null;
}

export function ToolActivity({ parts }: { parts: any[] }) {
  if (!parts.length) return null;
  return (
    <div className="flex flex-col gap-1 mb-2">
      {parts.map((p) => {
        const name = toolName(p);
        const labels = TOOL_LABELS[name] ?? { active: 'Working', done: 'Done' };
        const running = p.state === 'input-streaming' || p.state === 'input-available';
        const failed = p.state === 'output-error' || (p.state === 'output-available' && p.output?.error);
        const note = p.state === 'output-error' ? 'failed' : resultNote(name, p.output);
        return (
          <div key={p.toolCallId} className="flex items-center gap-2 font-mono text-[10px] tracking-wide">
            {running ? (
              <span className="inline-block w-2.5 h-2.5 rounded-full border border-cyan-400 border-t-transparent animate-spin" />
            ) : (
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${failed ? 'bg-amber-400' : 'bg-cyan-500'}`} />
            )}
            <span className={running ? 'text-cyan-300 animate-pulse' : failed ? 'text-amber-300/90' : 'text-slate-400'}>
              {running ? `${labels.active}…` : labels.done}
              {note ? <span className="text-slate-500"> · {note}</span> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Scans and actions from finished tool calls, de-duplicated across calls
export function collectResults(parts: any[]): { scans: ScanCard[]; actions: NavAction[] } {
  const scans = new Map<string, ScanCard>();
  const actions: NavAction[] = [];
  parts.forEach((p) => {
    if (p.state !== 'output-available' || !p.output || p.output.error) return;
    const o = p.output;
    (o.scans ?? []).forEach((s: ScanCard) => scans.set(s.session_id, s));
    if (o.scan?.session_id) scans.set(o.scan.session_id, o.scan);
    if (o.action === 'navigate' || o.action === 'open_scan') actions.push(o);
  });
  return { scans: Array.from(scans.values()), actions };
}

const SCAN_CARDS_SHOWN = 6;

export function ToolResults({
  parts, onOpenScan, onNavigate,
}: { parts: any[]; onOpenScan: (sessionId: string) => void; onNavigate: (href: string) => void }) {
  const { scans, actions } = collectResults(parts);
  if (!scans.length && !actions.length) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-2 mt-3 w-full">
      {scans.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {scans.slice(0, SCAN_CARDS_SHOWN).map((s) => {
            const color = TRIAGE_COLOR[s.triage] ?? TRIAGE_COLOR.Unclassified;
            return (
              <button
                key={s.session_id}
                type="button"
                onClick={() => onOpenScan(s.session_id)}
                title={`Open scan ${s.session_id}`}
                className="group/card text-left flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700/50 hover:border-cyan-500/50 hover:bg-cyan-950/30 transition-all"
                style={{ borderLeft: `3px solid ${color}` }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-slate-100 font-semibold truncate">{s.patient}</span>
                    <span className="font-mono text-[9px] px-1.5 py-px rounded" style={{ color, background: `${color}1a`, border: `1px solid ${color}40` }}>
                      {s.triage}
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-slate-400 truncate mt-0.5">
                    {s.regions.length ? s.regions.join(', ') : 'Region pending'} · {s.age}
                    {s.awaiting_review > 0 ? ` · ${s.awaiting_review} to review` : ''}
                  </div>
                </div>
                <div className="flex flex-col items-end flex-shrink-0">
                  <span className="font-mono text-[9px] text-slate-500 uppercase tracking-wider">PWAT</span>
                  <span className="font-mono text-[13px] font-bold" style={{ color }}>{s.max_pwat ?? '—'}</span>
                </div>
                <svg className="w-3.5 h-3.5 text-slate-600 group-hover/card:text-cyan-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            );
          })}
          {scans.length > SCAN_CARDS_SHOWN && (
            <span className="font-mono text-[10px] text-slate-500 px-1">+{scans.length - SCAN_CARDS_SHOWN} more — ask to narrow down</span>
          )}
        </div>
      )}
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={() => (a.action === 'open_scan' ? onOpenScan(a.session_id) : onNavigate(a.href))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-cyan-500/10 border border-cyan-500/40 text-cyan-200 font-mono text-[11px] hover:bg-cyan-500/20 hover:border-cyan-400 transition-all"
            >
              {a.label}
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}
