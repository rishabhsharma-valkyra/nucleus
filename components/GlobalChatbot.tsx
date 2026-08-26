'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChat } from '@ai-sdk/react';
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { useSession } from 'next-auth/react';
import { useRole, useSummary, useAllSessions } from '@/hooks';
import { useNucleusStore } from '@/store/useNucleusStore';
import ProceduralBot from './ProceduralBot';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Builds the floating thought-bubble pool from real live data instead of a
// fixed script, so the nudges reflect what's actually happening right now.
function buildProactiveMessages(summary: any, sessionCount: number): string[] {
  const msgs: string[] = [];
  const redCount = summary?.triage_distribution?.Red?.count ?? 0;
  const maxPwat = summary?.pwat_stats?.maximum;
  const avgPwat = summary?.pwat_stats?.average ?? summary?.avg_pwat;

  if (redCount > 0) msgs.push(`${redCount} Red-triage case${redCount > 1 ? 's' : ''} active right now — want a summary?`);
  if (maxPwat) msgs.push(`Highest PWAT score on record is ${Number(maxPwat).toFixed(1)}. Want the details?`);
  if (avgPwat) msgs.push(`Average PWAT across all cases is ${Number(avgPwat).toFixed(1)}.`);
  if (sessionCount > 0) msgs.push(`${sessionCount} sessions recorded so far. Ask me anything about them.`);
  msgs.push('Systems optimal. Awaiting your query.');
  return msgs;
}

const QUICK_PROMPTS = [
  "Summarize today's cases",
  "Show me the Red triage cases",
  "What's the highest PWAT score right now?",
];

// Two regexes, not one reused with both .replace and .test — a global-flag
// regex carries lastIndex state across .test() calls, which silently flips
// between true/false on identical input across re-renders.
const UUID_RE = /\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi;
const UUID_TEST_RE = /\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/i;

// Turns any raw session UUID the model mentions into a clickable markdown
// link the custom `a` renderer below recognizes and turns into a chip that
// opens the real patient modal, instead of leaving it as inert text.
function linkifySessionIds(text: string): string {
  return text.replace(UUID_RE, (match) => `[${match.slice(0, 8)}…](session:${match})`);
}

function getMessageText(m: any): string {
  const textElements: string[] = [];
  if (m.content) textElements.push(m.content);
  if (Array.isArray(m.parts)) {
    m.parts.forEach((part: any) => {
      if (part.type === 'text' && part.text && !m.content) textElements.push(part.text);
    });
  }
  return textElements.join('\n');
}

// Lightweight heuristic follow-ups keyed off what the reply actually said,
// so they read as a reaction to the answer rather than a generic menu.
function getFollowUps(text: string): string[] {
  const t = text.toLowerCase();
  const suggestions: string[] = [];
  if (UUID_TEST_RE.test(text)) suggestions.push('Open that session');
  if (t.includes('red') || t.includes('critical')) suggestions.push('Show me the Red triage cases');
  if (t.includes('pwat')) suggestions.push('What does that PWAT score mean?');
  if (t.includes('escalat')) suggestions.push('Which responder escalates most?');
  if (suggestions.length === 0) suggestions.push('What should I check next?');
  return suggestions.slice(0, 2);
}

// ==========================================
// 1. THE WRAPPER 
export default function GlobalChatbot() {
  const { data: session, status } = useSession();
  const role = useRole();
  
  const [isAppReady, setIsAppReady] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('valkyra-loaded') === 'true') {
      setIsAppReady(true);
    }

    const handleReady = () => setIsAppReady(true);
    const handleHide = () => setIsAppReady(false);

    window.addEventListener('valkyra-ready', handleReady);
    window.addEventListener('valkyra-hide', handleHide); 

    return () => {
      window.removeEventListener('valkyra-ready', handleReady);
      window.removeEventListener('valkyra-hide', handleHide);
    };
  }, []);

  if (status === 'loading') return null;
  if (!session?.user) return null;
  if (!isAppReady) return null;

  return <OracleChatCore session={session} role={role ?? null} />;
}

