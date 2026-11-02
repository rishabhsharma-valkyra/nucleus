import { streamText, convertToModelMessages, isStepCount, UIMessage } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { getServerSession } from 'next-auth';
import { NextRequest } from 'next/server';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS, ROLE_LABELS } from '@/lib/rbac';
import { getEffectiveRole } from '@/lib/serverRole';
import { createAssistantTools } from '@/lib/assistant/tools';
import { forwardToBackend, Actor } from '@/lib/backend';
import { NAV_PAGES } from '@/lib/assistant/types';

export const maxDuration = 60;

// Gemini on Vertex AI through the Valkyra AI Gateway (Cloud Run) — the same
// path the headsets use. Nucleus holds no Google credential: the gateway
// accepts Nucleus's own Hospital API key (INTERNAL_API_KEY here) and calls
// Vertex with its service account, falling back to the next model when one
// is rate-limited.
const AI_GATEWAY_URL = (process.env.AI_GATEWAY_URL || 'https://wound-ai-gateway-486571584866.us-central1.run.app').replace(/\/$/, '');
const CHAT_MODEL = process.env.CHAT_MODEL || 'gemini-2.5-flash';
const gemini = createGoogleGenerativeAI({
  baseURL: `${AI_GATEWAY_URL}/gemini/v1beta`,
  apiKey: process.env.INTERNAL_API_KEY ?? '',
});

// Messages of context sent to the model per turn (tool results included)
const HISTORY_MESSAGES = 16;
// Tool calls the model may chain in one answer (e.g. search -> open scan)
const MAX_STEPS = 6;

// ── Rate limiting ──────────────────────────────────────────────────────
// In-memory, per-instance sliding window: stops one runaway client (a tab
// stuck retrying, a script) from running up model cost. It does not
// coordinate across serverless instances; a hard limit needs a shared store.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 15;
const requestLog = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  timestamps.push(now);
  requestLog.set(key, timestamps);
  return timestamps.length > RATE_LIMIT_MAX;
}

