import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { motion } from 'motion/react';
import { 
  FileText, 
  Code, 
  Mic, 
  Award, 
  TrendingUp, 
  BrainCircuit, 
  CheckCircle2, 
  Sparkles 
} from 'lucide-react';

interface AI3DCoreProps {
  interactive?: boolean;
  size?: 'sm' | 'md' | 'lg';
  isSpeaking?: boolean;
  showFloatingBadges?: boolean;
}

export const AI3DCore: React.FC<AI3DCoreProps> = ({
  interactive = true,
  size = 'lg',
  isSpeaking = false,
  showFloatingBadges = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webGlSupported, setWebGlSupported] = useState<boolean>(true);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    // Check WebGL availability
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        setWebGlSupported(false);
        return;
      }
    } catch {
      setWebGlSupported(false);
      return;
    }

    const container = containerRef.current;
    const width = container.clientWidth || 450;
    const height = container.clientHeight || 450;

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 7;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Core Group
    const coreGroup = new THREE.Group();
    scene.add(coreGroup);

    // 1. Inner Glowing Wireframe Sphere
    const innerGeo = new THREE.IcosahedronGeometry(1.4, 3);
    const innerMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#3b82f6'),
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    const innerSphere = new THREE.Mesh(innerGeo, innerMat);
    coreGroup.add(innerSphere);

    // 2. Central Neural Point Cloud
    const particleCount = 280;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);

    const color1 = new THREE.Color('#06b6d4'); // Cyan
    const color2 = new THREE.Color('#8b5cf6'); // Violet
    const color3 = new THREE.Color('#3b82f6'); // Electric Blue

    for (let i = 0; i < particleCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = Math.cbrt(Math.random()) * 1.5 + 0.2;
      const sinPhi = Math.sin(phi);

      particlePositions[i * 3] = r * sinPhi * Math.cos(theta);
      particlePositions[i * 3 + 1] = r * sinPhi * Math.sin(theta);
      particlePositions[i * 3 + 2] = r * Math.cos(phi);

      const mixedColor = i % 3 === 0 ? color1 : i % 3 === 1 ? color2 : color3;
      particleColors[i * 3] = mixedColor.r;
      particleColors[i * 3 + 1] = mixedColor.g;
      particleColors[i * 3 + 2] = mixedColor.b;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.065,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    coreGroup.add(particleSystem);

    // 3. Concentric Orbital Rings
    const createRing = (radius: number, color: string, rotX: number, rotY: number) => {
      const ringGeo = new THREE.TorusGeometry(radius, 0.018, 16, 100);
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0.6,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = rotX;
      ring.rotation.y = rotY;
      return ring;
    };

    const ring1 = createRing(2.1, '#06b6d4', Math.PI / 4, Math.PI / 6);
    const ring2 = createRing(2.4, '#8b5cf6', -Math.PI / 3, Math.PI / 4);
    const ring3 = createRing(2.7, '#3b82f6', Math.PI / 2.2, 0);

    coreGroup.add(ring1);
    coreGroup.add(ring2);
    coreGroup.add(ring3);

    // 4. Subtle Outer Floating Satellite Spheres
    const satellites: THREE.Mesh[] = [];
    const satCount = 6;
    for (let i = 0; i < satCount; i++) {
      const satGeo = new THREE.SphereGeometry(0.06, 12, 12);
      const satMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? new THREE.Color('#38bdf8') : new THREE.Color('#c084fc'),
      });
      const sat = new THREE.Mesh(satGeo, satMat);
      coreGroup.add(sat);
      satellites.push(sat);
    }

    // Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      const speakingMultiplier = isSpeaking ? 2.4 : 1.0;

      // Rotate groups
      innerSphere.rotation.y = elapsed * 0.25 * speakingMultiplier;
      innerSphere.rotation.x = elapsed * 0.15;

      particleSystem.rotation.y = -elapsed * 0.18 * speakingMultiplier;
      particleSystem.rotation.z = elapsed * 0.1;

      ring1.rotation.z = elapsed * 0.3 * speakingMultiplier;
      ring2.rotation.z = -elapsed * 0.25 * speakingMultiplier;
      ring3.rotation.z = elapsed * 0.2 * speakingMultiplier;

      // Satellite orbital paths
      satellites.forEach((sat, idx) => {
        const angle = elapsed * 0.6 + (idx * (Math.PI * 2)) / satCount;
        const rad = 2.4 + Math.sin(elapsed + idx) * 0.2;
        sat.position.x = Math.cos(angle) * rad;
        sat.position.y = Math.sin(angle * 0.7) * (rad * 0.6);
        sat.position.z = Math.sin(angle) * rad;
      });

      // Subtle mouse tracking
      if (interactive) {
        coreGroup.rotation.x += (mousePos.y * 0.4 - coreGroup.rotation.x) * 0.05;
        coreGroup.rotation.y += (mousePos.x * 0.5 - coreGroup.rotation.y) * 0.05;
      }

      // Pulse on speaking
      if (isSpeaking) {
        const pulse = 1 + Math.sin(elapsed * 8) * 0.08;
        coreGroup.scale.set(pulse, pulse, pulse);
      } else {
        coreGroup.scale.set(1, 1, 1);
      }

      renderer.render(scene, camera);
    };

    animate();

    // Resize handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 450;
      const h = container.clientHeight || 450;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [interactive, isSpeaking]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    setMousePos({ x, y });
  };

  const containerSizes = {
    sm: 'w-64 h-64',
    md: 'w-80 h-80',
    lg: 'w-full max-w-[480px] h-[440px]',
  };

  return (
    <div 
      className={`relative flex items-center justify-center select-none ${containerSizes[size]}`}
      onMouseMove={handleMouseMove}
      id="ai-3d-core-container"
    >
      {/* Background Soft Glow Radial Backdrop */}
      <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/10 via-indigo-600/15 to-violet-600/10 rounded-full blur-3xl pointer-events-none transform scale-90 animate-pulse" />

      {/* WebGL 3D Canvas */}
      <div 
        ref={containerRef} 
        className="relative z-10 w-full h-full flex items-center justify-center"
      />

      {/* Fallback CSS 3D Animated Orb if WebGL unavailable */}
      {!webGlSupported && (
        <div className="relative z-10 w-48 h-48 rounded-full flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-cyan-400/40 animate-ping opacity-25" />
          <div className="absolute inset-2 rounded-full border-2 border-dashed border-violet-500/50 animate-spin" style={{ animationDuration: '12s' }} />
          <div className="absolute inset-6 rounded-full bg-gradient-to-br from-cyan-500/30 via-blue-600/40 to-violet-600/30 backdrop-blur-md flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <BrainCircuit className="w-16 h-16 text-cyan-300 animate-pulse" />
          </div>
        </div>
      )}

      {/* Floating 3D Metric Badges */}
      {showFloatingBadges && (
        <>
          {/* Badge 1: Top Left - 92% Answer Quality */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: [0, -8, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-3 -left-4 sm:top-2 sm:-left-6 z-20 flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-900/85 backdrop-blur-md border border-cyan-500/30 shadow-lg shadow-cyan-950/50 text-xs font-medium text-slate-100"
            id="badge-answer-quality"
          >
            <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Quality Index</div>
              <div className="text-cyan-300 font-bold flex items-center gap-1">
                92% <span className="text-[10px] text-emerald-400 font-normal">Accurate</span>
              </div>
            </div>
          </motion.div>

          {/* Badge 2: Top Right - 87% Technical Score */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: [0, 8, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
            className="absolute -top-4 -right-4 sm:top-4 sm:-right-4 z-20 flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-900/85 backdrop-blur-md border border-violet-500/30 shadow-lg shadow-violet-950/50 text-xs font-medium text-slate-100"
            id="badge-tech-score"
          >
            <div className="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-400/30 flex items-center justify-center text-violet-400">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Technical Score</div>
              <div className="text-violet-300 font-bold flex items-center gap-1">
                87/100 <span className="text-[10px] text-violet-400 font-normal">Mastery</span>
              </div>
            </div>
          </motion.div>

          {/* Badge 3: Bottom Right - AI Evaluation Complete */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: [0, -6, 0] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
            className="absolute -bottom-2 -right-4 sm:bottom-6 sm:-right-6 z-20 flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-900/85 backdrop-blur-md border border-blue-500/30 shadow-lg shadow-blue-950/50 text-xs font-medium text-slate-100"
            id="badge-ai-eval"
          >
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <BrainCircuit className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">AI Evaluation</div>
              <div className="text-blue-300 font-bold flex items-center gap-1">
                Real-Time <Sparkles className="w-3 h-3 text-amber-400" />
              </div>
            </div>
          </motion.div>

          {/* Badge 4: Bottom Left - Voice & Speech Analysis */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: [0, 7, 0] }}
            transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut', delay: 1.8 }}
            className="absolute -bottom-4 -left-4 sm:bottom-4 sm:-left-6 z-20 flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-900/85 backdrop-blur-md border border-emerald-500/30 shadow-lg shadow-emerald-950/50 text-xs font-medium text-slate-100"
            id="badge-voice-stt"
          >
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Voice Engine</div>
              <div className="text-emerald-300 font-bold">Speech-to-Text</div>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
};
