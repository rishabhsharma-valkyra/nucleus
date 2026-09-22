import { streamText, createUIMessageStreamResponse, toUIMessageStream } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { getServerSession } from 'next-auth';
import { NextRequest } from 'next/server';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS, ROLE_LABELS } from '@/lib/rbac';
import { getEffectiveRole } from '@/lib/serverRole';

export const maxDuration = 30;

// Same backend every other server route talks to (lib/backend.ts uses
// NEXT_PUBLIC_API_BASE). HOSPITAL_API_URL stays supported as an override,
// but must never be the *only* source — when it is unset in a deployment
// this route silently fell back to localhost and every telemetry fetch
// failed, which the model then reported as "no session data".
const API_BASE_URL =
  process.env.HOSPITAL_API_URL || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';
const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

// ── Rate limiting ──────────────────────────────────────────────────────
// In-memory, per-instance sliding window. This stops a single runaway
// client (buggy tab stuck retrying, or someone scripting the endpoint)
// from hammering the paid Groq API, but it does NOT coordinate across
// multiple serverless instances — a determined abuser spread across
// instances could still exceed this. A hard guarantee needs a shared
// store (Upstash/Vercel KV); this is a lightweight first line of defense.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 15;
const requestLog = new Map<string, number[]>();

// Marker the model is told to read as "the link broke", so a failed
// fetch is never reported to the user as an empty database.
const FETCH_FAILED = 'TELEMETRY_LINK_FAILED';

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  timestamps.push(now);
  requestLog.set(key, timestamps);
  return timestamps.length > RATE_LIMIT_MAX;
}

// Cloud Run scales to zero, so a cold start regularly costs 5-10s. The old
// 4s budget aborted those and left the prompt with no data at all; one
// retry covers the case where the first call paid the cold-start cost.
async function fetchWithTimeout(url: string, options: any = {}, timeoutMs = 12_000, attempts = 2) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    console.log(`[HTTP] Fetching (attempt ${attempt}/${attempts}): ${url}`);
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...(options.headers || {}), 'x-internal-key': process.env.INTERNAL_API_KEY ?? '' },
        signal: controller.signal,
      });
      clearTimeout(id);
      if (!response.ok) {
        console.error(`[HTTP ERROR] ${url} responded ${response.status}`);
      }
      return response;
    } catch (err: any) {
      clearTimeout(id);
      console.error(`[HTTP ERROR] Failure on ${url} (attempt ${attempt}):`, err.message);
    }
  }
  return null;
}

// Backend timestamps arrive as "2026-08-18 19:09:26.778561+00:00".
// Normalize the space so every runtime's Date parser accepts them.
function parseTimestamp(raw: any): number | null {
  if (!raw) return null;
  const t = new Date(String(raw).replace(' ', 'T')).getTime();
  return Number.isNaN(t) ? null : t;
}

// Pre-computed here rather than left to the model — an LLM has no reliable
// "now", so asking it to subtract dates produces confident wrong answers.
function humanAge(raw: any): string {
  const t = parseTimestamp(raw);
  if (t === null) return 'unknown';
  const mins = Math.floor((Date.now() - t) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days < 31) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, fifteen: 15, twenty: 20,
};

// "show me last 5 cases" -> 5. Defaults to 5, capped at 20 to keep the
// injected prompt small.
function parseRequestedCount(text: string): number {
  const m = text.match(
    /\b(?:last|latest|recent|past|previous|top|most\s+recent)\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty)\b/i
  );
  if (!m) return 5;
  const raw = m[1].toLowerCase();
  const n = NUMBER_WORDS[raw] ?? parseInt(raw, 10);
  if (!n || Number.isNaN(n)) return 5;
  return Math.min(Math.max(n, 1), 20);
}