// Where the user is in Nucleus, so "this patient" / "this page" resolve
function pageContext(pathname: unknown): string {
  if (typeof pathname !== 'string' || !pathname.startsWith('/')) return 'unknown';
  const patient = pathname.match(/^\/incidents\/([^/?#]+)/);
  if (patient) return `the patient record of patient_id "${decodeURIComponent(patient[1])}" (${pathname})`;
  const page = Object.values(NAV_PAGES).find((p) => pathname === p.href || pathname.startsWith(`${p.href}/`));
  return page ? `the ${page.label} page (${pathname})` : pathname.slice(0, 120);
}

// What this user may see, as the Hospital API applies it (memberships and
// whether organization rules are on), so the model describes counts as
// "within your access" rather than as system-wide totals
async function accessContext(actor: Actor): Promise<string> {
  const { status, data } = await forwardToBackend('/me', {}, actor).catch(() => ({ status: 0, data: null }));
  const me = status === 200 ? (data as any) : null;
  if (!me) return 'Unknown — treat every figure as limited to what the tools return for this user.';
  if (!me.org_access_enforced) return 'Organization access rules are off: tools return data of all organizations.';
  const ms: { org_id: string; role: string }[] = me.memberships ?? [];
  if (ms.some((m) => m.role === 'platform_admin')) return 'Platform admin: tools return data of every organization.';
  if (!ms.length) return 'This user belongs to no organization, so the tools return no patient data.';
  return `Limited to ${ms.map((m) => `${m.org_id} (${m.role})`).join(', ')}. Tools return ONLY these organizations' data — ` +
    'never describe counts as system-wide totals; say "in your organization" instead.';
}

// Earlier turns keep only their text: every answer is grounded on fresh
// lookups made with the user's CURRENT access, never on data saved in the
// browser's chat history from before (or forged into it).
function textOnly(messages: UIMessage[]): UIMessage[] {
  const lastUser = messages.map((m) => m.role).lastIndexOf('user');
  return messages
    .map((m, i) => (i >= lastUser ? m : { ...m, parts: (m.parts ?? []).filter((p: any) => p.type === 'text') }))
    .filter((m) => m.parts.length);
}

function systemPrompt(opts: { userName: string; userRole: string; privileged: boolean; page: string; access: string }) {
  return `You are Valkyra Sentinel, the assistant inside Valkyra Nucleus, a command center for emergency wound care.
Responders scan wounds with AR headsets; each End Scan is one "scan" of one patient and can hold several injuries (grouped by body region).

You are speaking to ${opts.userName} (${opts.userRole}). They are currently on ${opts.page}.
Their data access: ${opts.access}
Current server time (UTC): ${new Date().toISOString()}

${opts.privileged
    ? `DATA: You have read-only tools over live data. ALWAYS call a tool for any question about scans, patients, counts, injuries, locations or headsets — never answer from memory or guess. If a tool fails, say the live data link is unavailable and suggest retrying; never claim there is no data.`
    : `DATA: This account is not cleared for patient data, so you have no data tools. Explain features and terms only; never invent patient information.`}

DOMAIN (authoritative):
- PWAT = Photographic Wound Assessment Tool: a wound-severity score from 0 to 20 computed from the image. Higher = more severe. Bands: 0-4 Minor, 4-8 Delayed, 8-12 Urgent, 12-20 Critical. It is NOT a time.
- Triage: Red (immediate) > Orange (very urgent) > Yellow (urgent) > Green (minor). A scan's triage is its worst injury's.
- Body regions use the PATIENT's own left/right. "(side unknown)" means the side was not visible — never guess it.
- Each injury has an AI read (wound type, severity, observations, immediate steps). A clinician review, when present, overrides the AI and is authoritative — say which one you are quoting.
- A tool answer of "doesn't have access" means the user isn't permitted to see it. Say so plainly; never suggest the data doesn't exist, and never guess it.
- "Awaiting review" = injuries no clinician has confirmed yet. "AI pending" = frames whose AI read has not arrived yet.

ANSWERING:
1. Lead with the answer in one or two sentences, then the key facts. Be concise; this is a busy clinical setting.
2. Scans returned by tools are shown to the user as clickable cards under your message, so do not repeat every field of every scan. Summarise, highlight what matters (Red/critical first), and use a short markdown table only when comparing several items.
3. Always write session IDs in full (the UI turns them into links). Use the "age" values exactly as given; do not compute dates.
4. When the user asks to open, show or go to something, call show_in_app — it puts a button under your message. Never write URLs or markdown links yourself. When the user says "this patient" on a patient record, use that patient_id.
4b. "Better or worse" means the SAME body region compared across scans (region_trends_oldest_first): rising PWAT or triage = worse. Different regions in different scans are different wounds, not progress. If no region appears in more than one scan, say there is nothing to compare yet.
5. For a handoff, briefing or any question about a scan's injuries, first call get_scan for the full detail (list_scans cards are only summaries). Use a clear structure: patient, time and location, injuries (worst first) with triage, PWAT and AI/clinician notes, immediate steps, responder.
6. You support clinical decisions; you do not diagnose. For treatment questions, quote the recorded immediate steps and recommend clinician judgment.`;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return new Response('Unauthorized', { status: 401 });

  const userEmail = session.user.email;
  if (isRateLimited(userEmail)) {
    return Response.json({ error: 'Too many messages — please wait a moment before trying again.' }, { status: 429 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // empty body -> no messages
  }

  // Data tools only for roles that may view operations data — checked on
  // BOTH the real sign-in role and the dev-switch role, so the switch can
  // preview a lower role but never grant a higher one. Never from the body.
  // What the tools then return is scoped further by the Hospital API to the
  // user's organizations.
  const role = (await getEffectiveRole(session));
  const privileged = hasPermission(role, PERMISSIONS.OPERATIONS_VIEW)
    && hasPermission(session.user.role, PERMISSIONS.OPERATIONS_VIEW);
  const actor: Actor = {
    email: userEmail,
    role: session.user.role,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
  };

  const history: UIMessage[] = Array.isArray(body.messages) ? textOnly(body.messages.slice(-HISTORY_MESSAGES)) : [];
  // The model's turn order must start with the user (drops the greeting)
  while (history.length && history[0].role !== 'user') history.shift();
  if (!history.length) return Response.json({ error: 'No message to answer' }, { status: 400 });

  const tools = privileged ? createAssistantTools(actor) : undefined;
  const access = privileged ? await accessContext(actor) : 'None (no data tools for this role).';
  const result = streamText({
    model: gemini(CHAT_MODEL),
    system: systemPrompt({
      userName: session.user.name?.split(' ')[0] || 'there',
      userRole: ROLE_LABELS[role] ?? 'Medical Officer',
      privileged,
      page: pageContext(body.pathname),
      access,
    }),
    messages: await convertToModelMessages(history, { tools, ignoreIncompleteToolCalls: true }),
    tools,
    stopWhen: isStepCount(MAX_STEPS),
    temperature: 0.2,
    headers: { 'x-user-email': userEmail },
    providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } },
    onError: ({ error }) => console.error('[chat] model error:', error),
  });

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      const msg = error instanceof Error ? error.message : String(error);
      if (/429|RESOURCE_EXHAUSTED|No model available/i.test(msg)) return 'The AI service is busy right now. Please try again in a moment.';
      if (/Hospital API/i.test(msg)) return 'The live data link to the Nucleus backend is unavailable. Please retry.';
      return 'Something went wrong while answering. Please try again.';
    },
  });
}
