import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { Link, useLocation, useParams } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Clock3,
  Eye,
  Mic,
  Pause,
  RotateCcw,
  ScanFace,
  Send,
  ShieldCheck,
  UsersRound,
  Video,
} from "lucide-react";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { trpc } from "@/lib/trpc";
import {
  EmptyState,
  LoadingState,
  PageHeading,
  Panel,
  Tag,
} from "@/components/app/Shared";
import {
  aggregateBehavioralObservations,
  type BehavioralFrame,
  type BehavioralSummary,
} from "../../../../shared/behavioral-scoring";
import { MAX_TRANSCRIPTION_AUDIO_BYTES } from "@shared/const";
import { isSilenceHallucination } from "@shared/scoring";
import {
  behavioralDeviceSelectionFromStream,
  behavioralDeviceSelectionStorageKey,
  isBehavioralAudioReady,
  parseBehavioralDeviceSelection,
  selectAudioTracksForTranscription,
} from "./device-state";

type DeviceOption = { deviceId: string; label: string };

const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

function useBehavioralWorker(
  onObservation: (frame: BehavioralFrame) => void,
  enabled: boolean
) {
  const workerRef = useRef<Worker | null>(null);
  const observationRef = useRef(onObservation);
  observationRef.current = onObservation;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setReady(false);
    setError("");
    if (!enabled) return;
    const worker = new Worker(
      new URL("./behavioral.worker.ts", import.meta.url)
    );
    workerRef.current = worker;
    worker.onmessage = event => {
      if (event.data?.type === "ready") setReady(true);
      if (event.data?.type === "observation")
        observationRef.current(event.data.frame as BehavioralFrame);
      if (event.data?.type === "error")
        setError(
          "Local analysis models could not start. Check your connection and retry."
        );
    };
    worker.postMessage({ type: "init" });
    return () => {
      worker.postMessage({ type: "dispose" });
      worker.terminate();
      workerRef.current = null;
    };
  }, [attempt, enabled]);
  return {
    workerRef,
    ready,
    error,
    retry: () => setAttempt(value => value + 1),
  };
}