export async function POST(req: NextRequest) {
  console.log('\n======================================================');
  console.log('🚀 [API/CHAT] NEW DIRECT-INJECT REQUEST');
  console.log('======================================================');

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return new Response('Unauthorized', { status: 401 });

  // Same gate as /api/patients: only admin/doctor may see all-patient
  // telemetry. A patient still gets a working assistant, but every fetch
  // below is scoped to their own email server-side — the model is never
  // handed another patient's record to leak.
  const userEmail = session.user.email;
  const isPrivileged = hasPermission(getEffectiveRole(session), PERMISSIONS.OPERATIONS_VIEW);
  const ownerScope = isPrivileged ? '' : `patientEmail=${encodeURIComponent(userEmail)}`;

  const rateLimitKey = userEmail;
  if (isRateLimited(rateLimitKey)) {
    console.warn(`[RATE LIMIT] ${rateLimitKey} exceeded ${RATE_LIMIT_MAX} requests/min`);
    return new Response(
      JSON.stringify({ error: 'Too many messages — please wait a moment before trying again.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Parse body safely
  let body;
  try {
    body = await req.json();
  } catch (e) {
    body = {};
  }

  const messages = body.messages || [];
  const userName = body.userName || session.user.name?.split(' ')[0] || 'Authorized User';
  // Role comes from the session, not the request body — the client sends a
  // display label, and a spoofed one must not change how the assistant
  // describes the caller's clearance.
  const userRole = ROLE_LABELS[getEffectiveRole(session)] ?? 'Medical Officer';

  const recentMessages = messages.slice(-5);

  const coreMessages = recentMessages.map((m: any) => {
    let text = m.content || '';
    if (m.parts && Array.isArray(m.parts)) {
      const textParts = m.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n');
      if (textParts && !text.includes(textParts)) text += '\n' + textParts;
    }
    return {
      role: m.role === 'user' ? 'user' : 'assistant',
      content: text.trim() || '[Data Processed]'
    };
  }).filter((m: any) => m.content !== '');

  const lastUserMsg = coreMessages.filter((m: any) => m.role === 'user').pop();
  const lastUserText: string = lastUserMsg?.content || '';
  const uuidMatch = lastUserText.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
  const targetSessionId = uuidMatch ? uuidMatch[0] : null;
  const requestedCount = parseRequestedCount(lastUserText);

  let summaryString = FETCH_FAILED;
  let patientsString = FETCH_FAILED;
  let targetPatientString = 'No specific session ID was requested.';

  console.log(
    `\n📡 [PRE-FETCH] Pulling telemetry from ${API_BASE_URL} ` +
    `(${requestedCount} sessions, scope: ${isPrivileged ? 'all patients' : 'own records only'})...`
  );

  const fetchPromises = [
    fetchWithTimeout(`${API_BASE_URL}/patients/summary${ownerScope ? `?${ownerScope}` : ''}`),
    fetchWithTimeout(`${API_BASE_URL}/patients?limit=${requestedCount}&offset=0${ownerScope ? `&${ownerScope}` : ''}`)
  ];

  if (targetSessionId) {
    console.log(`🎯 [DIRECT FETCH] UUID detected in user prompt: ${targetSessionId}`);
    const encodedId = encodeURIComponent(String(targetSessionId).trim());
    // Unprivileged callers can only open their own session, no matter which
    // UUID they type at the assistant — the filter is forced here, not in
    // the UI, exactly as app/api/patients/[sessionId]/route.ts does it.
    fetchPromises.push(
      fetchWithTimeout(`${API_BASE_URL}/patient/${encodedId}${ownerScope ? `?${ownerScope}` : ''}`)
    );
  }

  const results = await Promise.all(fetchPromises);
  const summaryRes = results[0];
  const patientsRes = results[1];
  const targetRes = targetSessionId ? results[2] : null;

  if (summaryRes?.ok) {
    const d = await summaryRes.json();
    summaryString = JSON.stringify({
      total: d.total_cases,
      stats: d.pwat_stats,
      triage_distribution: d.triage_distribution,
    });
  }

  if (patientsRes?.ok) {
    const d = await patientsRes.json();
    // Newest first, with the age pre-computed so the model can state how
    // old each case is without doing date math itself.
    const lightweightPatients = (d.sessions || [])
      .slice()
      .sort((a: any, b: any) => (parseTimestamp(b.created_at) ?? 0) - (parseTimestamp(a.created_at) ?? 0))
      .map((p: any, i: number) => ({
        rank: i + 1,
        id: p.session_id,
        recorded_at_utc: p.created_at ?? null,
        age: humanAge(p.created_at),
        triage: p.triage_category ?? p.patient_triage,
        pwat: p.pwat_score ?? p.max_pwat,
        frames: p.frame_count,
      }));
    patientsString = lightweightPatients.length
      ? JSON.stringify(lightweightPatients)
      : 'NO_SESSIONS_RECORDED';
  }

  if (targetRes?.ok) {
    const data = await targetRes.json();
    const truncatedPayload = {
      session_id: data.session_id,
      recorded_at_utc: data.created_at ?? null,
      age: humanAge(data.created_at),
      triage_category: data.patient_triage || data.triage_category,
      pwat_score: data.pwat_score,
      wound_metrics: data.wound_metrics,
      gemini_analysis: data.gemini_analysis
    };
    targetPatientString = JSON.stringify(truncatedPayload);
    console.log('✅ [DIRECT FETCH] Targeted telemetry successfully loaded for prompt.');
  } else if (targetSessionId) {
    targetPatientString = isPrivileged
      ? `Database check complete: Session ID '${targetSessionId}' was not found.`
      : `Session ID '${targetSessionId}' is not one of this user's own records, so it cannot be shown to them.`;
  }

  const systemPrompt = `You are the "Valkyra Sentinel", an advanced tactical assistant managing the Valkyra Nucleus medical command center.
Your tone is professional and concise.
You are currently speaking to: ${userName} (Role: ${userRole}). Address them appropriately based on their role.
Current server time (UTC): ${new Date().toISOString()}

DOMAIN DEFINITIONS (authoritative — never guess or substitute a different expansion for these terms):
- PWAT = Photographic Wound Assessment Tool. It is a wound-severity SCORE on a 0-20 scale derived from automated analysis of the wound image — NOT "patient wait time", NOT a duration, and NOT measured in minutes or any other unit of time.
  Scale bands: 0-4 Minor · 4-8 Delayed · 8-12 Urgent · 12-20 Critical. A HIGHER PWAT score means a MORE SEVERE wound.
  "pwat_stats" / "average", "minimum", "maximum" fields below are PWAT score values (unitless, 0-20), not durations.
- Triage category (Red/Orange/Yellow/Green) is the field responder's severity classification, separate from but correlated with PWAT.
- A "session" is one wound-scan capture event from an AR headset; there is no separate "incident" record yet, so sessions are what's being referred to when discussing incidents. "Case" and "session" mean the same thing.

DATA SCOPE: ${isPrivileged
    ? 'This user is cleared for command-center data. Everything below covers ALL patients.'
    : "This user is a patient. Everything below covers ONLY their own scan sessions — it is not a system-wide view. Never describe these figures as the totals for the whole system, and never offer to look up another patient's records."}

REAL-TIME SYSTEM METRICS:
- Summary Overview: ${summaryString}
- Recent Sessions (newest first, ${requestedCount} requested; each entry carries "recorded_at_utc" and a pre-computed "age"): ${patientsString}

REQUESTED TELEMETRY (If applicable):
${targetPatientString}

SYSTEM RULES:
1. Use the data provided above to answer queries — do not invent units, timeframes, or expansions for domain terms that aren't given here.
2. If targeted telemetry is provided, format it clearly into a tactical medical briefing.
3. When asked for the last / latest / recent N cases or sessions, answer directly from "Recent Sessions" above. List them newest first with the session ID, its "age" value verbatim, the triage category, and the PWAT score. Never ask the user to supply session IDs or to export data that is already listed above.
4. Report ages using the "age" field exactly as given. Do not compute dates yourself, and do not describe a case as "today" unless its age says so.
5. "${FETCH_FAILED}" means the backend telemetry link failed or timed out — a connection problem, NOT an empty database. In that case, say the live data link to the Nucleus backend is unavailable and suggest retrying; never claim there are no cases on record.
6. "NO_SESSIONS_RECORDED" is the only value that means the database genuinely holds no sessions.`;

  console.log('\n🧠 [GROQ] Initializing response stream (Model: groq/compound-mini)...');

  const result = streamText({
    model: groq('groq/compound-mini'),
    system: systemPrompt,
    messages: coreMessages,
  });

  console.log('🌊 [STREAM] Pushing response stream to frontend...');

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: (result as any).stream })
  });
}
