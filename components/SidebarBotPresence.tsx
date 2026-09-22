'use client';

import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { motion } from 'framer-motion';
import ProceduralBot from './ProceduralBot';

// Ambient home for the procedural bot, sitting in the sidebar between the
// nav list and the footer — previously it only ever appeared inside the
// closed chat bubble. Reuses the same component/lighting recipe as
// GlobalChatbot.tsx so it reads as the same character, not a separate
// model. In normal document flow (not position:fixed), so it can't overlap
// scrolling page content the way an overlay would.
export default function SidebarBotPresence({ alert = false }: { alert?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.5, ease: 'easeOut' }}
      style={{ flexShrink: 0, padding: '4px 12px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      <div
        className="relative"
        style={{ width: 68, height: 68, borderRadius: '50%', overflow: 'hidden', background: 'var(--glass)', border: '1px solid var(--border)' }}
      >
        {alert && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ border: '1px solid var(--red)' }}
            animate={{ boxShadow: ['0 0 0 0 rgba(248,113,113,0.5)', '0 0 0 8px rgba(248,113,113,0)'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <Canvas camera={{ position: [0, 0.3, 4.5], fov: 45 }}>
          <ambientLight intensity={0.8} />
          <spotLight position={[5, 5, 5]} intensity={3} color="#ffffff" />
          <spotLight position={[-5, -5, -2]} intensity={1} color={alert ? '#f87171' : '#22d3ee'} />
          <Environment preset="city" />
          <ProceduralBot alert={alert} />
        </Canvas>
      </div>
      <div
        style={{ fontSize: 8, fontFamily: 'var(--mono)', color: alert ? 'var(--red)' : 'var(--text3)', letterSpacing: 1.5, marginTop: 4, transition: 'color 0.3s ease' }}
      >
        VALKYRA SENTINEL
      </div>
    </motion.div>
  );
}