// ==========================================
// 2. FLOWING GEMINI VAD WAVEFORM (Sustained Energy + Full Edges)
// ==========================================
function ExactGeminiWaveform({ lastSpeechTimeRef }: { lastSpeechTimeRef: React.MutableRefObject<number> }) {
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const BAR_COUNT = 43; 
  const CENTER = 21; 
  const SPREAD = 22; 
  
  const historyRef = useRef<number[]>(Array(CENTER + 1).fill(0));
  const currentCenterEnergyRef = useRef(0);
  const targetEnergyRef = useRef(0);

  useEffect(() => {
    let frameId: number;
    let tick = 0;

    const animate = () => {
      tick++;
      const now = Date.now();
      
      const timeSinceSpeech = now - lastSpeechTimeRef.current;

      if (tick % 4 === 0) {
        if (timeSinceSpeech < 800) {
          targetEnergyRef.current = 16 + Math.random() * 18; 
        } else if (timeSinceSpeech < 1200) {
          targetEnergyRef.current = 6 + Math.random() * 8; 
        } else {
          targetEnergyRef.current = 0;
        }
      }

      currentCenterEnergyRef.current += (targetEnergyRef.current - currentCenterEnergyRef.current) * 0.25;

      if (tick % 3 === 0) {
        historyRef.current.unshift(currentCenterEnergyRef.current);
        historyRef.current.pop();
      }

      barsRef.current.forEach((bar, i) => {
        if (!bar) return;
        
        let currentHeight = parseFloat(bar.style.height) || 4;
        const dist = Math.abs(i - CENTER); 
        
        const envelope = dist < SPREAD ? Math.cos((dist / SPREAD) * (Math.PI / 2)) : 0;
        const historicalEnergy = historyRef.current[dist] || 0;
        const targetHeight = 4 + (historicalEnergy * envelope);

        currentHeight += (targetHeight - currentHeight) * 0.4;
        bar.style.height = `${currentHeight}px`;

        if (currentHeight > 6) {
            const intensity = Math.min(1, (currentHeight - 4) / 20);
            bar.style.backgroundColor = '#22d3ee'; 
            bar.style.boxShadow = `0 0 ${8 * intensity}px rgba(34,211,238,${intensity * 0.6})`;
            bar.style.opacity = `${0.4 + (intensity * 0.6)}`;
        } else {
            bar.style.backgroundColor = '#94a3b8'; 
            bar.style.boxShadow = 'none';
            bar.style.opacity = '0.4';
        }
      });
      
      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [lastSpeechTimeRef]);

  return (
    <div className="flex-1 h-[48px] flex items-center justify-center gap-[3px] overflow-hidden ml-10 mr-12 px-2">
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <div
          key={i}
          ref={(el) => { barsRef.current[i] = el; }}
          className="w-[4px] rounded-[1px] transition-colors duration-300"
          style={{ height: '4px', backgroundColor: '#94a3b8', opacity: 0.4 }} 
        />
      ))}
    </div>
  );
}

