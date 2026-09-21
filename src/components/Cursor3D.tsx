import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Eye, EyeOff, Palette, Zap } from 'lucide-react';

export type CursorTheme = 'cyber-cyan' | 'neural-violet' | 'matrix-emerald' | 'plasma-amber';

interface ThemeColorConfig {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  coreColor: string;
  glowClass: string;
}

export const CURSOR_THEMES: Record<CursorTheme, ThemeColorConfig> = {
  'cyber-cyan': {
    name: 'Cyber Cyan',
    primary: '#06b6d4', // cyan-500
    secondary: '#3b82f6', // blue-500
    accent: '#8b5cf6', // violet-500
    coreColor: '#e0f2fe',
    glowClass: 'from-cyan-500 to-blue-500',
  },
  'neural-violet': {
    name: 'Neural Violet',
    primary: '#a855f7', // purple-500
    secondary: '#ec4899', // pink-500
    accent: '#6366f1', // indigo-500
    coreColor: '#fdf4ff',
    glowClass: 'from-purple-500 to-pink-500',
  },
  'matrix-emerald': {
    name: 'Matrix Emerald',
    primary: '#10b981', // emerald-500
    secondary: '#06b6d4', // cyan-500
    accent: '#84cc16', // lime-500
    coreColor: '#ecfdf5',
    glowClass: 'from-emerald-500 to-teal-500',
  },
  'plasma-amber': {
    name: 'Plasma Amber',
    primary: '#f59e0b', // amber-500
    secondary: '#ef4444', // red-500
    accent: '#f97316', // orange-500
    coreColor: '#fffbeb',
    glowClass: 'from-amber-500 to-orange-500',
  },
};

interface ParticleNode {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  colorIdx: number;
}

interface ClickBurst {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  opacity: number;
  color: THREE.Color;
}

