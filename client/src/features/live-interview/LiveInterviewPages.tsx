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
  RotateCcw,
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
import { isSilenceHallucination } from "@shared/scoring";

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
  const forceEnd = trpc.liveInterview.forceEnd.useMutation();
  const saveQuestion = trpc.liveInterview.saveQuestion.useMutation();
  const generate = trpc.ai.generateQuestions.useMutation();
  const isStartingRef = useRef(false);
  const prefetchedRef = useRef<{
    role: string;
    lang: string;
    promise: Promise<any> | null;
    data: any;
  } | null>(null);

  useEffect(() => {
    const target = role.trim();
    const lang = inferredSpeechLocale();
    if (target.length < 3 || active.data) {
      prefetchedRef.current = null;
      return;
    }
    const timer = window.setTimeout(() => {
      if (prefetchedRef.current?.role === target && prefetchedRef.current?.lang === lang) {
        return;
      }
      const fetchPromise = generate.mutateAsync({
        course: "General interview preparation",
        role: target,
        type: "Live Interview opening question",
        difficulty: "Medium",
        skills: [],
        count: 1,
        language: questionLanguage(lang),
        context:
          "Create a concise, natural opening question that lets the candidate introduce role-relevant experience. This is the first turn; do not assume a resume or background.",
      })
        .then(res => {
          if (prefetchedRef.current?.role === target) {
            prefetchedRef.current.data = res;
            prefetchedRef.current.promise = null;
          }
          return res;
        })
        .catch(() => {
          if (prefetchedRef.current?.role === target) {
            prefetchedRef.current = null;
          }
        });

      prefetchedRef.current = {
        role: target,
        lang,
        promise: fetchPromise,
        data: null,
      };
    }, 700);

    return () => window.clearTimeout(timer);
  }, [role, active.data, generate]);

  const isBlockingActive = Boolean(
    active.data &&
      active.data.status === "in_progress" &&
      Date.now() < Date.parse(active.data.deadline_at)
  );

  async function start() {
    if (isStartingRef.current) return;
    const target = role.trim();
    if (!target) {
      setError("Enter the target role to begin.");
      return;
    }
    isStartingRef.current = true;
    setError("");
    setRecoveryId("");
    try {
      if (active.data?.id && !isBlockingActive) {
        await forceEnd.mutateAsync({ id: active.data.id }).catch(() => undefined);
      }
      const speechLang = inferredSpeechLocale();
      let generatedData = null;
      if (prefetchedRef.current?.role === target && prefetchedRef.current.lang === speechLang) {
        if (prefetchedRef.current.data) {
          generatedData = prefetchedRef.current.data;
        } else if (prefetchedRef.current.promise) {
          generatedData = await prefetchedRef.current.promise;
        }
      }
      if (!generatedData?.questions?.[0]?.question?.trim()) {
        generatedData = await generate.mutateAsync({
          course: "General interview preparation",
          role: target,
          type: "Live Interview opening question",
          difficulty: "Medium",
          skills: [],
          count: 1,
          language: questionLanguage(speechLang),
          context:
            "Create a concise, natural opening question that lets the candidate introduce role-relevant experience. This is the first turn; do not assume a resume or background.",
        });
      }
      const first = generatedData?.questions?.[0];
      if (!first?.question?.trim())
        throw new Error("No usable interviewer question was returned.");
      const session = await create.mutateAsync({
        role: target,
        durationMinutes: duration,
        speechLanguage: speechLang,
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
    } finally {
      isStartingRef.current = false;
    }
  }
  const busy =
    create.isPending ||
    saveQuestion.isPending ||
    active.isLoading ||
    isStartingRef.current;
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
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <Link
              className="button button-secondary"
              href={`/live-interview/${active.data.id}`}
            >
              Resume session <ArrowRight size={14} />
            </Link>
            <button
              type="button"
              className="button button-danger"
              disabled={forceEnd.isPending}
              onClick={async () => {
                const targetId = active.data?.id;
                if (!targetId) return;
                try {
                  await forceEnd.mutateAsync({ id: targetId });
                  await Promise.all([active.refetch(), recent.refetch()]);
                } catch {
                  setError("Could not force end the session. Try again.");
                }
              }}
            >
              {forceEnd.isPending ? "Ending…" : "Discard / Force End"}
            </button>
          </div>
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
          disabled={busy || forceEnd.isPending || isBlockingActive || !role.trim()}
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
  const forceEnd = trpc.liveInterview.forceEnd.useMutation();
  const saveCameraSummary = trpc.liveInterview.saveCameraSummary.useMutation();
  const generate = trpc.ai.generateQuestions.useMutation();
  const transcribe = trpc.voice.transcribeStoredAudio.useMutation();
  const recognition = useRef<any>(null);
  const finalText = useRef("");
  const baseTranscript = useRef("");
  const latestRecognizedText = useRef("");
  const stopping = useRef(false);
  const isRecordingRef = useRef(false);
  const committedTextRef = useRef("");
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
  const restartTimerRef = useRef<number | null>(null);
  const typingRestartTimerRef = useRef<number | null>(null);
  const stopListeningRef = useRef<() => void>(() => {});
  const transcribingAudioRef = useRef(false);
  const abortCapture = useRef(false);
  const expiryRef = useRef(false);
  const speechGenerationRef = useRef(0);
  const turnAbortControllerRef = useRef<AbortController | null>(null);
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
      if (query.data.session.status === "completed") {
        setPhase("COMPLETED");
        navigate(`/live-report/${id}`);
      } else if (
        query.data.session.status === "failed" ||
        query.data.session.status === "abandoned"
      ) {
        setPhase("RECOVERABLE_ERROR");
        if (query.data.session.report_error) {
          setError(query.data.session.report_error);
        }
      } else if (query.data.session.status === "finalizing") {
        setPhase("FINALIZING");
      }
    }
  }, [query.data, id, navigate]);

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
  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => {
        try { t.stop(); } catch {}
      });
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        if (audioContextRef.current.state !== "closed") {
          audioContextRef.current.close();
        }
      } catch {}
      audioContextRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setMicVolume(0);
  }, []);

  const cleanupSpeechEngine = useCallback(() => {
    if (restartTimerRef.current) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (recognition.current) {
      const r = recognition.current;
      r.onresult = null;
      r.onerror = null;
      r.onend = null;
      r.onstart = null;
      try {
        r.abort();
      } catch {}
      recognition.current = null;
    }
  }, []);

  const cleanupRecorder = useCallback(() => {
    if (recorder.current) {
      const rec = recorder.current;
      rec.ondataavailable = null;
      rec.onstop = null;
      try {
        if (rec.state !== "inactive") rec.stop();
      } catch {}
      recorder.current = null;
    }
  }, []);
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

  useEffect(() => {
    if (phase !== "FINALIZING") return;
    let pollCount = 0;
    const maxPolls = 20; // 20 * 3000ms = 60s
    const timer = window.setInterval(async () => {
      pollCount += 1;
      try {
        const refetched = await query.refetch();
        const curStatus = refetched.data?.session?.status;
        if (curStatus === "completed") {
          window.clearInterval(timer);
          stopCamera();
          setPhase("COMPLETED");
          navigate(`/live-report/${id}`);
          return;
        }
        if (curStatus === "failed" || curStatus === "abandoned") {
          window.clearInterval(timer);
          setPhase("RECOVERABLE_ERROR");
          setError(
            refetched.data?.session?.report_error ||
              "Finalization could not finish. You can retry finalization or abandon the session."
          );
          expiryRef.current = false;
          return;
        }
      } catch {}
      if (pollCount >= maxPolls) {
        window.clearInterval(timer);
        setPhase("RECOVERABLE_ERROR");
        setError(
          "Finalization timed out. Your answers are saved; click Retry finalization or Force End."
        );
        expiryRef.current = false;
      }
    }, 3000);

    return () => window.clearInterval(timer);
  }, [phase, id, query, navigate, stopCamera]);
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
      let nextQuestionText = "";
      let nextDifficulty = prior.evaluation?.overall_score >= 80 ? "Hard" : "Medium";
      let nextTopic = session.target_role;
      try {
        const next = await generate.mutateAsync({
          course: "General interview preparation",
          role: session.target_role,
          type: "Adaptive live interview follow-up",
          difficulty: nextDifficulty,
          skills: ((prior.evaluation?.missing_points as string[] | undefined) || [])
            .map((point: string) => point.trim().slice(0, 100))
            .filter(Boolean)
            .slice(0, 8),
          count: 1,
          language: questionLanguage(session.speech_language),
          context,
        });
        const q = next.questions?.[0];
        if (q?.question?.trim()) {
          nextQuestionText = q.question.trim();
          if (q.difficulty) nextDifficulty = q.difficulty;
          if (q.topic) nextTopic = q.topic;
        }
      } catch (genError) {
        console.warn("Live interview adaptive question generation fallback:", genError);
      }
      if (!nextQuestionText) {
        nextQuestionText = `Can you provide a specific example of how you navigate trade-offs and edge cases in your work as a ${session.target_role}?`;
      }
      const saved = await saveQuestion.mutateAsync({
        sessionId: id,
        turnIndex: prior.turn_index + 1,
        question: nextQuestionText,
        type: "follow-up or next question",
        difficulty: nextDifficulty,
        competencies: [nextTopic],
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
      // Abort any in-flight turn evaluation or speech processing immediately
      abortCapture.current = true;
      if (turnAbortControllerRef.current) {
        turnAbortControllerRef.current.abort();
        turnAbortControllerRef.current = null;
      }
      submittedRef.current = false;
      if (stopping.current) stopping.current = false;
      if (typingRestartTimerRef.current) window.clearTimeout(typingRestartTimerRef.current);
      if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current);
      if (answerTimeout.current) window.clearTimeout(answerTimeout.current);
      cleanupSpeechEngine();
      cleanupRecorder();
      stopTracks();
      stopCamera(false);
      expiryRef.current = true;
      setPhase("FINALIZING");
      speechGenerationRef.current += 1;
      setQuestionAudioPending(false);
      window.speechSynthesis?.cancel?.();
      setBusy(false);
      try {
        await persistCameraSummary();
        await finalize.mutateAsync({ id, reason });
        stopCamera();
        setPhase("COMPLETED");
        navigate(`/live-report/${id}`);
      } catch (cause) {
        const msg = cause instanceof Error ? cause.message : "";
        if (msg.includes("already being finalized")) {
          setPhase("FINALIZING");
          setError("This interview is being finalized. Checking report status…");
          return;
        }
        try {
          const refetched = await query.refetch();
          if (refetched.data?.session?.status === "completed") {
            stopCamera();
            setPhase("COMPLETED");
            navigate(`/live-report/${id}`);
            return;
          }
          if (refetched.data?.session?.status === "finalizing") {
            setPhase("FINALIZING");
            setError("This interview is being finalized. Checking report status…");
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
      if (typingRestartTimerRef.current) window.clearTimeout(typingRestartTimerRef.current);
      if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current);
      if (answerTimeout.current) window.clearTimeout(answerTimeout.current);
      cleanupSpeechEngine();
      cleanupRecorder();
      stopTracks();
      stopCamera(false);
      speechGenerationRef.current += 1;
      window.speechSynthesis?.cancel?.();
    };
  }, [stopCamera, cleanupSpeechEngine, cleanupRecorder, stopTracks]);

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
  async function acceptTranscript(text?: string) {
    if (!current || submittedRef.current || abortCapture.current) return;

    // 1. If actively recording or listening, stop cleanly first
    if (phaseRef.current === "LISTENING" || streamRef.current || recorder.current) {
      stopping.current = true;
      if (answerTimeout.current) window.clearTimeout(answerTimeout.current);
      answerTimeout.current = null;
      if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
      if (typingRestartTimerRef.current) window.clearTimeout(typingRestartTimerRef.current);
      typingRestartTimerRef.current = null;

      cleanupSpeechEngine();
      cleanupRecorder();
      stopTracks();
    }

    const transcript = (text || transcriptDraft || partial || finalText.current || latestRecognizedText.current).trim();
    if (!transcript) {
      setBusy(false);
      setPhase("READY");
      setError(
        "No speech was detected. Please speak into your microphone or type your answer in the box below before submitting."
      );
      return;
    }
    const controller = new AbortController();
    turnAbortControllerRef.current = controller;
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
      if (abortCapture.current || controller.signal.aborted) return;
      transcriptSaved = true;
      setTranscriptDraft("");
      setPartial("");
      finalText.current = "";
      latestRecognizedText.current = "";
      baseTranscript.current = "";
      setCapturedAudio(null);
      stopping.current = false;
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
        transcript_status: "accepted" as const,
      };
      setTurns(old => old.map(t => (t.id === current.id ? accepted : t)));

      // Decouple full coaching evaluation into asynchronous execution
      // so candidate advances to the next question within 1-2 seconds.
      void evaluate
        .mutateAsync({
          sessionId: id,
          turnId: current.id,
        })
        .then(result => {
          if (abortCapture.current || controller.signal.aborted) return;
          const evaluated: Turn = {
            ...accepted,
            evaluation: result,
            evaluation_status: "completed",
          };
          setTurns(old => old.map(t => (t.id === current.id ? evaluated : t)));
        })
        .catch(evalErr => {
          console.warn(`[LiveInterview] Background evaluation for turn ${current.id} notice:`, evalErr);
        });

      if (Date.now() >= Date.parse(session!.deadline_at)) {
        setBusy(false);
        await finalizeSession("deadline");
        return;
      }
      setError("");
      try {
        await beginAdaptiveTurn(accepted);
      } catch (turnErr) {
        if (abortCapture.current || controller.signal.aborted) return;
        console.warn("Live interview adaptive turn step warning:", turnErr);
        setPhase("RECOVERABLE_ERROR");
        setError("Your answer was saved, but loading the next question had a network pause. Click Continue to load it.");
      }
    } catch {
      if (abortCapture.current || controller.signal.aborted) return;
      setPhase("RECOVERABLE_ERROR");
      setError(
        transcriptSaved
          ? "Your answer was saved, but coaching could not finish. Click Continue interview to load the next question."
          : "Your recognized answer could not be saved. The text remains on this page; retry saving it."
      );
    } finally {
      submittedRef.current = false;
      setBusy(false);
      stopTracks();
      cleanupSpeechEngine();
      cleanupRecorder();
    }
  }
  async function transcribeCapturedAudio(blob: Blob, fallbackLiveText = "") {
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
    setCapturedAudio(blob);
    setError("");
    setBusy(true);
    setPhase("PROCESSING_ANSWER");
    try {
      const mime = blob.type || "audio/webm";
      const userLang = session.speech_language || "en-US";
      const result = await transcribe.mutateAsync({
        audioBase64: bytesToBase64(new Uint8Array(await blob.arrayBuffer())),
        mimeType: mime,
        language: userLang.startsWith("hi") ? "hi" : (userLang.includes("IN") ? "en-IN" : "en"),
      });
      const transcribedText = result?.text?.trim() || "";
      if (transcribedText && !isSilenceHallucination(transcribedText)) {
        setTranscriptDraft(transcribedText);
        setPartial(transcribedText);
        finalText.current = transcribedText;
        latestRecognizedText.current = transcribedText;
        baseTranscript.current = transcribedText;
        setPhase("READY");
        setBusy(false);
      } else if (fallbackLiveText && fallbackLiveText.length >= 1) {
        setTranscriptDraft(fallbackLiveText);
        setPartial(fallbackLiveText);
        finalText.current = fallbackLiveText;
        latestRecognizedText.current = fallbackLiveText;
        baseTranscript.current = fallbackLiveText;
        setPhase("READY");
        setBusy(false);
      } else {
        setBusy(false);
        setPhase("READY");
        setError(
          "Audio recording finished, but no clear speech was recognized. You can speak again or type your answer below."
        );
      }
    } catch (cause) {
      setBusy(false);
      if (fallbackLiveText && fallbackLiveText.length >= 1) {
        setTranscriptDraft(fallbackLiveText);
        setPartial(fallbackLiveText);
        setPhase("READY");
      } else {
        setPhase("RECOVERABLE_ERROR");
        const raw = cause instanceof Error ? cause.message : String(cause || "");
        const isNetwork = /failed to fetch|networkerror|load failed/i.test(raw);
        setError(
          isNetwork
            ? "Unable to connect to the transcription server. Please check your connection or type your answer below."
            : cause instanceof Error
            ? cause.message
            : "The completed recording could not be transcribed. You can retry transcription or type your answer below."
        );
      }
    } finally {
      transcribingAudioRef.current = false;
    }
  }

  const startSpeechEngine = useCallback(() => {
    if (abortCapture.current || stopping.current || !isRecordingRef.current) return;
    const Speech = browserSpeech();
    if (!Speech) return;

    if (recognition.current) {
      const old = recognition.current;
      old.onresult = null;
      old.onerror = null;
      old.onend = null;
      old.onstart = null;
      try { old.abort(); } catch {}
      recognition.current = null;
    }

    try {
      const r = new Speech();
      recognition.current = r;
      const userLang = session?.speech_language || (typeof navigator !== "undefined" ? navigator.language : "en-IN") || "en-IN";
      r.lang = userLang.startsWith("hi") ? "hi-IN" : (userLang.includes("IN") ? "en-IN" : "en-US");
      r.continuous = true;
      r.interimResults = true;

      r.onresult = (event: any) => {
        if (abortCapture.current || stopping.current || !isRecordingRef.current) return;
        let interim = "";
        let finalChunk = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          const transcript = item[0]?.transcript || "";
          if (item.isFinal) {
            finalChunk += `${transcript} `;
          } else {
            interim += `${transcript} `;
          }
        }

        finalChunk = finalChunk.trim();
        interim = interim.trim();

        if (finalChunk) {
          const base = committedTextRef.current.trim();
          committedTextRef.current = base ? `${base} ${finalChunk}` : finalChunk;
        }

        const currentCommitted = committedTextRef.current.trim();
        const display = interim
          ? (currentCommitted ? `${currentCommitted} ${interim}` : interim)
          : currentCommitted;

        finalText.current = currentCommitted;
        latestRecognizedText.current = display;

        setPartial(display);
        setTranscriptDraft(display);
      };

      r.onerror = (event: any) => {
        if (abortCapture.current || stopping.current) return;
        const err = event?.error;
        if (err === "no-speech") {
          // Normal silence; browser will fire onend next, which will auto-restart
          return;
        }
        if (err === "aborted") {
          return;
        }
        if (err === "not-allowed" || err === "service-not-allowed") {
          setError("Microphone permission was denied. Please allow microphone in your browser URL bar or use Type mode.");
          stopListening();
          return;
        }
        if (err === "network") {
          console.warn("SpeechRecognition network warning, parallel audio recording is active");
          setError("Speech recognition service network warning. Background audio recording is active and will transcribe upon stopping.");
          return;
        }
        console.warn("Speech recognition warning:", err);
      };

      r.onend = () => {
        // If the user hasn't clicked "Stop" yet and the browser auto-stops recognition due to silence,
        // automatically restart recognition.start() inside a try/catch block.
        if (abortCapture.current || stopping.current || !isRecordingRef.current) return;

        if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current);
        restartTimerRef.current = window.setTimeout(() => {
          if (!abortCapture.current && !stopping.current && isRecordingRef.current) {
            try {
              if (recognition.current) {
                recognition.current.start();
              } else {
                startSpeechEngine();
              }
            } catch (startErr) {
              console.warn("Auto-restart recognition attempt caught:", startErr);
              try {
                startSpeechEngine();
              } catch (recreateErr) {
                console.warn("Re-create recognition caught:", recreateErr);
              }
            }
          }
        }, 100);
      };

      r.start();
    } catch (speechErr) {
      console.warn("Web Speech start failed:", speechErr);
      if (isRecordingRef.current && !stopping.current && !abortCapture.current) {
        if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current);
        restartTimerRef.current = window.setTimeout(() => {
          if (isRecordingRef.current && !stopping.current && !abortCapture.current) {
            startSpeechEngine();
          }
        }, 200);
      }
    }
  }, [session?.speech_language]);

  const restartSpeechEngine = useCallback((baseText: string) => {
    if (abortCapture.current || stopping.current || !isRecordingRef.current) return;
    cleanupSpeechEngine();
    committedTextRef.current = baseText;
    baseTranscript.current = baseText;
    finalText.current = baseText;
    latestRecognizedText.current = baseText;
    startSpeechEngine();
  }, [cleanupSpeechEngine, startSpeechEngine]);

  async function startListening() {
    if (!session || !current || busy || remaining <= 0) return;
    abortCapture.current = false;
    stopping.current = false;
    isRecordingRef.current = true;
    setError("");
    const existing = (transcriptDraft || partial || latestRecognizedText.current || finalText.current).trim();
    committedTextRef.current = existing;
    baseTranscript.current = existing;
    finalText.current = existing;
    latestRecognizedText.current = existing;
    setPartial(existing);
    setCapturedAudio(null);
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
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (constraintErr) {
        console.warn("Advanced mic constraints rejected, retrying with simple audio:", constraintErr);
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      streamRef.current = micStream;
      listeningStartedAt.current = Date.now();
    } catch (micErr) {
      setBusy(false);
      isRecordingRef.current = false;
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
    setBusy(false);
    setPhase("LISTENING");
    startSpeechEngine();

    answerTimeout.current = window.setTimeout(() => {
      if (phaseRef.current === "LISTENING") {
        setError("Answer capture limit reached. Processing captured speech.");
        stopListening();
      }
    }, 180000);
  }

  function stopListening() {
    isRecordingRef.current = false;
    const durationMs = listeningStartedAt.current ? Date.now() - listeningStartedAt.current : 0;
    listeningStartedAt.current = 0;
    if (phaseRef.current !== "LISTENING") return;
    if (answerTimeout.current) window.clearTimeout(answerTimeout.current);
    answerTimeout.current = null;
    if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current);
    restartTimerRef.current = null;
    if (typingRestartTimerRef.current) window.clearTimeout(typingRestartTimerRef.current);
    typingRestartTimerRef.current = null;

    setBusy(true);
    stopping.current = true;
    setPhase("PROCESSING_ANSWER");

    cleanupSpeechEngine();

    const liveText = (
      committedTextRef.current.trim() ||
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
        cleanupRecorder();
        stopTracks();

        const liveTrimmed = liveText.trim();
        const words = liveTrimmed ? liveTrimmed.split(/\s+/).filter(Boolean).length : 0;

        // Fallback Audio Transcription:
        // If the real-time transcript is empty or incomplete, send the audio blob to backend
        const realtimeIncomplete = words < 2 && audioBlob.size > 500 && durationMs >= 1500;
        const noRealtimeText = words === 0;

        if ((realtimeIncomplete || noRealtimeText) && audioBlob.size > 200) {
          setCapturedAudio(audioBlob);
          void transcribeCapturedAudio(audioBlob, liveTrimmed);
          return;
        }

        if (liveTrimmed.length >= 1) {
          setTranscriptDraft(liveTrimmed);
          setPartial(liveTrimmed);
          committedTextRef.current = liveTrimmed;
          finalText.current = liveTrimmed;
          latestRecognizedText.current = liveTrimmed;
          if (audioBlob.size > 200) {
            setCapturedAudio(audioBlob);
          }
          setBusy(false);
          setPhase("READY");
          return;
        }

        if (audioBlob.size > 200) {
          setCapturedAudio(audioBlob);
          void transcribeCapturedAudio(audioBlob, "");
          return;
        }

        setBusy(false);
        setPhase("READY");
        setError(
          "No speech was detected from your microphone. Please check your mic connection or type your answer directly in the box below."
        );
      };

      try {
        recorder.current.requestData();
      } catch {}
      try {
        recorder.current.stop();
      } catch {
        cleanupRecorder();
        stopTracks();
        if (liveText) {
          setTranscriptDraft(liveText);
          setPartial(liveText);
          committedTextRef.current = liveText;
          setBusy(false);
          setPhase("READY");
        }
      }
      return;
    }

    cleanupRecorder();
    stopTracks();
    if (liveText) {
      setTranscriptDraft(liveText);
      setPartial(liveText);
      committedTextRef.current = liveText;
      setBusy(false);
      setPhase("READY");
      return;
    }

    setBusy(false);
    setPhase("READY");
    setError("No speech was detected from your microphone. You can type your answer in the box below and click 'Submit answer'.");
  }
  stopListeningRef.current = stopListening;

  function handleReRecord() {
    if (busy || remaining <= 0) return;
    isRecordingRef.current = false;
    stopping.current = true;
    if (answerTimeout.current) window.clearTimeout(answerTimeout.current);
    answerTimeout.current = null;
    if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current);
    restartTimerRef.current = null;
    if (typingRestartTimerRef.current) window.clearTimeout(typingRestartTimerRef.current);
    typingRestartTimerRef.current = null;

    cleanupSpeechEngine();
    cleanupRecorder();
    stopTracks();

    setTranscriptDraft("");
    setPartial("");
    committedTextRef.current = "";
    finalText.current = "";
    latestRecognizedText.current = "";
    baseTranscript.current = "";
    setCapturedAudio(null);
    setError("");

    if (session?.id && current?.id) {
      if (session.owner_id) {
        safeStorage.removeItem(
          `live_draft_${session.owner_id}_${session.id}_${current.id}`
        );
      }
      safeStorage.removeItem(`live_draft_${session.id}_${current.id}`);
    }

    stopping.current = false;
    void startListening();
  }
  async function continueSaved() {
    if (!current?.transcript) return;
    setError("");
    setBusy(true);
    setPhase("EVALUATING");
    try {
      let evaluated = current;
      if (current.evaluation_status !== "completed" || !current.evaluation) {
        try {
          const result = await evaluate.mutateAsync({
            sessionId: id,
            turnId: current.id,
          });
          evaluated = {
            ...current,
            evaluation: result,
            evaluation_status: "completed",
          };
          setTurns(old => old.map(t => (t.id === current.id ? evaluated : t)));
        } catch (evalErr) {
          console.warn("[LiveInterview] Continue evaluation background warning:", evalErr);
          // If evaluation is temporarily unavailable, do not trap the user—proceed to the next question
        }
      }
      setError("");
      await beginAdaptiveTurn(evaluated);
    } catch (cause) {
      setPhase("RECOVERABLE_ERROR");
      const raw = cause instanceof Error ? cause.message : String(cause || "");
      const isNetwork = /failed to fetch|networkerror|load failed/i.test(raw);
      setError(
        isNetwork
          ? "Unable to connect to the interview server. Please check your connection and retry."
          : cause instanceof Error
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
  if (session.status === "abandoned")
    return (
      <div className="center-screen">
        <h2>Live Interview ended</h2>
        <p style={{ margin: "12px 0 20px" }}>This interview session was abandoned.</p>
        <Link className="button button-primary" href="/live-interview">
          Back to Live Interview <ArrowRight size={15} />
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
          <button
            className="button button-danger"
            disabled={phase === "FINALIZING"}
            onClick={() => setEndConfirmOpen(true)}
          >
            End interview
          </button>
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
                            : "rgba(255, 255, 255, 0.08)",
                        color:
                          answerMode === "type"
                            ? "#fff"
                            : "#e2e8f0",
                      }}
                      onClick={() => {
                        if (phaseRef.current === "LISTENING") {
                          stopListening();
                        } else {
                          cleanupSpeechEngine();
                          cleanupRecorder();
                          stopTracks();
                        }
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
                            : "rgba(255, 255, 255, 0.08)",
                        color:
                          answerMode === "speak"
                            ? "#fff"
                            : "#e2e8f0",
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
                    color: "#cbd5e1",
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
                    justifyContent: "space-between",
                    gap: "10px",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    background: "rgba(239, 68, 68, 0.08)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    marginBottom: "10px",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      color: "#f87171",
                      fontWeight: 700,
                      fontSize: "0.84rem",
                    }}
                  >
                    <span
                      style={{
                        width: "10px",
                        height: "10px",
                        borderRadius: "50%",
                        background: "#ef4444",
                        display: "inline-block",
                        boxShadow: "0 0 8px #ef4444",
                      }}
                    />
                    Listening to microphone:
                  </span>
                  <div
                    style={{
                      flex: 1,
                      maxWidth: "200px",
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
                  const newText = e.target.value;
                  setError("");
                  setTranscriptDraft(newText);
                  setPartial(newText);
                  committedTextRef.current = newText;
                  finalText.current = newText;
                  latestRecognizedText.current = newText;
                  baseTranscript.current = newText;

                  if (phaseRef.current === "LISTENING") {
                    if (typingRestartTimerRef.current) {
                      window.clearTimeout(typingRestartTimerRef.current);
                    }
                    if (recognition.current) {
                      recognition.current.onresult = null;
                    }
                    typingRestartTimerRef.current = window.setTimeout(() => {
                      if (phaseRef.current === "LISTENING" && !stopping.current && !abortCapture.current) {
                        restartSpeechEngine(newText);
                      }
                    }, 300);
                  }
                }}
                placeholder={
                  answerMode === "type"
                    ? "Type or paste your answer here in detail..."
                    : "Click 'Start recording' below or type your answer here..."
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
                <div style={{ fontSize: "0.78rem", color: "#94a3b8", fontWeight: 500 }}>
                  {(() => {
                    const txt = (transcriptDraft || partial).trim();
                    const words = txt ? txt.split(/\s+/).length : 0;
                    return `${words} words · ${txt.length} characters`;
                  })()}
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                  {answerMode === "speak" && phase === "LISTENING" && (
                    <button
                      type="button"
                      className="button button-danger"
                      onClick={stopListening}
                      disabled={busy}
                    >
                      <Square size={14} /> Stop recording
                    </button>
                  )}
                  {answerMode === "speak" && phase !== "LISTENING" && (
                    <>
                      <button
                        type="button"
                        className="button button-primary"
                        onClick={() => void startListening()}
                        disabled={
                          busy ||
                          questionAudioPending ||
                          phase === "ASKING" ||
                          !current ||
                          remaining <= 0
                        }
                      >
                        <Mic size={14} /> {(transcriptDraft.trim() || partial.trim()) ? "Resume recording" : "Start recording"}
                      </button>
                      {(transcriptDraft.trim() || partial.trim()) && (
                        <button
                          type="button"
                          className="button button-secondary"
                          onClick={() => void handleReRecord()}
                          disabled={
                            busy ||
                            phase === "PROCESSING_ANSWER" ||
                            phase === "EVALUATING" ||
                            !current ||
                            remaining <= 0
                          }
                        >
                          <RotateCcw size={14} /> Re-record
                        </button>
                      )}
                    </>
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
          {current?.transcript && phase !== "RECOVERABLE_ERROR" && (
            <button
              className="button button-secondary live-continue-button"
              onClick={() => void continueSaved()}
              disabled={busy}
            >
              {current.evaluation_status === "completed"
                ? "Continue interview"
                : "Continue to next question"}
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
                  Continue to next question
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
              {phase === "RECOVERABLE_ERROR" && (
                <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => void finalizeSession("manual")}
                    disabled={busy}
                  >
                    Retry finalization
                  </button>
                  <button
                    type="button"
                    className="button button-danger"
                    onClick={async () => {
                      try {
                        await forceEnd.mutateAsync({ id });
                        navigate("/live-interview");
                      } catch {
                        setError("Could not force end the session. Try again.");
                      }
                    }}
                    disabled={busy || forceEnd.isPending}
                  >
                    {forceEnd.isPending ? "Ending…" : "Force End / Abandon Session"}
                  </button>
                </div>
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
              <span
                className="live-microphone-status"
                role="status"
                aria-live="polite"
              >
                {phase === "LISTENING"
                  ? "Microphone active · speak your answer, then click Stop recording or Submit"
                  : (transcriptDraft.trim() || partial.trim())
                    ? "Review and edit your transcribed answer above before submitting"
                    : questionAudioPending
                      ? "Question audio is starting"
                      : phase === "PROCESSING_ANSWER" || phase === "EVALUATING"
                        ? "Processing your answer..."
                        : "Voice mode active · click Start recording to answer"}
              </span>
              <button
                type="button"
                className="button button-secondary"
                style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: "6px" }}
                onClick={() => {
                  if (phaseRef.current === "LISTENING") {
                    stopListening();
                  } else {
                    cleanupSpeechEngine();
                    cleanupRecorder();
                    stopTracks();
                  }
                  setAnswerMode("type");
                  safeStorage.setItem("live_interview_mode", "type");
                }}
              >
                <Keyboard size={14} /> Switch to Type mode
              </button>
            </>
          ) : (
            <>
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
