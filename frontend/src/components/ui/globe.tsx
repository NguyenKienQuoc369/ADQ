"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";

const RADIUS = 2.15;

function latLngToVector3(
  lat: number,
  lng: number,
  radius = RADIUS
): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);

  return new THREE.Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

const threatNodes = [
  { lat: 10.8231, lng: 106.6297, size: 0.052 }, // HCMC
  { lat: 1.3521, lng: 103.8198, size: 0.045 },  // Singapore
  { lat: 35.6762, lng: 139.6503, size: 0.045 }, // Tokyo
  { lat: 37.5665, lng: 126.978, size: 0.04 },   // Seoul
  { lat: 51.5072, lng: -0.1276, size: 0.045 },  // London
  { lat: 50.1109, lng: 8.6821, size: 0.038 },   // Frankfurt
  { lat: 40.7128, lng: -74.006, size: 0.048 },  // New York
  { lat: 37.7749, lng: -122.4194, size: 0.042 },// San Francisco
  { lat: -33.8688, lng: 151.2093, size: 0.04 }, // Sydney
  { lat: 19.076, lng: 72.8777, size: 0.038 },   // Mumbai
];

const connectionPairs = [
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 5],
  [1, 8],
  [2, 7],
  [4, 5],
  [4, 6],
  [5, 9],
  [6, 7],
] as const;

function ThreatNode({
  node,
  index,
}: {
  node: { lat: number; lng: number; size: number };
  index: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

  const position = useMemo(
    () => latLngToVector3(node.lat, node.lng, RADIUS + 0.075),
    [node.lat, node.lng]
  );

  const nodeColor =
    index === 0
      ? "#34d399"
      : index % 3 === 0
        ? "#c084fc"
        : "#22d3ee";

  useFrame((state) => {
    if (!groupRef.current) return;

    const pulse =
      1 +
      Math.sin(state.clock.elapsedTime * 2.1 + index * 0.83) * 0.16;

    groupRef.current.scale.setScalar(pulse);
  });

  return (
    <group ref={groupRef} position={position}>
      <mesh>
        <sphereGeometry args={[node.size, 18, 18]} />
        <meshBasicMaterial color={nodeColor} />
      </mesh>

      <mesh>
        <sphereGeometry args={[node.size * 2.9, 18, 18]} />
        <meshBasicMaterial
          color={nodeColor}
          transparent
          opacity={0.105}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}


function GlobeMesh() {
  const globeRef = useRef<THREE.Group>(null);
  const radarRef = useRef<THREE.Group>(null);
  const outerRingRef = useRef<THREE.Mesh>(null);

  /*
   * Fibonacci sphere.
   * Cho bề mặt dạng digital point-cloud đều hơn rất nhiều
   * so với dùng vertices của sphereGeometry.
   */
  const surfacePoints = useMemo(() => {
    const count = 2200;
    const positions = new Float32Array(count * 3);
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < count; i += 1) {
      const y = 1 - (i / (count - 1)) * 2;
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = goldenAngle * i;

      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;

      positions[i * 3] = x * (RADIUS + 0.025);
      positions[i * 3 + 1] = y * (RADIUS + 0.025);
      positions[i * 3 + 2] = z * (RADIUS + 0.025);
    }

    return positions;
  }, []);

  /*
   * Longitude + latitude grid cực mảnh.
   */
  const gridLines = useMemo(() => {
    const lines: THREE.BufferGeometry[] = [];

    // Latitude
    for (let lat = -60; lat <= 60; lat += 30) {
      const points: THREE.Vector3[] = [];

      for (let lng = -180; lng <= 180; lng += 4) {
        points.push(latLngToVector3(lat, lng, RADIUS + 0.015));
      }

      lines.push(new THREE.BufferGeometry().setFromPoints(points));
    }

    // Longitude
    for (let lng = -150; lng <= 180; lng += 30) {
      const points: THREE.Vector3[] = [];

      for (let lat = -90; lat <= 90; lat += 3) {
        points.push(latLngToVector3(lat, lng, RADIUS + 0.015));
      }

      lines.push(new THREE.BufferGeometry().setFromPoints(points));
    }

    return lines;
  }, []);

  /*
   * Threat / traffic connections.
   * Control point được đẩy ra ngoài để tạo arc cong.
   */
  const connectionGeometries = useMemo(() => {
    return connectionPairs.map(([fromIndex, toIndex]) => {
      const fromNode = threatNodes[fromIndex];
      const toNode = threatNodes[toIndex];

      const start = latLngToVector3(
        fromNode.lat,
        fromNode.lng,
        RADIUS + 0.06
      );

      const end = latLngToVector3(
        toNode.lat,
        toNode.lng,
        RADIUS + 0.06
      );

      const middle = start
        .clone()
        .add(end)
        .multiplyScalar(0.5)
        .normalize()
        .multiplyScalar(RADIUS + 0.65);

      const curve = new THREE.QuadraticBezierCurve3(
        start,
        middle,
        end
      );

      return new THREE.BufferGeometry().setFromPoints(
        curve.getPoints(56)
      );
    });
  }, []);

  useFrame((state, delta) => {
    if (globeRef.current) {
      globeRef.current.rotation.y += delta * 0.075;

      globeRef.current.rotation.x =
        -0.08 + Math.sin(state.clock.elapsedTime * 0.18) * 0.025;
    }

    if (radarRef.current) {
      radarRef.current.rotation.z -= delta * 0.16;
      radarRef.current.rotation.y += delta * 0.05;
    }

    if (outerRingRef.current) {
      outerRingRef.current.rotation.z += delta * 0.08;
    }
  });

  return (
    <>
      {/* Global soft glow */}
      <pointLight
        position={[0, 0, 4]}
        intensity={8}
        distance={10}
        color="#0891b2"
      />

      <group ref={globeRef} rotation={[0.08, -0.45, -0.08]}>
        {/* Deep core */}
        <mesh>
          <sphereGeometry args={[RADIUS - 0.035, 64, 64]} />
          <meshStandardMaterial
            color="#020817"
            emissive="#063344"
            emissiveIntensity={0.28}
            roughness={0.88}
            metalness={0.15}
          />
        </mesh>

        {/* Very subtle inner shell */}
        <mesh>
          <sphereGeometry args={[RADIUS, 64, 64]} />
          <meshBasicMaterial
            color="#071827"
            transparent
            opacity={0.44}
          />
        </mesh>

        {/* Digital surface */}
        <points>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[surfacePoints, 3]}
            />
          </bufferGeometry>

          <pointsMaterial
            color="#67e8f9"
            size={0.016}
            transparent
            opacity={0.58}
            sizeAttenuation
            depthWrite={false}
          />
        </points>

        {/* Geographic grid */}
        {gridLines.map((geometry, index) => (
          <line key={`grid-${index}`}>
            <primitive object={geometry} attach="geometry" />
            <lineBasicMaterial
              color="#0891b2"
              transparent
              opacity={0.12}
            />
          </line>
        ))}

        {/* Network paths */}
        {connectionGeometries.map((geometry, index) => (
          <line key={`connection-${index}`}>
            <primitive object={geometry} attach="geometry" />
            <lineBasicMaterial
              color={
                index % 3 === 0
                  ? "#34d399"
                  : index % 3 === 1
                    ? "#22d3ee"
                    : "#a78bfa"
              }
              transparent
              opacity={0.62}
            />
          </line>
        ))}

        {/* Threat / infrastructure nodes */}
        {threatNodes.map((node, index) => (
          <ThreatNode
            key={`${node.lat}-${node.lng}`}
            node={node}
            index={index}
          />
        ))}

        {/* Atmosphere */}
        <mesh>
          <sphereGeometry args={[RADIUS + 0.12, 64, 64]} />
          <meshBasicMaterial
            color="#22d3ee"
            transparent
            opacity={0.055}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Orbital / radar rings */}
      <group ref={radarRef} rotation={[0.95, 0.18, 0.2]}>
        <mesh>
          <torusGeometry args={[2.63, 0.008, 8, 180]} />
          <meshBasicMaterial
            color="#22d3ee"
            transparent
            opacity={0.32}
          />
        </mesh>

        <mesh rotation={[0.18, 0, 0]}>
          <torusGeometry args={[2.78, 0.005, 8, 180]} />
          <meshBasicMaterial
            color="#34d399"
            transparent
            opacity={0.15}
          />
        </mesh>
      </group>

      <mesh
        ref={outerRingRef}
        rotation={[Math.PI / 2.55, 0.2, 0]}
      >
        <torusGeometry args={[2.92, 0.009, 8, 180]} />
        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.19}
        />
      </mesh>
    </>
  );
}