function DeviceSetup({
  videoRef,
  stream,
  setStream,
  onReady,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  setStream: (stream: MediaStream | null) => void;
  onReady: (value: boolean) => void;
}) {
  const [cameras, setCameras] = useState<DeviceOption[]>([]);
  const [microphones, setMicrophones] = useState<DeviceOption[]>([]);
  const [cameraId, setCameraId] = useState("");
  const [microphoneId, setMicrophoneId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cameraEnabled = Boolean(
    stream?.getVideoTracks().some(track => track.readyState === "live")
  );

  async function enumerate() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    setCameras(
      devices
        .filter(device => device.kind === "videoinput")
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || "Camera",
        }))
    );
    setMicrophones(
      devices
        .filter(device => device.kind === "audioinput")
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || "Microphone",
        }))
    );
  }
  async function connectMicrophone() {
    setBusy(true);
    setError("");
    try {
      const requested = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: microphoneId ? { deviceId: { exact: microphoneId } } : true,
      });
      const audioTracks = requested.getAudioTracks();
      const videoTracks =
        stream?.getVideoTracks().filter(track => track.readyState === "live") ??
        [];
      stream?.getAudioTracks().forEach(track => track.stop());
      const next = new MediaStream([...videoTracks, ...audioTracks]);
      setStream(next);
      if (videoRef.current && videoTracks.length) {
        videoRef.current.srcObject = next;
        await videoRef.current.play().catch(() => undefined);
      }
      await enumerate();
    } catch {
      setError(
        "Microphone access is required for spoken answers. Check browser permissions and retry; camera access is optional."
      );
    } finally {
      setBusy(false);
    }
  }
  async function enableCamera() {
    if (!isBehavioralAudioReady(stream)) {
      setError("Connect your microphone first. Camera analysis is optional.");
      return;
    }
    setBusy(true);
    setError("");
    let requested: MediaStream | null = null;
    try {
      requested = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: cameraId
          ? {
              deviceId: { exact: cameraId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          : true,
      });
      const audioTracks =
        stream?.getAudioTracks().filter(track => track.readyState === "live") ??
        [];
      const videoTracks = requested.getVideoTracks();
      stream?.getVideoTracks().forEach(track => track.stop());
      const next = new MediaStream([...audioTracks, ...videoTracks]);
      setStream(next);
      if (videoRef.current) {
        videoRef.current.srcObject = next;
        await videoRef.current.play();
      }
      await enumerate();
    } catch {
      requested?.getTracks().forEach(track => track.stop());
      setError(
        "Camera access or preview failed. You can continue with microphone-only practice."
      );
      const audioOnly = new MediaStream(
        stream?.getAudioTracks().filter(track => track.readyState === "live") ??
          []
      );
      setStream(audioOnly);
      if (videoRef.current) videoRef.current.srcObject = null;
    } finally {
      setBusy(false);
    }
  }
  function disableCamera() {
    const audioTracks =
      stream?.getAudioTracks().filter(track => track.readyState === "live") ??
      [];
    stream?.getVideoTracks().forEach(track => track.stop());
    const audioOnly = new MediaStream(audioTracks);
    setStream(audioOnly);
    if (videoRef.current) videoRef.current.srcObject = null;
    setError("");
  }
  function stopDevices() {
    stream?.getTracks().forEach(track => track.stop());
    setStream(null);
    if (videoRef.current) videoRef.current.srcObject = null;
    setError("");
  }
  useEffect(() => {
    void enumerate().catch(() =>
      setError(
        "Available devices could not be listed. You can still use the default microphone."
      )
    );
  }, []);
  useEffect(() => {
    const refreshReadiness = () => {
      const ready = isBehavioralAudioReady(stream);
      onReady(ready);
      if (!ready && stream?.getAudioTracks().length)
        setError(
          "Microphone is muted or disconnected. Reconnect it to continue."
        );
    };
    const handleDeviceChange = () => {
      void enumerate().catch(() =>
        setError("Available devices could not be refreshed.")
      );
    };
    const tracks = stream?.getTracks() ?? [];
    const audioTracks = stream?.getAudioTracks() ?? [];
    const videoTracks = stream?.getVideoTracks() ?? [];
    const handleVideoEnded = () => {
      const audioOnly = new MediaStream(
        audioTracks.filter(track => track.readyState === "live")
      );
      setStream(audioOnly);
      if (videoRef.current) videoRef.current.srcObject = null;
      setError("Camera disconnected; microphone-only practice can continue.");
    };
    audioTracks.forEach(track => {
      track.addEventListener("ended", refreshReadiness);
      track.addEventListener("mute", refreshReadiness);
      track.addEventListener("unmute", refreshReadiness);
    });
    videoTracks.forEach(track =>
      track.addEventListener("ended", handleVideoEnded)
    );
    navigator.mediaDevices?.addEventListener?.(
      "devicechange",
      handleDeviceChange
    );
    refreshReadiness();
    return () => {
      audioTracks.forEach(track => {
        track.removeEventListener("ended", refreshReadiness);
        track.removeEventListener("mute", refreshReadiness);
        track.removeEventListener("unmute", refreshReadiness);
      });
      videoTracks.forEach(track =>
        track.removeEventListener("ended", handleVideoEnded)
      );
      navigator.mediaDevices?.removeEventListener?.(
        "devicechange",
        handleDeviceChange
      );
    };
  }, [stream, setStream, onReady, videoRef]);
  return (
    <div className="behavioral-device-setup">
      <div className="behavioral-preview-wrap">
        <video
          ref={videoRef}
          className="behavioral-video"
          muted
          playsInline
          aria-label="Camera preview"
        />
        {!cameraEnabled && (
          <div className="behavioral-preview-empty">
            <Camera size={28} />
            <span>Camera is off; microphone-only practice is available</span>
          </div>
        )}
        <span
          className={`behavioral-status-dot ${cameraEnabled ? "ready" : ""}`}
        />
      </div>
      <div className="behavioral-device-fields">
        <label>
          Camera
          <select
            className="field"
            value={cameraId}
            onChange={event => setCameraId(event.target.value)}
          >
            <option value="">Default camera</option>
            {cameras.map(device => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Microphone
          <select
            className="field"
            value={microphoneId}
            onChange={event => setMicrophoneId(event.target.value)}
          >
            <option value="">Default microphone</option>
            {microphones.map(device => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button button-secondary"
          type="button"
          onClick={() => void connectMicrophone()}
          disabled={busy}
        >
          {busy ? (
            <>
              <span className="spinner" /> Connecting microphone…
            </>
          ) : (
            <>
              <Mic size={15} /> Connect or retry microphone
            </>
          )}
        </button>
        {isBehavioralAudioReady(stream) && !cameraEnabled && (
          <button
            className="button button-secondary"
            type="button"
            onClick={() => void enableCamera()}
            disabled={busy}
          >
            <Camera size={15} /> Enable optional camera analysis
          </button>
        )}
        {cameraEnabled && (
          <button
            className="button button-ghost"
            type="button"
            onClick={disableCamera}
          >
            Turn camera off
          </button>
        )}
        {stream && (
          <button
            className="button button-ghost"
            type="button"
            onClick={stopDevices}
          >
            Stop microphone and camera
          </button>
        )}
      </div>
      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}
      {isBehavioralAudioReady(stream) && (
        <div className="behavioral-readiness-checks">
          <span>
            <Check size={14} /> Microphone connected
          </span>
          <span>
            {cameraEnabled ? <Check size={14} /> : <Camera size={14} />}{" "}
            {cameraEnabled
              ? "Optional camera analysis on"
              : "Camera off (optional)"}
          </span>
          {cameraEnabled && (
            <span>
              <Check size={14} /> Camera preview ready; framing and lighting are
              not measured
            </span>
          )}
        </div>
      )}
    </div>
  );
}

type GeneratedQuestion = {
  question: string;
  topic: string;
  difficulty: string;
  rationale: string;
};

export function BehavioralSetup() {
  const { user } = useSupabaseAuth();
  const [, navigate] = useLocation();
  const createSession = trpc.behavioral.createSession.useMutation();
  const generateQuestions = trpc.ai.generateQuestions.useMutation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(stream);
  streamRef.current = stream;
  const [deviceReady, setDeviceReady] = useState(false);
  const [includeAnswerEvaluation, setIncludeAnswerEvaluation] = useState(true);
  const [course, setCourse] = useState("");
  const [role, setRole] = useState("");
  const [focus, setFocus] = useState("");
  const [difficulty, setDifficulty] = useState("Medium");
  const [count, setCount] = useState("5");
  const [generatedQuestions, setGeneratedQuestions] = useState<
    GeneratedQuestion[]
  >([]);
  const [error, setError] = useState("");
  const observationSink = useRef<(frame: BehavioralFrame) => void>(
    () => undefined
  );
  const cameraEnabled = Boolean(
    stream?.getVideoTracks().some(track => track.readyState === "live")
  );
  const worker = useBehavioralWorker(
    frame => observationSink.current(frame),
    cameraEnabled
  );
  useEffect(
    () => () => streamRef.current?.getTracks().forEach(track => track.stop()),
    []
  );

  async function generate() {
    if (!user || !course.trim() || !role.trim()) {
      setError("Enter your field of study and target role first.");
      return;
    }
    setError("");
    try {
      const result = await generateQuestions.mutateAsync({
        course: course.trim(),
        role: role.trim(),
        type: "Behavioral",
        difficulty,
        count: Number(count),
        language: "English",
        skills: focus
          .split(",")
          .map(value => value.trim())
          .filter(Boolean)
          .slice(0, 10),
        context: focus.trim() || undefined,
      });
      setGeneratedQuestions(result.questions as GeneratedQuestion[]);
    } catch {
      setError(
        "Something went wrong while generating your interview. Please try again."
      );
    }
  }

  async function start() {
    if (!user) {
      setError("Please sign in to start your behavioral practice.");
      return;
    }
    if (!generatedQuestions.length) {
      setError("Please generate behavioral questions first before starting.");
      return;
    }
    setError("");

    let activeStream = stream;
    if (!activeStream) {
      try {
        const audio = await navigator.mediaDevices.getUserMedia({ audio: true });
        activeStream = audio;
        setStream(audio);
        setDeviceReady(true);
      } catch (e) {
        console.warn("Microphone pre-connection optional during setup:", e);
      }
    }

    const isCameraActive = Boolean(
      activeStream?.getVideoTracks().some(track => track.readyState === "live")
    ) && worker.ready;

    const selection = activeStream
      ? behavioralDeviceSelectionFromStream(activeStream)
      : { cameraDeviceId: "", microphoneDeviceId: "" };
    const pendingSelectionKey =
      behavioralDeviceSelectionStorageKey("__pending__");
    try {
      sessionStorage.setItem(pendingSelectionKey, JSON.stringify(selection));
    } catch {
      // Storage unavailable, continue
    }

    try {
      const created = await createSession.mutateAsync({
        selectedQuestions: [],
        generatedQuestions,
        includeAnswerEvaluation,
        consent: {
          camera: isCameraActive,
          microphone: true,
          permissionRequestedAutomatically: false,
          localVisualProcessing: isCameraActive,
          temporaryAudioForTranscription: true,
          rawMediaRetention: false,
          permissionRequestedAt: new Date().toISOString(),
        },
        modelMetadata: {
          questionGenerator: "Google Gemini",
          transcription: "Google Gemini server transcription",
          ...(isCameraActive
            ? {
                face: "MediaPipe Face Landmarker · float16/1 · numFaces=2",
                pose: "MediaPipe Pose Landmarker Lite · float16/1",
                hand: "MediaPipe Hand Landmarker · float16/1",
              }
            : {}),
        },
      });
      try {
        sessionStorage.setItem(
          behavioralDeviceSelectionStorageKey(created.id),
          JSON.stringify(selection)
        );
        sessionStorage.removeItem(pendingSelectionKey);
      } catch {
        // The pending entry remains available as a same-tab fallback.
      }
      navigate(`/behavioral-interview/${created.id}`);
    } catch (err: any) {
      try {
        sessionStorage.removeItem(pendingSelectionKey);
      } catch {
        /* storage may be disabled */
      }
      setError(
        err?.message ||
          "We couldn't start this behavioral session. Your question set is still here; please retry."
      );
    }
  }

  return (
    <div className="page-stack behavioral-page">
      <PageHeading
        eyebrow="OBSERVABLE PRACTICE MODE"
        title="Behavioral Interview Analysis"
        description="Tell your AI coach what you want to practise, then answer generated questions aloud while reviewing observable interview behavior. This is a private coaching signal, not a hiring or personality judgment."
        action={
          <Link className="button button-secondary" href="/practice">
            <ArrowLeft size={14} /> Back to interview setup
          </Link>
        }
      />
      <Panel
        title="1. Generate your behavioral questions"
        subtitle="Your AI coach creates a fresh, role-specific question set from your field, target role and focus topics. No saved interview history is required."
      >
        <div className="behavioral-generator-grid">
          <label>
            Field or course
            <input
              className="field"
              value={course}
              onChange={event => setCourse(event.target.value)}
              placeholder="e.g. Computer Science, Finance, Mechanical Engineering"
            />
          </label>
          <label>
            Target role
            <input
              className="field"
              value={role}
              onChange={event => setRole(event.target.value)}
              placeholder="e.g. Frontend Developer"
            />
          </label>
          <label className="behavioral-generator-wide">
            Focus topics or skills
            <input
              className="field"
              value={focus}
              onChange={event => setFocus(event.target.value)}
              placeholder="e.g. teamwork, leadership, project ownership (comma separated)"
            />
          </label>
          <label>
            Difficulty
            <select
              className="field"
              value={difficulty}
              onChange={event => setDifficulty(event.target.value)}
            >
              <option>Easy</option>
              <option>Medium</option>
              <option>Hard</option>
            </select>
          </label>
          <label>
            Questions
            <select
              className="field"
              value={count}
              onChange={event => setCount(event.target.value)}
            >
              <option value="3">3 questions</option>
              <option value="5">5 questions</option>
              <option value="8">8 questions</option>
              <option value="10">10 questions</option>
            </select>
          </label>
        </div>
        <button
          className="button button-secondary"
          type="button"
          onClick={() => void generate()}
          disabled={
            generateQuestions.isPending || !course.trim() || !role.trim()
          }
        >
          {generateQuestions.isPending ? (
            <>
              <span className="spinner" /> Creating questions…
            </>
          ) : (
            <>
              Generate questions <ArrowRight size={15} />
            </>
          )}
        </button>
        {generatedQuestions.length > 0 && (
          <div className="behavioral-generated-list">
            <div className="behavioral-selection-summary">
              <span>
                <Check size={15} /> {generatedQuestions.length} generated
              </span>
              <span>
                <Clock3 size={15} /> About{" "}
                {Math.max(1, Math.ceil(generatedQuestions.length * 2.5))} min
              </span>
              <span>Ready for spoken practice</span>
            </div>
            {generatedQuestions.map((question, index) => (
              <article
                className="behavioral-generated-question"
                key={`${question.question}-${index}`}
              >
                <span className="behavioral-question-index">{index + 1}</span>
                <div>
                  <b>{question.question}</b>
                  <small>
                    {question.topic || "General"} · {question.difficulty} ·{" "}
                    {question.rationale}
                  </small>
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>
      <div className="behavioral-setup-grid">
        <Panel
          title="2. Microphone and optional camera"
          subtitle="Connect a microphone to record spoken answers. Camera access is optional and is requested only if you choose to enable local visual analysis."
        >
          <DeviceSetup
            videoRef={videoRef}
            stream={stream}
            setStream={setStream}
            onReady={setDeviceReady}
          />
          <div className="behavioral-consent-box">
            <ShieldCheck size={20} />
            <div>
              <b>Optional camera and microphone privacy boundaries</b>
              <p>
                Camera permission is optional. Without it, you can complete
                every question using microphone audio only. If enabled,
                camera video stays in your browser for local analysis and is never
                included in the recording sent for transcription.
                Only microphone audio is held temporarily for authenticated
                transcription; the app does not retain it by default.
              </p>
              <p>
                The app does not upload camera frames, camera video or landmark
                coordinates to its server. MediaPipe says its Tasks APIs send
                performance and usage metrics to Google; its public notice does
                not list every field. The pinned runtime and model files are
                fetched from jsDelivr and Google Cloud Storage.
              </p>
              <p>
                When camera analysis is enabled, this mode measures approximate
                camera-relative gaze, visible face count, head orientation,
                upper-body/hand coverage and data quality. Speaking timing comes
                from the audio recording. Missing camera data is disclosed; it
                does not infer emotion, honesty, confidence, personality,
                disability or hiring potential.
              </p>
            </div>
          </div>
          <label className="behavioral-checkbox-row">
            <input
              type="checkbox"
              checked={includeAnswerEvaluation}
              onChange={event =>
                setIncludeAnswerEvaluation(event.target.checked)
              }
            />
            <span>
              Include original answer-quality evaluation when a matching saved
              answer is available.
            </span>
          </label>
          {(error || (cameraEnabled && worker.error)) && (
            <div className="notice notice-error" role="alert">
              {error || worker.error}
            </div>
          )}
          <div className="behavioral-start-row">
            <span
              className={`behavioral-model-status ${!cameraEnabled || worker.ready ? "ready" : ""}`}
            >
              <ScanFace size={15} />{" "}
              {!cameraEnabled
                ? "Camera analysis is optional"
                : worker.ready
                  ? "Face, pose and hand models ready"
                  : worker.error
                    ? "Local model setup needs retry"
                    : "Loading local model assets…"}
            </span>
            {cameraEnabled && worker.error && (
              <button
                className="button button-secondary"
                type="button"
                onClick={worker.retry}
              >
                Retry model setup
              </button>
            )}
            <button
              className="button button-primary"
              type="button"
              onClick={() => void start()}
              disabled={
                !generatedQuestions.length ||
                createSession.isPending
              }
            >
              {createSession.isPending ? (
                <>
                  <span className="spinner" /> Starting…
                </>
              ) : (
                <>
                  Start behavioral practice <ArrowRight size={15} />
                </>
              )}
            </button>
          </div>
        </Panel>
        <aside className="behavioral-principles">
          <span className="eyebrow">
            <Eye size={13} /> MEASUREMENT BOUNDARIES
          </span>
          <h3>Useful signals, careful claims.</h3>
          <ul>
            <li>
              <Check /> Looking away is a camera-relative observation, not
              dishonesty.
            </li>
            <li>
              <Check /> A second face creates a factual event timeline, not an
              accusation.
            </li>
            <li>
              <Check /> Missing coverage lowers reliability; it never becomes a
              zero by default.
            </li>
            <li>
              <Check /> AI-generated questions are coaching prompts, not hiring
              tests.
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}

export function BehavioralRoom() {
  const params = useParams<{ id: string }>();
  const id = params?.id || "";
  const [, navigate] = useLocation();
  const sessionQuery = trpc.behavioral.getSession.useQuery(
    { id },
    { enabled: Boolean(id) }
  );
  const saveAnswer = trpc.behavioral.saveAnswer.useMutation();
  const completeSession = trpc.behavioral.completeSession.useMutation();
  const transcribe = trpc.voice.transcribeStoredAudio.useMutation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const framesRef = useRef<BehavioralFrame[]>([]);
  const workerRef = useRef<Worker | null>(null);
  const recordStarted = useRef(0);
  const recordEnded = useRef(0);
  const stopRecordingRef = useRef<() => void>(() => {});
  const [index, setIndex] = useState(0);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processed, setProcessed] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [observationCount, setObservationCount] = useState(0);
  const [error, setError] = useState("");
  const [modelReady, setModelReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [microphoneReady, setMicrophoneReady] = useState(false);
  const [lastSummary, setLastSummary] = useState<BehavioralSummary | null>(
    null
  );
  const [retryBlob, setRetryBlob] = useState<Blob | null>(null);

  // Editable answer and speech-to-text states
  const [answerText, setAnswerText] = useState("");
  const answerTextRef = useRef("");
  const committedSpeechRef = useRef("");
  const isRecordingRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [micVolume, setMicVolume] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const questionMountedAt = useRef(Date.now());
  const current = sessionQuery.data?.questions?.[index];

  // Auto-focus on active question and reset per-question draft
  useEffect(() => {
    questionMountedAt.current = Date.now();
    setElapsed(0);
    setAnswerText("");
    answerTextRef.current = "";
    committedSpeechRef.current = "";
    framesRef.current = [];
    setObservationCount(0);
    setLastSummary(null);
    setProcessed(false);
    setRetryBlob(null);
    setError("");
    const timer = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 150);
    return () => window.clearTimeout(timer);
  }, [index]);

  // Track question timer
  useEffect(() => {
    if (processed) return;
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - questionMountedAt.current) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [processed]);

  useEffect(() => {
    let live = true;
    if (!cameraReady) {
      setModelReady(false);
      workerRef.current?.terminate();
      workerRef.current = null;
      return;
    }
    const worker = new Worker(
      new URL("./behavioral.worker.ts", import.meta.url)
    );
    workerRef.current = worker;
    worker.onmessage = event => {
      if (!live) return;
      if (event.data?.type === "ready") setModelReady(true);
      if (event.data?.type === "observation") {
        framesRef.current.push(event.data.frame as BehavioralFrame);
        setObservationCount(framesRef.current.length);
      }
      if (event.data?.type === "error") {
        setModelReady(false);
        setError(
          "Optional local camera analysis is unavailable. You can continue without it."
        );
      }
    };
    worker.postMessage({ type: "init" });
    return () => {
      live = false;
      worker.postMessage({ type: "dispose" });
      worker.terminate();
    };
  }, [cameraReady]);

  useEffect(() => {
    let live = true;
    let acquired: MediaStream | null = null;
    let preferredDevices: ReturnType<typeof parseBehavioralDeviceSelection> =
      null;
    const handleMicrophoneEnded = () => {
      setMicrophoneReady(false);
      setError(
        "Microphone access ended. Reconnect it before recording another answer, or type your answer in the box below."
      );
      if (mediaRecorder.current?.state === "recording") {
        recordEnded.current = Date.now();
        mediaRecorder.current.stop();
        mediaRecorder.current = null;
        setRecording(false);
      }
    };
    const handleCameraEnded = () => {
      setCameraReady(false);
      setError("Camera access ended; microphone-only practice can continue.");
      if (videoRef.current) videoRef.current.srcObject = null;
    };
    void (async () => {
      try {
        const stored =
          sessionStorage.getItem(behavioralDeviceSelectionStorageKey(id)) ||
          sessionStorage.getItem(
            behavioralDeviceSelectionStorageKey("__pending__")
          );
        preferredDevices = parseBehavioralDeviceSelection(stored);
      } catch {
        preferredDevices = null;
      }
      try {
        const microphone = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: preferredDevices?.microphoneDeviceId
            ? { deviceId: { exact: preferredDevices.microphoneDeviceId } }
            : true,
        });
        if (!live) return microphone.getTracks().forEach(track => track.stop());
        const audioTracks = microphone.getAudioTracks();
        let videoTracks: MediaStreamTrack[] = [];
        if (preferredDevices?.cameraDeviceId) {
          try {
            const camera = await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: {
                deviceId: { exact: preferredDevices.cameraDeviceId },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
            });
            videoTracks = camera.getVideoTracks();
          } catch {
            setError(
              "The selected camera is unavailable; continuing with microphone-only practice."
            );
          }
        }
        if (!live) {
          [...audioTracks, ...videoTracks].forEach(track => track.stop());
          return;
        }
        const stream = new MediaStream([...audioTracks, ...videoTracks]);
        acquired = stream;
        streamRef.current = stream;
        audioTracks.forEach(track =>
          track.addEventListener("ended", handleMicrophoneEnded)
        );
        videoTracks.forEach(track =>
          track.addEventListener("ended", handleCameraEnded)
        );
        setMicrophoneReady(
          audioTracks.some(track => track.readyState === "live")
        );
        setCameraReady(videoTracks.some(track => track.readyState === "live"));
        if (videoRef.current && videoTracks.length) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
          } catch {
            videoTracks.forEach(track => track.stop());
            setCameraReady(false);
            setError(
              "Camera preview could not start; continuing with microphone-only practice."
            );
          }
        } else if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      } catch {
        // Microphone not pre-connected; user can still type or connect on recording
        setMicrophoneReady(false);
      }
    })();
    return () => {
      live = false;
      acquired
        ?.getAudioTracks()
        .forEach(track =>
          track.removeEventListener("ended", handleMicrophoneEnded)
        );
      acquired
        ?.getVideoTracks()
        .forEach(track =>
          track.removeEventListener("ended", handleCameraEnded)
        );
      acquired?.getTracks().forEach(track => track.stop());
    };
  }, [id]);

  useEffect(() => {
    if (
      !recording ||
      !modelReady ||
      !cameraReady ||
      !videoRef.current ||
      !workerRef.current
    )
      return;
    const timer = window.setInterval(() => {
      const video = videoRef.current;
      const worker = workerRef.current;
      if (!video || !worker || video.readyState < 2) return;
      void createImageBitmap(video)
        .then(bitmap =>
          worker.postMessage(
            { type: "frame", bitmap, timestampMs: performance.now() },
            [bitmap]
          )
        )
        .catch(() => undefined);
    }, 250);
    return () => window.clearInterval(timer);
  }, [recording, modelReady, cameraReady]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      stopVisualizer();
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  function startVisualizer(stream: MediaStream) {
    try {
      const AudioCtx =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const actx = new AudioCtx();
      audioContextRef.current = actx;
      const src = actx.createMediaStreamSource(stream);
      const analyser = actx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyserRef.current = analyser;
      const dataArr = new Uint8Array(analyser.frequencyBinCount);
      const checkVolume = () => {
        if (!analyserRef.current || !isRecordingRef.current) return;
        analyser.getByteFrequencyData(dataArr);
        let sum = 0;
        for (let i = 0; i < dataArr.length; i++) sum += dataArr[i];
        const avg = sum / dataArr.length;
        setMicVolume(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(checkVolume);
      };
      animFrameRef.current = requestAnimationFrame(checkVolume);
    } catch (e) {
      console.warn("Audio visualizer error:", e);
    }
  }

  function stopVisualizer() {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = null;
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setMicVolume(0);
  }

  async function blobToBase64(blob: Blob) {
    const buffer = await blob.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const chunk = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunk)
      binary += String.fromCharCode(
        ...bytes.subarray(offset, Math.min(offset + chunk, bytes.length))
      );
    return btoa(binary);
  }

  async function transcribeCapturedAudio(blob: Blob) {
    if (blob.size > MAX_TRANSCRIPTION_AUDIO_BYTES) return;
    try {
      setProcessing(true);
      const transcription = await transcribe.mutateAsync({
        audioBase64: await blobToBase64(blob),
        mimeType: blob.type || "audio/webm",
        language: "en",
      });
      const text = transcription.text?.trim() || "";
      if (text && !isSilenceHallucination(text)) {
        setAnswerText(text);
        answerTextRef.current = text;
        committedSpeechRef.current = text;
      }
    } catch (e) {
      console.warn("Fallback audio transcription warning:", e);
    } finally {
      setProcessing(false);
    }
  }

  async function processRecording(blob: Blob) {
    if (!current || !sessionQuery.data) return;
    if (!blob.size) {
      setError("No audio was captured. Start a new recording or type your answer below.");
      return;
    }
    setProcessing(true);
    setError("");
    try {
      const transcription = await transcribe.mutateAsync({
        audioBase64: await blobToBase64(blob),
        mimeType: blob.type || "audio/webm",
        language: "en",
      });
      const transcript = transcription.text?.trim() || "";
      if (transcript && !isSilenceHallucination(transcript)) {
        setAnswerText(transcript);
        answerTextRef.current = transcript;
        committedSpeechRef.current = transcript;
      } else {
        setError(
          "We couldn't recognize clear speech in that recording. You can retry speaking or type your answer directly."
        );
      }
    } catch {
      setError("Transcription failed. You can type your answer manually in the box below.");
    } finally {
      setProcessing(false);
    }
  }

  async function startRecording() {
    if (processing) return;
    setError("");

    let stream = streamRef.current;
    if (
      !stream ||
      !stream.getAudioTracks().some(track => track.readyState === "live")
    ) {
      try {
        const preferredDevices = parseBehavioralDeviceSelection(
          sessionStorage.getItem(behavioralDeviceSelectionStorageKey(id)) ||
            sessionStorage.getItem(
              behavioralDeviceSelectionStorageKey("__pending__")
            )
        );
        const micStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: preferredDevices?.microphoneDeviceId
            ? { deviceId: { exact: preferredDevices.microphoneDeviceId } }
            : true,
        });
        const audioTracks = micStream.getAudioTracks();
        const videoTracks =
          stream?.getVideoTracks().filter(t => t.readyState === "live") || [];
        stream = new MediaStream([...audioTracks, ...videoTracks]);
        streamRef.current = stream;
        setMicrophoneReady(true);
      } catch (err: any) {
        setError(
          err?.name === "NotAllowedError" ||
            err?.name === "PermissionDeniedError"
            ? "Microphone access was denied. Please allow microphone access in your browser or type your answer in the box below."
            : "Could not access your microphone. You can type your answer manually in the box below."
        );
        setMicrophoneReady(false);
        return;
      }
    }

    const mimeType =
      ["audio/webm;codecs=opus", "audio/webm", "audio/ogg"].find(
        type =>
          typeof MediaRecorder !== "undefined" &&
          MediaRecorder.isTypeSupported(type)
      ) || "";

    try {
      const audioTracks = selectAudioTracksForTranscription(stream);
      if (!audioTracks.length) {
        setError(
          "Microphone audio is unavailable. Reconnect your microphone or type your answer below."
        );
        return;
      }

      isRecordingRef.current = true;
      committedSpeechRef.current = answerTextRef.current;
      recordStarted.current = Date.now();
      setRecording(true);

      startVisualizer(stream);

      // MediaRecorder in parallel for fallback audio transcription
      if (typeof MediaRecorder !== "undefined") {
        const audioStream = new MediaStream(audioTracks);
        const recorder = new MediaRecorder(audioStream, mimeType ? { mimeType } : undefined);
        const chunks: Blob[] = [];
        recorder.ondataavailable = event => {
          if (event.data.size) chunks.push(event.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(chunks, {
            type: recorder.mimeType || "audio/webm",
          });
          setRetryBlob(blob);
          if (!answerTextRef.current.trim() && blob.size > 200) {
            void transcribeCapturedAudio(blob);
          }
        };
        mediaRecorder.current = recorder;
        recorder.start(250);
      }

      // Live SpeechRecognition
      const Speech =
        (typeof window !== "undefined" &&
          ((window as any).SpeechRecognition ||
            (window as any).webkitSpeechRecognition)) ||
        null;
      if (Speech) {
        try {
          if (recognitionRef.current) {
            try {
              recognitionRef.current.abort();
            } catch {}
          }
          const recognition = new Speech();
          recognitionRef.current = recognition;
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = "en-US";
          recognition.onresult = (event: any) => {
            if (!isRecordingRef.current) return;
            let interim = "";
            let finalChunk = "";
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              const item = event.results[i];
              const txt = item[0]?.transcript || "";
              if (item.isFinal) finalChunk += `${txt} `;
              else interim += `${txt} `;
            }
            finalChunk = finalChunk.trim();
            interim = interim.trim();
            if (finalChunk) {
              const base = committedSpeechRef.current.trim();
              committedSpeechRef.current = base
                ? `${base} ${finalChunk}`
                : finalChunk;
            }
            const committed = committedSpeechRef.current.trim();
            const display = interim
              ? committed
                ? `${committed} ${interim}`
                : interim
              : committed;
            setAnswerText(display);
            answerTextRef.current = display;
          };
          recognition.onerror = (event: any) => {
            const err = event?.error;
            if (err === "no-speech" || err === "aborted") return;
            if (err === "not-allowed" || err === "service-not-allowed") {
              setError(
                "Microphone permission was denied. You can continue by typing your answer in the text box below."
              );
            } else if (err === "network") {
              console.warn(
                "SpeechRecognition network warning, parallel audio recording active"
              );
            }
          };
          recognition.onend = () => {
            if (isRecordingRef.current) {
              try {
                recognition.start();
              } catch {}
            }
          };
          recognition.start();
        } catch (speechErr) {
          console.warn("SpeechRecognition start error:", speechErr);
        }
      }
    } catch {
      setError(
        "Could not start audio recording. You can type your answer manually in the box below."
      );
      setRecording(false);
      isRecordingRef.current = false;
      stopVisualizer();
    }
  }

  function stopRecording() {
    isRecordingRef.current = false;
    recordEnded.current = Date.now();
    stopVisualizer();

    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    if (mediaRecorder.current && mediaRecorder.current.state === "recording") {
      mediaRecorder.current.stop();
      mediaRecorder.current = null;
    }
    setRecording(false);
  }
  stopRecordingRef.current = stopRecording;

  async function submitAnswer() {
    if (!current || !sessionQuery.data || processing) return;
    const text = answerText.trim();
    if (!text) {
      setError(
        "Please speak into your microphone or type your answer before submitting."
      );
      return;
    }

    if (recording) {
      stopRecording();
    }

    setProcessing(true);
    setError("");

    const endedAt = new Date(recordEnded.current || Date.now());
    const startedAt = new Date(
      recordStarted.current ||
        Date.now() - Math.max(1, elapsed) * 1000
    );
    const durationSeconds = Math.max(
      1,
      recordEnded.current && recordStarted.current
        ? Math.round((recordEnded.current - recordStarted.current) / 1000)
        : elapsed || 1
    );

    try {
      const speech = {
        durationSeconds,
        transcriptAvailable: true,
        transcriptConfidence: 0.88,
      };
      const completedSummary = aggregateBehavioralObservations(
        framesRef.current,
        speech
      );
      setLastSummary(completedSummary);

      await saveAnswer.mutateAsync({
        sessionId: id,
        questionId: current.id,
        transcript: text,
        transcriptLanguage: "en",
        transcriptConfidence: speech.transcriptConfidence,
        durationSeconds,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        observationSummary: completedSummary as unknown as Record<
          string,
          unknown
        >,
        observations: framesRef.current.slice(-600).map(frame => ({
          observedAtMs: frame.timestampMs,
          observationType: "frame",
          payload: frame as unknown as Record<string, unknown>,
          valid: frame.trackingReliable,
          reliability: frame.trackingReliable ? 85 : 0,
        })),
      });

      setRetryBlob(null);
      setProcessed(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "We couldn't save this answer. Please retry submitting."
      );
    } finally {
      setProcessing(false);
    }
  }

  function retry() {
    setAnswerText("");
    answerTextRef.current = "";
    committedSpeechRef.current = "";
    framesRef.current = [];
    setObservationCount(0);
    setLastSummary(null);
    setProcessed(false);
    setRetryBlob(null);
    setError("");
    setElapsed(0);
    questionMountedAt.current = Date.now();
    textareaRef.current?.focus();
  }

  async function next() {
    if (!processed || processing) return;
    if (index + 1 < (sessionQuery.data?.questions.length || 0)) {
      setIndex(value => value + 1);
      return;
    }
    setProcessing(true);
    try {
      await completeSession.mutateAsync({ id });
      try {
        sessionStorage.removeItem(behavioralDeviceSelectionStorageKey(id));
        sessionStorage.removeItem(
          behavioralDeviceSelectionStorageKey("__pending__")
        );
      } catch {}
      navigate(`/behavioral-report/${id}`);
    } catch (cause) {
      try {
        const refreshed = await sessionQuery.refetch();
        if (refreshed.data?.session?.status === "completed") {
          navigate(`/behavioral-report/${id}`);
          return;
        }
      } catch {}
      setError(
        cause instanceof Error
          ? cause.message
          : "The behavioral report could not be completed. Retry without losing saved answers."
      );
    } finally {
      setProcessing(false);
    }
  }

  if (sessionQuery.isLoading)
    return <LoadingState text="Preparing your behavioral interview room…" />;
  if (sessionQuery.isError || !sessionQuery.data || !current)
    return (
      <EmptyState
        title="Behavioral session unavailable"
        description="This session may have expired or may not belong to your account."
        action="Choose questions again"
        href="/behavioral-interview"
      />
    );
  return (
    <div className="page-stack behavioral-page behavioral-room-page">
      <PageHeading
        eyebrow="BEHAVIORAL PRACTICE"
        title="Speak naturally. Review the evidence."
        description="Answer using your microphone or the text box. Camera observations are approximate, local and shown with coverage and reliability limits."
        action={
          <Link
            className="button button-secondary"
            href="/behavioral-interview"
          >
            <ArrowLeft size={14} /> Exit session
          </Link>
        }
      />
      <div className="behavioral-room-grid">
        <Panel
          className="behavioral-live-panel"
          title="Optional camera and microphone status"
          subtitle={`Question ${index + 1} of ${sessionQuery.data.questions.length}`}
        >
          <div className="behavioral-live-preview">
            <video
              ref={videoRef}
              className="behavioral-video"
              muted
              playsInline
              aria-label="Live camera preview"
            />
            {!cameraReady && (
              <span className="behavioral-preview-empty">
                Camera off; microphone-only practice
              </span>
            )}
            <span
              className={`behavioral-recording-badge ${recording ? "active" : ""}`}
            >
              {recording
                ? "Recording"
                : microphoneReady
                  ? "Ready"
                  : "Microphone unavailable"}
            </span>
          </div>
          <div className="behavioral-live-status">
            <span>
              <Mic size={14} />{" "}
              {microphoneReady
                ? "Microphone connected"
                : "Microphone unavailable"}
            </span>
            <span>
              <Video size={14} />{" "}
              {cameraReady ? "Optional camera on" : "Camera off"}
            </span>
            <span>
              <ScanFace size={14} />{" "}
              {cameraReady
                ? modelReady
                  ? "Models running locally"
                  : "Camera models loading"
                : "Camera analysis skipped"}
            </span>
            <span>
              <Eye size={14} /> {observationCount} observations
            </span>
          </div>
          <div className="behavioral-signal-strip">
            <span>
              <UsersRound size={14} /> Additional faces are factual events
            </span>
            <span>
              <ShieldCheck size={14} /> Camera video stays local; permission is
              optional
            </span>
          </div>
        </Panel>
        <Panel
          className="behavioral-question-panel"
          title="Your spoken or written answer"
          subtitle={`${current.topic || "General"} · ${current.difficulty}`}
        >
          <div className="behavioral-question-card">
            <span className="eyebrow">
              QUESTION {index + 1} OF {sessionQuery.data.questions.length}
            </span>
            <h2>{current.question_text}</h2>
            <p>
              {current.rationale ||
                "Answer using a clear example, your reasoning and the result. The saved interview rubric remains the expectation context."}
            </p>
          </div>
          <div className="behavioral-timer">
            <Clock3 size={17} /> {formatDuration(elapsed)}{" "}
            <span>
              {recording
                ? "Recording in progress"
                : processed
                  ? "Answer evaluated & saved"
                  : "Speak or type your answer"}
            </span>
          </div>

          {recording && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 12px",
                marginBottom: "12px",
                borderRadius: "8px",
                background: "rgba(239, 68, 68, 0.08)",
                border: "1px solid rgba(239, 68, 68, 0.25)",
              }}
            >
              <div
                style={{
                  width: "9px",
                  height: "9px",
                  borderRadius: "50%",
                  backgroundColor: "#ef4444",
                }}
              />
              <span
                style={{
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  color: "#f87171",
                }}
              >
                Listening to microphone…
              </span>
              <div
                style={{
                  flex: 1,
                  height: "6px",
                  background: "rgba(255, 255, 255, 0.1)",
                  borderRadius: "3px",
                  overflow: "hidden",
                  marginLeft: "8px",
                }}
              >
                <div
                  style={{
                    width: `${micVolume}%`,
                    height: "100%",
                    backgroundColor: micVolume > 10 ? "#22c55e" : "#ef4444",
                    transition: "width 0.1s ease",
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: "0.78rem",
                  color: micVolume > 10 ? "#22c55e" : "#94a3b8",
                  minWidth: "135px",
                  textAlign: "right",
                }}
              >
                {micVolume > 10
                  ? `Voice detected (${micVolume}%)`
                  : "Waiting for speech…"}
              </span>
            </div>
          )}

          <div style={{ marginBottom: "12px" }}>
            <textarea
              ref={textareaRef}
              className="input"
              style={{
                width: "100%",
                minHeight: "130px",
                resize: "vertical",
                fontFamily: "inherit",
                fontSize: "0.95rem",
                lineHeight: "1.5",
                padding: "12px",
                borderRadius: "6px",
                boxSizing: "border-box",
              }}
              value={answerText}
              onChange={e => {
                const text = e.target.value;
                setError("");
                setAnswerText(text);
                answerTextRef.current = text;
                committedSpeechRef.current = text;
              }}
              placeholder="Type your answer here or click 'Start recording' to speak..."
              disabled={processing}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "6px",
                fontSize: "0.78rem",
                color: "var(--muted)",
              }}
            >
              <span>
                {(() => {
                  const words = answerText.trim()
                    ? answerText.trim().split(/\s+/).length
                    : 0;
                  return `${words} words · ${answerText.trim().length} characters`;
                })()}
              </span>
              <span>
                {recording
                  ? "Streaming live speech to text…"
                  : "Editable at any time"}
              </span>
            </div>
          </div>

          {error && (
            <div className="notice notice-error" role="alert">
              {error}
            </div>
          )}
          {lastSummary && !processing && (
            <div className="behavioral-processing-note">
              <Check size={15} />{" "}
              {cameraReady
                ? `Captured ${observationCount} local observations. Coverage ${lastSummary.coverage}% · Reliability ${lastSummary.reliability}%.`
                : "Answer saved successfully. Camera was off, so no visual observations were recorded."}
            </div>
          )}
          {processing && (
            <div className="behavioral-processing-note">
              <span className="spinner" /> Processing answer and observations…
            </div>
          )}
          <div className="behavioral-control-row">
            {!recording && (
              <button
                className="button button-primary"
                type="button"
                onClick={() => void startRecording()}
                disabled={processing}
              >
                <Mic size={15} />{" "}
                {answerText.trim() ? "Resume recording" : "Start recording"}
              </button>
            )}
            {recording && (
              <button
                className="button button-danger"
                type="button"
                onClick={stopRecording}
              >
                <Pause size={15} /> Stop recording
              </button>
            )}
            {retryBlob && !recording && !processed && !processing && (
              <button
                className="button button-secondary"
                type="button"
                onClick={() => void processRecording(retryBlob)}
              >
                <RotateCcw size={15} /> Retry transcription
              </button>
            )}
            <button
              className="button button-primary"
              type="button"
              onClick={() => void submitAnswer()}
              disabled={!answerText.trim() || processing}
            >
              <Send size={15} /> Submit answer
            </button>
            {processed && (
              <>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={retry}
                  disabled={processing}
                >
                  <RotateCcw size={15} /> Re-answer question
                </button>
                <button
                  className="button button-primary"
                  type="button"
                  onClick={() => void next()}
                  disabled={processing}
                >
                  {index + 1 === sessionQuery.data.questions.length
                    ? "Create behavioral report"
                    : "Next question"}{" "}
                  <ArrowRight size={15} />
                </button>
              </>
            )}
          </div>
          <div
            className="behavioral-input-note"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: "var(--muted)",
              fontSize: "0.76rem",
              marginTop: "12px",
            }}
          >
            <Check size={14} style={{ color: "var(--cyan)" }} />
            Voice & text input enabled · speak with microphone, edit transcribed
            text, or type manually before submitting.
          </div>
        </Panel>
      </div>
    </div>
  );
}

