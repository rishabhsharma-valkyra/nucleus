'use client';

import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Cylinder, Capsule, RoundedBox, Center } from '@react-three/drei';
import * as THREE from 'three';

interface BotProps {
  isLoading?: boolean;
  // Data-reactive mood — eyes/core shift from cyan to red when true (e.g.
  // a live Red-triage case exists), independent of the chat's own loading
  // state so the bot's "mood" reflects real hospital state, not just typing.
  alert?: boolean;
  // Bump this number to fire a one-shot "notice" beat — head snaps to look
  // at the viewer and eyes flash, for moments like opening the chat.
  noticeTrigger?: number;
}

const MOOD_CYAN = new THREE.Color('#22d3ee');
const MOOD_RED = new THREE.Color('#f87171');

export default function ProceduralBot({ isLoading = false, alert = false, noticeTrigger = 0 }: BotProps) {
  const botGroupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);

  // Material Refs for pulsing
  const eyeLeftMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const eyeRightMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const coreMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const mouthRef = useRef<THREE.Mesh>(null);

  // Mesh refs (not material) so blinking can squash them on the Y axis.
  const eyeLeftMeshRef = useRef<THREE.Mesh>(null);
  const eyeRightMeshRef = useRef<THREE.Mesh>(null);

  // Cursor gaze-tracking — the bot looks toward the real mouse position
  // instead of a canned sine-wave sweep when idle.
  const pointerRef = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      pointerRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointerRef.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

  // Blinking — randomized interval, ~140ms eyelid-squash each time.
  const blinkRef = useRef({ next: 2 + Math.random() * 3, active: false, start: 0 });

  // Notice pulse — fires once whenever noticeTrigger changes. `pending` is
  // consumed on the next animation frame (which has the three.js clock),
  // since the effect itself runs outside the render loop.
  const noticeRef = useRef({ seen: noticeTrigger, pending: false, startTime: -10 });
  useEffect(() => {
    if (noticeTrigger !== noticeRef.current.seen) {
      noticeRef.current.seen = noticeTrigger;
      noticeRef.current.pending = true;
    }
  }, [noticeTrigger]);

  // Refs for the dynamic rocket exhaust
  const flameLRef = useRef<THREE.Mesh>(null);
  const flameRRef = useRef<THREE.Mesh>(null);
  const coreLRef = useRef<THREE.Mesh>(null);
  const coreRRef = useRef<THREE.Mesh>(null);
  const flameLMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const flameRMatRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;

    // 1. Ultra-Smooth Cinematic Floating
    if (botGroupRef.current) {
      const hoverSpeed = isLoading ? 4 : 2;
      const hoverAmplitude = isLoading ? 0.08 : 0.04;
      botGroupRef.current.position.y = Math.sin(time * hoverSpeed) * hoverAmplitude;
    }

    // 2. Gaze — tracks the real cursor when idle instead of a canned sweep.
    // A notice pulse briefly overrides this to snap toward the viewer.
    const noticeElapsed = time - noticeRef.current.startTime;
    if (noticeRef.current.pending) {
      noticeRef.current.startTime = time;
      noticeRef.current.pending = false;
    }
    const noticing = noticeElapsed < 0.6;

    if (headRef.current) {
      let targetRotY: number;
      let targetRotX: number;
      let lerpSpeed = 3;

      if (noticing) {
        // Quick look-at-viewer beat, then gaze resumes naturally.
        const settle = Math.min(noticeElapsed / 0.25, 1);
        targetRotY = THREE.MathUtils.lerp(0, pointerRef.current.x * 0.35, settle);
        targetRotX = THREE.MathUtils.lerp(0, -pointerRef.current.y * 0.15, settle);
        lerpSpeed = 10;
      } else if (isLoading) {
        targetRotY = Math.sin(time * 3) * 0.15;
        targetRotX = Math.sin(time * 2) * 0.08;
      } else {
        targetRotY = THREE.MathUtils.clamp(pointerRef.current.x * 0.35, -0.4, 0.4);
        targetRotX = THREE.MathUtils.clamp(-pointerRef.current.y * 0.15, -0.2, 0.2);
      }

      headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, targetRotY, delta * lerpSpeed);
      headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, targetRotX, delta * lerpSpeed);
    }

    // 3. Eye Pulse + Blink + Mood Color
    if (eyeLeftMatRef.current && eyeRightMatRef.current) {
      const basePulse = isLoading ? Math.abs(Math.sin(time * 5)) * 1.5 + 0.5 : 1.2;
      const pulse = noticing ? basePulse + (1 - Math.min(noticeElapsed / 0.3, 1)) * 2 : basePulse;
      eyeLeftMatRef.current.emissiveIntensity = THREE.MathUtils.lerp(eyeLeftMatRef.current.emissiveIntensity, pulse, delta * 5);
      eyeRightMatRef.current.emissiveIntensity = THREE.MathUtils.lerp(eyeRightMatRef.current.emissiveIntensity, pulse, delta * 5);

      const moodColor = alert ? MOOD_RED : MOOD_CYAN;
      eyeLeftMatRef.current.color.lerp(moodColor, delta * 4);
      eyeLeftMatRef.current.emissive.lerp(moodColor, delta * 4);
      eyeRightMatRef.current.color.lerp(moodColor, delta * 4);
      eyeRightMatRef.current.emissive.lerp(moodColor, delta * 4);
      if (coreMatRef.current) {
        coreMatRef.current.color.lerp(moodColor, delta * 4);
        coreMatRef.current.emissive.lerp(moodColor, delta * 4);
      }
    }

    // Blink — randomized interval, quick eyelid squash independent of pulse.
    const blink = blinkRef.current;
    if (!blink.active && time > blink.next) {
      blink.active = true;
      blink.start = time;
    }
    if (eyeLeftMeshRef.current && eyeRightMeshRef.current) {
      if (blink.active) {
        const t = time - blink.start;
        const dur = 0.14;
        const scaleY = t < dur ? Math.abs(Math.cos((t / dur) * Math.PI)) : 1;
        eyeLeftMeshRef.current.scale.y = Math.max(0.08, scaleY);
        eyeRightMeshRef.current.scale.y = Math.max(0.08, scaleY);
        if (t >= dur) {
          blink.active = false;
          blink.next = time + 2.5 + Math.random() * 3.5;
        }
      }
    }

    // 4. Voice / Mouth Animation
    if (mouthRef.current) {
      const speechScale = isLoading 
        ? 1 + Math.abs(Math.sin(time * 15)) * 1.5 
        : 1 + Math.abs(Math.sin(time * 2)) * 0.2;
      mouthRef.current.scale.x = THREE.MathUtils.lerp(mouthRef.current.scale.x, speechScale, delta * 10);
    }

    // 5. Dynamic Rocket Exhaust (Flickering Plasma Effect)
    if (flameLRef.current && flameRRef.current && coreLRef.current && coreRRef.current) {
      // Rapid chaotic scaling to simulate volatile thrust
      const outerScaleY = 1 + Math.random() * 0.4 + Math.sin(time * 30) * 0.2;
      const outerScaleXZ = 1 + Math.random() * 0.1;
      
      flameLRef.current.scale.set(outerScaleXZ, outerScaleY, outerScaleXZ);
      flameRRef.current.scale.set(outerScaleXZ, outerScaleY, outerScaleXZ);

      const coreScaleY = 1 + Math.random() * 0.3;
      coreLRef.current.scale.set(1, coreScaleY, 1);
      coreRRef.current.scale.set(1, coreScaleY, 1);

      // Flickering opacity
      if (flameLMatRef.current && flameRMatRef.current) {
        const opacity = 0.4 + Math.random() * 0.4;
        flameLMatRef.current.opacity = opacity;
        flameRMatRef.current.opacity = opacity;
      }
    }
  });

  // 🛡️ TACTICAL MATERIALS
  const matteAlloy = <meshStandardMaterial color="#1e293b" roughness={0.85} metalness={0.2} />;
  const darkMetal = <meshStandardMaterial color="#0f172a" roughness={0.9} metalness={0.5} />;
  const matteVisor = <meshStandardMaterial color="#020617" roughness={0.9} metalness={0.1} />;
  const cyanAccent = <meshStandardMaterial color="#0284c7" roughness={0.7} metalness={0.3} />;
  const glowMat = <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" toneMapped={false} />;

  return (
    <Center>
      <group ref={botGroupRef} scale={1.1}>
        
        {/* HEAD (Restored to original smooth shape) */}
        <group ref={headRef} position={[0, 0.9, 0]}>
          <Sphere args={[0.75, 32, 32]} scale={[1.15, 0.85, 0.95]}>{matteAlloy}</Sphere>
          <Sphere args={[0.7, 32, 32]} position={[0, 0, 0.1]} scale={[1.06, 0.76, 0.86]}>{matteVisor}</Sphere>

          {/* Digital Face */}
          <group position={[0, 0.05, 0.85]}>
            {/* Eyes */}
            <group position={[-0.28, 0, 0]} rotation={[0, 0, 0.05]}>
              <RoundedBox ref={eyeLeftMeshRef as any} args={[0.22, 0.05, 0.05]} radius={0.02} smoothness={4}>
                <meshStandardMaterial ref={eyeLeftMatRef} color="#22d3ee" emissive="#22d3ee" toneMapped={false} />
              </RoundedBox>
            </group>
            <group position={[0.28, 0, 0]} rotation={[0, 0, -0.05]}>
              <RoundedBox ref={eyeRightMeshRef as any} args={[0.22, 0.05, 0.05]} radius={0.02} smoothness={4}>
                <meshStandardMaterial ref={eyeRightMatRef} color="#22d3ee" emissive="#22d3ee" toneMapped={false} />
              </RoundedBox>
            </group>

            {/* Voice Waveform Mouth */}
            <RoundedBox ref={mouthRef as any} args={[0.15, 0.02, 0.02]} position={[0, -0.2, 0]} radius={0.01}>
              {glowMat}
            </RoundedBox>
          </group>

          {/* Earpieces */}
          <group position={[-0.85, 0, 0]}>
            <Cylinder args={[0.22, 0.22, 0.12, 24]} rotation={[0, 0, Math.PI / 2]}>{matteAlloy}</Cylinder>
            <Capsule args={[0.02, 0.2]} position={[-0.08, 0.25, 0]}>{cyanAccent}</Capsule>
          </group>
          <group position={[0.85, 0, 0]}>
            <Cylinder args={[0.22, 0.22, 0.12, 24]} rotation={[0, 0, Math.PI / 2]}>{matteAlloy}</Cylinder>
            <Capsule args={[0.02, 0.2]} position={[0.08, 0.25, 0]}>{cyanAccent}</Capsule>
          </group>
        </group>

        {/* TORSO (Restored to original sleek shape) */}
        <group position={[0, -0.1, 0]}>
          <Capsule args={[0.5, 0.35, 24, 32]}>{matteAlloy}</Capsule>
          {/* Glowing Core */}
          <Sphere args={[0.32, 24, 24]} position={[0, -0.05, 0.38]} scale={[0.8, 0.6, 0.3]}>
            <meshStandardMaterial ref={coreMatRef} color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.6} toneMapped={false} />
          </Sphere>

          {/* Back Anti-Gravity Thrusters */}
          <group position={[0, -0.65, -0.20]} rotation={[0.2, 0, 0]}>
            
            {/* Left Engine */}
            <group position={[-0.22, 0, 0]}>
              <Cylinder args={[0.06, 0.1, 0.15, 16]}>{darkMetal}</Cylinder>
              {/* Animated Outer Flame */}
              <mesh ref={flameLRef} position={[0, -0.2, 0]} rotation={[Math.PI, 0, 0]}>
                <coneGeometry args={[0.08, 0.4, 16]} />
                <meshStandardMaterial ref={flameLMatRef} color="#0ea5e9" emissive="#0ea5e9" emissiveIntensity={2.5} transparent toneMapped={false} />
              </mesh>
              {/* Animated Inner Hot Core */}
              <mesh ref={coreLRef} position={[0, -0.1, 0]} rotation={[Math.PI, 0, 0]}>
                <capsuleGeometry args={[0.02, 0.15, 8, 16]} />
                <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={4} toneMapped={false} />
              </mesh>
            </group>

            {/* Right Engine */}
            <group position={[0.22, 0, 0]}>
              <Cylinder args={[0.06, 0.1, 0.15, 16]}>{darkMetal}</Cylinder>
              {/* Animated Outer Flame */}
              <mesh ref={flameRRef} position={[0, -0.2, 0]} rotation={[Math.PI, 0, 0]}>
                <coneGeometry args={[0.08, 0.4, 16]} />
                <meshStandardMaterial ref={flameRMatRef} color="#0ea5e9" emissive="#0ea5e9" emissiveIntensity={2.5} transparent toneMapped={false} />
              </mesh>
              {/* Animated Inner Hot Core */}
              <mesh ref={coreRRef} position={[0, -0.1, 0]} rotation={[Math.PI, 0, 0]}>
                <capsuleGeometry args={[0.02, 0.15, 8, 16]} />
                <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={4} toneMapped={false} />
              </mesh>
            </group>
            
          </group>
        </group>

        {/* FLOATING ARMS (Restored to original sleek style without shoulders) */}
        <Capsule args={[0.12, 0.35, 16, 24]} position={[-0.72, 0.05, 0]} rotation={[0, 0, -0.35]}>{matteAlloy}</Capsule>
        <Capsule args={[0.12, 0.35, 16, 24]} position={[0.72, 0.05, 0]} rotation={[0, 0, 0.35]}>{matteAlloy}</Capsule>
        
      </group>
    </Center>
  );
}