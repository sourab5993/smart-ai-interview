import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CameraOff,
  Clock3,
  Keyboard,
  Mic,
  Orbit,
  Send,
  ShieldCheck,
  Square,
  Volume2,
} from "lucide-react";
import { PageHeading, Panel, Tag } from "@/components/app/Shared";
import { LoadingState } from "@/components/app/Shared";
import { safeStorage } from "@/lib/safeStorage";
import { trpc } from "@/lib/trpc";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getLiveAudioRetryAction } from "./audio-retry";
import { MAX_TRANSCRIPTION_AUDIO_BYTES } from "@shared/const";

type Turn = {
  id: string;
  turn_index: number;
  question_text: string;
  question_type: string;
  difficulty: string;
  competencies: string[];
  parent_turn_id: string | null;
  transcript: string | null;
  transcript_status: string;
  evaluation: any;
  evaluation_status: string;
};
type FramingSummary = {
  version: "local-framing-v1";
  sample_count: number;
  face_present: number;
  shoulders_present: number;
  hands_present: number;
};
type Session = {
  id: string;
  owner_id?: string;
  target_role: string;
  duration_minutes: number;
  speech_language: string;
  status: string;
  started_at: string;
  deadline_at: string;
  completed_at: string | null;
  camera_summary?: FramingSummary | null;
  report: any;
};
type Phase =
  | "READY"
  | "ASKING"
  | "LISTENING"
  | "PROCESSING_ANSWER"
  | "EVALUATING"
  | "ASKING_FOLLOWUP_OR_NEXT_QUESTION"
  | "FINALIZING"
  | "COMPLETED"
  | "RECOVERABLE_ERROR";
const durations = [5, 10, 15, 20, 30, 45, 60] as const;
const inferredSpeechLocale = () =>
  typeof navigator !== "undefined" &&
  navigator.language.toLowerCase().startsWith("hi")
    ? "hi-IN"
    : "en-US";
const questionLanguage = (locale: string): "English" | "Hindi" =>
  locale.toLowerCase().startsWith("hi") ? "Hindi" : "English";
const timeLabel = (seconds: number) =>
  `${String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, "0")}:${String(Math.max(0, seconds) % 60).padStart(2, "0")}`;
function browserSpeech() {
  return (
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  );
}
function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}