export function Globe() {
  return (
    <div className="group relative h-[400px] w-full overflow-hidden rounded-3xl border border-cyan-500/20 bg-[#020617]/90 shadow-[0_30px_80px_rgba(2,6,23,0.55)]">
      {/* Background glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/10 blur-[70px]" />

      {/* HUD */}
      <div className="pointer-events-none absolute left-5 top-5 z-10">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300">
            Global Attack Surface
          </span>
        </div>

        <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.15em] text-slate-600">
          Infrastructure intelligence
        </p>
      </div>

      <div className="pointer-events-none absolute right-5 top-5 z-10 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 font-mono text-[9px] tracking-[0.18em] text-emerald-400">
        LIVE
      </div>

      {/* Corner HUD decorations */}
      <div className="pointer-events-none absolute bottom-5 left-5 z-10 font-mono text-[9px] leading-5 text-slate-600">
        <p>ASSET MAP / GLOBAL</p>
        <p>ADQ SECURITY INTELLIGENCE</p>
      </div>

      <div className="pointer-events-none absolute bottom-5 right-5 z-10 text-right font-mono text-[9px] leading-5 text-cyan-500/50">
        <p>NODE LINK ACTIVE</p>
        <p>THREAT SURFACE</p>
      </div>

      {/* top / bottom vignette */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-24 bg-gradient-to-b from-[#020617]/55 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-20 bg-gradient-to-t from-[#020617]/65 to-transparent" />

      <Canvas
        dpr={[1, 1.6]}
        camera={{ position: [0, 0, 6.6], fov: 42 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
      >
        <ambientLight intensity={0.38} />

        <directionalLight
          position={[4, 3, 5]}
          intensity={1.8}
          color="#67e8f9"
        />

        <directionalLight
          position={[-4, -2, -3]}
          intensity={0.55}
          color="#6366f1"
        />

        <Suspense fallback={null}>
          <GlobeMesh />
        </Suspense>
      </Canvas>
    </div>
  );
}
