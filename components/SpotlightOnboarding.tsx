'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TourStep {
  targetId: string;
  tag: string;
  title: string;
  description: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    targetId: 'spotlight-pwat',
    tag: 'CLINICAL TELEMETRY',
    title: 'PWAT Score Tracking',
    description: 'Monitors Bates-Jensen & PWAT scales in real-time to detect wound healing stagnation.'
  },
  {
    targetId: 'spotlight-triage',
    tag: 'NETWORK ANALYTICS',
    title: 'Triage Distribution',
    description: 'Categorizes case severity across all active wards to prioritize critical Red alerts.'
  },
  {
    targetId: 'spotlight-bot',
    tag: 'VOICE INTELLIGENCE',
    title: 'Valkyra Sentinel',
    description: 'Voice-activated telemetry core. Click or speak anytime to query live hospital data.'
  }
];

export default function SpotlightOnboarding() {
  const [currentStep, setCurrentStep] = useState<number | null>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const handleComplete = () => {
    setCurrentStep(null);
    localStorage.setItem('valkyra-onboarded', 'true');
  };

  // 🛡️ THE FIX: Added a global keyboard listener for the Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleComplete();
      }
    };

    // Only listen if the tour is actively running
    if (currentStep !== null) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep]);

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('valkyra-onboarded');
    if (hasSeenTour === 'true') return;

    const startTour = () => {
      setTimeout(() => setCurrentStep(0), 1000); 
    };

    if (sessionStorage.getItem('valkyra-loaded') === 'true') {
      startTour();
    }

    window.addEventListener('valkyra-ready', startTour);
    return () => window.removeEventListener('valkyra-ready', startTour);
  }, []);

  useEffect(() => {
    if (currentStep === null) return;

    const updateBounds = () => {
      const step = TOUR_STEPS[currentStep];
      if (!step) return;

      const element = document.getElementById(step.targetId);
      if (element) {
        const bounds = element.getBoundingClientRect();
        setRect({
          top: bounds.top - 8,
          left: bounds.left - 8,
          width: bounds.width + 16,
          height: bounds.height + 16
        });
      } else {
        setTimeout(updateBounds, 250);
      }
    };

    updateBounds();
    window.addEventListener('resize', updateBounds);
    return () => window.removeEventListener('resize', updateBounds);
  }, [currentStep]);

  useEffect(() => {
    if (currentStep === null) return;

    const stepTimer = setTimeout(() => {
      if (currentStep < TOUR_STEPS.length - 1) {
        setCurrentStep((prev) => (prev !== null ? prev + 1 : null));
      } else {
        handleComplete();
      }
    }, 4200);

    return () => clearTimeout(stepTimer);
  }, [currentStep]);

  if (currentStep === null || !rect) return null;

  const stepData = TOUR_STEPS[currentStep];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] pointer-events-auto overflow-hidden">
        
        {/* Invisible background to block clicks to the dashboard below */}
        <div className="absolute inset-0 z-[150]" />

        {/* Dynamic Glowing Spotlight Frame with "Punch-Out" Shadow */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }}
          exit={{ opacity: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 25 }}
          style={{
            boxShadow: '0 0 20px rgba(34,211,238,0.4), inset 0 0 20px rgba(34,211,238,0.1), 0 0 0 9999px rgba(2, 6, 23, 0.88)',
          }}
          className="absolute rounded-xl border-2 border-cyan-400 pointer-events-none z-[160]"
        >
          {/* Corner Tech Accents */}
          <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-cyan-300" />
          <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-cyan-300" />
          <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-cyan-300" />
          <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-cyan-300" />
        </motion.div>

        {/* Subspace Subtitle Audio Bar */}
        <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 z-[170] w-full max-w-[500px] px-4 pointer-events-none">
          <motion.div 
            key={currentStep} 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="bg-slate-950/95 border border-cyan-500/40 rounded-xl p-5 shadow-[0_20px_40px_rgba(0,0,0,0.8)] backdrop-blur-md relative overflow-hidden pointer-events-auto"
          >
            {/* Audio Wave Visualizer Pulse */}
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" style={{ boxShadow: '0 0 10px rgba(34,211,238,0.8)' }} />
              <span className="font-mono text-[10px] text-cyan-400 tracking-widest uppercase font-bold">
                [{stepData.tag}] • TRANSMISSION {currentStep + 1}/{TOUR_STEPS.length}
              </span>
            </div>

            {/* Subtitle Title & Description */}
            <h4 className="font-sans text-slate-100 text-lg font-bold tracking-wide mb-1.5 drop-shadow-md">
              {stepData.title}
            </h4>
            <p className="font-mono text-slate-300 text-xs leading-relaxed">
              {stepData.description}
            </p>

            {/* Controls Bar */}
            <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-800">
              <div className="flex items-center gap-2">
                {TOUR_STEPS.map((_, idx) => (
                  <div 
                    key={idx} 
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      idx === currentStep ? 'w-8 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'w-2 bg-slate-700'
                    }`} 
                  />
                ))}
              </div>

              <button
                onClick={handleComplete}
                className="font-mono text-[10px] text-slate-500 hover:text-cyan-400 transition-colors uppercase tracking-wider px-2 py-1 bg-slate-900 rounded border border-slate-800 hover:border-cyan-900"
              >
                Skip Orientation [ESC]
              </button>
            </div>
          </motion.div>
        </div>

      </div>
    </AnimatePresence>
  );
}