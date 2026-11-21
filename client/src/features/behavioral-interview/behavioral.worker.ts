import {
  FaceLandmarker,
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";
import type { BehavioralFrame } from "../../../../shared/behavioral-scoring";

const MODEL_ASSETS = {
  face: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  pose: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  hand: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
};
const WASM_ASSET_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

let face: FaceLandmarker | null = null;
let pose: PoseLandmarker | null = null;
let hand: HandLandmarker | null = null;
let lastShoulderCenter: { x: number; y: number } | null = null;
let lastHandCenter: { x: number; y: number } | null = null;
let startedAt = 0;

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const average = (items: Array<{ x: number; y: number }>) => ({
  x: items.reduce((sum, item) => sum + item.x, 0) / Math.max(1, items.length),
  y: items.reduce((sum, item) => sum + item.y, 0) / Math.max(1, items.length),
});

function eyeGaze(landmarks: Array<{ x: number; y: number; z?: number }>) {
  if (landmarks.length < 478) return "unavailable" as const;
  const leftCorner = landmarks[33];
  const leftOuter = landmarks[133];
  const rightCorner = landmarks[362];
  const rightOuter = landmarks[263];
  const leftIris = average([landmarks[468], landmarks[469], landmarks[470], landmarks[471]]);
  const rightIris = average([landmarks[473], landmarks[474], landmarks[475], landmarks[476]]);
  const leftRatio = distance(leftCorner, leftIris) / Math.max(0.001, distance(leftCorner, leftOuter));
  const rightRatio = distance(rightCorner, rightIris) / Math.max(0.001, distance(rightCorner, rightOuter));
  const ratio = (leftRatio + rightRatio) / 2;
  return ratio >= 0.28 && ratio <= 0.72 ? ("camera" as const) : ("away" as const);
}

function blink(landmarks: Array<{ x: number; y: number }>) {
  if (landmarks.length < 400) return null;
  const left = distance(landmarks[159], landmarks[145]) / Math.max(0.001, distance(landmarks[33], landmarks[133]));
  const right = distance(landmarks[386], landmarks[374]) / Math.max(0.001, distance(landmarks[362], landmarks[263]));
  return (left + right) / 2 < 0.18;
}

function headPose(matrix: { data?: number[] } | undefined) {
  const m = matrix?.data;
  if (!m || m.length < 16) return { yaw: null, pitch: null, roll: null };
  const yaw = Math.atan2(-m[2], Math.sqrt(m[0] * m[0] + m[1] * m[1])) * (180 / Math.PI);
  const pitch = Math.atan2(m[6], m[10]) * (180 / Math.PI);
  const roll = Math.atan2(m[1], m[0]) * (180 / Math.PI);
  return { yaw, pitch, roll };
}

async function init() {
  // The Vite worker bundle is classic so MediaPipe's classic loader can
  // register ModuleFactory on the worker global before task construction.
  const vision = await FilesetResolver.forVisionTasks(WASM_ASSET_ROOT, false);
  face = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_ASSETS.face },
    runningMode: "VIDEO",
    numFaces: 2,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  });
  pose = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_ASSETS.pose },
    runningMode: "VIDEO",
    numPoses: 1,
  });
  hand = await HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_ASSETS.hand },
    runningMode: "VIDEO",
    numHands: 2,
  });
  startedAt = performance.now();
  (self as unknown as Worker).postMessage({ type: "ready", models: { ...MODEL_ASSETS } });
}

function processFrame(bitmap: ImageBitmap, timestampMs: number) {
  if (!face || !pose || !hand) throw new Error("Behavioral models are not initialized");
  const faceResult = face.detectForVideo(bitmap, timestampMs);
  const poseResult = pose.detectForVideo(bitmap, timestampMs);
  const handResult = hand.detectForVideo(bitmap, timestampMs);
  const faces = faceResult.faceLandmarks || [];
  const primary = faces[0];
  const torso = poseResult.landmarks?.[0] || [];
  const shoulderPoints = torso.length > 12 ? [torso[11], torso[12]] : [];
  const shoulders = shoulderPoints.length === 2 && shoulderPoints.every(point =>
    Number.isFinite(point.x) && Number.isFinite(point.y) && (point.visibility ?? 0) >= 0.5
  ) ? average(shoulderPoints) : null;
  const handLandmarks = handResult.landmarks || [];
  const currentHand = handLandmarks.length
    ? average(
        handLandmarks.flatMap(items => [
          items[0],
          items[5],
          items[9],
          items[13],
          items[17],
        ]) as Array<{ x: number; y: number }>
      )
    : null;
  const head = headPose(faceResult.facialTransformationMatrixes?.[0]);
  const frame: BehavioralFrame = {
    timestampMs: Math.round(timestampMs - startedAt),
    faceCount: faces.length,
    faceVisible: Boolean(primary),
    gaze: primary ? eyeGaze(primary) : "unavailable",
    blink: primary ? blink(primary) : null,
    yaw: head.yaw,
    pitch: head.pitch,
    roll: head.roll,
    poseVisible: Boolean(shoulders),
    torsoMovement: shoulders && lastShoulderCenter ? distance(shoulders, lastShoulderCenter) : null,
    handsVisible: handLandmarks.length,
    handMovement: currentHand && lastHandCenter ? distance(currentHand, lastHandCenter) : null,
    lightingOk: null,
    trackingReliable: Boolean(primary && primary.length >= 478),
  };
  lastShoulderCenter = shoulders;
  lastHandCenter = currentHand;
  (self as unknown as Worker).postMessage({ type: "observation", frame });
}

self.onmessage = event => {
  const message = event.data as { type: string; bitmap?: ImageBitmap; timestampMs?: number };
  if (message.type === "init") {
    void init().catch(error =>
      (self as unknown as Worker).postMessage({
        type: "error",
        message: error instanceof Error ? error.message : "Model initialization failed",
      })
    );
    return;
  }
  if (message.type === "frame" && message.bitmap && typeof message.timestampMs === "number") {
    try {
      processFrame(message.bitmap, message.timestampMs);
    } catch (error) {
      (self as unknown as Worker).postMessage({
        type: "error",
        message: error instanceof Error ? error.message : "Frame inference failed",
      });
    } finally {
      message.bitmap.close();
    }
  }
  if (message.type === "dispose") {
    face?.close();
    pose?.close();
    hand?.close();
    face = null;
    pose = null;
    hand = null;
    lastShoulderCenter = null;
    lastHandCenter = null;
  }
};
