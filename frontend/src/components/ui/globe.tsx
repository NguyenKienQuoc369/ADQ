"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";

function GlobeMesh() {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  const arcPositions = useMemo(() => {
    const points: number[] = [];
    for (let i = 0; i < 240; i += 1) {
      const angle = (i / 240) * Math.PI * 2;
      const radius = 2.45 + Math.sin(i * 0.1) * 0.05;
      points.push(Math.cos(angle) * radius, Math.sin(angle) * radius, Math.sin(angle * 2) * 0.28);
    }
    return new Float32Array(points);
  }, []);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.2;
      groupRef.current.rotation.x = Math.sin(Date.now() * 0.00015) * 0.16;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 0.5;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[2.2, 64, 64]} />
        <meshStandardMaterial color="#0b1222" emissive="#0ea5e9" emissiveIntensity={0.18} metalness={0.45} roughness={0.4} wireframe />
      </mesh>

      <mesh ref={ringRef} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[2.65, 0.02, 16, 120]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.65} />
      </mesh>

      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[arcPositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#34d399" transparent opacity={0.45} />
      </line>

      <points>
        <sphereGeometry args={[2.28, 32, 32]} />
        <pointsMaterial color="#7dd3fc" size={0.02} transparent opacity={0.7} />
      </points>
    </group>
  );
}

export function Globe() {
  return (
    <div className="h-[360px] w-full overflow-hidden rounded-3xl border border-cyan-500/20 bg-[#020617]/80">
      <Canvas camera={{ position: [0, 0, 6], fov: 45 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[4, 4, 5]} intensity={1.1} color="#67e8f9" />
        <Suspense fallback={null}>
          <GlobeMesh />
        </Suspense>
      </Canvas>
    </div>
  );
}
