'use client';

import { useState, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Environment, Float, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { motion } from 'framer-motion';

// 1. The 3D Glasses Component
function GlassesModel({ onComplete }: { onComplete: () => void }) {
  // Load your 3D model from the public folder
  const { scene } = useGLTF('/xr-glasses.glb'); 
  const { camera } = useThree();
  const [animationStage, setAnimationStage] = useState<'intro' | 'zoom'>('intro');

  useEffect(() => {
    // Wait 2 seconds for the cinematic intro, then trigger the zoom through the lens
    const timer = setTimeout(() => setAnimationStage('zoom'), 2000);
    return () => clearTimeout(timer);
  }, []);

  useFrame((state, rawDelta) => {
    // Cap the step: after a background-tab pause the first delta can be minutes,
    // which would overshoot every lerp / jump the rotation in one frame.
    const delta = Math.min(rawDelta, 1 / 30);
    const blend = (speed: number) => Math.min(1, delta * speed);
    if (animationStage === 'intro') {
      // Cinematic slow rotation while floating
      scene.rotation.y += delta * 0.2;
    } 
    
    if (animationStage === 'zoom') {
      // The "Dive In" Animation: Move camera forward THROUGH the lens
      // We lerp (smoothly transition) the camera's Z position to push it past the glasses
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, -2, blend(3));
      
      // We also lerp the camera's X position slightly to aim precisely at the right lens
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, 0.5, blend(2));

      // Once the camera passes through the lens (Z < 0.1), trigger the dashboard
      if (camera.position.z < 0.1) {
        onComplete();
      }
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
      {/* Scale and position will depend on your specific .glb model size */}
      <primitive object={scene} scale={1.5} position={[0, 0, 0]} />
    </Float>
  );
}

// 2. The Full Screen Wrapper Component
export default function XRTransition({ onTransitionEnd }: { onTransitionEnd: () => void }) {
  const [isFadingOut, setIsFadingOut] = useState(false);

  const handleCameraPassedLens = () => {
    if (!isFadingOut) {
      setIsFadingOut(true);
      // Wait for the white flash fade-out to finish before unmounting the 3D scene
      setTimeout(() => {
        onTransitionEnd();
      }, 800);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: isFadingOut ? 0 : 1 }} 
      transition={{ duration: 0.8, ease: "easeInOut" }}
      className="fixed inset-0 z-[999] bg-[#020617] flex items-center justify-center overflow-hidden"
    >
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        {/* Cinematic Lighting Setup */}
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={2} color="#22d3ee" />
        <Environment preset="city" /> 
        
        <GlassesModel onComplete={handleCameraPassedLens} />
        
        {/* Ground shadow for realism */}
        <ContactShadows position={[0, -1.5, 0]} opacity={0.5} scale={10} blur={2} far={4} />
      </Canvas>

      {/* Optional: Add a subtle overlay text that fades out before the dive */}
      {!isFadingOut && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute bottom-12 text-cyan-500 font-mono text-sm tracking-widest animate-pulse"
        >
          INITIALIZING VALKYRA XR...
        </motion.div>
      )}
    </motion.div>
  );
}

// Preload the model so it's instantly ready when the user logs in
useGLTF.preload('/xr-glasses.glb');