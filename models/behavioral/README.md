# Behavioral Interview Analysis model registry

SMART INTERVIEW's Behavioral Interview Analysis mode uses lightweight, local landmark models for observable coaching signals. The browser downloads these official task assets on first model initialization; model weights are not committed to this repository and are not silently replaced with another checkpoint.

## Registry

| Model | Purpose | Official checkpoint | License/source | Runtime notes |
|---|---|---|---|---|
| Google MediaPipe Face Landmarker | Face visibility, approximate camera-relative gaze, blink observations, head transformation matrix, multiple visible faces | [Float16 version 1](https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task) | The overview links separate Face Detector, Face Mesh V2 and Blendshape model cards. The overview does not establish a license for each weight file; check the cards/terms before redistribution. | `VIDEO` mode, `numFaces: 2`, blendshapes and facial transformation matrices enabled |
| Google MediaPipe Pose Landmarker Lite | Shoulder/upper-body visibility, normalized torso movement and framing coverage | [Float16 version 1](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task) | The overview links the BlazePose GHUM model card; verify its asset terms before redistribution. | Lite variant chosen for lower resource use; CPU fallback remains supported. Windows 11/MX450 performance has not been measured in this project. |
| Google MediaPipe Hand Landmarker | Left/right hand visibility and normalized hand movement coverage | [Float16 version 1](https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task) | The overview links the Hand Tracking model card; verify its asset terms before redistribution. | `VIDEO` mode, up to two hands; no semantic gesture labels are claimed |
| Google Gemini through the authenticated server transcription endpoint | Spoken-answer transcription text | `GEMINI_AUDIO_MODEL` (defaults to `gemini-2.5-flash`); no checkpoint is committed by the app | Google Gemini API documentation: <https://ai.google.dev/gemini-api/docs/audio> | Audio is held in memory and sent to the server with `GEMINI_API_KEY`. The app does not write the audio file to Supabase Storage; provider-side retention was not verified. |

MediaPipe documentation and source: <https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker>, <https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker>, <https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker>, <https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js>, <https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js>, <https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js>, <https://ai.google.dev/edge/mediapipe/solutions/setup_web>, <https://github.com/google-ai-edge/mediapipe>.

## Setup and network requirements

The project pins `@mediapipe/tasks-vision` `0.10.35` (its installed package metadata declares Apache-2.0) and uses `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm`. The three model bundles are pinned to version `1` in their Google Storage URLs above. Google's Web documentation states that page content is generally CC BY 4.0 and code samples Apache 2.0; those notices do not establish the license of each downloadable model weight. The overview pages link separate model cards for the Face Detector, Face Mesh V2, Blendshape V2, BlazePose GHUM and Hand Tracking models. Consult each relevant card and current terms before copying, modifying, mirroring or redistributing model files. The app currently fetches the files from the official URLs and does not check model weights into this repository.

The first behavioral session requires a browser that supports `getUserMedia`, `MediaRecorder`, classic workers, `ImageBitmap` transfer and WebAssembly. The three `.task` files and MediaPipe WASM runtime must be reachable from the development machine. If a corporate firewall blocks the official Google Storage or jsDelivr URLs, model readiness fails with an actionable retry message; the app never substitutes placeholder models.

No model provider key is exposed in the browser. `GEMINI_API_KEY` is a server-only secret; the browser reaches transcription through the authenticated application API. `SUPABASE_URL` and `SUPABASE_ANON_KEY` configure the public Supabase client, with row-level security enforced by the database.

The approved database migration must be applied in the owning Supabase project before remote behavioral writes; this local guide does not assert the migration's current remote state. Behavioral questions are generated on demand by the authenticated Google Gemini-backed question-generation procedure from the learner's field, target role, focus topics, difficulty and requested count. The app does not upload raw camera frames, camera-bearing streams or landmark arrays to its server. The `MediaRecorder` used for transcription is constructed from microphone audio tracks only; camera video stays local for preview and worker inference. Camera permission is optional and is requested only after the learner explicitly enables camera analysis. Without a selected camera, the practice room requests microphone access only and supports the complete question/transcription/report flow. Selected camera/microphone device IDs are held only in tab-scoped `sessionStorage` to reacquire opted-in devices after the route transition or reload; they are not sent to the backend. Raw audio is held in memory for the authenticated server-side Gemini transcription request and is not written to Supabase Storage by the app; provider-side retention was not verified here. The disclosure also states that MediaPipe reports performance/utilization metrics to Google; its public notice does not enumerate every field. This is separate from the app's camera-frame handling, and means the optional camera feature is not telemetry-free.

## Measurement boundaries

The feature produces observable, camera-relative coaching measurements. Gaze is an approximation from visible facial landmarks, not medical eye tracking. Head pose is a normalized movement signal, not a confidence or honesty detector. Hand and posture coverage does not penalize a person for gesturing less, moving differently, having a disability, or using a different communication style. Additional faces are factual timestamped events and are never labelled cheating. The report shows coverage, reliability and missing-data limitations; it does not infer emotion, personality, deception, sensitive traits, employability or hiring outcomes.

## Local commands and verification

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
pnpm dev
```

Before opening `/behavioral-interview`, confirm that the required migrations are applied in the exact Supabase project. Follow [`supabase/SETUP.md`](../../supabase/SETUP.md) for safe SQL Editor execution and ledger reconciliation. Local code checks do not establish remote migration state.
