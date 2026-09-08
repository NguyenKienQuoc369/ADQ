"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { motion } from "framer-motion";
import { ShieldCheck, BrainCircuit } from "lucide-react";

export function CyberShield3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const mousePos = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 340;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 5.0);

    // 2. High-Performance WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    container.appendChild(renderer.domElement);

    // 3. Ambient & Focused Cyber Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const cyanPointLight = new THREE.PointLight(0x22d3ee, 4.5, 12);
    cyanPointLight.position.set(2.0, 2.5, 4.0);
    scene.add(cyanPointLight);

    const blueRimLight = new THREE.DirectionalLight(0x38bdf8, 2.5);
    blueRimLight.position.set(-3.5, -2, 3);
    scene.add(blueRimLight);

    const backGlowLight = new THREE.PointLight(0x06b6d4, 3.0, 10);
    backGlowLight.position.set(0, 0, -2);
    scene.add(backGlowLight);

    // 4. Main Group
    const shieldGroup = new THREE.Group();
    scene.add(shieldGroup);

    // 5. Load User's 3D Shield Model OBJ with EXACT Centering & Logo
    const loader = new OBJLoader();
    loader.load(
      "/models/3d-model.obj",
      (obj) => {
        // Premium Polished Cyber Shield Material (Smooth, radiant azure cyan)
        const shieldMaterial = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color("#0284c7"),
          metalness: 0.88,
          roughness: 0.15,
          clearcoat: 1.0,
          clearcoatRoughness: 0.1,
          reflectivity: 0.95,
          emissive: new THREE.Color("#0891b2"),
          emissiveIntensity: 0.45,
          side: THREE.DoubleSide,
        });

        const edgeLineMaterial = new THREE.LineBasicMaterial({
          color: 0x67e8f9,
          transparent: true,
          opacity: 0.95,
          linewidth: 2,
        });

        obj.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;

            // EXACT CENTERING of geometry coordinates to (0, 0, 0)
            mesh.geometry.center();
            mesh.geometry.computeVertexNormals();
            mesh.geometry.computeBoundingBox();

            if (mesh.geometry.boundingBox) {
              const size = mesh.geometry.boundingBox.getSize(
                new THREE.Vector3()
              );
              const maxDim = Math.max(size.x, size.y, size.z);
              const scale = 3.6 / maxDim; // Auto-fit to viewport
              mesh.scale.setScalar(scale);
            }

            mesh.material = shieldMaterial;

            // Clean Outer Cyber Border (Double-rim border with NO vertical stripes and NO stray triangle)
            const edges = new THREE.EdgesGeometry(mesh.geometry, 8);
            const pos = edges.attributes.position;
            const cleanVertices: number[] = [];

            for (let i = 0; i < pos.count; i += 2) {
              const x1 = pos.getX(i), y1 = pos.getY(i), z1 = pos.getZ(i);
              const x2 = pos.getX(i + 1), y2 = pos.getY(i + 1), z2 = pos.getZ(i + 1);

              const isVertical = Math.abs(x1 - x2) < 5 && Math.abs(x1) < 950;
              const isTriangle =
                (Math.abs(x1 - -830.4) < 2 || Math.abs(x2 - -830.4) < 2) &&
                (Math.abs(y1 - -10.9) < 2 ||
                  Math.abs(y2 - -10.9) < 2 ||
                  Math.abs(y1 - 207.1) < 2 ||
                  Math.abs(y2 - 207.1) < 2);

              if (!isVertical && !isTriangle) {
                cleanVertices.push(x1, y1, z1, x2, y2, z2);
              }
            }

            if (cleanVertices.length > 0) {
              const cleanGeom = new THREE.BufferGeometry();
              cleanGeom.setAttribute(
                "position",
                new THREE.Float32BufferAttribute(cleanVertices, 3)
              );
              const borderLines = new THREE.LineSegments(
                cleanGeom,
                edgeLineMaterial
              );
              mesh.add(borderLines);
            }
          }
        });

        // Face front towards camera
        obj.rotation.y = Math.PI;

        shieldGroup.add(obj);

        // Load & mount ADQ Project Logo directly onto the front face of the shield
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load("/logo.png", (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          const logoMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0.98,
            depthWrite: false,
            depthTest: true,
            side: THREE.DoubleSide,
          });
          const logoGeometry = new THREE.PlaneGeometry(1.65, 1.65);
          const logoMesh = new THREE.Mesh(logoGeometry, logoMaterial);
          logoMesh.position.set(0, 0.15, -0.095);
          logoMesh.rotation.y = Math.PI; // Aligns perfectly with front of shield
          logoMesh.renderOrder = 10;
          obj.add(logoMesh);
        });

        setIsLoaded(true);
      },
      undefined,
      (err) => {
        console.error("Error loading 3D shield model:", err);
      }
    );

    // 6. Mouse Interaction for 3D Tilt (Only active when hovering directly over container)
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mousePos.current.targetX = Math.max(-1, Math.min(1, x)) * 0.45;
      mousePos.current.targetY = Math.max(-1, Math.min(1, y)) * 0.35;
    };

    const handleMouseLeave = () => {
      // Smoothly return to rest position when mouse leaves the shield
      mousePos.current.targetX = 0;
      mousePos.current.targetY = 0;
    };

    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);

    // 7. Responsive Resizing
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    };
    window.addEventListener("resize", handleResize);

    // 8. 60 FPS Render Loop with Smooth Floating Physics
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Smooth mouse interpolation (Lerping)
      mousePos.current.x +=
        (mousePos.current.targetX - mousePos.current.x) * 0.06;
      mousePos.current.y +=
        (mousePos.current.targetY - mousePos.current.y) * 0.06;

      // Shield floating oscillation & interactive mouse orientation
      shieldGroup.rotation.y =
        mousePos.current.x + Math.sin(elapsedTime * 0.8) * 0.18;
      shieldGroup.rotation.x =
        -mousePos.current.y + Math.cos(elapsedTime * 0.9) * 0.12;
      shieldGroup.position.y = Math.sin(elapsedTime * 1.3) * 0.1;

      // Subtle cyan light pulse
      cyanPointLight.intensity = 4.5 + Math.sin(elapsedTime * 2.5) * 1.0;

      renderer.render(scene, camera);
    };

    animate();

    // 9. Cleanup on Unmount
    return () => {
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative flex h-[320px] md:h-[350px] w-full items-center justify-center select-none">
      {/* Background Soft Radial Ambient Glow */}
      <div className="pointer-events-none absolute h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl" />
      <div className="pointer-events-none absolute h-44 w-44 rounded-full bg-sky-400/20 blur-2xl" />

      {/* Floating 3D WebGL Canvas */}
      <div
        ref={containerRef}
        className="relative z-10 h-full w-full cursor-grab active:cursor-grabbing"
      />

      {/* Floating Holographic Telemetry Chips */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="pointer-events-none absolute right-2 top-2 z-20 flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-[#020617]/70 px-3 py-1 text-[11px] font-mono text-cyan-300 backdrop-blur-md shadow-[0_0_20px_rgba(6,182,212,0.2)]"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
        <span>SHIELD: ACTIVE</span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="pointer-events-none absolute bottom-3 left-2 z-20 flex items-center gap-1.5 rounded-full border border-white/15 bg-[#020617]/70 px-3 py-1 text-[11px] font-mono text-slate-300 backdrop-blur-md shadow-sm"
      >
        <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
        <span>0 CRITICAL THREATS</span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="pointer-events-none absolute bottom-3 right-2 z-20 flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-[#020617]/70 px-3 py-1 text-[11px] font-mono text-emerald-300 backdrop-blur-md shadow-sm"
      >
        <BrainCircuit className="h-3.5 w-3.5 text-emerald-400" />
        <span>AI TRIAGE: ONLINE</span>
      </motion.div>
    </div>
  );
}
