# Optional camera framing: browser implementation notes

Research date: 2026-10-24.

## Official implementation references

- [Face Landmarker for Web](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js)
- [Pose Landmarker for Web](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js)
- [Hand Landmarker for Web](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js)
- [MediaPipe Tasks setup for Web](https://developers.google.com/mediapipe/solutions/setup_web)

The app pins the already installed `@mediapipe/tasks-vision` dependency. The official Web guides document `FilesetResolver.forVisionTasks`, `createFromOptions`, `runningMode: "VIDEO"`, and `detectForVideo` for video-frame inference. The Hand Landmarker guide states that inference calls are synchronous and can block the UI thread; it recommends using a Web Worker for camera/video use. The existing behavioral feature documents the official model asset URLs and a version-pinned WebAssembly bundle root.

## SMART INTERVIEW AI privacy boundary

The Live Interview camera feature is separately opt-in and requests a video-only stream after explicit user action. It runs the official face, pose, and hand detection tasks locally in a worker, samples at a low rate, and returns only aggregate counts of frames where a face, both shoulders, or hands were detected. It does not calculate gaze, expression, emotion, confidence, identity, personality, health, competence, or hiring suitability. It does not send frames, audio, coordinates, or landmarks to the server. If retained with a report, the only camera record is a bounded summary, sample count, and availability/reliability note; missing/insufficient coverage is unavailable rather than zero.

Models and WebAssembly are fetched from the documented public CDNs when a user opts in. This external model download is disclosed in the UI. The feature stops the camera tracks and worker on opt-out, completion, unmount, or error. No generated or inferred data is a hiring recommendation.