export function LiveInterviewSetup() {
  const [, navigate] = useLocation();
  const [role, setRole] = useState("");
  const [duration, setDuration] = useState<(typeof durations)[number]>(20);
  const [preferredMode, setPreferredMode] = useState<"type" | "speak">(() => {
    return (safeStorage.getItem("live_interview_mode") as "type" | "speak") || "type";
  });
  const [error, setError] = useState("");
  const [recoveryId, setRecoveryId] = useState("");
  const active = trpc.liveInterview.active.useQuery();
  const recent = trpc.liveInterview.recent.useQuery();
  const create = trpc.liveInterview.create.useMutation();
  const saveQuestion = trpc.liveInterview.saveQuestion.useMutation();
  const generate = trpc.ai.generateQuestions.useMutation();
  async function start() {
    const target = role.trim();
    if (!target) {
      setError("Enter the target role to begin.");
      return;
    }
    setError("");
    setRecoveryId("");
    try {
      const generated = await generate.mutateAsync({
        course: "General interview preparation",
        role: target,
        type: "Live Interview opening question",
        difficulty: "Medium",
        skills: [],
        count: 1,
        language: questionLanguage(inferredSpeechLocale()),
        context:
          "Create a concise, natural opening question that lets the candidate introduce role-relevant experience. This is the first turn; do not assume a resume or background.",
      });
      const first = generated.questions?.[0];
      if (!first?.question?.trim())
        throw new Error("No usable interviewer question was returned.");
      const session = await create.mutateAsync({
        role: target,
        durationMinutes: duration,
        speechLanguage: inferredSpeechLocale(),
      });
      setRecoveryId(session.id);
      await saveQuestion.mutateAsync({
        sessionId: session.id,
        turnIndex: 0,
        question: first.question,
        type: "opening",
        difficulty: first.difficulty || "Medium",
        competencies: [first.topic || target],
        idempotencyKey: `${session.id}:turn:0`,
      });
      navigate(`/live-interview/${session.id}`);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "We could not start the interview. Check your connection and try again."
      );
    }
  }
  const busy =
    create.isPending ||
    generate.isPending ||
    saveQuestion.isPending ||
    active.isLoading;
  return (
    <div className="page-stack live-interview-page">
      <PageHeading
        eyebrow="SPOKEN PRACTICE"
        title="Live Interview"
        description="A separate, spoken interview with role-aware questions, actual speech recognition, adaptive follow-ups and a saved report."
        action={
          <Link className="button button-secondary" href="/practice">
            <ArrowLeft size={14} /> Back to practice
          </Link>
        }
      />
      {active.data && (
        <Panel
          title="Resume your saved interview"
          subtitle="An unfinished or recoverable session is attached to your account."
        >
          <p>
            {active.data.target_role} · {active.data.duration_minutes} minutes ·{" "}
            {active.data.status}
          </p>
          <Link
            className="button button-secondary"
            href={`/live-interview/${active.data.id}`}
          >
            Resume session <ArrowRight size={14} />
          </Link>
        </Panel>
      )}
      {recent.data?.length ? (
        <Panel
          title="Recent Live Interviews"
          subtitle="Saved sessions and reports for your account."
        >
          <div className="live-history-list">
            {recent.data.map(item => (
              <div className="live-history-row" key={item.id}>
                <span>
                  <b>{item.target_role}</b>
                  <small>
                    {new Date(item.started_at).toLocaleString()} ·{" "}
                    {item.duration_minutes} min
                  </small>
                </span>
                <Tag tone={item.status === "completed" ? "green" : "violet"}>
                  {item.status}
                </Tag>
                <Link
                  className="button button-secondary"
                  href={
                    item.status === "completed"
                      ? `/live-report/${item.id}`
                      : `/live-interview/${item.id}`
                  }
                >
                  {item.status === "completed" ? "Open report" : "Resume"}{" "}
                  <ArrowRight size={13} />
                </Link>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}
      <Panel
        title="Set up your interview"
        subtitle="Only two inputs are required. Camera is not requested for this audio-based session."
      >
        <div className="live-setup-grid">
          <label>
            Target role
            <input
              className="field"
              maxLength={160}
              value={role}
              onChange={e => setRole(e.target.value)}
              placeholder="e.g. Data Analyst, SOC Analyst, Product Manager"
            />
          </label>
          <label>
            Duration
            <select
              className="field"
              value={duration}
              onChange={e =>
                setDuration(
                  Number(e.target.value) as (typeof durations)[number]
                )
              }
            >
              {durations.map(x => (
                <option key={x} value={x}>
                  {x} minutes
                </option>
              ))}
            </select>
          </label>
          <label>
            Response mode
            <select
              className="field"
              value={preferredMode}
              onChange={e => {
                const m = e.target.value as "type" | "speak";
                setPreferredMode(m);
                safeStorage.setItem("live_interview_mode", m);
              }}
            >
              <option value="type">Type answers (Keyboard)</option>
              <option value="speak">Speak answers (Microphone)</option>
            </select>
          </label>
        </div>
        <div className="live-privacy-note">
          <ShieldCheck size={18} />
          <p>
            Questions are spoken aloud. Microphone permission is requested only
            when you start speaking. Recognized answer text is saved to your
            account. Browser speech recognition may process audio according to
            your browser provider. If browser recognition is unavailable, a
            completed answer recording is sent to the configured transcription
            service after you stop and is not saved by this app. If
            transcription fails, the captured recording stays on this device for
            retry. Accuracy varies by language and environment. You can stop or
            end the session at any time.
          </p>
        </div>
        {error && (
          <div className="notice notice-error" role="alert">
            {error}
            {recoveryId && (
              <p>
                <Link href={`/live-interview/${recoveryId}`}>
                  Open the saved session to recover <ArrowRight size={13} />
                </Link>
              </p>
            )}
          </div>
        )}
        <button
          className="button button-primary"
          onClick={() => void start()}
          disabled={busy || Boolean(active.data) || !role.trim()}
        >
          {busy ? (
            <>
              <span className="spinner" />
              Preparing session…
            </>
          ) : (
            <>
              Start Live Interview <ArrowRight size={15} />
            </>
          )}
        </button>
      </Panel>
    </div>
  );
}

export function LiveInterviewRoom() {
  const params = useParams<{ id: string }>();
  const id = params?.id || "";
  const [, navigate] = useLocation();
  const [session, setSession] = useState<Session | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [phase, setPhase] = useState<Phase>("READY");
  const [remaining, setRemaining] = useState(0);
  const [partial, setPartial] = useState("");
  const [capturedAudio, setCapturedAudio] = useState<Blob | null>(null);
  const [transcriptDraft, setTranscriptDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [answerMode, setAnswerMode] = useState<"speak" | "type">(() => {
    return (safeStorage.getItem("live_interview_mode") as "speak" | "type") || "type";
  });
  const [questionAudioPending, setQuestionAudioPending] = useState(false);
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);
  const [cameraOptIn, setCameraOptIn] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<
    "off" | "loading" | "ready" | "unsupported" | "error"
  >("off");
  const [cameraError, setCameraError] = useState("");
  const [cameraCounts, setCameraCounts] = useState<FramingSummary>({
    version: "local-framing-v1",
    sample_count: 0,
    face_present: 0,
    shoulders_present: 0,
    hands_present: 0,
  });
  const query = trpc.liveInterview.get.useQuery(
    { id },
    { enabled: !!id, retry: 1 }
  );
  const saveTranscript = trpc.liveInterview.saveTranscript.useMutation();
  const evaluate = trpc.liveInterview.evaluateTurn.useMutation();
  const saveQuestion = trpc.liveInterview.saveQuestion.useMutation();
  const finalize = trpc.liveInterview.finalize.useMutation();
  const saveCameraSummary = trpc.liveInterview.saveCameraSummary.useMutation();
  const generate = trpc.ai.generateQuestions.useMutation();
  const transcribe = trpc.voice.transcribeStoredAudio.useMutation();
  const recognition = useRef<any>(null);
  const finalText = useRef("");
  const baseTranscript = useRef("");
  const latestRecognizedText = useRef("");
  const stopping = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const [micVolume, setMicVolume] = useState(0);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const framingWorkerRef = useRef<Worker | null>(null);
  const framingIntervalRef = useRef<number | null>(null);
  const framingBusyRef = useRef(false);
  const cameraStatusRef = useRef(cameraStatus);
  const cameraOptInRef = useRef(cameraOptIn);
  const cameraRunRef = useRef(0);
  const cameraCountsRef = useRef(cameraCounts);
  const cameraBaseRef = useRef<FramingSummary>(cameraCounts);
  const lastCameraSaveRef = useRef(0);
  cameraStatusRef.current = cameraStatus;
  cameraOptInRef.current = cameraOptIn;
  cameraCountsRef.current = cameraCounts;
  const answerTimeout = useRef<number | null>(null);
  const submittedRef = useRef(false);
  const listeningStartedAt = useRef(0);
  const stopListeningRef = useRef<() => void>(() => {});
  const transcribingAudioRef = useRef(false);
  const abortCapture = useRef(false);
  const expiryRef = useRef(false);
  const speechGenerationRef = useRef(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const followTranscriptRef = useRef(true);
  useEffect(() => {
    if (query.data) {
      const loaded = query.data.session as Session;
      setSession(loaded);
      setTurns(query.data.turns as Turn[]);
      if (loaded.camera_summary) {
        setCameraCounts(loaded.camera_summary);
        cameraCountsRef.current = loaded.camera_summary;
        cameraBaseRef.current = loaded.camera_summary;
        lastCameraSaveRef.current = loaded.camera_summary.sample_count;
      }
      if (query.data.session.status === "completed") setPhase("COMPLETED");
      else if (query.data.session.status === "failed")
        setPhase("RECOVERABLE_ERROR");
    }
  }, [query.data]);
  useEffect(() => {
    if (!session) return;
    const tick = () =>
      setRemaining(
        Math.max(
          0,
          Math.ceil((Date.parse(session.deadline_at) - Date.now()) / 1000)
        )
      );
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [session]);
  useEffect(() => {
    const transcript = transcriptRef.current;
    if (transcript && followTranscriptRef.current)
      transcript.scrollTop = transcript.scrollHeight;
  }, [turns, partial, transcriptDraft, phase]);
  const stopTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setMicVolume(0);
  };
  const persistCameraSummary = useCallback(
    async (summary = cameraCountsRef.current) => {
      if (!summary.sample_count) return;
      try {
        await saveCameraSummary.mutateAsync({ sessionId: id, summary });
      } catch {
        setCameraError(
          "The optional framing summary was not saved. Your answers and interview report are unaffected."
        );
      }
    },
    [id, saveCameraSummary]
  );
  const stopCamera = useCallback((updateState = true) => {
    cameraRunRef.current += 1;
    if (framingIntervalRef.current !== null) {
      window.clearInterval(framingIntervalRef.current);
      framingIntervalRef.current = null;
    }
    framingWorkerRef.current?.postMessage({ type: "dispose" });
    framingWorkerRef.current?.terminate();
    framingWorkerRef.current = null;
    framingBusyRef.current = false;
    cameraStreamRef.current?.getTracks().forEach(track => track.stop());
    cameraStreamRef.current = null;
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
    cameraStatusRef.current = "off";
    if (updateState) setCameraStatus("off");
  }, []);
  async function enableCamera() {
    const runId = ++cameraRunRef.current;
    setCameraError("");
    if (
      typeof window !== "undefined" &&
      !window.isSecureContext &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
    ) {
      cameraStatusRef.current = "unsupported";
      setCameraStatus("unsupported");
      setCameraError(
        "Camera access requires a secure connection (HTTPS). Please open this site using HTTPS."
      );
      return;
    }
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof Worker === "undefined" ||
      typeof createImageBitmap === "undefined"
    ) {
      cameraStatusRef.current = "unsupported";
      setCameraStatus("unsupported");
      setCameraError(
        "This browser or device does not support local camera analysis."
      );
      return;
    }
    setCameraStatus("loading");
    cameraStatusRef.current = "loading";
    cameraBaseRef.current = cameraCountsRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
      if (runId !== cameraRunRef.current || !cameraOptInRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      cameraStreamRef.current = stream;
      const video = cameraVideoRef.current;
      if (!video) throw new Error("Camera preview is unavailable.");
      video.srcObject = stream;
      await video.play();

      const worker = new Worker(
        new URL("./framing.worker.ts", import.meta.url),
        { type: "module" }
      );
      framingWorkerRef.current = worker;
      worker.onmessage = event => {
        const data = event.data as {
          type?: string;
          counts?: {
            samples?: number;
            facePresent?: number;
            shouldersPresent?: number;
            handsPresent?: number;
          };
        };
        framingBusyRef.current = false;
        if (data?.type === "ready") {
          cameraStatusRef.current = "ready";
          setCameraStatus("ready");
          return;
        }
        if (data?.type === "counts" && data.counts) {
          const local = data.counts;
          const base = cameraBaseRef.current;
          const next: FramingSummary = {
            version: "local-framing-v1",
            sample_count: Math.min(
              10000,
              base.sample_count + (local.samples || 0)
            ),
            face_present: Math.min(
              10000,
              base.face_present + (local.facePresent || 0)
            ),
            shoulders_present: Math.min(
              10000,
              base.shoulders_present + (local.shouldersPresent || 0)
            ),
            hands_present: Math.min(
              10000,
              base.hands_present + (local.handsPresent || 0)
            ),
          };
          cameraCountsRef.current = next;
          setCameraCounts(next);
          if (next.sample_count - lastCameraSaveRef.current >= 20) {
            lastCameraSaveRef.current = next.sample_count;
            void persistCameraSummary(next);
          }
          return;
        }
        if (data?.type === "error") {
          stopCamera();
          cameraStatusRef.current = "error";
          setCameraStatus("error");
          setCameraError(
            "Local framing models could not run on this device. The interview can continue without camera analysis."
          );
        }
      };
      worker.onerror = () => {
        stopCamera();
        cameraStatusRef.current = "error";
        setCameraStatus("error");
        setCameraError(
          "Local framing analysis stopped unexpectedly; your interview is unaffected."
        );
      };
      worker.postMessage({ type: "init" });

      framingIntervalRef.current = window.setInterval(() => {
        if (
          cameraStatusRef.current !== "ready" ||
          document.hidden ||
          framingBusyRef.current ||
          !video.videoWidth ||
          video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
        )
          return;
        const currentWorker = framingWorkerRef.current;
        if (!currentWorker) return;
        framingBusyRef.current = true;
        void createImageBitmap(video, { resizeWidth: 320, resizeHeight: 240 })
          .then(bitmap => {
            if (framingWorkerRef.current !== currentWorker) {
              bitmap.close();
              framingBusyRef.current = false;
              return;
            }
            currentWorker.postMessage(
              { type: "frame", bitmap, timestampMs: performance.now() },
              [bitmap]
            );
          })
          .catch(() => {
            framingBusyRef.current = false;
          });
      }, 650);
    } catch {
      stopCamera(false);
      cameraStatusRef.current = "error";
      setCameraStatus("error");
      setCameraError(
        "Camera permission or local model setup was unavailable. Your answers and interview remain available."
      );
    }
  }
  async function disableCamera() {
    const summary = cameraCountsRef.current;
    stopCamera();
    await persistCameraSummary(summary);
  }
  const speak = useCallback((text: string, language = "en-US") => {
    if (!("speechSynthesis" in window)) {
      setQuestionAudioPending(false);
      setPhase("READY");
      setError(
        "Question audio playback is unavailable in this browser. Read the question on screen and continue."
      );
      return;
    }
    const generation = ++speechGenerationRef.current;
    window.speechSynthesis.cancel();
    setPhase("READY");
    setQuestionAudioPending(true);
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = language;
    utter.onstart = () => {
      if (generation !== speechGenerationRef.current) return;
      setQuestionAudioPending(false);
      setPhase("ASKING");
    };
    utter.onend = () => {
      if (generation !== speechGenerationRef.current) return;
      setQuestionAudioPending(false);
      setPhase("READY");
    };
    utter.onerror = () => {
      if (generation !== speechGenerationRef.current) return;
      setQuestionAudioPending(false);
      setPhase("READY");
      setError(
        "Question audio playback failed. Read the question on screen and continue."
      );
    };
    try {
      window.speechSynthesis.speak(utter);
    } catch {
      if (generation !== speechGenerationRef.current) return;
      setQuestionAudioPending(false);
      setPhase("READY");
      setError(
        "Question audio playback failed. Read the question on screen and continue."
      );
    }
  }, []);
  const current = turns[turns.length - 1] || null;
  const audioRetryAction = getLiveAudioRetryAction({
    capturedAudioAvailable: Boolean(capturedAudio?.size),
    transcriptDraft,
    persistedTranscript: current?.transcript,
  });
  const beginAdaptiveTurn = useCallback(
    async (prior: Turn) => {
      if (!session || Date.now() >= Date.parse(session.deadline_at)) {
        await finalize.mutateAsync({ id, reason: "deadline" });
        navigate(`/live-report/${id}`);
        return;
      }
      setPhase("ASKING_FOLLOWUP_OR_NEXT_QUESTION");
      const context = JSON.stringify({
        previousQuestion: prior.question_text,
        recognizedAnswer: prior.transcript,
        answerEvaluation: prior.evaluation
          ? {
              score: prior.evaluation.overall_score,
              strengths: prior.evaluation.strengths,
              weaknesses: prior.evaluation.weaknesses,
              missingPoints: prior.evaluation.missing_points,
            }
          : null,
        instruction:
          "Ask one relevant follow-up grounded in the candidate's answer if it is incomplete or raises an important point. Otherwise continue with a distinct role-relevant competency. Never assume evidence not in the transcript.",
      }).slice(0, 3000);
      const next = await generate.mutateAsync({
        course: "General interview preparation",
        role: session.target_role,
        type: "Adaptive live interview follow-up",
        difficulty: prior.evaluation?.overall_score >= 80 ? "Hard" : "Medium",
        skills: ((prior.evaluation?.missing_points as string[] | undefined) || [])
          .map((point: string) => point.trim().slice(0, 100))
          .filter(Boolean)
          .slice(0, 8),
        count: 1,
        language: questionLanguage(session.speech_language),
        context,
      });
      const q = next.questions?.[0];
      if (!q?.question?.trim())
        throw new Error(
          "The interviewer could not produce a valid next question."
        );
      const saved = await saveQuestion.mutateAsync({
        sessionId: id,
        turnIndex: prior.turn_index + 1,
        question: q.question,
        type: "follow-up or next question",
        difficulty: q.difficulty || "Medium",
        competencies: [q.topic || session.target_role],
        parentTurnId: prior.id,
        idempotencyKey: `${id}:turn:${prior.turn_index + 1}`,
      });
      setTurns(old => [...old.filter(t => t.id !== saved.id), saved as Turn]);
      setError("");
      speak(saved.question_text, session.speech_language);
    },
    [session, id, navigate, finalize, generate, saveQuestion, speak]
  );
  const createOpeningTurn = useCallback(async () => {
    if (!session || session.status !== "in_progress") return;
    setBusy(true);
    setPhase("ASKING_FOLLOWUP_OR_NEXT_QUESTION");
    setError("");
    try {
      const result = await generate.mutateAsync({
        course: "General interview preparation",
        role: session.target_role,
        type: "Live Interview opening question",
        difficulty: "Medium",
        skills: [],
        count: 1,
        language: questionLanguage(session.speech_language),
        context:
          "This is the opening turn. Ask a concise, natural question that lets the candidate introduce role-relevant experience without assuming prior background.",
      });
      const q = result.questions?.[0];
      if (!q?.question?.trim())
        throw new Error("No valid opening question was returned.");
      const saved = await saveQuestion.mutateAsync({
        sessionId: id,
        turnIndex: 0,
        question: q.question,
        type: "opening",
        difficulty: q.difficulty || "Medium",
        competencies: [q.topic || session.target_role],
        idempotencyKey: `${id}:turn:0`,
      });
      setTurns([saved as Turn]);
      speak(saved.question_text, session.speech_language);
    } catch (cause) {
      setPhase("RECOVERABLE_ERROR");
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not prepare the opening question. Retry when ready."
      );
    } finally {
      setBusy(false);
    }
  }, [session, generate, saveQuestion, id, speak]);
  const finalizeSession = useCallback(
    async (reason: "manual" | "deadline") => {
      if (!session || (expiryRef.current && reason === "deadline"))
        return;
      if (phaseRef.current === "LISTENING") {
        stopListening();
      }
      expiryRef.current = true;
      setPhase("FINALIZING");
      speechGenerationRef.current += 1;
      setQuestionAudioPending(false);
      window.speechSynthesis?.cancel?.();
      try {
        await persistCameraSummary();
        await finalize.mutateAsync({ id, reason });
        stopCamera();
        setPhase("COMPLETED");
        navigate(`/live-report/${id}`);
      } catch (cause) {
        try {
          const refetched = await query.refetch();
          if (refetched.data?.session?.status === "completed") {
            stopCamera();
            setPhase("COMPLETED");
            navigate(`/live-report/${id}`);
            return;
          }
        } catch {}
        setPhase("RECOVERABLE_ERROR");
        setError(
          cause instanceof Error
            ? cause.message
            : "Report generation failed. Your saved answers can be recovered; retry finalization."
        );
        expiryRef.current = false;
      }
    },
    [session, id, finalize, navigate, persistCameraSummary, stopCamera, query]
  );
  useEffect(() => {
    if (
      remaining === 0 &&
      !busy &&
      session?.status === "in_progress" &&
      Date.now() >= Date.parse(session.deadline_at) &&
      !expiryRef.current
    )
      void finalizeSession("deadline");
  }, [remaining, session, busy, phase, finalizeSession]);
  useEffect(() => {
    abortCapture.current = false;
    return () => {
      abortCapture.current = true;
      recognition.current?.stop?.();
      recorder.current?.stop?.();
      stopTracks();
      stopCamera(false);
      if (answerTimeout.current) window.clearTimeout(answerTimeout.current);
      speechGenerationRef.current += 1;
      window.speechSynthesis?.cancel?.();
    };
  }, [stopCamera]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "visible" &&
        phaseRef.current === "LISTENING"
      ) {
        if (
          listeningStartedAt.current &&
          Date.now() - listeningStartedAt.current >= 180000
        ) {
          setError(
            "Answer capture limit reached while tab was in background. Processing captured speech."
          );
          stopListeningRef.current();
        }
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
      return () =>
        document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
  }, []);

  useEffect(() => {
    if (!session?.id || !current?.id) return;
    const userScope = session.owner_id
      ? `live_draft_${session.owner_id}_${session.id}_${current.id}`
      : "";
    const key = `live_draft_${session.id}_${current.id}`;
    if (transcriptDraft.trim()) {
      if (userScope) safeStorage.setItem(userScope, transcriptDraft);
      safeStorage.setItem(key, transcriptDraft);
    }
  }, [transcriptDraft, session?.id, current?.id, session?.owner_id]);

  useEffect(() => {
    if (!session?.id || !current?.id) return;
    const userScope = session.owner_id
      ? `live_draft_${session.owner_id}_${session.id}_${current.id}`
      : "";
    const saved =
      (userScope ? safeStorage.getItem(userScope) : null) ||
      safeStorage.getItem(`live_draft_${session.id}_${current.id}`);
    if (saved && !current.transcript && !transcriptDraft) {
      setTranscriptDraft(saved);
      setPartial(saved);
    }
  }, [current?.id, session?.id, session?.owner_id]);
  async function acceptTranscript(text: string) {
    if (!current || submittedRef.current) return;
    const transcript = (text || transcriptDraft || partial).trim();
    if (!transcript) {
      setBusy(false);
      setPhase("READY");
      setError(
        "No speech was detected. Please speak into your microphone or type your answer in the box below before submitting."
      );
      return;
    }
    setTranscriptDraft(transcript);
    setPartial(transcript);
    submittedRef.current = true;
    setBusy(true);
    setPhase("PROCESSING_ANSWER");
    setError("");
    let transcriptSaved = false;
    try {
      await saveTranscript.mutateAsync({
        sessionId: id,
        turnId: current.id,
        transcript,
      });
      transcriptSaved = true;
      setTranscriptDraft("");
      setCapturedAudio(null);
      if (session?.id && current?.id) {
        if (session.owner_id) {
          safeStorage.removeItem(
            `live_draft_${session.owner_id}_${session.id}_${current.id}`
          );
        }
        safeStorage.removeItem(`live_draft_${session.id}_${current.id}`);
      }
      const accepted = {
        ...current,
        transcript,
        transcript_status: "accepted",
      };
      setTurns(old => old.map(t => (t.id === current.id ? accepted : t)));
      setPhase("EVALUATING");
      const result = await evaluate.mutateAsync({
        sessionId: id,
        turnId: current.id,
      });
      const evaluated = {
        ...accepted,
        evaluation: result,
        evaluation_status: "completed",
      };
      setTurns(old => old.map(t => (t.id === current.id ? evaluated : t)));
      if (Date.now() >= Date.parse(session!.deadline_at)) {
        setBusy(false);
        await finalizeSession("deadline");
        return;
      }
      await beginAdaptiveTurn(evaluated);
    } catch {
      setPhase("RECOVERABLE_ERROR");
      setError(
        transcriptSaved
          ? "Your answer was saved, but its coaching could not finish. Retry the saved answer without recording again."
          : "Your recognized answer could not be saved. The text remains on this page; retry saving it."
      );
    } finally {
      submittedRef.current = false;
      setBusy(false);
      stopTracks();
    }
  }
  async function transcribeCapturedAudio(blob: Blob) {
    if (!session || !blob.size || transcribingAudioRef.current) return;
    if (blob.size > MAX_TRANSCRIPTION_AUDIO_BYTES) {
      setBusy(false);
      setCapturedAudio(null);
      setPhase("RECOVERABLE_ERROR");
      setError(
        "This recording is too large to send for transcription. Record a shorter answer or use text mode."
      );
      return;
    }
    transcribingAudioRef.current = true;
    setError("");
    setBusy(true);
    setPhase("PROCESSING_ANSWER");
    try {
      const result = await transcribe.mutateAsync({
        audioBase64: bytesToBase64(new Uint8Array(await blob.arrayBuffer())),
        mimeType: blob.type || "audio/webm",
        language: session.speech_language.split("-")[0] || "en",
      });
      const transcribedText = result?.text?.trim() || "";
      if (transcribedText) {
        setTranscriptDraft(transcribedText);
        setPartial(transcribedText);
        await acceptTranscript(transcribedText);
      } else {
        setBusy(false);
        setPhase("READY");
        setError(
          "Audio recording finished, but no clear speech was recognized. You can speak again or type your answer below."
        );
      }
    } catch (cause) {
      setBusy(false);
      setPhase("RECOVERABLE_ERROR");
      setError(
        cause instanceof Error
          ? cause.message
          : "The completed recording could not be transcribed. You can retry transcription or type your answer below."
      );
    } finally {
      transcribingAudioRef.current = false;
    }
  }

  async function startListening() {
    if (!session || !current || busy || remaining <= 0) return;
    abortCapture.current = false;
    setError("");
    const existing = (transcriptDraft || partial || latestRecognizedText.current || finalText.current).trim();
    baseTranscript.current = existing;
    finalText.current = existing;
    latestRecognizedText.current = existing;
    setPartial(existing);
    setCapturedAudio(null);
    stopping.current = false;
    setBusy(true);

    let micStream: MediaStream;
    try {
      if (
        typeof window !== "undefined" &&
        !window.isSecureContext &&
        window.location.hostname !== "localhost" &&
        window.location.hostname !== "127.0.0.1"
      ) {
        throw new Error(
          "Microphone access requires a secure connection (HTTPS). Please open this site using HTTPS or use Type mode."
        );
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Your browser does not support microphone access.");
      }
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = micStream;
      listeningStartedAt.current = Date.now();
    } catch (micErr) {
      setBusy(false);
      setPhase("READY");
      setError(
        micErr instanceof Error
          ? `Microphone access denied: ${micErr.message}. Please check browser permissions or use Type mode.`
          : "Microphone access denied. Please allow microphone in your browser URL bar or use Type mode."
      );
      return;
    }

    // 1. Audio Visualizer using Web Audio API
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const actx = new AudioCtx();
        audioContextRef.current = actx;
        const src = actx.createMediaStreamSource(micStream);
        const analyser = actx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        analyserRef.current = analyser;
        const dataArr = new Uint8Array(analyser.frequencyBinCount);

        const checkVolume = () => {
          if (!analyserRef.current || stopping.current) return;
          analyser.getByteFrequencyData(dataArr);
          let sum = 0;
          for (let i = 0; i < dataArr.length; i++) sum += dataArr[i];
          const avg = sum / dataArr.length;
          setMicVolume(Math.min(100, Math.round((avg / 128) * 100)));
          animFrameRef.current = requestAnimationFrame(checkVolume);
        };
        animFrameRef.current = requestAnimationFrame(checkVolume);
      }
    } catch (e) {
      console.warn("Audio visualizer init error:", e);
    }

    // 2. Hardware recording with MediaRecorder
    try {
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : "";
      const rec = mime
        ? new MediaRecorder(micStream, { mimeType: mime, audioBitsPerSecond: 32000 })
        : new MediaRecorder(micStream, { audioBitsPerSecond: 32000 });
      recorder.current = rec;
      chunks.current = [];
      rec.ondataavailable = e => {
        if (e.data && e.data.size > 0) chunks.current.push(e.data);
      };
      rec.start(250);
    } catch (recErr) {
      console.warn("MediaRecorder start failed:", recErr);
    }

    // 3. Browser SpeechRecognition for live real-time preview (parallel)
    const Speech = browserSpeech();
    if (Speech) {
      try {
        const r = new Speech();
        recognition.current = r;
        const userLang = session?.speech_language || navigator.language || "en-IN";
        r.lang = userLang.startsWith("hi") ? "hi-IN" : (userLang.includes("IN") ? "en-IN" : "en-US");
        r.continuous = true;
        r.interimResults = true;
        r.onresult = (event: any) => {
          let finals = "", interim = "";
          for (let n = 0; n < event.results.length; n++) {
            const item = event.results[n];
            if (item.isFinal) finals += `${item[0]?.transcript || ""} `;
            else interim += `${item[0]?.transcript || ""} `;
          }
          const base = baseTranscript.current ? `${baseTranscript.current.trim()} ` : "";
          const resolvedFinals = `${base}${finals}`.trim();
          finalText.current = resolvedFinals;
          const combined = `${resolvedFinals} ${interim}`.trim();
          latestRecognizedText.current = combined;
          setPartial(combined);
          setTranscriptDraft(combined);
        };
        r.onerror = (event: any) => {
          if (abortCapture.current || event.error === "no-speech") return;
          console.warn("Speech recognition warning:", event.error);
        };
        r.onend = () => {
          if (abortCapture.current || stopping.current) return;
          if (phaseRef.current === "LISTENING") {
            const currentTotal = (finalText.current || latestRecognizedText.current || "").trim();
            if (currentTotal) {
              baseTranscript.current = currentTotal;
            }
            try {
              r.start();
            } catch {}
          }
        };
        r.start();
      } catch (speechErr) {
        console.warn("Web Speech start failed:", speechErr);
      }
    }

    setBusy(false);
    setPhase("LISTENING");

    answerTimeout.current = window.setTimeout(() => {
      if (phaseRef.current === "LISTENING") {
        setError("Answer capture limit reached. Processing captured speech.");
        stopListening();
      }
    }, 180000);
  }

  function stopListening() {
    listeningStartedAt.current = 0;
    if (phaseRef.current !== "LISTENING") return;
    if (answerTimeout.current) window.clearTimeout(answerTimeout.current);
    answerTimeout.current = null;
    setBusy(true);
    stopping.current = true;
    setPhase("PROCESSING_ANSWER");

    try {
      recognition.current?.stop?.();
    } catch {}

    const liveText = (
      finalText.current.trim() ||
      latestRecognizedText.current.trim() ||
      transcriptDraft.trim() ||
      partial.trim()
    );

    if (recorder.current && recorder.current.state === "recording") {
      recorder.current.onstop = async () => {
        const audioBlob = new Blob(chunks.current, {
          type: recorder.current?.mimeType || "audio/webm",
        });
        stopTracks();

        if (liveText && liveText.trim().length >= 2) {
          setBusy(false);
          void acceptTranscript(liveText.trim());
          return;
        }

        if (audioBlob.size > 800) {
          setCapturedAudio(audioBlob);
          void transcribeCapturedAudio(audioBlob);
          return;
        }

        setBusy(false);
        setPhase("READY");
        setError(
          "No speech was detected from your microphone. Please check your mic connection or type your answer directly in the box below."
        );
      };

      try {
        recorder.current.stop();
      } catch {
        stopTracks();
        if (liveText) void acceptTranscript(liveText);
      }
      return;
    }

    stopTracks();
    if (liveText) {
      setBusy(false);
      void acceptTranscript(liveText);
      return;
    }

    setBusy(false);
    setPhase("READY");
    setError("No speech was detected from your microphone. You can type your answer in the box below and click 'Submit answer'.");
  }
  stopListeningRef.current = stopListening;
  async function continueSaved() {
    if (!current?.transcript) return;
    setError("");
    setBusy(true);
    try {
      setPhase("EVALUATING");
      const result = await evaluate.mutateAsync({
        sessionId: id,
        turnId: current.id,
      });
      const evaluated = {
        ...current,
        evaluation: result,
        evaluation_status: "completed",
      };
      setTurns(old => old.map(t => (t.id === current.id ? evaluated : t)));
      await beginAdaptiveTurn(evaluated);
    } catch (cause) {
      setPhase("RECOVERABLE_ERROR");
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not continue this saved answer; retry."
      );
    } finally {
      setBusy(false);
    }
  }
  if (query.isLoading)
    return <LoadingState text="Recovering your Live Interview…" />;
  if (query.error || !session)
    return (
      <div className="page-stack">
        <div className="notice notice-error">
          Could not load this account's interview session. Check your connection
          or return to setup.
        </div>
        <Link className="button button-secondary" href="/live-interview">
          Back to setup
        </Link>
      </div>
    );
  if (session.status === "completed")
    return (
      <div className="center-screen">
        <h2>Live Interview complete</h2>
        <Link className="button button-primary" href={`/live-report/${id}`}>
          Open saved report <ArrowRight size={15} />
        </Link>
      </div>
    );
  const labels: Record<Phase, string> = {
    READY: "Ready",
    ASKING: "Interviewer speaking",
    LISTENING: "Listening — finish when ready",
    PROCESSING_ANSWER: "Transcribing answer",
    EVALUATING: "Evaluating your answer",
    ASKING_FOLLOWUP_OR_NEXT_QUESTION: "Preparing the next question",
    FINALIZING: "Generating your report",
    COMPLETED: "Complete",
    RECOVERABLE_ERROR: "Needs attention",
  };
  const cameraLabel =
    cameraStatus === "ready"
      ? "Camera on"
      : cameraStatus === "loading"
        ? "Camera starting"
        : cameraStatus === "unsupported"
          ? "Camera unavailable"
          : cameraStatus === "error"
            ? "Camera error"
            : "Camera off";
  const phaseLabel = questionAudioPending
    ? "Starting question audio"
    : labels[phase];
  return (
    <div className="page-stack live-interview-page">
      <PageHeading
        eyebrow="LIVE INTERVIEW"
        title={session.target_role}
        description="Your camera is optional. Interview audio is processed only when you start an answer."
        action={
          phase === "LISTENING" ? (
            <button className="button button-danger" onClick={stopListening}>
              <Square size={15} /> Stop answer
            </button>
          ) : (
            <button
              className="button button-danger"
              disabled={busy || phase === "FINALIZING"}
              onClick={() => setEndConfirmOpen(true)}
            >
              End interview
            </button>
          )
        }
      />
      <div className="live-room-meta">
        <Tag tone={phase === "LISTENING" ? "green" : "violet"}>
          {phaseLabel}
        </Tag>
        <span className={remaining < 60 ? "time-warn" : ""}>
          <Clock3 size={15} /> {timeLabel(remaining)}
        </span>
        <span>
          {turns.length} {turns.length === 1 ? "question" : "questions"}
        </span>
      </div>
      <div className="live-room-grid">
        <section
          className={`live-room-panel live-interviewer ${phase.toLowerCase()}`}
          aria-labelledby="live-interviewer-title"
        >
          <div className="live-room-panel-heading">
            <span className="live-room-kicker">
              <Orbit size={15} /> AI INTERVIEWER
            </span>
            <Tag tone={phase === "LISTENING" ? "green" : "violet"}>
              {phaseLabel}
            </Tag>
          </div>
          <div className="live-orb" aria-hidden="true">
            <Orbit size={42} />
          </div>
          <div className="live-question-block" aria-live="polite">
            <span className="live-room-kicker">
              {current ? `QUESTION ${current.turn_index + 1}` : "WELCOME"}
            </span>
            <h2 id="live-interviewer-title">
              {current?.question_text || "Your interviewer is ready."}
            </h2>
          </div>
          <div className="live-interviewer-actions">
            {current ? (
              <button
                className="button button-secondary"
                onClick={() =>
                  speak(current.question_text, session.speech_language)
                }
                disabled={busy || questionAudioPending || phase === "LISTENING"}
              >
                <Volume2 size={15} /> Repeat question
              </button>
            ) : (
              <button
                className="button button-primary"
                onClick={() => void createOpeningTurn()}
                disabled={busy || remaining <= 0}
              >
                <ArrowRight size={15} /> Prepare first question
              </button>
            )}
          </div>
          <p className="live-room-hint" role="status" aria-live="polite">
            {questionAudioPending
              ? "Starting question audio."
              : phase === "ASKING"
                ? "Speaking the current question."
                : phase === "LISTENING"
                  ? "Listening to your answer."
                  : phase === "PROCESSING_ANSWER" || phase === "EVALUATING"
                    ? "Processing the answer you provided."
                    : phase === "ASKING_FOLLOWUP_OR_NEXT_QUESTION"
                      ? "Preparing your next question."
                      : phase === "FINALIZING"
                        ? "Saving your interview and preparing a report."
                        : "Your interviewer is ready when you are."}
          </p>
        </section>

        <section
          className="live-room-panel live-candidate-panel"
          aria-labelledby="live-candidate-title"
        >
          <div className="live-room-panel-heading">
            <span className="live-room-kicker" id="live-candidate-title">
              <Camera size={15} /> YOU
            </span>
            <span className="live-camera-indicator">
              <i className={cameraStatus === "ready" ? "is-active" : ""} />
              {cameraLabel}
            </span>
          </div>
          <div className="live-candidate-preview">
            {cameraStatus === "ready" || cameraStatus === "loading" ? (
              <video
                ref={cameraVideoRef}
                autoPlay
                muted
                playsInline
                aria-label="Your live camera preview, displayed locally"
              />
            ) : (
              <div className="live-camera-placeholder" aria-live="polite">
                <span className="live-camera-placeholder-icon">
                  <CameraOff size={25} />
                </span>
                <strong>Your camera is off</strong>
                <span>You can complete the interview without it.</span>
              </div>
            )}
            {cameraStatus === "loading" && (
              <span className="live-camera-loading" role="status">
                Loading camera…
              </span>
            )}
          </div>
          <div className="live-camera-controls">
            <label className="camera-consent">
              <input
                type="checkbox"
                checked={cameraOptIn}
                onChange={event => {
                  const optedIn = event.currentTarget.checked;
                  setCameraOptIn(optedIn);
                  if (!optedIn) void disableCamera();
                }}
              />
              <span>Opt in to optional on-device framing observations</span>
            </label>
            {cameraStatus === "ready" ? (
              <button
                className="button button-secondary"
                onClick={() => void disableCamera()}
              >
                <CameraOff size={15} /> Turn camera off
              </button>
            ) : (
              <button
                className="button button-secondary"
                disabled={!cameraOptIn || cameraStatus === "loading"}
                onClick={() => void enableCamera()}
              >
                <Camera size={15} />
                {cameraStatus === "loading"
                  ? "Loading local models…"
                  : "Turn camera on"}
              </button>
            )}
            <p className="live-limit-note" role="status">
              {cameraStatus === "ready"
                ? `${cameraCounts.sample_count} low-rate samples processed on this device.`
                : cameraStatus === "unsupported"
                  ? "Camera analysis is unsupported here. The interview works without it."
                  : "Camera access starts only after opting in and stays optional."}
            </p>
            {cameraError && (
              <p className="notice notice-warning" role="status">
                {cameraError}
              </p>
            )}
            <details className="live-camera-privacy">
              <summary>Camera privacy details</summary>
              <p>
                Camera frames and landmarks stay on this device and are not
                uploaded by this feature. Only low-rate face, shoulder, and hand
                visibility counts may be saved. MediaPipe reports sending
                performance and usage metrics to Google; its notice does not
                list every field. Model files are fetched from Google Cloud
                Storage and jsDelivr.
              </p>
            </details>
          </div>
        </section>

        <Panel
          className="live-room-panel live-transcript-panel"
          title="Conversation"
          subtitle="Only questions and answers from this interview appear here."
        >
          <div
            className="live-conversation"
            ref={transcriptRef}
            role="log"
            tabIndex={0}
            onScroll={event => {
              const element = event.currentTarget;
              followTranscriptRef.current =
                element.scrollHeight -
                  element.scrollTop -
                  element.clientHeight <
                48;
            }}
            aria-label="Interview conversation transcript"
            aria-live="polite"
          >
            {turns.length === 0 && (
              <p className="live-conversation-empty">
                Your interview conversation will appear here.
              </p>
            )}
            {turns.map(turn => (
              <article className="live-conversation-turn" key={turn.id}>
                <div className="live-conversation-message interviewer-message">
                  <span>INTERVIEWER · {turn.turn_index + 1}</span>
                  <p>{turn.question_text}</p>
                </div>
                <div className="live-conversation-message candidate-message">
                  <span>YOU</span>
                  <p>
                    {turn.transcript ||
                      (turn.id === current?.id
                        ? "Your answer will appear here after you speak."
                        : "No transcript was saved for this answer.")}
                  </p>
                </div>
              </article>
            ))}
            {(partial || transcriptDraft) && (
              <div className="live-conversation-message candidate-message live-draft-message">
                <span>YOU · DRAFT</span>
                <p>{partial || transcriptDraft}</p>
              </div>
            )}
            {phase === "PROCESSING_ANSWER" && !partial && !transcriptDraft && (
              <p className="live-conversation-status" role="status">
                Transcribing your recorded answer…
              </p>
            )}
            {phase === "LISTENING" && !partial && (
              <p className="live-conversation-status" role="status">
                Listening. Your recognized words will appear here when
                available.
              </p>
            )}
          </div>
          {!current?.transcript && current && (
            <div
              style={{
                marginTop: "16px",
                padding: "16px",
                border: "1px solid var(--border, #333)",
                borderRadius: "10px",
                background: "rgba(255, 255, 255, 0.03)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "10px",
                  marginBottom: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      color: "var(--foreground, #fff)",
                      letterSpacing: "0.05em",
                    }}
                  >
                    ANSWER MODE:
                  </span>
                  <div
                    style={{
                      display: "inline-flex",
                      borderRadius: "6px",
                      overflow: "hidden",
                      border: "1px solid var(--border, #444)",
                    }}
                  >
                    <button
                      type="button"
                      style={{
                        padding: "6px 12px",
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        border: "none",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        background:
                          answerMode === "type"
                            ? "var(--primary, #3b82f6)"
                            : "transparent",
                        color:
                          answerMode === "type"
                            ? "#fff"
                            : "var(--muted, #aaa)",
                      }}
                      onClick={() => {
                        if (phase === "LISTENING") stopListening();
                        setAnswerMode("type");
                        safeStorage.setItem("live_interview_mode", "type");
                      }}
                    >
                      <Keyboard size={14} /> Type (Text)
                    </button>
                    <button
                      type="button"
                      style={{
                        padding: "6px 12px",
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        border: "none",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        background:
                          answerMode === "speak"
                            ? "var(--primary, #3b82f6)"
                            : "transparent",
                        color:
                          answerMode === "speak"
                            ? "#fff"
                            : "var(--muted, #aaa)",
                      }}
                      onClick={() => {
                        setAnswerMode("speak");
                        safeStorage.setItem("live_interview_mode", "speak");
                      }}
                    >
                      <Mic size={14} /> Speak (Voice)
                    </button>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--muted, #888)",
                  }}
                >
                  {answerMode === "type"
                    ? "Type or paste your response comfortably"
                    : "Speak using microphone or edit speech below"}
                </span>
              </div>
              {phase === "LISTENING" && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    background: "rgba(34, 197, 94, 0.08)",
                    border: "1px solid rgba(34, 197, 94, 0.25)",
                    marginBottom: "10px",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      color: "#22c55e",
                      fontWeight: 600,
                      fontSize: "0.82rem",
                    }}
                  >
                    <span className="live-camera-indicator">
                      <i className="is-active" />
                    </span>
                    Listening to microphone:
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: "8px",
                      background: "rgba(255,255,255,0.1)",
                      borderRadius: "4px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.max(6, micVolume)}%`,
                        height: "100%",
                        background: micVolume > 12 ? "#22c55e" : "#eab308",
                        transition: "width 0.08s ease",
                        borderRadius: "4px",
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: "0.78rem",
                      color: micVolume > 10 ? "#22c55e" : "#aaa",
                      minWidth: "135px",
                      textAlign: "right",
                    }}
                  >
                    {micVolume > 10 ? `Voice detected (${micVolume}%)` : "Waiting for voice..."}
                  </span>
                </div>
              )}
              <textarea
                className="input"
                style={{
                  width: "100%",
                  minHeight: "120px",
                  resize: "vertical",
                  fontFamily: "inherit",
                  fontSize: "0.95rem",
                  lineHeight: "1.5",
                  padding: "12px",
                  borderRadius: "6px",
                  boxSizing: "border-box",
                }}
                value={transcriptDraft || partial}
                onChange={e => {
                  setError("");
                  setTranscriptDraft(e.target.value);
                  setPartial(e.target.value);
                  finalText.current = e.target.value;
                  latestRecognizedText.current = e.target.value;
                }}
                placeholder={
                  answerMode === "type"
                    ? "Type or paste your answer here in detail..."
                    : "Click 'Start speaking' below or type your answer here..."
                }
                disabled={
                  busy ||
                  phase === "PROCESSING_ANSWER" ||
                  phase === "EVALUATING"
                }
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: "10px",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                <div style={{ fontSize: "0.78rem", color: "var(--muted, #888)" }}>
                  {(() => {
                    const txt = (transcriptDraft || partial).trim();
                    const words = txt ? txt.split(/\s+/).length : 0;
                    return `${words} words · ${txt.length} characters`;
                  })()}
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  {answerMode === "speak" && phase === "LISTENING" && (
                    <button
                      type="button"
                      className="button button-danger"
                      onClick={stopListening}
                      disabled={busy}
                    >
                      <Square size={14} /> Stop & submit
                    </button>
                  )}
                  {answerMode === "speak" && phase !== "LISTENING" && (
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => void startListening()}
                      disabled={
                        busy ||
                        questionAudioPending ||
                        phase === "ASKING" ||
                        !current ||
                        remaining <= 0
                      }
                    >
                      <Mic size={14} /> Start speaking
                    </button>
                  )}
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() =>
                      void acceptTranscript(transcriptDraft || partial)
                    }
                    disabled={
                      busy ||
                      !(transcriptDraft.trim() || partial.trim()) ||
                      phase === "PROCESSING_ANSWER" ||
                      phase === "EVALUATING"
                    }
                  >
                    <Send size={14} /> Submit answer
                  </button>
                </div>
              </div>
            </div>
          )}
          {current?.transcript && (
            <button
              className="button button-secondary live-continue-button"
              onClick={() => void continueSaved()}
              disabled={busy}
            >
              {current.evaluation_status === "completed"
                ? "Continue interview"
                : "Continue processing saved answer"}
            </button>
          )}
          {error && (
            <div className="notice notice-error live-room-error" role="alert">
              <span>{error}</span>
              {phase === "RECOVERABLE_ERROR" && current?.transcript && (
                <button
                  className="button button-secondary"
                  onClick={() => void continueSaved()}
                  disabled={busy}
                >
                  Retry saved answer
                </button>
              )}
              {audioRetryAction === "transcribe" && capturedAudio && (
                <button
                  className="button button-secondary"
                  onClick={() => void transcribeCapturedAudio(capturedAudio)}
                  disabled={busy}
                >
                  Retry transcription from captured audio
                </button>
              )}
              {audioRetryAction === "save-transcript" && (
                <button
                  className="button button-secondary"
                  onClick={() => void acceptTranscript(transcriptDraft)}
                  disabled={busy}
                >
                  Retry saving recognized answer
                </button>
              )}

            </div>
          )}
          <p className="live-limit-note">
            Recognition varies by browser and language. If real-time recognition
            is unavailable, captured audio is transcribed after you stop.
            Captured audio and recognized text remain available here for retry
            if transcription or saving fails.
          </p>
        </Panel>

        <div className="live-room-controls">
          {answerMode === "speak" ? (
            <>
              {phase === "LISTENING" ? (
                <button className="button button-danger" onClick={stopListening}>
                  <Square size={15} /> Stop & submit answer
                </button>
              ) : (
                <button
                  className="button button-primary live-start-answer"
                  onClick={() => void startListening()}
                  disabled={
                    busy ||
                    questionAudioPending ||
                    phase === "ASKING" ||
                    !current ||
                    remaining <= 0 ||
                    Boolean(current?.transcript)
                  }
                >
                  <Mic size={17} /> Start speaking
                </button>
              )}
              <span
                className="live-microphone-status"
                role="status"
                aria-live="polite"
              >
                {phase === "LISTENING"
                  ? "Microphone active · stop when your answer is complete"
                  : questionAudioPending
                    ? "Question audio is starting"
                    : phase === "PROCESSING_ANSWER" || phase === "EVALUATING"
                      ? "Processing your answer..."
                      : "Voice mode active · click Start speaking to answer"}
              </span>
              <button
                type="button"
                className="button button-secondary"
                style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: "6px" }}
                onClick={() => {
                  if (phase === "LISTENING") stopListening();
                  setAnswerMode("type");
                  safeStorage.setItem("live_interview_mode", "type");
                }}
              >
                <Keyboard size={14} /> Switch to Type mode
              </button>
            </>
          ) : (
            <>
              <button
                className="button button-primary"
                onClick={() =>
                  void acceptTranscript(transcriptDraft || partial)
                }
                disabled={
                  busy ||
                  !(transcriptDraft.trim() || partial.trim()) ||
                  phase === "PROCESSING_ANSWER" ||
                  phase === "EVALUATING" ||
                  !current ||
                  remaining <= 0 ||
                  Boolean(current?.transcript)
                }
              >
                <Send size={15} /> Submit typed answer
              </button>
              <span
                className="live-microphone-status"
                role="status"
                aria-live="polite"
              >
                {phase === "PROCESSING_ANSWER" || phase === "EVALUATING"
                  ? "Evaluating your answer..."
                  : "Type mode active · write your answer in the box above"}
              </span>
              <button
                type="button"
                className="button button-secondary"
                style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: "6px" }}
                onClick={() => {
                  setAnswerMode("speak");
                  safeStorage.setItem("live_interview_mode", "speak");
                }}
              >
                <Mic size={14} /> Switch to Speak mode
              </button>
            </>
          )}
        </div>
      </div>
      <AlertDialog open={endConfirmOpen} onOpenChange={setEndConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this interview?</AlertDialogTitle>
            <AlertDialogDescription>
              Your saved answers will be used to prepare the report. You cannot
              continue this session after it is finalized.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep practicing</AlertDialogCancel>
            <AlertDialogAction
              className="button-danger"
              disabled={phase === "FINALIZING"}
              onClick={() => void finalizeSession("manual")}
            >
              End interview
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function LiveInterviewReport() {
  const p = useParams<{ id: string }>();
  const id = p?.id || "";
  const q = trpc.liveInterview.get.useQuery(
    { id },
    { enabled: !!id, retry: 1 }
  );
  if (q.isLoading) return <LoadingState text="Loading your saved report…" />;
  const session = q.data?.session as Session | undefined;
  const report = session?.report;
  const cameraSummary = report?.cameraSummary as
    | FramingSummary
    | null
    | undefined;
  if (!session || session.status !== "completed" || !report)
    return (
      <div className="page-stack">
        <div className="notice notice-warning">
          This report is not complete yet. Return to the session to retry
          finalization.
        </div>
        <Link
          className="button button-secondary"
          href={`/live-interview/${id}`}
        >
          Recover session
        </Link>
      </div>
    );
  return (
    <div className="page-stack live-interview-page">
      <PageHeading
        eyebrow="SAVED LIVE INTERVIEW REPORT"
        title={report.role || session.target_role}
        description={`Started ${new Date(report.startedAt || session.started_at).toLocaleString()} · Completed ${new Date(report.completedAt).toLocaleString()} · ${session.duration_minutes} minutes · ${report.completionReason === "deadline" ? "time expired" : "ended early"}`}
        action={
          <Link className="button button-secondary" href="/practice">
            <ArrowLeft size={14} /> Practice home
          </Link>
        }
      />
      <div className="live-report-summary">
        <Panel
          title="Answer quality"
          subtitle="AI coaching estimate, not a validated hiring metric."
        >
          {report.answerQualityScore === null ? (
            <b>Insufficient evaluated answers</b>
          ) : (
            <strong>
              {report.answerQualityScore}
              <small>/100</small>
            </strong>
          )}
          <p>
            {report.answeredCount} answered · {report.evaluatedCount} evaluated
            · {report.questionCount} questions
          </p>
        </Panel>
        <Panel
          title="Interview feedback"
          subtitle="AI-generated coaching suggestions; not independently verified facts or hiring advice."
        >
          {report.analysis?.summary && <p>{report.analysis.summary}</p>}
          {report.evaluationModelVersion && (
            <p className="live-report-provenance">
              AI answer coaching · prompt{" "}
              {report.evaluationPromptVersion || "version not recorded"} ·
              rubric {report.rubricVersion || "version not recorded"}
            </p>
          )}
          {report.analysisModelVersion && (
            <p className="live-report-provenance">
              AI report analysis · prompt{" "}
              {report.analysisPromptVersion || "version not recorded"}
            </p>
          )}
          <h4>Strengths</h4>
          <ul>
            {(report.analysis?.strengths || []).map((x: string, i: number) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
          <h4>Areas to improve</h4>
          <ul>
            {(report.analysis?.weaknesses || []).map((x: string, i: number) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
          <h4>Next steps</h4>
          <ul>
            {(report.analysis?.next_steps || []).map((x: string, i: number) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
          {report.analysis?.communication_issues?.length > 0 && (
            <>
              <h4>Transcript-based communication observations</h4>
              <ul>
                {report.analysis.communication_issues.map(
                  (x: string, i: number) => (
                    <li key={i}>{x}</li>
                  )
                )}
              </ul>
            </>
          )}
        </Panel>
      </div>
      <Panel
        title="Question-by-question record"
        subtitle="Recognized transcripts and actual stored evaluations."
      >
        {(report.turns || []).map((t: any, i: number) => (
          <article className="live-report-turn" key={t.id}>
            <h3>
              {i + 1}. {t.question}
            </h3>
            <p>
              <b>Transcript:</b> {t.transcript || "No transcript saved."}
            </p>
            {t.evaluation ? (
              <>
                <p>
                  <b>Answer quality:</b> {t.evaluation.overall_score}/100
                </p>
                {typeof t.evaluation.communication_score === "number" && (
                  <p className="live-report-provenance">
                    Separate transcript communication-structure observation:{" "}
                    {t.evaluation.communication_score}/100; excluded from answer
                    quality and not a measure of vocal confidence, accent or
                    personality.
                  </p>
                )}
                <p>{t.evaluation.improvement_tip}</p>
                {t.evaluation.dimensions?.length > 0 && (
                  <div className="live-evaluation-dimensions">
                    {t.evaluation.dimensions.map(
                      (dimension: any, index: number) => (
                        <div
                          className="live-evaluation-dimension"
                          key={`${dimension.name}-${index}`}
                        >
                          <span>
                            {dimension.name}
                            {typeof dimension.weight === "number" && (
                              <small>Weight {dimension.weight}%</small>
                            )}
                          </span>
                          <b>{dimension.score}/100</b>
                          {dimension.note && <small>{dimension.note}</small>}
                          <small className="dimension-evidence">
                            <b>Exact answer evidence:</b>{" "}
                            {dimension.evidence ||
                              "No exact evidence quote returned."}
                          </small>
                        </div>
                      )
                    )}
                  </div>
                )}
                {t.evaluation.strengths?.length > 0 && (
                  <p>
                    <b>AI coaching suggestions:</b>{" "}
                    {t.evaluation.strengths.join(" · ")}
                  </p>
                )}
                {t.evaluation.weaknesses?.length > 0 && (
                  <p>
                    <b>Areas to strengthen:</b>{" "}
                    {t.evaluation.weaknesses.join(" · ")}
                  </p>
                )}
                {t.evaluation.missing_points?.length > 0 && (
                  <p>
                    <b>Points not covered:</b>{" "}
                    {t.evaluation.missing_points.join(" · ")}
                  </p>
                )}
              </>
            ) : (
              <p>Evaluation unavailable.</p>
            )}
          </article>
        ))}
      </Panel>
      <Panel
        title="Optional local framing observations"
        subtitle="Factual detection coverage only. These observations are not a performance score and do not affect answer evaluations."
      >
        {!cameraSummary ? (
          <p>No optional camera framing data was saved for this session.</p>
        ) : cameraSummary.sample_count < 20 ? (
          <p>
            Limited sample ({cameraSummary.sample_count}). There is not enough
            local coverage for a useful framing summary; no zero score is
            assigned.
          </p>
        ) : (
          <ul>
            <li>
              Face detected in {cameraSummary.face_present} of{" "}
              {cameraSummary.sample_count} low-rate samples.
            </li>
            <li>
              Both shoulders detected in {cameraSummary.shoulders_present} of{" "}
              {cameraSummary.sample_count} low-rate samples.
            </li>
            <li>
              Hands detected in {cameraSummary.hands_present} of{" "}
              {cameraSummary.sample_count} low-rate samples.
            </li>
          </ul>
        )}
        <p className="live-limit-note">
          Camera was optional. Raw webcam frames, audio and landmark coordinates
          were not uploaded or retained by this feature.
        </p>
      </Panel>
      <Panel title="Limitations">
        <ul>
          {(report.limitations || []).map((x: string, i: number) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