// ==========================================
// 3. THE CORE
// ==========================================
function OracleChatCore({ session, role }: { session: any, role: string | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [noticeTrigger, setNoticeTrigger] = useState(0);

  // Real live data — drives the proactive thought bubbles, the bot's
  // data-reactive mood color, and inline session chips in replies.
  const { data: summary } = useSummary();
  const { data: sessionsData } = useAllSessions();
  const sessions = sessionsData?.sessions ?? [];
  const redCount = summary?.triage_distribution?.Red?.count ?? 0;
  const setActivePatientId = useNucleusStore((s) => s.setActivePatientId);

  const [tooltipText, setTooltipText] = useState('Systems optimal. Awaiting your query.');
  const [showTooltip, setShowTooltip] = useState(false);

  const [input, setInput] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  
  const lastSpeechTimeRef = useRef(0); 
  
  const recognitionRef = useRef<any>(null);
  const baseInputRef = useRef<string>(''); 

  const rawName = session.user.name || 'User';
  const firstName = rawName.split(' ')[0];
  const roleName = role === 'admin' ? 'System Administrator' : 'Medical Officer';

  const chatConfig: any = {
    body: { userName: firstName, userRole: roleName },
    messages: [
      { 
        id: '1', 
        role: 'assistant', 
        parts: [{ type: 'text', text: `Valkyra AI initialized. Connected to live hospital telemetry. How can I assist, ${firstName}?` }] 
      }
    ]
  };

  const { messages, sendMessage, status: chatStatus, error } = useChat(chatConfig);
  const isLoading = chatStatus === 'submitted' || chatStatus === 'streaming';

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input, isRecording]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        console.error("[Valkyra Voice] ❌ Browser does not support Web Speech API.");
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true; 
      recognition.interimResults = true;

      recognition.onsoundstart = () => {
        lastSpeechTimeRef.current = Date.now();
      };

      recognition.onspeechstart = () => {
        lastSpeechTimeRef.current = Date.now();
      };

      recognition.onresult = (event: any) => {
        lastSpeechTimeRef.current = Date.now(); 
        
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        
        setInput((baseInputRef.current + ' ' + transcript).trim());
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (isRecording) {
      setIsRecording(false);
      lastSpeechTimeRef.current = 0;
      recognitionRef.current?.stop();
    } else {
      setIsRecording(true); 
      baseInputRef.current = input; 
      try {
        recognitionRef.current?.start();
      } catch (err) {}
    }
  };

  useEffect(() => {
    if (isOpen || isHovered) {
      if (isOpen) setShowTooltip(false);
      return;
    }
    const interval = setInterval(() => {
      const pool = buildProactiveMessages(summary, sessions.length);
      const randomMsg = pool[Math.floor(Math.random() * pool.length)];
      setTooltipText(randomMsg);
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 6000);
    }, 20000);
    return () => clearInterval(interval);
  }, [isOpen, isHovered, summary, sessions.length]);

  // One-shot "notice" beat for the bot avatar — fires when the panel opens,
  // so it visibly acknowledges you instead of just sitting there animating.
  useEffect(() => {
    if (isOpen) setNoticeTrigger((n) => n + 1);
  }, [isOpen]);

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    if (isRecording) {
      setIsRecording(false);
      lastSpeechTimeRef.current = 0;
      recognitionRef.current?.stop();
    }

    sendMessage({ text: input });
    setInput('');
    baseInputRef.current = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleFormSubmit(e as any);
    }
  };

  useEffect(() => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: chatStatus === 'streaming' ? 'auto' : 'smooth'
      });
    }
  }, [messages, chatStatus, isOpen, error]);

  const MarkdownComponents: any = {
    p: ({ node, ...props }: any) => <p className="mb-3 last:mb-0 leading-relaxed" {...props} />,
    strong: ({ node, ...props }: any) => <strong className="text-cyan-400 font-semibold tracking-wide" {...props} />,
    em: ({ node, ...props }: any) => <em className="text-cyan-200/80 italic" {...props} />,
    h1: ({ node, ...props }: any) => <h1 className="text-cyan-400 font-bold uppercase tracking-widest text-sm mb-3 mt-5 border-b border-cyan-500/30 pb-1" {...props} />,
    h2: ({ node, ...props }: any) => <h2 className="text-cyan-400 font-bold uppercase tracking-wider text-[13px] mb-2 mt-4" {...props} />,
    h3: ({ node, ...props }: any) => <h3 className="text-cyan-300 font-semibold text-[13px] mb-2 mt-3" {...props} />,
    ul: ({ node, ...props }: any) => <ul className="list-disc list-outside ml-4 mb-3 space-y-1 marker:text-cyan-500" {...props} />,
    ol: ({ node, ...props }: any) => <ol className="list-decimal list-outside ml-4 mb-3 space-y-1 marker:text-cyan-500" {...props} />,
    li: ({ node, ...props }: any) => <li className="pl-1" {...props} />,
    table: ({ node, ...props }: any) => (
      <div className="overflow-x-auto my-4 border border-cyan-900/30 rounded-lg">
        <table className="w-full text-left border-collapse" {...props} />
      </div>
    ),
    th: ({ node, ...props }: any) => <th className="bg-cyan-950/40 border-b border-cyan-800/50 p-2.5 font-mono text-cyan-400 text-[10px] uppercase tracking-wider" {...props} />,
    td: ({ node, ...props }: any) => <td className="border-b border-cyan-900/20 p-2.5 text-slate-200 text-[12px] last:border-b-0" {...props} />,
    a: ({ node, href, children, ...props }: any) => {
      if (typeof href === 'string' && href.startsWith('session:')) {
        const sessionId = href.slice('session:'.length);
        return (
          <button
            type="button"
            onClick={() => setActivePatientId(sessionId)}
            className="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono text-[11px] hover:bg-cyan-500/20 hover:border-cyan-400/50 transition-all align-middle"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            {children}
          </button>
        );
      }
      return <a href={href} target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300" {...props}>{children}</a>;
    },
    code: ({ node, inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <pre className="bg-slate-950/80 p-3 rounded-lg border border-cyan-900/30 my-3 overflow-x-auto font-mono text-[11px] text-cyan-100/90 shadow-inner">
          <code className={className} {...props}>{children}</code>
        </pre>
      ) : (
        <code className="bg-cyan-950/50 text-cyan-300 px-1.5 py-0.5 rounded font-mono text-[11px] border border-cyan-800/30" {...props}>
          {children}
        </code>
      );
    }
  };

  const renderMessageContent = (m: any) => {
    const text = linkifySessionIds(getMessageText(m));
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
        {text}
      </ReactMarkdown>
    );
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        .cyber-scrollbar::-webkit-scrollbar { width: 4px; }
        .cyber-scrollbar::-webkit-scrollbar-track { background: rgba(2,6,23,0.5); }
        .cyber-scrollbar::-webkit-scrollbar-thumb { background: rgba(34,211,238,0.3); border-radius: 4px; }
        .cyber-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(34,211,238,0.6); }
      `}} />

      {/* 🛡️ THE FIX: Added id="spotlight-bot" to this wrapper so the Tour Engine can track it */}
      <motion.div 
        id="spotlight-bot"
        initial={{ x: 200, opacity: 0 }} 
        animate={{ x: 0, opacity: 1 }} 
        transition={{ type: 'spring', damping: 20, stiffness: 120, delay: 0.2 }}
        className="fixed bottom-6 right-6 z-[100] flex justify-center pointer-events-none"
      >
        <div
          className="relative w-28 h-28 pointer-events-auto flex items-center justify-center group"
          onMouseEnter={() => { setIsHovered(true); setTooltipText("Click to deploy Valkyra AI."); setShowTooltip(true); setNoticeTrigger((n) => n + 1); }}
          onMouseLeave={() => { setIsHovered(false); setShowTooltip(false); }}
        >
          {/* 🛡️ NEW THOUGHT CLOUD BUBBLE */}
          <AnimatePresence>
            {(!isOpen && showTooltip) && (
              <motion.div 
                initial={{ opacity: 0, x: 10, y: 15, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 5, y: 10, scale: 0.95 }}
                // Positioning it above and to the left of the head
                className="absolute bottom-[75%] right-[75%] w-max max-w-[240px] pointer-events-auto cursor-pointer z-50"
                onClick={() => setIsOpen(true)}
              >
                <motion.div 
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="relative flex flex-col items-end hover:brightness-125 transition-all"
                >
                  {/* Main Cloud Bubble */}
                  <div className="relative z-10 px-4 py-2.5 bg-[#060a12]/95 border border-cyan-500/40 rounded-2xl backdrop-blur-md shadow-[0_0_20px_rgba(34,211,238,0.15)]">
                    <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--cyan)', lineHeight: 1.4 }}>
                      {tooltipText}
                    </div>
                  </div>

                  {/* Thought Trail Dots (Leading diagonally down toward the bot's head) */}
                  <motion.div 
                    animate={{ y: [0, -2, 0] }} 
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
                    className="absolute -bottom-2.5 right-6 w-2.5 h-2.5 rounded-full bg-[#060a12] border border-cyan-500/40 shadow-[0_0_10px_rgba(34,211,238,0.15)] pointer-events-none" 
                  />
                  <motion.div 
                    animate={{ y: [0, -1.5, 0] }} 
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
                    className="absolute -bottom-5 right-2 w-1.5 h-1.5 rounded-full bg-[#060a12] border border-cyan-500/40 shadow-[0_0_5px_rgba(34,211,238,0.15)] pointer-events-none" 
                  />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="absolute bottom-2 w-16 h-4 bg-cyan-500/10 blur-xl rounded-full group-hover:bg-cyan-400/20 transition-colors duration-500 pointer-events-none" />

          <div className="w-full h-full pointer-events-none cursor-pointer" onClick={() => setIsOpen(true)}>
            <Canvas camera={{ position: [0, 0.3, 4.5], fov: 45 }}>
              <ambientLight intensity={0.8} />
              <spotLight position={[5, 5, 5]} intensity={3} color="#ffffff" />
              <spotLight position={[-5, -5, -2]} intensity={1} color={redCount > 0 ? '#f87171' : '#22d3ee'} />
              <Environment preset="city" />
              <ProceduralBot isLoading={isLoading} alert={redCount > 0} noticeTrigger={noticeTrigger} />
            </Canvas>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110]"
            />

            <motion.div 
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-md z-[120] flex flex-col shadow-2xl"
              style={{ background: 'rgba(2, 6, 23, 0.95)', borderLeft: '1px solid rgba(34,211,238,0.2)' }}
            >
              <div className="flex items-center justify-between p-6 bg-slate-950/80 border-b border-cyan-900/30">
                <div className="flex items-center gap-4">
                  <div className="relative flex items-center justify-center w-10 h-10 rounded-lg bg-cyan-950/50 border border-cyan-500/30 overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(34,211,238,0.2),transparent)]" />
                    <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-mono text-cyan-400 text-sm tracking-widest font-bold uppercase">Valkyra AI</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <p className="font-mono text-[9px] text-slate-400 uppercase tracking-wider">Secure Uplink Active</p>
                    </div>
                  </div>
                </div>
                <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-cyan-400 transition-colors p-2 hover:bg-cyan-950/30 rounded-md">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 cyber-scrollbar">
                
                {messages.map((m: any, i: number) => {
                  const isUser = m.role === 'user';
                  const isLastMessage = i === messages.length - 1;
                  const isStreamingThis = !isUser && isLastMessage && chatStatus === 'streaming';
                  const showFollowUps = !isUser && isLastMessage && chatStatus === 'ready' && messages.length > 1;
                  return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 15, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className={`flex flex-col max-w-[88%] ${isUser ? 'self-end items-end' : 'self-start items-start'}`}
                    >
                      <span className="font-mono text-[10px] text-slate-400 mb-1.5 tracking-wider uppercase px-1">
                        {isUser ? firstName : 'Valkyra System'}
                      </span>

                      <div
                        className={`
                          px-4 py-3 text-[13px] shadow-lg
                          ${isUser
                            ? 'bg-slate-800 text-slate-100 rounded-2xl rounded-tr-sm border-r-2 border-slate-600'
                            : 'bg-cyan-950/20 text-cyan-50 rounded-2xl rounded-tl-sm border-l-2 border-cyan-500'}
                        `}
                      >
                        {renderMessageContent(m)}
                        {isStreamingThis && (
                          <motion.span
                            className="inline-block w-[7px] h-[13px] bg-cyan-400 ml-0.5 align-middle"
                            animate={{ opacity: [1, 1, 0, 0] }}
                            transition={{ duration: 0.9, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}
                          />
                        )}
                      </div>

                      {showFollowUps && (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.15 }}
                          className="flex flex-wrap gap-2 mt-2.5"
                        >
                          {getFollowUps(getMessageText(m)).map((prompt) => (
                            <button
                              key={prompt}
                              onClick={() => sendMessage({ text: prompt })}
                              className="px-3 py-1.5 rounded-full border border-cyan-900/50 bg-cyan-950/10 text-cyan-200/90 text-[11px] font-mono hover:bg-cyan-950/30 hover:border-cyan-500/40 transition-all"
                            >
                              {prompt}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })}
                
                {messages.length === 1 && chatStatus === 'ready' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="flex flex-col gap-2 self-start w-full"
                  >
                    <span className="font-mono text-[9px] text-slate-500 tracking-widest uppercase px-1">Quick actions</span>
                    <div className="flex flex-col gap-2">
                      {QUICK_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => sendMessage({ text: prompt })}
                          className="text-left px-3.5 py-2.5 rounded-lg border border-cyan-900/40 bg-cyan-950/10 text-cyan-100/90 text-[12px] font-mono hover:bg-cyan-950/30 hover:border-cyan-500/40 transition-all"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {chatStatus === 'submitted' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 15, scale: 0.95 }} 
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="flex flex-col max-w-[88%] self-start items-start"
                  >
                    <span className="font-mono text-[10px] text-slate-400 mb-1.5 tracking-wider uppercase px-1">
                      Valkyra System
                    </span>
                    <div className="px-4 py-3 shadow-lg bg-cyan-950/20 text-cyan-50 rounded-2xl rounded-tl-sm border-l-2 border-cyan-500 font-mono">
                      <div className="text-cyan-400 text-xs flex items-center gap-3 py-1">
                        <div className="w-9 h-9 flex-shrink-0 -my-2">
                          <Canvas camera={{ position: [0, 0.3, 4.5], fov: 45 }}>
                            <ambientLight intensity={0.9} />
                            <spotLight position={[3, 3, 3]} intensity={2.5} color="#ffffff" />
                            <spotLight position={[-3, -3, -1]} intensity={1} color="#22d3ee" />
                            <ProceduralBot isLoading />
                          </Canvas>
                        </div>
                        <span className="animate-pulse">Intercepting Live Telemetry...</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {error && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="self-start flex flex-col gap-2 max-w-[95%]">
                    <span className="font-mono text-[10px] text-red-400 tracking-wider uppercase px-1">System Alert</span>
                    <div className="p-4 rounded-xl rounded-tl-sm bg-red-950/40 border-l-2 border-red-500 text-red-400 font-mono text-xs shadow-lg">
                      [CONNECTION SEVERED] {error.message}
                    </div>
                  </motion.div>
                )}
                
                <div ref={messagesEndRef} className="h-8 flex-shrink-0" />
              </div>

              <div className="p-4 bg-slate-950/90 border-t border-cyan-900/30 pb-8">
                <form 
                  onSubmit={handleFormSubmit} 
                  className={`relative flex items-end w-full rounded-lg shadow-inner transition-all duration-300 ${
                    isRecording ? 'bg-slate-900 border border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.15)]' : 'bg-slate-900/50 border border-slate-700/50 focus-within:border-cyan-500/50'
                  }`}
                >
                  
                  <div className="absolute left-4 bottom-[14px] text-cyan-500/50 transition-colors pointer-events-none z-10">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  
                  {isRecording ? (
                    <ExactGeminiWaveform lastSpeechTimeRef={lastSpeechTimeRef} />
                  ) : (
                    <textarea 
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Message Valkyra AI..."
                      className="flex-1 bg-transparent text-slate-200 placeholder-slate-500 focus:outline-none font-mono text-[13px] py-3.5 pl-12 pr-24 resize-none cyber-scrollbar min-h-[48px]"
                      rows={1}
                      style={{ maxHeight: '120px' }}
                    />
                  )}
                  
                  <div className="absolute right-2 bottom-[6px] flex items-center gap-1 z-10">
                    <button 
                      type="button" 
                      onClick={toggleListening}
                      className={`p-2 flex items-center justify-center rounded-md transition-all duration-300 ${
                        isRecording 
                          ? 'bg-slate-700 hover:bg-slate-600 text-slate-200 shadow-lg !rounded-full' 
                          : 'text-cyan-500/50 hover:text-cyan-300 hover:bg-cyan-950/50'
                      }`}
                      style={isRecording ? { width: '32px', height: '32px', margin: '2px 6px' } : {}}
                      title={isRecording ? "Stop recording" : "Voice input"}
                    >
                      {isRecording ? (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                      )}
                    </button>

                    {!isRecording && (
                      <button 
                        type="submit" 
                        disabled={!input || !input.trim() || isLoading}
                        className="p-2 rounded-md text-cyan-400 hover:bg-cyan-950/50 hover:text-cyan-300 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                      >
                        <svg className="w-5 h-5 -rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V6m0 0l-7 7m7-7l7 7" />
                        </svg>
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}