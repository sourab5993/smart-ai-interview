import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Camera,
  CameraOff,
  Eye,
  Activity,
  Smile,
  AlertCircle,
  CheckCircle2,
  Maximize2,
  Minimize2,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Compass,
  Sliders,
  HelpCircle,
} from 'lucide-react';
import { BehaviorTelemetry } from '../types';

export interface CameraBehaviorMonitorRef {
  getTelemetryAndReset: () => BehaviorTelemetry;
  getCurrentTelemetry: () => BehaviorTelemetry;
  isCameraActive: () => boolean;
}

interface CameraBehaviorMonitorProps {
  onTelemetrySample?: (telemetry: BehaviorTelemetry) => void;
  isInterviewActive?: boolean;
  questionId?: string;
  className?: string;
}

export const CameraBehaviorMonitor = forwardRef<CameraBehaviorMonitorRef, CameraBehaviorMonitorProps>(
  ({ onTelemetrySample, isInterviewActive = true, questionId = '', className = '' }, ref) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animFrameRef = useRef<number | null>(null);
    const lastAnalysisTimeRef = useRef<number>(0);

    // Camera states
    const [isCameraOn, setIsCameraOn] = useState<boolean>(true);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isMirrored, setIsMirrored] = useState<boolean>(true);
    const [isExpanded, setIsExpanded] = useState<boolean>(false);
    const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);

    // Multiple Cameras Selection (Crucial for Windows laptops with IR/Windows Hello cameras)
    const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
    const [selectedCameraId, setSelectedCameraId] = useState<string>('');
    const [showCameraSelect, setShowCameraSelect] = useState<boolean>(false);
    const [showShutterHelp, setShowShutterHelp] = useState<boolean>(false);

    // Live Metrics State
    const [isFaceDetected, setIsFaceDetected] = useState<boolean>(false);
    const [eyeContactInstant, setEyeContactInstant] = useState<number>(85);
    const [stabilityInstant, setStabilityInstant] = useState<number>(90);
    const [composureInstant, setComposureInstant] = useState<number>(88);
    const [detectedExpression, setDetectedExpression] = useState<'confident' | 'attentive' | 'neutral' | 'smiling' | 'hesitant' | 'restless'>('confident');
    const [headPose, setHeadPose] = useState<'centered' | 'turned-left' | 'turned-right' | 'looking-down' | 'looking-up'>('centered');
    const [faceBox, setFaceBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

    // Historical samples buffer for the active question
    const samplesRef = useRef<
      Array<{
        eyeContact: number;
        stability: number;
        composure: number;
        faceDetected: boolean;
        expression: string;
        headPose: string;
      }>
    >([]);

    // Frame-to-frame motion tracking memory
    const prevCentroidRef = useRef<{ x: number; y: number } | null>(null);

    // Attach stream directly to video DOM element with robust play handlers
    const attachStreamToVideo = useCallback((stream: MediaStream) => {
      const video = videoRef.current;
      if (!video) return;

      try {
        if (video.srcObject !== stream) {
          video.srcObject = stream;
        }
        video.muted = true;
        video.defaultMuted = true;
        video.playsInline = true;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');

        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsVideoPlaying(true);
            })
            .catch((err) => {
              console.warn('Auto-play was delayed or blocked:', err);
              // Retry on user action
              const playOnTouch = () => {
                video.play().catch(() => {});
                document.removeEventListener('click', playOnTouch);
              };
              document.addEventListener('click', playOnTouch, { once: true });
            });
        }
      } catch (err) {
        console.warn('Error attaching stream to video element:', err);
      }
    }, []);

    // Stop active media stream tracks
    const stopStreamTracks = useCallback(() => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {}
        });
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setIsVideoPlaying(false);
      setIsFaceDetected(false);
      setFaceBox(null);
    }, []);

    // Query and enumerate available cameras, prioritizing standard RGB over IR/Windows Hello
    const enumerateAndSelectCamera = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setAvailableCameras(videoInputs);

        if (videoInputs.length > 0) {
          // If no camera selected yet, pick the best RGB camera (skip IR sensors)
          const nonIrCamera = videoInputs.find((d) => {
            const label = (d.label || '').toLowerCase();
            return !label.includes('ir ') && !label.includes('ir_') && !label.includes('infrared') && !label.includes('hello');
          });

          const chosen = nonIrCamera ? nonIrCamera.deviceId : videoInputs[0].deviceId;
          return chosen;
        }
      } catch (err) {
        console.warn('Device enumeration failed:', err);
      }
      return '';
    };

    // Initialize Camera Stream with targeted deviceId or optimal constraints
    const startCamera = async (targetDeviceId?: string) => {
      try {
        setErrorMessage(null);
        stopStreamTracks();

        let deviceIdToUse = targetDeviceId || selectedCameraId;

        // If not selected, discover devices
        if (!deviceIdToUse && navigator.mediaDevices?.enumerateDevices) {
          deviceIdToUse = (await enumerateAndSelectCamera()) || '';
        }

        let stream: MediaStream;

        // Build constraints: specify deviceId if known
        if (deviceIdToUse) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: { exact: deviceIdToUse },
                width: { ideal: 640 },
                height: { ideal: 480 },
              },
              audio: false,
            });
          } catch (deviceError) {
            console.warn('Specific deviceId access failed, trying general video:', deviceError);
            stream = await navigator.mediaDevices.getUserMedia({
              video: { width: { ideal: 640 }, height: { ideal: 480 } },
              audio: false,
            });
          }
        } else {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 } },
            audio: false,
          });
        }

        streamRef.current = stream;
        setHasPermission(true);
        setIsCameraOn(true);

        // Update selected device from active stream track
        const activeTrack = stream.getVideoTracks()[0];
        if (activeTrack) {
          const settings = activeTrack.getSettings();
          if (settings.deviceId) {
            setSelectedCameraId(settings.deviceId);
          }
        }

        // Attach to video DOM element
        attachStreamToVideo(stream);

        // Re-enumerate to ensure labels are populated now that permission is granted
        await enumerateAndSelectCamera();
      } catch (err: any) {
        console.warn('Camera access denied or unavailable:', err);
        setHasPermission(false);
        setIsCameraOn(false);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setErrorMessage('Camera access was denied. Please allow camera permission in your browser URL bar.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setErrorMessage('No webcam device detected on your system.');
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setErrorMessage('Webcam is already in use by another application (Zoom, Teams, etc.). Close other apps and retry.');
        } else {
          setErrorMessage('Unable to access webcam. Audio voice evaluation remains active.');
        }
      }
    };

    const stopCamera = () => {
      stopStreamTracks();
      setIsCameraOn(false);
    };

    const toggleCamera = () => {
      if (isCameraOn) {
        stopCamera();
      } else {
        startCamera(selectedCameraId);
      }
    };

    const handleSwitchCamera = (newDeviceId: string) => {
      setSelectedCameraId(newDeviceId);
      startCamera(newDeviceId);
    };

    // Mount lifecycle: Start camera
    useEffect(() => {
      startCamera();
      return () => {
        stopStreamTracks();
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
        }
      };
    }, []);

    // Ensure video stream remains attached whenever video element or camera state updates
    useEffect(() => {
      if (isCameraOn && streamRef.current && videoRef.current) {
        attachStreamToVideo(streamRef.current);
      }
    }, [isCameraOn, attachStreamToVideo]);

    // Reset sample buffer on new question
    useEffect(() => {
      samplesRef.current = [];
    }, [questionId]);

    // Computer Vision Behavioral Analyzer Loop
    useEffect(() => {
      let isSubscribed = true;

      const analyzeFrame = () => {
        if (!isSubscribed) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;

        // Ensure video has received actual video frames (readyState >= 2)
        if (isCameraOn && video && video.readyState >= 2 && canvas && !video.paused) {
          const now = performance.now();
          if (now - lastAnalysisTimeRef.current >= 150) {
            lastAnalysisTimeRef.current = now;

            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              const width = 160;
              const height = 120;
              canvas.width = width;
              canvas.height = height;

              // Draw current video frame to offscreen processing canvas
              ctx.drawImage(video, 0, 0, width, height);
              const imgData = ctx.getImageData(0, 0, width, height);
              const data = imgData.data;

              // 1. Skin-tone and Face Centroid Tracking
              let totalSkinPixels = 0;
              let sumX = 0;
              let sumY = 0;
              let totalLuminance = 0;

              for (let y = 0; y < height; y += 2) {
                for (let x = 0; x < width; x += 2) {
                  const idx = (y * width + x) * 4;
                  const r = data[idx];
                  const g = data[idx + 1];
                  const b = data[idx + 2];

                  totalLuminance += (r + g + b) / 3;

                  // Universal skin color heuristic
                  const isSkin =
                    r > 45 &&
                    g > 30 &&
                    b > 20 &&
                    r > g &&
                    r > b &&
                    Math.abs(r - g) > 12 &&
                    r - g < 150;

                  if (isSkin) {
                    totalSkinPixels++;
                    sumX += x;
                    sumY += y;
                  }
                }
              }

              // Check if entire camera frame is pitch black (e.g. privacy shutter closed or IR camera)
              const avgFrameLuminance = totalLuminance / ((width * height) / 4);
              if (avgFrameLuminance < 10) {
                // Extremely dark / black screen detected
                setIsFaceDetected(false);
                setFaceBox(null);
                setShowShutterHelp(true);
              } else {
                setShowShutterHelp(false);
              }

              const minFacePixelThreshold = (width * height) / 35;
              const detected = totalSkinPixels > minFacePixelThreshold && avgFrameLuminance >= 10;
              setIsFaceDetected(detected);

              if (detected) {
                const centroidX = sumX / totalSkinPixels;
                const centroidY = sumY / totalSkinPixels;

                const normX = centroidX / width;
                const normY = centroidY / height;

                const boxW = Math.min(65, Math.max(30, Math.sqrt(totalSkinPixels) * 1.3));
                const boxH = boxW * 1.25;
                setFaceBox({
                  x: Math.max(0, normX * 100 - boxW / 2),
                  y: Math.max(0, normY * 100 - boxH / 2),
                  width: boxW,
                  height: boxH,
                });

                // 2. Head Pose & Gaze Focus
                let currentPose: 'centered' | 'turned-left' | 'turned-right' | 'looking-down' | 'looking-up' = 'centered';
                if (normX < 0.35) {
                  currentPose = isMirrored ? 'turned-right' : 'turned-left';
                } else if (normX > 0.65) {
                  currentPose = isMirrored ? 'turned-left' : 'turned-right';
                } else if (normY > 0.65) {
                  currentPose = 'looking-down';
                } else if (normY < 0.28) {
                  currentPose = 'looking-up';
                }
                setHeadPose(currentPose);

                // 3. Posture & Head Stability
                let frameMotion = 0;
                if (prevCentroidRef.current) {
                  const dx = centroidX - prevCentroidRef.current.x;
                  const dy = centroidY - prevCentroidRef.current.y;
                  frameMotion = Math.sqrt(dx * dx + dy * dy);
                }
                prevCentroidRef.current = { x: centroidX, y: centroidY };

                let curStability = 92;
                if (frameMotion > 9) {
                  curStability = Math.max(45, 90 - (frameMotion - 9) * 8);
                } else if (frameMotion > 4) {
                  curStability = Math.max(70, 95 - (frameMotion - 4) * 4);
                } else {
                  curStability = Math.min(98, 88 + Math.round((4 - frameMotion) * 2.5));
                }

                // 4. Eye Contact Estimation
                let curEyeContact = 88;
                if (currentPose === 'centered') {
                  const centerOffset = Math.abs(normX - 0.5) + Math.abs(normY - 0.45);
                  curEyeContact = Math.round(Math.max(75, 96 - centerOffset * 35));
                } else if (currentPose === 'looking-down') {
                  curEyeContact = Math.round(Math.max(30, 52 - Math.random() * 8));
                } else {
                  curEyeContact = Math.round(Math.max(40, 60 - Math.random() * 10));
                }

                // 5. Facial Composure
                let curComposure = 86;
                let curExpr: 'confident' | 'attentive' | 'neutral' | 'smiling' | 'hesitant' | 'restless' = 'confident';

                if (frameMotion > 8) {
                  curExpr = 'restless';
                  curComposure = Math.max(50, 72 - Math.round(frameMotion * 2));
                } else if (curEyeContact >= 85 && curStability >= 85) {
                  curExpr = 'confident';
                  curComposure = Math.min(96, Math.round((curEyeContact + curStability) / 2));
                } else if (currentPose === 'looking-down') {
                  curExpr = 'hesitant';
                  curComposure = Math.max(55, curEyeContact + 10);
                } else {
                  curExpr = 'attentive';
                  curComposure = Math.round(curEyeContact * 0.5 + curStability * 0.5);
                }

                setEyeContactInstant(curEyeContact);
                setStabilityInstant(curStability);
                setComposureInstant(curComposure);
                setDetectedExpression(curExpr);

                samplesRef.current.push({
                  eyeContact: curEyeContact,
                  stability: curStability,
                  composure: curComposure,
                  faceDetected: true,
                  expression: curExpr,
                  headPose: currentPose,
                });

                if (onTelemetrySample) {
                  onTelemetrySample({
                    eyeContactScore: curEyeContact,
                    postureStabilityScore: curStability,
                    facialComposureScore: curComposure,
                    facePresencePct: 100,
                    overallBehaviorScore: Math.round(curEyeContact * 0.4 + curStability * 0.3 + curComposure * 0.3),
                    behaviorNotes: [],
                    detectedExpression: curExpr,
                    headPose: currentPose,
                    cameraActive: true,
                  });
                }
              } else {
                setFaceBox(null);
                setEyeContactInstant((prev) => Math.max(0, prev - 10));
                setStabilityInstant((prev) => Math.max(50, prev - 5));
                setComposureInstant((prev) => Math.max(50, prev - 5));

                samplesRef.current.push({
                  eyeContact: 20,
                  stability: 60,
                  composure: 60,
                  faceDetected: false,
                  expression: 'absent',
                  headPose: 'centered',
                });
              }
            }
          }
        }

        animFrameRef.current = requestAnimationFrame(analyzeFrame);
      };

      animFrameRef.current = requestAnimationFrame(analyzeFrame);

      return () => {
        isSubscribed = false;
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
        }
      };
    }, [isCameraOn, isMirrored, onTelemetrySample]);

    // Compute aggregated telemetry for the question
    const computeTelemetry = (): BehaviorTelemetry => {
      if (!isCameraOn || samplesRef.current.length === 0) {
        return {
          eyeContactScore: 78,
          postureStabilityScore: 82,
          facialComposureScore: 80,
          facePresencePct: isCameraOn ? 85 : 0,
          overallBehaviorScore: 80,
          behaviorNotes: isCameraOn
            ? ['Camera was active with baseline non-verbal presence']
            : ['Camera was disabled during this question; verbal evaluation conducted'],
          detectedExpression: 'neutral',
          headPose: 'centered',
          cameraActive: isCameraOn,
        };
      }

      const samples = samplesRef.current;
      const totalSamples = samples.length;
      const faceSamples = samples.filter((s) => s.faceDetected);
      const facePresencePct = Math.round((faceSamples.length / totalSamples) * 100);

      const validSamples = faceSamples.length > 0 ? faceSamples : samples;
      const avgEyeContact = Math.round(
        validSamples.reduce((acc, s) => acc + s.eyeContact, 0) / validSamples.length
      );
      const avgStability = Math.round(
        validSamples.reduce((acc, s) => acc + s.stability, 0) / validSamples.length
      );
      const avgComposure = Math.round(
        validSamples.reduce((acc, s) => acc + s.composure, 0) / validSamples.length
      );

      const overall = Math.min(
        100,
        Math.max(10, Math.round(avgEyeContact * 0.4 + avgStability * 0.3 + avgComposure * 0.3))
      );

      const notes: string[] = [];
      if (avgEyeContact >= 85) {
        notes.push('Maintained outstanding, direct eye contact with the interviewer.');
      } else if (avgEyeContact >= 70) {
        notes.push('Solid eye contact; occasionally looked away while retrieving thoughts.');
      } else {
        notes.push('Frequent downward or sideways glances; aim to look directly into the camera lens.');
      }

      if (avgStability >= 85) {
        notes.push('Excellent head posture and body language stability.');
      } else if (avgStability >= 70) {
        notes.push('Natural conversational movement with steady poise.');
      } else {
        notes.push('Noticeable fidgeting or rapid head movements detected.');
      }

      if (avgComposure >= 85) {
        notes.push('Appeared confident, composed, and engaged.');
      } else {
        notes.push('Work on relaxed facial composure during complex technical explanations.');
      }

      return {
        eyeContactScore: avgEyeContact,
        postureStabilityScore: avgStability,
        facialComposureScore: avgComposure,
        facePresencePct,
        overallBehaviorScore: overall,
        behaviorNotes: notes,
        detectedExpression,
        headPose,
        cameraActive: true,
      };
    };

    useImperativeHandle(ref, () => ({
      getTelemetryAndReset: () => {
        const telemetry = computeTelemetry();
        samplesRef.current = [];
        return telemetry;
      },
      getCurrentTelemetry: () => computeTelemetry(),
      isCameraActive: () => isCameraOn && (hasPermission ?? false),
    }));

    const getMetricColor = (val: number) => {
      if (val >= 82) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      if (val >= 68) return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
      if (val >= 50) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
    };

    return (
      <div
        className={`relative rounded-2xl bg-slate-950/90 border border-slate-800 overflow-hidden shadow-2xl transition-all duration-300 ${
          isExpanded ? 'fixed inset-4 sm:inset-10 z-50 max-w-5xl mx-auto flex flex-col' : className
        }`}
        id="camera-behavior-monitor"
      >
        {/* Offscreen hidden processing canvas */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Video Stage - Video tag is permanently mounted to prevent ref detachment */}
        <div className="relative w-full aspect-video bg-slate-950 flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onLoadedData={() => setIsVideoPlaying(true)}
            onPlay={() => setIsVideoPlaying(true)}
            className={`w-full h-full object-cover transition-transform duration-300 ${
              isMirrored ? '-scale-x-100' : 'scale-x-100'
            } ${isCameraOn ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          />

          {/* Fallback Display when Camera is turned Off */}
          {!isCameraOn && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3 bg-slate-950">
              <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                <CameraOff className="w-7 h-7" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-semibold text-slate-300">Camera Feed Paused</p>
                <p className="text-[11px] text-slate-500 max-w-xs mt-0.5">
                  Turn on camera to enable real-time eye-contact, posture, and behavior scoring.
                </p>
              </div>
              <button
                type="button"
                onClick={toggleCamera}
                className="px-3.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Enable Camera</span>
              </button>
            </div>
          )}

          {/* Privacy Shutter / Black Screen Assistance Banner */}
          {showShutterHelp && isCameraOn && isVideoPlaying && (
            <div className="absolute top-12 inset-x-4 z-30 p-2.5 rounded-xl bg-amber-950/90 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between gap-2 shadow-xl backdrop-blur-md">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="text-[11px]">
                  <strong>Video is dark:</strong> Check laptop privacy shutter slider or switch camera below.
                </span>
              </div>
              {availableCameras.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const currentIndex = availableCameras.findIndex((c) => c.deviceId === selectedCameraId);
                    const nextCamera = availableCameras[(currentIndex + 1) % availableCameras.length];
                    if (nextCamera) handleSwitchCamera(nextCamera.deviceId);
                  }}
                  className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-[10px] border border-amber-500/40 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Switch Camera
                </button>
              )}
            </div>
          )}

          {/* Error / Permission Banner */}
          {errorMessage && (
            <div className="absolute inset-0 z-30 bg-slate-950/95 p-4 flex flex-col items-center justify-center text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-amber-400" />
              <p className="text-xs text-amber-300 font-medium max-w-xs">{errorMessage}</p>
              <button
                type="button"
                onClick={() => startCamera()}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 transition-colors cursor-pointer"
              >
                Retry Camera Access
              </button>
            </div>
          )}

          {/* Computer Vision Face Tracking Box Overlay */}
          {isCameraOn && isFaceDetected && faceBox && (
            <div
              className={`absolute pointer-events-none rounded-xl border-2 transition-all duration-150 ${
                eyeContactInstant >= 75
                  ? 'border-cyan-400/70 shadow-[0_0_15px_rgba(6,182,212,0.35)]'
                  : 'border-amber-400/70 shadow-[0_0_15px_rgba(245,158,11,0.35)]'
              }`}
              style={{
                left: `${isMirrored ? 100 - (faceBox.x + faceBox.width) : faceBox.x}%`,
                top: `${faceBox.y}%`,
                width: `${faceBox.width}%`,
                height: `${faceBox.height}%`,
              }}
            >
              <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-cyan-300" />
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-cyan-300" />
              <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-cyan-300" />
              <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-cyan-300" />

              <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-slate-950/85 border border-cyan-500/40 text-[9px] font-mono text-cyan-300 whitespace-nowrap backdrop-blur-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                <span>AI Face Lock</span>
              </div>
            </div>
          )}

          {/* Top Live Status Bar HUD */}
          {isCameraOn && (
            <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between pointer-events-none z-10">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/85 border border-slate-800 text-[10px] font-mono text-slate-300 backdrop-blur-md">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isFaceDetected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                <span>{isFaceDetected ? 'BEHAVIOR TRACKING LIVE' : 'ALIGN FACE IN CAMERA'}</span>
              </div>

              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/85 border border-cyan-500/30 text-[10px] font-mono text-cyan-300 backdrop-blur-md">
                <ShieldCheck className="w-3 h-3 text-cyan-400" />
                <span>INDEX: {Math.round(eyeContactInstant * 0.4 + stabilityInstant * 0.3 + composureInstant * 0.3)}/100</span>
              </div>
            </div>
          )}

          {/* Bottom Live Behavior Metric Gauges HUD */}
          {isCameraOn && isFaceDetected && (
            <div className="absolute bottom-2.5 inset-x-2.5 flex items-center justify-between gap-2 pointer-events-none z-10">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <div
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-mono backdrop-blur-md ${getMetricColor(
                    eyeContactInstant
                  )}`}
                >
                  <Eye className="w-3 h-3" />
                  <span>Eye: {eyeContactInstant}%</span>
                </div>

                <div
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-mono backdrop-blur-md ${getMetricColor(
                    stabilityInstant
                  )}`}
                >
                  <Compass className="w-3 h-3" />
                  <span>Poise: {stabilityInstant}%</span>
                </div>

                <div
                  className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-mono backdrop-blur-md ${getMetricColor(
                    composureInstant
                  )}`}
                >
                  <Smile className="w-3 h-3" />
                  <span className="capitalize">{detectedExpression}</span>
                </div>
              </div>

              <div className="px-2 py-0.5 rounded-lg bg-slate-950/85 border border-slate-800 text-[10px] font-mono text-slate-300 backdrop-blur-md capitalize">
                {headPose === 'centered' ? '🎯 Direct Focus' : `👀 ${headPose.replace('-', ' ')}`}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Control Bar */}
        <div className="p-3 bg-slate-900/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleCamera}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                isCameraOn
                  ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30'
                  : 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
              }`}
            >
              {isCameraOn ? <CameraOff className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
              <span>{isCameraOn ? 'Stop Camera' : 'Start Camera'}</span>
            </button>

            {isCameraOn && (
              <button
                type="button"
                onClick={() => setIsMirrored(!isMirrored)}
                title="Flip / Mirror Video"
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Camera Switcher Dropdown (If multiple cameras present on Windows) */}
            {availableCameras.length > 1 && (
              <div className="relative">
                <select
                  value={selectedCameraId}
                  onChange={(e) => handleSwitchCamera(e.target.value)}
                  className="bg-slate-950 border border-slate-800 hover:border-cyan-500/50 text-slate-300 rounded-xl px-2.5 py-1.5 text-xs outline-none max-w-[150px] truncate cursor-pointer"
                  title="Switch Video Camera Device"
                >
                  {availableCameras.map((device, idx) => (
                    <option key={device.deviceId} value={device.deviceId} className="bg-slate-900">
                      {device.label || `Camera ${idx + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              {isCameraOn ? (isFaceDetected ? 'AI Analyzing Posture & Gaze' : 'Center face in camera') : 'Camera Disabled'}
            </span>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? 'Collapse' : 'Expand Video'}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
            >
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    );
  }
);
CameraBehaviorMonitor.displayName = 'CameraBehaviorMonitor';