export const Cursor3D: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('smart_interview_3d_cursor_enabled');
    return saved !== null ? saved === 'true' : true;
  });

  const [theme, setTheme] = useState<CursorTheme>(() => {
    const saved = localStorage.getItem('smart_interview_3d_cursor_theme');
    return (saved as CursorTheme) || 'cyber-cyan';
  });

  const [trailMode, setTrailMode] = useState<'dense' | 'light' | 'off'>(() => {
    const saved = localStorage.getItem('smart_interview_3d_cursor_trail');
    return (saved as 'dense' | 'light' | 'off') || 'dense';
  });

  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(false);
  const [isHoveredInteractive, setIsHoveredInteractive] = useState<boolean>(false);
  const [hoverLabel, setHoverLabel] = useState<string>('');
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [isMouseInWindow, setIsMouseInWindow] = useState<boolean>(true);

  // Mouse & Physics Refs
  const mouseRef = useRef<{
    targetX: number;
    targetY: number;
    currentX: number;
    currentY: number;
    velocityX: number;
    velocityY: number;
    isDown: boolean;
    isHovering: boolean;
    hoverType: string;
  }>({
    targetX: typeof window !== 'undefined' ? window.innerWidth / 2 : 0,
    targetY: typeof window !== 'undefined' ? window.innerHeight / 2 : 0,
    currentX: typeof window !== 'undefined' ? window.innerWidth / 2 : 0,
    currentY: typeof window !== 'undefined' ? window.innerHeight / 2 : 0,
    velocityX: 0,
    velocityY: 0,
    isDown: false,
    isHovering: false,
    hoverType: '',
  });

  const particlesRef = useRef<ParticleNode[]>([]);
  const burstsRef = useRef<ClickBurst[]>([]);

  // Update localStorage when configs change
  useEffect(() => {
    localStorage.setItem('smart_interview_3d_cursor_enabled', String(isEnabled));
  }, [isEnabled]);

  useEffect(() => {
    localStorage.setItem('smart_interview_3d_cursor_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('smart_interview_3d_cursor_trail', trailMode);
  }, [trailMode]);

  // Check touch device on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isCoarse = window.matchMedia('(pointer: coarse)').matches;
      setIsTouchDevice(isCoarse);
    }
  }, []);

  // Keyboard shortcut: Alt + C toggles 3D cursor or opens config
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        setShowConfigModal((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Main Three.js Rendering Engine
  useEffect(() => {
    if (!isEnabled || isTouchDevice || !canvasRef.current) return;

    const canvas = canvasRef.current;
    let width = window.innerWidth;
    let height = window.innerHeight;

    // 1. Scene & Camera Setup (Orthographic mapping pixels 1:1)
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(
      -width / 2,
      width / 2,
      height / 2,
      -height / 2,
      0.1,
      1000
    );
    camera.position.z = 500;

    // 2. WebGL Renderer
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    } catch {
      return;
    }

    // 3. Cursor 3D Assembly Group
    const cursorRoot = new THREE.Group();
    scene.add(cursorRoot);

    const themeColors = CURSOR_THEMES[theme];
    const cPrimary = new THREE.Color(themeColors.primary);
    const cSecondary = new THREE.Color(themeColors.secondary);
    const cAccent = new THREE.Color(themeColors.accent);
    const cCore = new THREE.Color(themeColors.coreColor);

    // Inner Glowing Core Nucleus
    const coreGeo = new THREE.SphereGeometry(3.5, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({
      color: cCore,
      transparent: true,
      opacity: 0.95,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    cursorRoot.add(coreMesh);

    // Outer 3D Gyroscopic Gimbal Ring 1 (Torus)
    const ring1Geo = new THREE.TorusGeometry(14, 1.2, 12, 48);
    const ring1Mat = new THREE.MeshBasicMaterial({
      color: cPrimary,
      transparent: true,
      opacity: 0.75,
      wireframe: false,
    });
    const ring1Mesh = new THREE.Mesh(ring1Geo, ring1Mat);
    cursorRoot.add(ring1Mesh);

    // Outer 3D Gyroscopic Gimbal Ring 2 (Orthogonal)
    const ring2Geo = new THREE.TorusGeometry(19, 0.9, 12, 48);
    const ring2Mat = new THREE.MeshBasicMaterial({
      color: cSecondary,
      transparent: true,
      opacity: 0.65,
    });
    const ring2Mesh = new THREE.Mesh(ring2Geo, ring2Mat);
    cursorRoot.add(ring2Mesh);

    // Outer 3D Diamond Satellite Nodes (4 orbiting points)
    const satGroup = new THREE.Group();
    cursorRoot.add(satGroup);
    const satellites: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const satGeo = new THREE.OctahedronGeometry(2, 0);
      const satMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? cPrimary : cAccent,
        transparent: true,
        opacity: 0.85,
      });
      const satMesh = new THREE.Mesh(satGeo, satMat);
      satellites.push(satMesh);
      satGroup.add(satMesh);
    }

    // 4. Particle Trail Buffer
    const maxParticles = 60;
    const particlePositions = new Float32Array(maxParticles * 3);
    const particleColors = new Float32Array(maxParticles * 3);
    const particleSizes = new Float32Array(maxParticles);

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 4.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // 5. Click Shockwave Ring Pool
    const shockwaveMeshes: THREE.Mesh[] = [];
    const maxShockwaves = 6;
    for (let i = 0; i < maxShockwaves; i++) {
      const swGeo = new THREE.RingGeometry(2, 4, 32);
      const swMat = new THREE.MeshBasicMaterial({
        color: cPrimary,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      });
      const swMesh = new THREE.Mesh(swGeo, swMat);
      scene.add(swMesh);
      shockwaveMeshes.push(swMesh);
    }

    // Resize Handler
    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      camera.left = -width / 2;
      camera.right = width / 2;
      camera.top = height / 2;
      camera.bottom = -height / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // Mouse Tracking Event Listeners
    const handleMouseMove = (e: MouseEvent) => {
      const m = mouseRef.current;
      m.targetX = e.clientX;
      m.targetY = e.clientY;
      setIsMouseInWindow(true);

      // Detect hover target
      const target = e.target as HTMLElement | null;
      if (target) {
        const interactiveEl = target.closest(
          'button, a, input, textarea, select, [role="button"], [data-interactive="true"], .cursor-pointer'
        );
        if (interactiveEl) {
          m.isHovering = true;
          setIsHoveredInteractive(true);

          // Compute intelligent tooltip label
          if (interactiveEl.tagName === 'BUTTON' || interactiveEl.getAttribute('role') === 'button') {
            const text = interactiveEl.textContent?.trim().slice(0, 14) || 'Click';
            setHoverLabel(text);
          } else if (interactiveEl.tagName === 'A') {
            setHoverLabel('Navigate');
          } else if (interactiveEl.tagName === 'INPUT' || interactiveEl.tagName === 'TEXTAREA') {
            setHoverLabel('Input');
          } else if (interactiveEl.tagName === 'SELECT') {
            setHoverLabel('Select');
          } else {
            setHoverLabel('Interact');
          }
        } else {
          m.isHovering = false;
          setIsHoveredInteractive(false);
          setHoverLabel('');
        }
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      mouseRef.current.isDown = true;
      const x = e.clientX - width / 2;
      const y = -(e.clientY - height / 2);

      // Trigger 3D shockwave ripple
      burstsRef.current.push({
        x,
        y,
        radius: 4,
        maxRadius: mouseRef.current.isHovering ? 65 : 45,
        opacity: 0.9,
        color: mouseRef.current.isHovering ? cAccent : cPrimary,
      });

      // Burst particle sparks
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const speed = Math.random() * 4 + 2;
        particlesRef.current.push({
          x,
          y,
          z: (Math.random() - 0.5) * 20,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          vz: (Math.random() - 0.5) * 2,
          life: 1.0,
          maxLife: 1.0,
          size: Math.random() * 4 + 3,
          colorIdx: i % 3,
        });
      }
    };

    const handleMouseUp = () => {
      mouseRef.current.isDown = false;
    };

    const handleMouseLeave = () => {
      setIsMouseInWindow(false);
    };

    const handleMouseEnter = () => {
      setIsMouseInWindow(true);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);

    // Animation Render Loop
    let animationFrameId: number;
    let lastTime = performance.now();
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      const elapsed = clock.getElapsedTime();

      const m = mouseRef.current;

      // Smooth Spring/Lerp Position Interpolation
      const lerpSpeed = m.isHovering ? 0.28 : 0.22;
      const prevX = m.currentX;
      const prevY = m.currentY;

      m.currentX += (m.targetX - m.currentX) * lerpSpeed;
      m.currentY += (m.targetY - m.currentY) * lerpSpeed;

      m.velocityX = m.currentX - prevX;
      m.velocityY = m.currentY - prevY;

      const speed = Math.sqrt(m.velocityX * m.velocityX + m.velocityY * m.velocityY);

      // Screen space to Three.js coordinates (center is 0,0)
      const worldX = m.currentX - width / 2;
      const worldY = -(m.currentY - height / 2);

      cursorRoot.position.set(worldX, worldY, 0);

      // Target Scale & Dynamics
      let targetScale = 1.0;
      if (m.isDown) {
        targetScale = 0.75;
      } else if (m.isHovering) {
        targetScale = 1.45;
      } else if (speed > 5) {
        targetScale = 1.15;
      }

      cursorRoot.scale.x += (targetScale - cursorRoot.scale.x) * 0.2;
      cursorRoot.scale.y += (targetScale - cursorRoot.scale.y) * 0.2;
      cursorRoot.scale.z += (targetScale - cursorRoot.scale.z) * 0.2;

      // Dynamic 3D Gyroscopic Rotations & Inertia Tilt
      const tiltX = THREE.MathUtils.clamp(-m.velocityY * 0.04, -0.6, 0.6);
      const tiltY = THREE.MathUtils.clamp(m.velocityX * 0.04, -0.6, 0.6);

      cursorRoot.rotation.x += (tiltX - cursorRoot.rotation.x) * 0.15;
      cursorRoot.rotation.y += (tiltY - cursorRoot.rotation.y) * 0.15;

      const spinSpeed = m.isHovering ? 4.5 : 2.0;
      ring1Mesh.rotation.x = elapsed * spinSpeed * 0.6;
      ring1Mesh.rotation.y = elapsed * spinSpeed * 0.8;

      ring2Mesh.rotation.x = -elapsed * spinSpeed * 0.7;
      ring2Mesh.rotation.z = elapsed * spinSpeed * 0.5;

      // Orbiting Diamond Satellites
      satellites.forEach((sat, idx) => {
        const satAngle = elapsed * (spinSpeed * 0.8) + (idx * Math.PI) / 2;
        const satRadius = (m.isHovering ? 28 : 22) + Math.sin(elapsed * 4 + idx) * 2;
        sat.position.x = Math.cos(satAngle) * satRadius;
        sat.position.y = Math.sin(satAngle) * satRadius;
        sat.position.z = Math.sin(satAngle * 2) * 6;
        sat.rotation.x = elapsed * 3;
        sat.rotation.y = elapsed * 2;
      });

      // Core pulse
      const corePulse = 1 + Math.sin(elapsed * 6) * 0.15;
      coreMesh.scale.set(corePulse, corePulse, corePulse);

      // Emit Movement Trail Particles
      if (trailMode !== 'off' && speed > 1.2) {
        const particlesToEmit = trailMode === 'dense' ? (speed > 8 ? 3 : 2) : 1;
        for (let i = 0; i < particlesToEmit; i++) {
          if (particlesRef.current.length < maxParticles) {
            particlesRef.current.push({
              x: worldX + (Math.random() - 0.5) * 6,
              y: worldY + (Math.random() - 0.5) * 6,
              z: (Math.random() - 0.5) * 10,
              vx: -m.velocityX * 0.15 + (Math.random() - 0.5) * 0.8,
              vy: -m.velocityY * 0.15 + (Math.random() - 0.5) * 0.8,
              vz: (Math.random() - 0.5) * 0.5,
              life: 1.0,
              maxLife: trailMode === 'dense' ? 0.65 : 0.45,
              size: Math.random() * 3 + 2,
              colorIdx: Math.floor(Math.random() * 3),
            });
          }
        }
      }

      // Update & Render Particles
      const activeParticles = particlesRef.current;
      const positions = particleGeo.attributes.position.array as Float32Array;
      const colors = particleGeo.attributes.color.array as Float32Array;

      const palette = [cPrimary, cSecondary, cAccent];

      for (let i = activeParticles.length - 1; i >= 0; i--) {
        const p = activeParticles[i];
        p.life -= delta / p.maxLife;
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;
        p.vx *= 0.94;
        p.vy *= 0.94;

        if (p.life <= 0) {
          activeParticles.splice(i, 1);
        }
      }

      // Populate WebGL buffer
      for (let i = 0; i < maxParticles; i++) {
        if (i < activeParticles.length) {
          const p = activeParticles[i];
          positions[i * 3] = p.x;
          positions[i * 3 + 1] = p.y;
          positions[i * 3 + 2] = p.z;

          const col = palette[p.colorIdx] || cPrimary;
          const alpha = p.life;
          colors[i * 3] = col.r * alpha;
          colors[i * 3 + 1] = col.g * alpha;
          colors[i * 3 + 2] = col.b * alpha;
        } else {
          positions[i * 3] = 0;
          positions[i * 3 + 1] = 0;
          positions[i * 3 + 2] = -9999;
          colors[i * 3] = 0;
          colors[i * 3 + 1] = 0;
          colors[i * 3 + 2] = 0;
        }
      }

      particleGeo.attributes.position.needsUpdate = true;
      particleGeo.attributes.color.needsUpdate = true;

      // Update & Render Click Shockwaves
      const activeBursts = burstsRef.current;
      for (let i = activeBursts.length - 1; i >= 0; i--) {
        const b = activeBursts[i];
        b.radius += (b.maxRadius - b.radius) * 0.15;
        b.opacity -= delta * 1.8;

        if (b.opacity <= 0 || b.radius >= b.maxRadius - 1) {
          activeBursts.splice(i, 1);
        }
      }

      shockwaveMeshes.forEach((mesh, idx) => {
        if (idx < activeBursts.length) {
          const b = activeBursts[idx];
          mesh.position.set(b.x, b.y, 0);
          mesh.scale.set(b.radius / 10, b.radius / 10, 1);
          (mesh.material as THREE.MeshBasicMaterial).color = b.color;
          (mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, b.opacity);
          mesh.visible = true;
        } else {
          mesh.visible = false;
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);

      // Clean up Three.js scene assets
      renderer.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      ring1Geo.dispose();
      ring1Mat.dispose();
      ring2Geo.dispose();
      ring2Mat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      satellites.forEach((s) => {
        s.geometry.dispose();
        (s.material as THREE.Material).dispose();
      });
      shockwaveMeshes.forEach((m) => {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      });
    };
  }, [isEnabled, isTouchDevice, theme, trailMode]);

  if (isTouchDevice) {
    return null; // Gracefully disable on touch devices
  }

  return (
    <>
      {/* 3D WebGL Canvas Layer */}
      {isEnabled && (
        <canvas
          ref={canvasRef}
          className={`pointer-events-none fixed inset-0 z-[99999] transition-opacity duration-300 ${
            isMouseInWindow ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ width: '100vw', height: '100vh' }}
        />
      )}

      {/* Floating 3D Cursor Control Badge / Menu Trigger */}
      <div className="fixed bottom-4 right-4 z-[99998] flex items-center gap-2">
        <button
          onClick={() => setShowConfigModal((prev) => !prev)}
          title="3D Cybernetic Cursor Settings (Alt+C)"
          className={`group flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md border shadow-xl transition-all cursor-pointer ${
            isEnabled
              ? 'bg-slate-900/85 border-cyan-500/40 text-cyan-300 hover:bg-slate-800 hover:border-cyan-400'
              : 'bg-slate-900/80 border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
          id="btn-3d-cursor-quick-toggle"
        >
          <div className="relative flex items-center justify-center">
            <Sparkles className={`w-3.5 h-3.5 ${isEnabled ? 'text-cyan-400 animate-spin' : 'text-slate-500'}`} style={{ animationDuration: '6s' }} />
            {isEnabled && (
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            )}
          </div>
          <span className="hidden sm:inline">3D Cursor</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-slate-300">
            {isEnabled ? 'ON' : 'OFF'}
          </span>
        </button>
      </div>

      {/* 3D Cursor Configuration Floating Panel */}
      <AnimatePresence>
        {showConfigModal && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed bottom-14 right-4 z-[99999] w-80 p-5 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-cyan-500/30 shadow-2xl shadow-cyan-950/80 text-slate-100 space-y-4"
            id="modal-3d-cursor-config"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400">
                <Sparkles className="w-4 h-4" />
                <span>3D Cyber Cursor Engine</span>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-slate-200 text-xs px-1.5 py-0.5 rounded hover:bg-slate-800 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Toggle Power */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="text-xs">
                <div className="font-bold text-slate-200">3D Interactive Orb</div>
                <div className="text-[11px] text-slate-400">WebGL gyroscopic tracking & ring physics</div>
              </div>
              <button
                onClick={() => setIsEnabled((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  isEnabled ? 'bg-cyan-500' : 'bg-slate-800'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Theme Selector */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-cyan-400" />
                <span>Glow & Laser Color Theme</span>
              </label>

              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(CURSOR_THEMES) as CursorTheme[]).map((thmKey) => {
                  const thm = CURSOR_THEMES[thmKey];
                  const isSelected = theme === thmKey;
                  return (
                    <button
                      key={thmKey}
                      onClick={() => setTheme(thmKey)}
                      className={`flex items-center gap-2 p-2 rounded-xl text-left text-xs font-semibold border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-800/90 border-cyan-400 text-white shadow-md shadow-cyan-500/20'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: thm.primary }}
                      />
                      <span className="truncate text-[11px]">{thm.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Trail Mode */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-violet-400" />
                <span>3D Particle Trail Stream</span>
              </label>

              <div className="grid grid-cols-3 gap-1.5 text-xs">
                {(['dense', 'light', 'off'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setTrailMode(mode)}
                    className={`py-1.5 rounded-lg font-semibold uppercase tracking-wider text-[10px] border transition-all cursor-pointer ${
                      trailMode === mode
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Tip */}
            <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-between">
              <span>Press <kbd className="px-1 py-0.5 rounded bg-slate-800 font-mono text-cyan-300">Alt + C</kbd> anytime</span>
              <span className="text-cyan-400 font-semibold">60-120 FPS</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
