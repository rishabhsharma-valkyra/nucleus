'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

export interface TourStep {
  targetId: string;
  tag: string;
  title: string;
  script: string;
  action?: () => void;
}

interface VoiceTourProps {
  storageKey: string;
  steps: TourStep[];
  onTourEnd?: () => void;
}

// ==========================================
// SYNTHETIC WAVEFORM (Audio-Synced)
// ==========================================
function SyntheticWaveform({ isSpeaking }: { isSpeaking: boolean }) {
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
      if (tick % 4 === 0) {
        if (isSpeaking) {
          targetEnergyRef.current = 14 + Math.random() * 20; 
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
  }, [isSpeaking]);

  return (
    <div className="h-[40px] flex items-center justify-center gap-[3px] overflow-hidden my-2">
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <div
          key={i}
          ref={(el) => { barsRef.current[i] = el; }}
          className="w-[3px] rounded-[1px] transition-colors duration-300"
          style={{ height: '4px', backgroundColor: '#94a3b8', opacity: 0.4 }} 
        />
      ))}
    </div>
  );
}

// ==========================================
// MAIN TOUR ENGINE
// ==========================================
export default function VoiceTour({ storageKey, steps, onTourEnd }: VoiceTourProps) {
  const [tourState, setTourState] = useState<'idle' | 'running'>('idle');
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // 🛡️ HUD Spatial Awareness State (Now tracks Top/Bottom AND Left/Right/Center)
  const [boxPos, setBoxPos] = useState<{ v: 'top' | 'bottom', h: 'center' | 'left' | 'right' }>({ v: 'bottom', h: 'center' });
  
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const lastScrolledStepRef = useRef<number | null>(null); 

  useEffect(() => {
    const hasSeenTour = localStorage.getItem(storageKey);
    if (hasSeenTour === 'true') return;

    const startTour = () => setTimeout(() => setTourState('running'), 1200); 

    if (sessionStorage.getItem('valkyra-loaded') === 'true') {
      startTour();
    } else {
      window.addEventListener('valkyra-ready', startTour);
    }
    return () => window.removeEventListener('valkyra-ready', startTour);
  }, [storageKey]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') endTour();
    };
    if (tourState === 'running') window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.speechSynthesis.cancel(); 
    };
  }, [tourState]);

  // Spotlight Tracking, Auto-Scroll, and Smart Placement Engine
  useEffect(() => {
    if (tourState !== 'running') return;
    
    let isActive = true;

    const trackTarget = () => {
      if (!isActive) return;
      const element = document.getElementById(steps[currentStep].targetId);
      
      if (element) {
        if (lastScrolledStepRef.current !== currentStep) {
          // 'nearest' only scrolls if the target isn't already visible —
          // 'center' was forcing a scroll on every step even for elements
          // (like a corner-pinned legend) that were already fully on
          // screen, making fixed UI chrome visibly jump mid-tour.
          element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
          lastScrolledStepRef.current = currentStep;
        }

        const bounds = element.getBoundingClientRect();
        setRect({
          top: bounds.top - 8,
          left: bounds.left - 8,
          width: bounds.width + 16,
          height: bounds.height + 16
        });

        // 🛡️ Advanced Spatial Positioning Calculation
        const v = bounds.top > window.innerHeight / 2.2 ? 'top' : 'bottom';
        let h: 'center' | 'left' | 'right' = 'center';

        // If the highlighted element takes up LESS than 60% of the screen width, move the UI box to the side!
        if (bounds.width < window.innerWidth * 0.6) {
          const elementCenter = bounds.left + (bounds.width / 2);
          // If element is on the left half of the screen, put UI on the right
          h = elementCenter < window.innerWidth / 2 ? 'right' : 'left';
        }

        // Only trigger state update if the position actually needs to change
        setBoxPos(prev => {
          if (prev.v !== v || prev.h !== h) return { v, h };
          return prev;
        });
      }
      requestAnimationFrame(trackTarget);
    };

    trackTarget();

    return () => {
      isActive = false; 
    };
  }, [currentStep, tourState, steps]);

  useEffect(() => {
    if (tourState !== 'running') return;

    if (steps[currentStep].action) {
      steps[currentStep].action();
    }

    window.speechSynthesis.cancel(); 
    
    const utterance = new SpeechSynthesisUtterance(steps[currentStep].script);
    utteranceRef.current = utterance; 
    
    // 🛡️ THE PREMIUM VOICE HUNTER
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = 
      // 1. Microsoft Edge "Natural" Voices (These sound the most human)
      voices.find(v => v.name.includes('Natural') && v.lang.includes('en')) ||
      // 2. Google's Premium Browser Voices
      voices.find(v => v.name === 'Google US English' || v.name === 'Google UK English Female') ||
      // 3. Apple's Premium Voices (Mac/iOS)
      voices.find(v => v.name === 'Samantha' || v.name === 'Daniel' || v.name === 'Alex') ||
      // 4. Fallback to any standard English voice
      voices.find(v => v.lang.startsWith('en'));

    if (preferredVoice) utterance.voice = preferredVoice;
    
    // 🛡️ HUMANIZATION TWEAKS
    // A slightly slower rate and lower pitch removes the "robotic rush"
    utterance.rate = 0.92;  // 1.0 is default. 0.92 is more conversational and deliberate.
    utterance.pitch = 0.95; // 1.0 is default. 0.95 makes the AI sound calmer and less synthetic.

    utterance.onstart = () => setIsSpeaking(true);
    
    utterance.onend = () => {
      setIsSpeaking(false);
      setTimeout(() => {
        if (currentStep < steps.length - 1) {
          setCurrentStep(prev => prev + 1);
        } else {
          endTour();
        }
      }, 1000);
    };

    const speechDelay = setTimeout(() => {
      window.speechSynthesis.speak(utteranceRef.current as SpeechSynthesisUtterance);
    }, 600);

    return () => {
      clearTimeout(speechDelay);
      window.speechSynthesis.cancel(); 
    };
  }, [currentStep, tourState, steps]); 

  const endTour = () => {
    window.speechSynthesis.cancel();
    setTourState('idle');
    lastScrolledStepRef.current = null;
    localStorage.setItem(storageKey, 'true');
    if (onTourEnd) onTourEnd();
  };

  const handleManualNext = () => {
    window.speechSynthesis.cancel();
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      endTour();
    }
  };

  if (tourState === 'idle') return null;
  // Rendered via a portal to document.body — this component is mounted
  // inside each page, nested under .shell (the dashboard's root wrapper),
  // which sets its own position:relative + z-index:1 stacking context.
  // That traps this z-index:99990 overlay so it only wins against other
  // things ALSO nested in .shell — anything portaled straight to body with
  // even a modest z-index (like PatientModal's 200) beats the whole .shell
  // subtree regardless of this component's own (much larger) number. The
  // portal puts this at the same top-level playing field as those.
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[99990] pointer-events-auto overflow-hidden flex items-center justify-center">
        
        {tourState === 'running' && (
          <div className="absolute inset-0 z-[99991]" />
        )}

        {tourState === 'running' && rect && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 180, damping: 25 }}
              className="absolute rounded-xl border-2 border-cyan-400 pointer-events-none z-[99992]"
              style={{ boxShadow: '0 0 20px rgba(34,211,238,0.4), inset 0 0 20px rgba(34,211,238,0.1), 0 0 0 9999px rgba(2, 6, 23, 0.88)' }}
            >
              <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-cyan-300" />
              <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-cyan-300" />
              <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-cyan-300" />
              <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-cyan-300" />
            </motion.div>

            {/* 🛡️ DYNAMIC X & Y PLACEMENT */}
            <div 
              className={`absolute z-[99993] w-full max-w-[500px] pointer-events-none transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                boxPos.v === 'top' ? 'top-12' : 'bottom-12'
              } ${
                boxPos.h === 'center' ? 'left-1/2 -translate-x-1/2 px-4' : boxPos.h === 'left' ? 'left-12' : 'right-12'
              }`}
            >
              <motion.div 
                key={currentStep} 
                initial={{ opacity: 0, y: boxPos.v === 'top' ? -20 : 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-slate-950/95 border border-cyan-500/40 rounded-xl p-5 shadow-[0_30px_60px_rgba(0,0,0,0.9)] backdrop-blur-md pointer-events-auto"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-2 h-2 rounded-full bg-cyan-400 ${isSpeaking ? 'animate-ping' : ''}`} style={{ boxShadow: '0 0 10px rgba(34,211,238,0.8)' }} />
                  <span className="font-mono text-[10px] text-cyan-400 tracking-widest uppercase font-bold">
                    [{steps[currentStep].tag}] • TRANSMISSION {currentStep + 1}/{steps.length}
                  </span>
                </div>

                <h4 className="font-sans text-slate-100 text-lg font-bold tracking-wide mb-2 drop-shadow-md">
                  {steps[currentStep].title}
                </h4>
                
                <p className="font-mono text-slate-300 text-xs leading-relaxed mb-3 min-h-[35px]">
                  {steps[currentStep].script}
                </p>
                
                <SyntheticWaveform isSpeaking={isSpeaking} />

                <div className="flex items-center justify-between mt-2 pt-3 border-t border-slate-800">
                  <div className="flex items-center gap-2">
                    {steps.map((_, idx) => (
                      <div key={idx} className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentStep ? 'w-8 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'w-2 bg-slate-700'}`} />
                    ))}
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {currentStep < steps.length - 1 && (
                      <button onClick={handleManualNext} className="font-mono text-[10px] text-cyan-500 hover:text-cyan-300 transition-colors uppercase tracking-wider font-bold">
                        Skip Step ❯
                      </button>
                    )}
                    <button onClick={endTour} className="font-mono text-[10px] text-slate-500 hover:text-cyan-400 transition-colors uppercase tracking-wider px-2 py-1 bg-slate-900 rounded border border-slate-800 hover:border-cyan-900">
                      Abort Protocol [ESC]
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </div>
    </AnimatePresence>,
    document.body
  );
}