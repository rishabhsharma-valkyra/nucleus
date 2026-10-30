'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Environment, ContactShadows, Center } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';

// ==========================================
// 1. THE 3D SCENE & CAMERA DIVE LOGIC
// ==========================================
function CinematicGlasses({ phase, onLensBreach }: { phase: 'intro' | 'dive'; onLensBreach: () => void }) {
  const { scene } = useGLTF('/xr-glasses.glb');
  const { camera } = useThree();
  const hasTriggered = useRef(false);

  // 540 degrees = 1 full spin + half spin to face the back
  const targetRotation = useRef(Math.PI * 3); 

  useFrame((state, rawDelta) => {
    // Cap the step: after a background-tab pause the first delta can be minutes,
    // which would overshoot every lerp / jump the rotation in one frame.
    const delta = Math.min(rawDelta, 1 / 30);
    const blend = (speed: number) => Math.min(1, delta * speed);
    // 1. The Cinematic Spin
    scene.rotation.y = THREE.MathUtils.lerp(scene.rotation.y, targetRotation.current, blend(1.5));
    scene.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.1;

    // 2. The Dive Through the Lens
    if (phase === 'dive') {
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, -1.5, blend(4));
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, 0.38, blend(4));
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, 0.05, blend(4));

      if (camera.position.z < 1.0) {
        scene.traverse((child: any) => {
          if (child.isMesh && child.material) {
            child.material.transparent = true; 
            child.material.opacity = THREE.MathUtils.lerp(child.material.opacity, 0, blend(8));
          }
        });
      }

      if (camera.position.z < 0.4 && !hasTriggered.current) {
        hasTriggered.current = true;
        onLensBreach();
      }
    }
  });

  return (
    <Center>
      <primitive object={scene} scale={1.2} />
    </Center>
  );
}

useGLTF.preload('/xr-glasses.glb');

// ==========================================
// 2. THE MAIN LOADER & UI OVERLAY
// ==========================================
export default function Loader({ onComplete }: { onComplete?: () => void }) {
  const [phase, setPhase] = useState<'intro' | 'dive'>('intro');
  const [showText, setShowText] = useState(true);
  const [flash, setFlash] = useState(false);
  const [isUnmounted, setIsUnmounted] = useState(false);

  useEffect(() => {
    // 🛡️ THE FIX: The moment the loader mounts (e.g., on page refresh), 
    // wipe the old session storage and broadcast the kill switch.
    sessionStorage.setItem('valkyra-loaded', 'false');
    window.dispatchEvent(new Event('valkyra-hide'));

    const textTimer = setTimeout(() => setShowText(false), 3500); 
    const diveTimer = setTimeout(() => setPhase('dive'), 3800); 
    
    return () => {
      clearTimeout(textTimer);
      clearTimeout(diveTimer);
    };
  }, []);

  const handleLensBreach = () => {
    setFlash(true);
    setTimeout(() => {
      setIsUnmounted(true);
      
      // Tell the chatbot it is safe to appear now
      sessionStorage.setItem('valkyra-loaded', 'true');
      window.dispatchEvent(new Event('valkyra-ready'));
      
      if (onComplete) onComplete();
    }, 600);
  };

  if (isUnmounted) return null;

  return (
    <motion.div 
      animate={{ opacity: flash ? 0 : 1 }} 
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed inset-0 z-[9999] overflow-hidden pointer-events-none"
    >
      <motion.div 
        animate={{ opacity: phase === 'intro' ? 1 : 0 }} 
        transition={{ duration: 1.2, ease: "easeInOut" }}
        className="absolute inset-0 bg-[#020617] z-[-1]" 
      />

      <div className="absolute inset-0 w-full h-full z-0">
        <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
          <ambientLight intensity={0.2} />
          <spotLight position={[0, 5, 5]} intensity={3} color="#22d3ee" penumbra={1} />
          <spotLight position={[0, -5, -5]} intensity={2} color="#4f46e5" penumbra={1} />
          <Environment preset="studio" /> 
          <Suspense fallback={null}>
            <CinematicGlasses phase={phase} onLensBreach={handleLensBreach} />
            {phase === 'intro' && (
              <ContactShadows position={[0, -1.8, 0]} opacity={0.6} scale={15} blur={2.5} far={4} />
            )}
          </Suspense>
        </Canvas>
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-end pb-24 z-10">
        <AnimatePresence>
          {showText && (
            <motion.div 
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center text-center"
            >
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
                className="text-sm md:text-xl font-mono tracking-[0.5em] text-cyan-500 mb-2 uppercase"
              >
                Welcome to the
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8, duration: 1, ease: "backOut" }}
                className="text-4xl md:text-7xl font-bold tracking-widest text-white uppercase drop-shadow-[0_0_20px_rgba(34,211,238,0.5)]"
                style={{ fontFamily: 'var(--font-sans), sans-serif' }}
              >
                Valkyra Experience
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {flash && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 z-50 bg-cyan-400 mix-blend-screen"
            style={{ backdropFilter: 'blur(20px)' }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}