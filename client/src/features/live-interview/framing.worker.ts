import {
  FaceLandmarker,
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";

type Counts = {
  samples: number;
  facePresent: number;
  shouldersPresent: number;
  handsPresent: number;
};

type WorkerInput =
  | { type: "init" }
  | { type: "dispose" }
  | { type: "frame"; bitmap: ImageBitmap; timestampMs: number };

const MODELS = {
  face: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  pose: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  hand: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
};

const WASM_ROOT =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

let face: FaceLandmarker | null = null;
let pose: PoseLandmarker | null = null;
let hands: HandLandmarker | null = null;
let counts: Counts = {
  samples: 0,
  facePresent: 0,
  shouldersPresent: 0,
  handsPresent: 0,
};

function post(message: Record<string, unknown>) {
  (self as unknown as Worker).postMessage(message);
}

async function createLandmarker<T>(
  createFn: (opts: any) => Promise<T>,
  modelAssetPath: string,
  extraOptions: Record<string, unknown>
): Promise<{ model: T | null; error: unknown }> {
  try {
    const model = await createFn({
      baseOptions: { modelAssetPath, delegate: "GPU" },
      runningMode: "VIDEO",
      ...extraOptions,
    });
    return { model, error: null };
  } catch (gpuErr) {
    try {
      const model = await createFn({
        baseOptions: { modelAssetPath, delegate: "CPU" },
        runningMode: "VIDEO",
        ...extraOptions,
      });
      return { model, error: null };
    } catch (cpuErr) {
      return { model: null, error: cpuErr || gpuErr };
    }
  }
}

async function init() {
  const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);

  const faceRes = await createLandmarker(
    opts => FaceLandmarker.createFromOptions(vision, opts),
    MODELS.face,
    {
      numFaces: 1,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    }
  );
  face = faceRes.model;

  const poseRes = await createLandmarker(
    opts => PoseLandmarker.createFromOptions(vision, opts),
    MODELS.pose,
    {
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    }
  );
  pose = poseRes.model;

  const handRes = await createLandmarker(
    opts => HandLandmarker.createFromOptions(vision, opts),
    MODELS.hand,
    {
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    }
  );
  hands = handRes.model;

  if (!face && !pose && !hands) {
    const firstErr = faceRes.error || poseRes.error || handRes.error;
    const reason =
      firstErr instanceof Error
        ? firstErr.message
        : firstErr
          ? String(firstErr)
          : "MediaPipe models failed to load on this device";
    throw new Error(reason);
  }

  post({ type: "ready" });
}

function frame(bitmap: ImageBitmap, timestampMs: number) {
  if (!face && !pose && !hands) throw new Error("Models are not ready");

  let faceFound = false;
  let shouldersFound = false;
  let handsFound = false;

  if (face) {
    try {
      faceFound =
        (face.detectForVideo(bitmap, timestampMs).faceLandmarks || []).length >
        0;
    } catch {}
  }

  if (pose) {
    try {
      const poseLandmarks =
        pose.detectForVideo(bitmap, timestampMs).landmarks?.[0] || [];
      const visible = (index: number) =>
        Boolean(
          poseLandmarks[index] && (poseLandmarks[index].visibility ?? 0) >= 0.5
        );
      shouldersFound = visible(11) && visible(12);
    } catch {}
  }

  if (hands) {
    try {
      handsFound =
        (hands.detectForVideo(bitmap, timestampMs).landmarks || []).length > 0;
    } catch {}
  }

  counts = {
    samples: Math.min(10000, counts.samples + 1),
    facePresent: Math.min(10000, counts.facePresent + Number(faceFound)),
    shouldersPresent: Math.min(
      10000,
      counts.shouldersPresent + Number(shouldersFound)
    ),
    handsPresent: Math.min(10000, counts.handsPresent + Number(handsFound)),
  };
  post({ type: "counts", counts });
}

function dispose() {
  face?.close();
  pose?.close();
  hands?.close();
  face = null;
  pose = null;
  hands = null;
  counts = {
    samples: 0,
    facePresent: 0,
    shouldersPresent: 0,
    handsPresent: 0,
  };
}

self.onmessage = event => {
  const input = event.data as WorkerInput;
  if (input.type === "init") {
    void init().catch(err =>
      post({
        type: "error",
        code: "model_unavailable",
        message: err instanceof Error ? err.message : String(err),
      })
    );
    return;
  }
  if (input.type === "dispose") {
    dispose();
    return;
  }
  if (input.type === "frame") {
    try {
      frame(input.bitmap, input.timestampMs);
    } catch (err) {
      post({
        type: "error",
        code: "inference_unavailable",
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      input.bitmap.close();
    }
  }
};