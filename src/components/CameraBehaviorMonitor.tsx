import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Camera,
  CameraOff,
  Eye,
  EyeOff,
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

    // Live Metrics State - Real-time Computer Vision Detection
    const [isFaceDetected, setIsFaceDetected] = useState<boolean>(false);
    const [areEyesDetected, setAreEyesDetected] = useState<boolean>(false);
    const [eyeContactInstant, setEyeContactInstant] = useState<number>(0);
    const [stabilityInstant, setStabilityInstant] = useState<number>(0);
    const [composureInstant, setComposureInstant] = useState<number>(0);
    const [detectedExpression, setDetectedExpression] = useState<'confident' | 'attentive' | 'neutral' | 'smiling' | 'hesitant' | 'restless'>('attentive');
    const [headPose, setHeadPose] = useState<'centered' | 'turned-left' | 'turned-right' | 'looking-down' | 'looking-up'>('centered');
    const [faceBox, setFaceBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
    const [eyeBoxDetails, setEyeBoxDetails] = useState<{
      left: { x: number; y: number; width: number; height: number; visible: boolean; pupilX: number; pupilY: number };
      right: { x: number; y: number; width: number; height: number; visible: boolean; pupilX: number; pupilY: number };
      statusText: string;
    } | null>(null);

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

              // 1. Skin-tone & Facial Geometry Segmentation
              let totalSkinPixels = 0;
              let minSkinX = width, maxSkinX = 0, minSkinY = height, maxSkinY = 0;
              let sumX = 0;
              let sumY = 0;
              let totalLuminance = 0;

              for (let y = 0; y < height; y += 2) {
                for (let x = 0; x < width; x += 2) {
                  const idx = (y * width + x) * 4;
                  const r = data[idx];
                  const g = data[idx + 1];
                  const b = data[idx + 2];
                  const lum = (r * 299 + g * 587 + b * 114) / 1000;
                  totalLuminance += lum;

                  const maxC = Math.max(r, g, b);
                  const minC = Math.min(r, g, b);
                  const isSkin =
                    r > 50 &&
                    g > 35 &&
                    b > 25 &&
                    r > g &&
                    r > b &&
                    (r - g) >= 12 &&
                    (maxC - minC) >= 14 &&
                    Math.abs(r - g) <= 120;

                  if (isSkin) {
                    totalSkinPixels++;
                    sumX += x;
                    sumY += y;
                    if (x < minSkinX) minSkinX = x;
                    if (x > maxSkinX) maxSkinX = x;
                    if (y < minSkinY) minSkinY = y;
                    if (y > maxSkinY) maxSkinY = y;
                  }
                }
              }

              // Check if entire camera frame is pitch black (e.g. privacy shutter closed or IR camera)
              const avgFrameLuminance = totalLuminance / ((width * height) / 4);
              if (avgFrameLuminance < 10) {
                setIsFaceDetected(false);
                setAreEyesDetected(false);
                setFaceBox(null);
                setEyeBoxDetails(null);
                setEyeContactInstant(0);
                setStabilityInstant(0);
                setComposureInstant(0);
                setShowShutterHelp(true);
                return;
              }
              setShowShutterHelp(false);

              // 2. Validate coherent facial geometry
              const skinClusterW = maxSkinX - minSkinX;
              const skinClusterH = maxSkinY - minSkinY;
              const minFacePixelThreshold = (width * height) / 32; // ~600 skin pixels
              const skinAspectRatio = skinClusterH / Math.max(1, skinClusterW);

              const hasValidFaceGeometry =
                totalSkinPixels > minFacePixelThreshold &&
                skinClusterW >= 26 &&
                skinClusterH >= 32 &&
                skinAspectRatio >= 0.75 &&
                skinAspectRatio <= 2.3 &&
                avgFrameLuminance >= 10;

              if (hasValidFaceGeometry) {
                setIsFaceDetected(true);

                const centroidX = sumX / totalSkinPixels;
                const centroidY = sumY / totalSkinPixels;
                const normCentroidX = centroidX / width;
                const normCentroidY = centroidY / height;

                // Relative bounding box (0 - 100%)
                const boxW = Math.min(65, Math.max(28, (skinClusterW / width) * 100));
                const boxH = Math.min(80, Math.max(35, (skinClusterH / height) * 100));
                const boxX = Math.max(0, Math.min(100 - boxW, normCentroidX * 100 - boxW / 2));
                const boxY = Math.max(0, Math.min(100 - boxH, normCentroidY * 100 - boxH / 2));

                setFaceBox({
                  x: boxX,
                  y: boxY,
                  width: boxW,
                  height: boxH,
                });

                // Head Pose Estimation
                let currentPose: 'centered' | 'turned-left' | 'turned-right' | 'looking-down' | 'looking-up' = 'centered';
                if (normCentroidX < 0.35) {
                  currentPose = isMirrored ? 'turned-right' : 'turned-left';
                } else if (normCentroidX > 0.65) {
                  currentPose = isMirrored ? 'turned-left' : 'turned-right';
                } else if (normCentroidY > 0.65) {
                  currentPose = 'looking-down';
                } else if (normCentroidY < 0.28) {
                  currentPose = 'looking-up';
                }
                setHeadPose(currentPose);

                // Posture Stability Tracking
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

                // 3. Genuine Ocular & Eye Socket Detection
                const facePixelLeft = Math.floor((boxX / 100) * width);
                const facePixelTop = Math.floor((boxY / 100) * height);
                const facePixelW = Math.floor((boxW / 100) * width);
                const facePixelH = Math.floor((boxH / 100) * height);

                // Reference ambient facial skin luminance from forehead & cheek baseline
                let refSkinLumSum = 0;
                let refSkinCount = 0;

                const fhYStart = Math.max(0, facePixelTop + Math.floor(facePixelH * 0.10));
                const fhYEnd = Math.min(height, facePixelTop + Math.floor(facePixelH * 0.20));
                const fhXStart = Math.max(0, facePixelLeft + Math.floor(facePixelW * 0.30));
                const fhXEnd = Math.min(width, facePixelLeft + Math.floor(facePixelW * 0.70));

                for (let y = fhYStart; y < fhYEnd; y += 2) {
                  for (let x = fhXStart; x < fhXEnd; x += 2) {
                    const idx = (y * width + x) * 4;
                    refSkinLumSum += (data[idx] * 299 + data[idx + 1] * 587 + data[idx + 2] * 114) / 1000;
                    refSkinCount++;
                  }
                }

                const chYStart = Math.max(0, facePixelTop + Math.floor(facePixelH * 0.54));
                const chYEnd = Math.min(height, facePixelTop + Math.floor(facePixelH * 0.64));
                const chXStart = Math.max(0, facePixelLeft + Math.floor(facePixelW * 0.20));
                const chXEnd = Math.min(width, facePixelLeft + Math.floor(facePixelW * 0.80));

                for (let y = chYStart; y < chYEnd; y += 2) {
                  for (let x = chXStart; x < chXEnd; x += 2) {
                    const idx = (y * width + x) * 4;
                    refSkinLumSum += (data[idx] * 299 + data[idx + 1] * 587 + data[idx + 2] * 114) / 1000;
                    refSkinCount++;
                  }
                }

                const avgSkinLum = refSkinCount > 0 ? refSkinLumSum / refSkinCount : 120;

                // Eye Socket Region coordinates
                const eyeYTop = Math.max(0, facePixelTop + Math.floor(facePixelH * 0.25));
                const eyeYBottom = Math.min(height, facePixelTop + Math.floor(facePixelH * 0.46));
                const eyeBoxH = Math.max(1, eyeYBottom - eyeYTop);

                const lEyeLeft = Math.max(0, facePixelLeft + Math.floor(facePixelW * 0.16));
                const lEyeRight = Math.min(width, facePixelLeft + Math.floor(facePixelW * 0.44));
                const lEyeW = Math.max(1, lEyeRight - lEyeLeft);

                const rEyeLeft = Math.max(0, facePixelLeft + Math.floor(facePixelW * 0.56));
                const rEyeRight = Math.min(width, facePixelLeft + Math.floor(facePixelW * 0.84));
                const rEyeW = Math.max(1, rEyeRight - rEyeLeft);

                // Helper to evaluate ocular visibility and pupil/iris presence
                const evalEye = (xStart: number, xEnd: number, yStart: number, yEnd: number) => {
                  let minLum = 255;
                  let maxLum = 0;
                  let darkestX = xStart;
                  let darkestY = yStart;
                  let totalLum = 0;
                  let count = 0;
                  const lums: number[] = [];

                  for (let y = yStart; y < yEnd; y++) {
                    for (let x = xStart; x < xEnd; x++) {
                      const idx = (y * width + x) * 4;
                      const lum = (data[idx] * 299 + data[idx + 1] * 587 + data[idx + 2] * 114) / 1000;
                      lums.push(lum);
                      totalLum += lum;
                      count++;
                      if (lum < minLum) {
                        minLum = lum;
                        darkestX = x;
                        darkestY = y;
                      }
                      if (lum > maxLum) {
                        maxLum = lum;
                      }
                    }
                  }

                  if (count === 0) return { isVisible: false, contrast: 0, pupilRelX: 0.5, pupilRelY: 0.5, darkestX, darkestY };

                  const meanLum = totalLum / count;
                  let varSum = 0;
                  for (let i = 0; i < lums.length; i++) {
                    const d = lums[i] - meanLum;
                    varSum += d * d;
                  }
                  const stdDev = Math.sqrt(varSum / count);
                  const irisContrast = (avgSkinLum - minLum) / Math.max(1, avgSkinLum);
                  const internalContrast = (maxLum - minLum) / Math.max(1, maxLum);

                  const marginX = (xEnd - xStart) * 0.06;
                  const isInsideMargins = darkestX > xStart + marginX && darkestX < xEnd - marginX;

                  // Physiological criteria for an eye open and visible to camera:
                  // 1. Iris/pupil is significantly darker than ambient skin
                  // 2. Ocular box exhibits high variance (contrast between sclera and pupil)
                  // 3. Darkest pupil point is not at the extreme outer edge of the face
                  const isVisible =
                    irisContrast >= 0.16 &&
                    stdDev >= 9 &&
                    internalContrast >= 0.22 &&
                    minLum < avgSkinLum - 14 &&
                    isInsideMargins;

                  const pupilRelX = (darkestX - xStart) / Math.max(1, xEnd - xStart);
                  const pupilRelY = (darkestY - yStart) / Math.max(1, yEnd - yStart);

                  return { isVisible, contrast: irisContrast, stdDev, pupilRelX, pupilRelY, darkestX, darkestY };
                };

                const leftEval = evalEye(lEyeLeft, lEyeRight, eyeYTop, eyeYBottom);
                const rightEval = evalEye(rEyeLeft, rEyeRight, eyeYTop, eyeYBottom);

                const bothVisible = leftEval.isVisible && rightEval.isVisible;
                const oneVisible = leftEval.isVisible || rightEval.isVisible;

                setEyeBoxDetails({
                  left: {
                    x: (lEyeLeft / width) * 100,
                    y: (eyeYTop / height) * 100,
                    width: (lEyeW / width) * 100,
                    height: (eyeBoxH / height) * 100,
                    visible: leftEval.isVisible,
                    pupilX: (leftEval.darkestX / width) * 100,
                    pupilY: (leftEval.darkestY / height) * 100,
                  },
                  right: {
                    x: (rEyeLeft / width) * 100,
                    y: (eyeYTop / height) * 100,
                    width: (rEyeW / width) * 100,
                    height: (eyeBoxH / height) * 100,
                    visible: rightEval.isVisible,
                    pupilX: (rightEval.darkestX / width) * 100,
                    pupilY: (rightEval.darkestY / height) * 100,
                  },
                  statusText: bothVisible ? 'Direct Eye Lock' : oneVisible ? 'Partial Eye View' : 'Eyes Not Detected (0%)',
                });

                // 4. Accurate Eye Contact Calculation
                let curEyeContact = 0;

                if (!oneVisible) {
                  // CRITICAL FIX: EYES NOT VISIBLE IN CAMERA (Eyes closed, head turned, covered, or out of frame)
                  // MUST NOT SHOW 90%! Zero eye contact!
                  setAreEyesDetected(false);
                  curEyeContact = 0;
                } else if (!bothVisible) {
                  // Partial visibility: Only one eye visible (profile view or hand partially obstructing)
                  setAreEyesDetected(true);
                  curEyeContact = Math.round(Math.min(38, Math.max(15, 25 + (leftEval.contrast + rightEval.contrast) * 25)));
                } else {
                  // Both eyes are clearly visible in the camera
                  setAreEyesDetected(true);
                  const avgPupilX = (leftEval.pupilRelX + rightEval.pupilRelX) / 2;
                  const avgPupilY = (leftEval.pupilRelY + rightEval.pupilRelY) / 2;

                  const hGazeDev = Math.abs(avgPupilX - 0.50);
                  const vGazeDev = Math.abs(avgPupilY - 0.50);
                  const faceOffset = Math.abs(normCentroidX - 0.5) + Math.abs(normCentroidY - 0.45);

                  if (currentPose === 'centered' && hGazeDev < 0.18 && vGazeDev < 0.22) {
                    // Direct camera eye contact
                    curEyeContact = Math.round(Math.min(96, Math.max(80, 95 - (hGazeDev * 55 + vGazeDev * 45 + faceOffset * 25))));
                  } else if (currentPose === 'looking-down' || vGazeDev >= 0.22) {
                    // Looking downward away from camera lens
                    curEyeContact = Math.round(Math.max(18, 46 - vGazeDev * 60));
                  } else {
                    // Looking sideways away from camera
                    curEyeContact = Math.round(Math.max(22, 52 - hGazeDev * 70));
                  }
                }

                // 5. Facial Composure & Expression
                let curComposure = 50;
                let curExpr: 'confident' | 'attentive' | 'neutral' | 'smiling' | 'hesitant' | 'restless' = 'attentive';

                if (!oneVisible) {
                  curComposure = Math.max(20, Math.round(curStability * 0.4));
                  curExpr = 'hesitant';
                } else if (frameMotion > 8) {
                  curExpr = 'restless';
                  curComposure = Math.max(45, 72 - Math.round(frameMotion * 2));
                } else if (curEyeContact >= 80 && curStability >= 80) {
                  curExpr = 'confident';
                  curComposure = Math.min(96, Math.round((curEyeContact + curStability) / 2));
                } else if (currentPose === 'looking-down') {
                  curExpr = 'hesitant';
                  curComposure = Math.max(40, curEyeContact + 10);
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
                // No face detected in camera
                setIsFaceDetected(false);
                setAreEyesDetected(false);
                setFaceBox(null);
                setEyeBoxDetails(null);
                setEyeContactInstant(0);
                setStabilityInstant(0);
                setComposureInstant(0);

                samplesRef.current.push({
                  eyeContact: 0,
                  stability: 0,
                  composure: 0,
                  faceDetected: false,
                  expression: 'absent',
                  headPose: 'centered',
                });

                if (onTelemetrySample) {
                  onTelemetrySample({
                    eyeContactScore: 0,
                    postureStabilityScore: 0,
                    facialComposureScore: 0,
                    facePresencePct: 0,
                    overallBehaviorScore: 0,
                    behaviorNotes: ['No face detected in camera frame'],
                    detectedExpression: 'neutral',
                    headPose: 'centered',
                    cameraActive: true,
                  });
                }
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
          eyeContactScore: 0,
          postureStabilityScore: 0,
          facialComposureScore: 0,
          facePresencePct: 0,
          overallBehaviorScore: 0,
          behaviorNotes: isCameraOn
            ? ['Camera was active but no face or eyes were in view during this question.']
            : ['Camera was disabled during this question; verbal evaluation conducted.'],
          detectedExpression: 'neutral',
          headPose: 'centered',
          cameraActive: isCameraOn,
        };
      }

      const samples = samplesRef.current;
      const totalSamples = samples.length;
      const faceSamples = samples.filter((s) => s.faceDetected);
      const facePresencePct = Math.round((faceSamples.length / totalSamples) * 100);

      // Average accurately across all attempt frames so absence of eyes legitimately reduces score
      const avgEyeContact = Math.round(
        samples.reduce((acc, s) => acc + s.eyeContact, 0) / totalSamples
      );
      const avgStability = Math.round(
        samples.reduce((acc, s) => acc + s.stability, 0) / totalSamples
      );
      const avgComposure = Math.round(
        samples.reduce((acc, s) => acc + s.composure, 0) / totalSamples
      );

      const overall = Math.min(
        100,
        Math.max(0, Math.round(avgEyeContact * 0.4 + avgStability * 0.3 + avgComposure * 0.3))
      );

      const notes: string[] = [];
      if (avgEyeContact >= 80) {
        notes.push('Maintained outstanding, direct eye contact with the interviewer.');
      } else if (avgEyeContact >= 50) {
        notes.push('Moderate eye contact; occasionally looked away while retrieving thoughts.');
      } else if (avgEyeContact > 0) {
        notes.push('Low eye contact detected; practice looking directly into the webcam lens.');
      } else {
        notes.push('No direct eye contact detected during this question.');
      }

      if (avgStability >= 80) {
        notes.push('Excellent head posture and body language stability.');
      } else if (avgStability >= 50) {
        notes.push('Natural conversational movement with steady poise.');
      } else if (avgStability > 0) {
        notes.push('Noticeable fidgeting or rapid head movements detected.');
      }

      if (avgComposure >= 80) {
        notes.push('Appeared confident, composed, and engaged.');
      } else if (avgComposure > 0) {
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

          {/* Computer Vision Face & Eye Tracking Box Overlay */}
          {isCameraOn && isFaceDetected && faceBox && (
            <>
              {/* Main Face Box */}
              <div
                className={`absolute pointer-events-none rounded-xl border-2 transition-all duration-150 ${
                  areEyesDetected && eyeContactInstant >= 75
                    ? 'border-cyan-400/70 shadow-[0_0_15px_rgba(6,182,212,0.35)]'
                    : areEyesDetected
                    ? 'border-amber-400/70 shadow-[0_0_15px_rgba(245,158,11,0.35)]'
                    : 'border-rose-500/70 shadow-[0_0_15px_rgba(244,63,94,0.35)]'
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

                <div
                  className={`absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md border text-[9px] font-mono whitespace-nowrap backdrop-blur-xs flex items-center gap-1 ${
                    areEyesDetected
                      ? 'bg-slate-950/85 border-cyan-500/40 text-cyan-300'
                      : 'bg-rose-950/90 border-rose-500/50 text-rose-300'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      areEyesDetected ? 'bg-cyan-400 animate-ping' : 'bg-rose-400 animate-pulse'
                    }`}
                  />
                  <span>{areEyesDetected ? 'AI Face & Eyes Locked' : '⚠️ Eyes Not Detected (0%)'}</span>
                </div>
              </div>

              {/* Left & Right Ocular Reticles */}
              {eyeBoxDetails && (
                <>
                  {/* Left Eye Box */}
                  <div
                    className={`absolute pointer-events-none rounded-md border transition-all duration-150 flex items-center justify-center ${
                      eyeBoxDetails.left.visible
                        ? 'border-cyan-400/90 bg-cyan-400/15 shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                        : 'border-rose-500/80 bg-rose-500/15 border-dashed'
                    }`}
                    style={{
                      left: `${
                        isMirrored
                          ? 100 - (eyeBoxDetails.left.x + eyeBoxDetails.left.width)
                          : eyeBoxDetails.left.x
                      }%`,
                      top: `${eyeBoxDetails.left.y}%`,
                      width: `${eyeBoxDetails.left.width}%`,
                      height: `${eyeBoxDetails.left.height}%`,
                    }}
                  >
                    {eyeBoxDetails.left.visible ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-sm animate-pulse" />
                    ) : (
                      <span className="text-[8px] text-rose-300 font-mono font-bold">✕</span>
                    )}
                  </div>

                  {/* Right Eye Box */}
                  <div
                    className={`absolute pointer-events-none rounded-md border transition-all duration-150 flex items-center justify-center ${
                      eyeBoxDetails.right.visible
                        ? 'border-cyan-400/90 bg-cyan-400/15 shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                        : 'border-rose-500/80 bg-rose-500/15 border-dashed'
                    }`}
                    style={{
                      left: `${
                        isMirrored
                          ? 100 - (eyeBoxDetails.right.x + eyeBoxDetails.right.width)
                          : eyeBoxDetails.right.x
                      }%`,
                      top: `${eyeBoxDetails.right.y}%`,
                      width: `${eyeBoxDetails.right.width}%`,
                      height: `${eyeBoxDetails.right.height}%`,
                    }}
                  >
                    {eyeBoxDetails.right.visible ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-sm animate-pulse" />
                    ) : (
                      <span className="text-[8px] text-rose-300 font-mono font-bold">✕</span>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {/* Top Live Status Bar HUD */}
          {isCameraOn && (
            <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between pointer-events-none z-10">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/85 border border-slate-800 text-[10px] font-mono text-slate-300 backdrop-blur-md">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isFaceDetected && areEyesDetected
                      ? 'bg-emerald-400 animate-pulse'
                      : isFaceDetected
                      ? 'bg-rose-400 animate-pulse'
                      : 'bg-amber-400'
                  }`}
                />
                <span>
                  {isFaceDetected && areEyesDetected
                    ? 'BEHAVIOR TRACKING LIVE'
                    : isFaceDetected
                    ? '⚠️ EYES NOT VISIBLE - LOOK AT CAMERA'
                    : 'ALIGN FACE IN CAMERA'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/85 border border-cyan-500/30 text-[10px] font-mono text-cyan-300 backdrop-blur-md">
                <ShieldCheck className="w-3 h-3 text-cyan-400" />
                <span>
                  INDEX:{' '}
                  {isFaceDetected && areEyesDetected
                    ? Math.round(eyeContactInstant * 0.4 + stabilityInstant * 0.3 + composureInstant * 0.3)
                    : 0}
                  /100
                </span>
              </div>
            </div>
          )}

          {/* Bottom Live Behavior Metric Gauges HUD */}
          {isCameraOn && (
            <div className="absolute bottom-2.5 inset-x-2.5 flex items-center justify-between gap-2 pointer-events-none z-10">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {/* Eye Contact Badge */}
                <div
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-mono backdrop-blur-md ${
                    areEyesDetected
                      ? getMetricColor(eyeContactInstant)
                      : 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                  }`}
                >
                  {areEyesDetected ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  <span>
                    Eye: {areEyesDetected ? `${eyeContactInstant}%` : isFaceDetected ? '0% (No Eyes)' : '0%'}
                  </span>
                </div>

                {/* Poise / Stability Badge */}
                <div
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-mono backdrop-blur-md ${
                    isFaceDetected ? getMetricColor(stabilityInstant) : 'text-slate-500 bg-slate-900/50 border-slate-800'
                  }`}
                >
                  <Compass className="w-3 h-3" />
                  <span>Poise: {isFaceDetected ? `${stabilityInstant}%` : '0%'}</span>
                </div>

                {/* Composure / Expression Badge */}
                <div
                  className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-mono backdrop-blur-md ${
                    isFaceDetected ? getMetricColor(composureInstant) : 'text-slate-500 bg-slate-900/50 border-slate-800'
                  }`}
                >
                  <Smile className="w-3 h-3" />
                  <span className="capitalize">{isFaceDetected ? detectedExpression : 'searching'}</span>
                </div>
              </div>

              <div className="px-2 py-0.5 rounded-lg bg-slate-950/85 border border-slate-800 text-[10px] font-mono text-slate-300 backdrop-blur-md capitalize">
                {!isFaceDetected
                  ? '👤 Align Face'
                  : !areEyesDetected
                  ? '❌ Eyes Not Visible'
                  : headPose === 'centered'
                  ? '🎯 Direct Focus'
                  : `👀 ${headPose.replace('-', ' ')}`}
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