export function BehavioralReport() {
  const params = useParams<{ id: string }>();
  const id = params?.id || "";
  const report = trpc.behavioral.getReport.useQuery(
    { id },
    { enabled: Boolean(id) }
  );
  if (report.isLoading)
    return <LoadingState text="Preparing your behavioral report…" />;
  if (report.isError || !report.data)
    return (
      <EmptyState
        title="Behavioral report unavailable"
        description="The session may still be processing or may not belong to your account."
        action="Back to behavioral practice"
        href="/behavioral-interview"
      />
    );
  const { session, questions, answers, events } = report.data as any;
  const summary = session.summary || {};
  const categories = Array.isArray(summary.categories)
    ? summary.categories
    : [];
  const answersByQuestion = new Map(
    (answers || []).map((answer: any) => [
      answer.behavioral_question_id,
      answer,
    ])
  );
  return (
    <div className="page-stack behavioral-page behavioral-report-page">
      <PageHeading
        eyebrow="BEHAVIORAL REPORT"
        title="Observable practice evidence"
        description="This report describes recorded camera-relative and speech observations. It is not a confidence, personality, honesty, employability or hiring prediction."
        action={
          <Link
            className="button button-secondary"
            href="/behavioral-interview"
          >
            <ArrowLeft size={14} /> New behavioral session
          </Link>
        }
      />
      <section className="behavioral-report-hero">
        <div>
          <span className="eyebrow">
            <ScanFace size={13} /> BEHAVIORAL COACHING SCORE
          </span>
          <h2>
            {summary.behavioralScore == null
              ? "Insufficient data"
              : `${summary.behavioralScore}%`}
          </h2>
          <p>
            {summary.behavioralScore == null
              ? "Insufficient data for a reliable behavioral score. At least 8 reliable face samples spanning 3.5 seconds are required for camera-based measures; unavailable categories are not scored as zero."
              : "An approximate practice metric from valid observable signals, with unavailable categories excluded from the weighted denominator."}
          </p>
        </div>
        <div className="behavioral-report-hero-metrics">
          <span>
            <b>{summary.coverage ?? session.coverage ?? 0}%</b> measurement
            coverage
          </span>
          <span>
            <b>{summary.reliability ?? session.reliability ?? 0}%</b>{" "}
            measurement reliability
          </span>
          <span>
            <b>
              {summary.answeredCount ?? answers.length}/
              {summary.questionCount ?? questions.length}
            </b>{" "}
            answers processed
          </span>
          <span>
            <b>
              {summary.sampleAdequacy?.answersMeetingMinimum ?? 0}/
              {summary.sampleAdequacy?.processedAnswers ?? answers.length}
            </b>{" "}
            answers met the camera sample threshold
          </span>
        </div>
      </section>
      <div className="behavioral-report-grid">
        <Panel
          title="Category measurements"
          subtitle="Each category keeps its own availability and reliability context."
        >
          <div className="behavioral-category-list">
            {categories.length === 0 ? (
              <p className="muted-copy">
                No category reached its minimum evidence threshold. Your answers
                remain available, but no behavioral score is assigned.
              </p>
            ) : (
              categories.map((category: any) => (
                <article className="behavioral-category" key={category.key}>
                  <div>
                    <b>{category.label || category.key}</b>
                    <small>
                      {category.explanation || "Observable practice signal"}
                    </small>
                  </div>
                  <strong>
                    {category.available === false || category.score == null
                      ? "Unavailable"
                      : `${Math.round(category.score)}%`}
                  </strong>
                  <span>
                    {Math.round(category.coverage || 0)}% coverage ·{" "}
                    {Math.round(category.reliability || 0)}% reliability
                  </span>
                </article>
              ))
            )}
          </div>
        </Panel>
        <Panel
          title="Separate score components"
          subtitle="The original interview score is never overwritten."
        >
          <div className="behavioral-score-components">
            <div>
              <span>Answer quality</span>
              <b>
                {summary.answerQuality == null
                  ? "Unavailable"
                  : `${summary.answerQuality}%`}
              </b>
            </div>
            <div>
              <span>Behavioral Coaching Score</span>
              <b>
                {summary.behavioralScore == null
                  ? "Unavailable"
                  : `${summary.behavioralScore}%`}
              </b>
            </div>
            <div className="combined">
              <span>Combined practice metric</span>
              <b>
                {summary.combinedScore == null
                  ? "Unavailable"
                  : `${summary.combinedScore}%`}
              </b>
              <small>
                80% answer quality + 20% behavioral coaching, only when both
                components are valid.
              </small>
            </div>
          </div>
        </Panel>
      </div>
      <Panel
        title="Observed events and limitations"
        subtitle="Events are factual camera observations, not accusations or identity claims."
      >
        {events.length ? (
          <div className="behavioral-event-list">
            {events.map((event: any, index: number) => (
              <div key={`${event.timestampMs}-${index}`}>
                <UsersRound size={15} />
                <span>
                  <b>
                    {event.type === "additional_visible_face"
                      ? "Additional visible face"
                      : event.type}
                  </b>
                  <small>
                    {event.detail} ·{" "}
                    {formatDuration(Math.round(event.timestampMs / 1000))}
                  </small>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted-copy">No additional-face events were recorded.</p>
        )}
        <div className="notice notice-warning">
          Model signals are approximate and depend on lighting, framing, camera
          quality, occlusion and supported browser performance. Missing
          observations remain unavailable rather than being treated as poor
          behavior.
        </div>
      </Panel>
      <Panel
        title="Per-question processing"
        subtitle="Every answer stays linked to the generated practice question used in this session."
      >
        <div className="behavioral-answer-report-list">
          {questions.map((question: any, index: number) => {
            const answer = answersByQuestion.get(question.id) as any;
            const answerSummary = answer?.observation_summary || {};
            return (
              <article key={question.id}>
                <span className="behavioral-question-index">{index + 1}</span>
                <div>
                  <b>{question.question_text}</b>
                  <small>
                    {answer
                      ? `${answer.duration_seconds ? Math.round(answer.duration_seconds) : 0}s spoken · ${answer.behavioral_score == null ? "insufficient behavioral data" : `${Math.round(answer.behavioral_score)}% behavioral coaching`} · ${Math.round(answer.coverage || 0)}% coverage`
                      : "Not answered"}
                  </small>
                  {answer?.transcript && <p>{answer.transcript}</p>}
                  {Array.isArray(answerSummary.events) &&
                    answerSummary.events.length > 0 && (
                      <Tag tone="amber">
                        {answerSummary.events.length} camera event
                        {answerSummary.events.length === 1 ? "" : "s"}
                      </Tag>
                    )}
                </div>
              </article>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
