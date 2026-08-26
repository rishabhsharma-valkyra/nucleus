'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useMotionValue, useTransform, animate, AnimatePresence, useSpring } from 'framer-motion';
import { useEffect } from 'react';

// Renders via a portal to document.body — position:fixed only tracks the
// viewport when nothing between it and <body> has a CSS transform, and
// framer-motion's motion.div always sets an inline transform (even at rest,
// for GPU acceleration). Any tooltip nested inside an animated ancestor
// would otherwise be positioned relative to that ancestor's box instead of
// the viewport, drifting off and clipping at screen edges.
function CursorTooltip({ tooltip, isHovered, smoothX, smoothY }: { tooltip: string; isHovered: boolean; smoothX: any; smoothY: any }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {isHovered && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.15 }}
          style={{ position: 'fixed', left: smoothX, top: smoothY }}
          className="w-max max-w-[220px] bg-slate-900 border border-slate-700/80 rounded px-3 py-2 text-[11px] leading-relaxed text-slate-200 font-mono shadow-[0_10px_20px_rgba(0,0,0,0.5)] z-[9999] pointer-events-none"
        >
          {tooltip}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

// Shared "premium" metric primitives — originally built for Overview, now
// reusable anywhere a KPI card wants the count-up animation, scanner-sweep
// glow, and cursor-following tooltip.

export function AnimatedNumber({ value, decimals = 0 }: { value: any; decimals?: number }) {
  const count = useMotionValue(0);
  const formatted = useTransform(count, (latest) => latest.toFixed(decimals));
  const isNumeric = value !== '—' && value !== undefined && value !== null && value !== '' && !isNaN(Number(value));

  useEffect(() => {
    if (isNumeric) {
      const controls = animate(count, Number(value), { duration: 1.5, ease: 'easeOut' });
      return controls.stop;
    }
  }, [value, count, isNumeric]);

  // Non-numeric values (e.g. "Thermal Injury", a responder name, "—") render as-is.
  if (!isNumeric) return <span>{value}</span>;
  return <motion.span>{formatted}</motion.span>;
}

export function ScannerSweep() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-lg opacity-[0.15]">
      <motion.div
        className="w-full h-[1px] bg-gradient-to-r from-transparent via-[#22d3ee] to-transparent shadow-[0_0_8px_rgba(34,211,238,0.8)]"
        animate={{ y: ['-100%', '600%'] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear', delay: Math.random() * 2 }}
      />
    </div>
  );
}

// Generic hover-tooltip wrapper for blocks that don't fit MetricCard's fixed
// label/value/sub shape (progress rings, stat pills, legend items, etc.) —
// same cursor-following tooltip UI, but wraps arbitrary children.
export function HoverTooltip({ tooltip, children, className = '', style }: { tooltip: string; children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const [isHovered, setIsHovered] = useState(false);
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);
  const springConfig = { damping: 25, stiffness: 300, mass: 0.5 };
  const smoothX = useSpring(cursorX, springConfig);
  const smoothY = useSpring(cursorY, springConfig);

  const handleMouseMove = (e: React.MouseEvent) => {
    cursorX.set(Math.min(e.clientX + 15, window.innerWidth - 236));
    cursorY.set(Math.max(10, e.clientY - 40));
  };

  return (
    <div
      className={`relative ${className}`}
      style={style}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseMove={handleMouseMove}
    >
      <CursorTooltip tooltip={tooltip} isHovered={isHovered} smoothX={smoothX} smoothY={smoothY} />
      {children}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  sub,
  color,
  bg,
  decimals = 0,
  suffix = '',
  tooltip,
}: {
  label: string;
  value: any;
  sub?: string;
  color: string;
  bg: string;
  decimals?: number;
  suffix?: string;
  tooltip?: string;
}) {
  const [isHovered, setIsHovered] = useState(false);

  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);

  const springConfig = { damping: 25, stiffness: 300, mass: 0.5 };
  const smoothX = useSpring(cursorX, springConfig);
  const smoothY = useSpring(cursorY, springConfig);

  const handleMouseMove = (e: React.MouseEvent) => {
    cursorX.set(Math.min(e.clientX + 15, window.innerWidth - 236));
    cursorY.set(Math.max(10, e.clientY - 40));
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseMove={handleMouseMove}
    >
      {tooltip && <CursorTooltip tooltip={tooltip} isHovered={isHovered} smoothX={smoothX} smoothY={smoothY} />}

      <div className={`metric-card ${bg} relative transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[inset_0_0_20px_rgba(255,255,255,0.02)] overflow-hidden`}>
        <ScannerSweep />
        <div className="metric-label relative z-10">{label}</div>
        <div className={`metric-value ${color} relative z-10`}>
          <AnimatedNumber value={value} decimals={decimals} />
          {suffix}
        </div>
        {sub && <div className="metric-delta relative z-10" dangerouslySetInnerHTML={{ __html: sub }} />}
      </div>
    </div>
  );
}
