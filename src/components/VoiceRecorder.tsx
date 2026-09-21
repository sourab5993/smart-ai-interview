import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Mic, Square, RefreshCw, Type, Sparkles, AlertCircle, Globe, CheckCircle2, Wand2, Info } from 'lucide-react';
import { formatTimer, countWords } from '../utils/uiHelpers';

interface VoiceRecorderProps {
  onTranscriptChange: (text: string) => void;
  onSubmitAnswer: (text: string, mode: 'voice' | 'text') => void;
  disabled?: boolean;
  isSubmitting?: boolean;
  initialText?: string;
  language?: 'English' | 'Hindi' | 'Hinglish';
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onTranscriptChange,
  onSubmitAnswer,
  disabled = false,
  isSubmitting = false,
  initialText = '',
  language = 'English',
}) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>(initialText);
  const [mode, setMode] = useState<'voice' | 'text'>('voice');
  const [speechSupported, setSpeechSupported] = useState<boolean>(true);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [audioLevels, setAudioLevels] = useState<number[]>([15, 25, 45, 60, 30, 20, 50, 70, 40, 25, 15, 30, 60, 45, 20, 25]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAiTranscribing, setIsAiTranscribing] = useState<boolean>(false);
  const [hasRecordedAudio, setHasRecordedAudio] = useState<boolean>(false);
  const [interimLiveText, setInterimLiveText] = useState<string>('');

  // Default to en-IN (Hinglish/Indian English) as it understands both Indian English and Hindi terms, or hi-IN for pure Hindi
  const defaultLangCode = language === 'Hindi' ? 'hi-IN' : 'en-IN';
  const [speechLang, setSpeechLang] = useState<string>(defaultLangCode);

  // Refs for persistent state across recognition restarts
  const speechLangRef = useRef<string>(defaultLangCode);
  const isRecordingRef = useRef<boolean>(false);
  const recognitionRef = useRef<any>(null);
  const restartTimeoutRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  // Transcription buffer management with official resultIndex offset
  const finalTranscriptRef = useRef<string>(initialText);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Web Audio Context waveform visualizer
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Audio recording buffer for AI Transcribe Fallback (MediaRecorder)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const lastRecordedBlobRef = useRef<Blob | null>(null);

  // Sync initialText changes
  useEffect(() => {
    if (initialText && !transcript) {
      setTranscript(initialText);
      finalTranscriptRef.current = initialText;
    }
  }, [initialText]);

  // Keep speechLangRef in sync
  useEffect(() => {
    speechLangRef.current = speechLang;
  }, [speechLang]);

  // Update recognition language when prop changes
  useEffect(() => {
    const code = language === 'Hindi' ? 'hi-IN' : 'en-IN';
    setSpeechLang(code);
    speechLangRef.current = code;
  }, [language]);

  // Keep isRecordingRef in sync with state
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // Check browser SpeechRecognition support
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
    }
  }, []);

  // Recording Timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecordingSession();
    };
  }, []);

  // Initialize a fresh Web Speech API recognition instance
  const startSpeechRecognitionInstance = (langCode: string) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
        recognitionRef.current = null;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = langCode;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          const textPiece = res[0]?.transcript || '';
          if (res.isFinal) {
            const trimmedPiece = textPiece.trim();
            if (trimmedPiece) {
              const currentFinal = finalTranscriptRef.current.trim();
              finalTranscriptRef.current = currentFinal ? `${currentFinal} ${trimmedPiece}` : trimmedPiece;
            }
          } else {
            interim += textPiece;
          }
        }

        const currentFinal = finalTranscriptRef.current.trim();
        const combined = (currentFinal + (interim ? (currentFinal ? ' ' : '') + interim.trim() : '')).trim();

        setTranscript(combined);
        onTranscriptChange(combined);
        setInterimLiveText(interim.trim());
        setErrorMessage(null);

        // Auto-scroll textarea as candidate speaks
        if (textareaRef.current) {
          textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('SpeechRecognition warning:', event.error);
        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          setErrorMessage('Microphone access blocked. Click the lock/microphone icon in the browser address bar to allow microphone.');
          stopRecordingSession();
        } else if (event.error === 'audio-capture') {
          setErrorMessage('Microphone not detected or in use by another app. Audio fallback will capture voice.');
        } else if (event.error === 'network') {
          setErrorMessage('Browser speech recognition network delay. Audio is recorded for Gemini AI transcription.');
        }
        // If error is 'no-speech' or 'aborted', do NOT cancel recording; onend will restart cleanly
      };

      recognition.onend = () => {
        setInterimLiveText('');
        // Seamless auto-restart: if user is still in recording mode, instantiate fresh instance
        if (isRecordingRef.current) {
          if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
          restartTimeoutRef.current = setTimeout(() => {
            if (isRecordingRef.current) {
              startSpeechRecognitionInstance(speechLangRef.current);
            }
          }, 80);
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (e: any) {
      console.warn('Recognition start error:', e?.message || e);
    }
  };

  // Dynamic animated sound wave visualizer responding to voice activity
  const startSimulatedWaveform = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    let step = 0;
    const updateSimulated = () => {
      if (!isRecordingRef.current) return;
      step += 0.12;
      const baseEnergy = interimLiveText ? 68 : 38;
      const sampled: number[] = [];
      for (let i = 0; i < 16; i++) {
        const wave1 = Math.sin(step + i * 0.5) * 26;
        const wave2 = Math.cos(step * 1.4 + i * 0.35) * 14;
        const height = Math.max(16, Math.min(98, Math.round(baseEnergy + wave1 + wave2)));
        sampled.push(height);
      }
      setAudioLevels(sampled);
      animFrameRef.current = requestAnimationFrame(updateSimulated);
    };
    updateSimulated();
  };

  // Audio Context waveform visualizer & MediaRecorder setup
  const startAudioCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 1. Audio Visualizer Setup
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        analyserRef.current = analyser;

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const updateWaveform = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          const sampled: number[] = [];
          const step = Math.floor(bufferLength / 16) || 1;
          for (let i = 0; i < 16; i++) {
            const val = dataArray[i * step] || 0;
            sampled.push(Math.max(12, Math.min(100, Math.round((val / 255) * 100))));
          }
          setAudioLevels(sampled);
          animFrameRef.current = requestAnimationFrame(updateWaveform);
        };
        updateWaveform();
      } catch (acErr) {
        console.warn('AudioContext visualization setup note:', acErr);
      }

      // 2. Parallel MediaRecorder for AI Audio Transcription Backup
      if (typeof MediaRecorder !== 'undefined') {
        audioChunksRef.current = [];
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/ogg';

        const mediaRecorder = new MediaRecorder(stream, { mimeType });
        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };
        mediaRecorder.start(250);
        mediaRecorderRef.current = mediaRecorder;
      }
    } catch (err: any) {
      console.warn('Microphone stream setup warning:', err);
      // Fallback animated waveform if getUserMedia had permission delay
      const mockInterval = setInterval(() => {
        setAudioLevels(Array.from({ length: 16 }, () => Math.floor(Math.random() * 60) + 15));
      }, 120);
      (window as any).__mockWaveform = mockInterval;
    }
  };

  // Stop media recorder safely and return the captured audio Blob
  const stopAudioCapture = async (): Promise<Blob | null> => {
    return new Promise<Blob | null>((resolve) => {
      const recorder = mediaRecorderRef.current;

      const finishCleanup = (blob: Blob | null) => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        if ((window as any).__mockWaveform) clearInterval((window as any).__mockWaveform);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(() => {});
          audioContextRef.current = null;
        }
        if (blob) {
          lastRecordedBlobRef.current = blob;
          setHasRecordedAudio(true);
        }
        resolve(blob);
      };

      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = () => {
          let fullBlob: Blob | null = null;
          if (audioChunksRef.current.length > 0) {
            const rawMime = recorder.mimeType || 'audio/webm';
            fullBlob = new Blob(audioChunksRef.current, { type: rawMime });
          }
          finishCleanup(fullBlob);
        };
        try {
          recorder.stop();
        } catch {
          finishCleanup(lastRecordedBlobRef.current);
        }
      } else {
        finishCleanup(lastRecordedBlobRef.current);
      }
    });
  };

  const stopRecordingSession = () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if ((window as any).__mockWaveform) clearInterval((window as any).__mockWaveform);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  };

  const handleStartRecording = async () => {
    if (disabled || isSubmitting) return;

    // Stop AI speech synthesis immediately so it doesn't get picked up by mic
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    setErrorMessage(null);
    setIsRecording(true);
    isRecordingRef.current = true;
    setRecordingSeconds(0);

    // Sync final transcript with current textarea text
    finalTranscriptRef.current = transcript.trim();
    setInterimLiveText('');

    // 1. If Web Speech is supported (Chrome/Edge), give it 100% exclusive mic access (avoids hardware audio distortion)
    if (speechSupported) {
      startSpeechRecognitionInstance(speechLangRef.current);
      startSimulatedWaveform();
    } else {
      // 2. Fallback for browsers without Web Speech (Brave, Firefox): record via MediaRecorder for Gemini AI
      await startAudioCapture();
    }
  };

  const handleStopRecording = async () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    setInterimLiveText('');
    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    // Await audio recorder stop to collect full audio blob if MediaRecorder was used
    if (!speechSupported) {
      const recordedBlob = await stopAudioCapture();
      if (recordedBlob && recordedBlob.size > 200) {
        await transcribeBlobWithAI(recordedBlob);
      }
    } else if (streamRef.current) {
      await stopAudioCapture();
    }
  };

  // Send recorded audio Blob to backend Gemini AI transcription endpoint
  const transcribeBlobWithAI = async (blob: Blob) => {
    setIsAiTranscribing(true);
    setErrorMessage(null);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64 = result.includes(';base64,') ? result.split(';base64,')[1] : result;
          resolve(base64);
        };
        reader.onerror = reject;
      });

      reader.readAsDataURL(blob);
      const audioBase64 = await base64Promise;

      if (!audioBase64 || audioBase64.length < 50) {
        setIsAiTranscribing(false);
        return;
      }

      const res = await fetch('/api/ai/transcribe-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64,
          mimeType: blob.type || 'audio/webm',
          language,
        }),
      });

      const data = await res.json();
      if (data.success && data.text) {
        const aiTranscribed = data.text.trim();
        finalTranscriptRef.current = aiTranscribed;
        setTranscript(aiTranscribed);
        setInterimLiveText('');
        onTranscriptChange(aiTranscribed);
      } else if (data.error) {
        setErrorMessage(`Gemini AI Transcription: ${data.error}`);
      }
    } catch (err: any) {
      console.warn('AI Audio Transcribe error:', err);
      setErrorMessage('Audio transcription error. You can also type your answer directly.');
    } finally {
      setIsAiTranscribing(false);
    }
  };

  const handleLanguageChange = (newLang: string) => {
    setSpeechLang(newLang);
    speechLangRef.current = newLang;

    // If currently recording, seamlessly switch language on the fly!
    if (isRecordingRef.current && recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      // onend will automatically restart with speechLangRef.current
    }
  };

  const handleClear = () => {
    stopRecordingSession();
    finalTranscriptRef.current = '';
    setTranscript('');
    setInterimLiveText('');
    onTranscriptChange('');
    setRecordingSeconds(0);
    audioChunksRef.current = [];
    lastRecordedBlobRef.current = null;
    setHasRecordedAudio(false);
    setErrorMessage(null);
  };

  const handleSubmit = () => {
    if (isRecording) {
      stopRecordingSession();
    }
    if (!transcript.trim()) return;
    onSubmitAnswer(transcript, mode);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    finalTranscriptRef.current = val;
    setTranscript(val);
    onTranscriptChange(val);
  };

  const wordCount = countWords(transcript);

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl backdrop-blur-md" id="voice-recorder">
      {/* Header: Mode & Language Selectors */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${isRecording ? 'bg-rose-500 animate-ping' : isAiTranscribing ? 'bg-amber-400 animate-spin' : 'bg-cyan-400 animate-pulse'}`} />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            {isRecording
              ? 'Listening & Transcribing Voice Live'
              : isAiTranscribing
              ? 'Converting Voice to Text with Gemini AI...'
              : 'Candidate Response Engine'}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Speech Language Switcher */}
          {mode === 'voice' && (
            <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl text-[11px]">
              <Globe className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
              <button
                type="button"
                onClick={() => handleLanguageChange('en-IN')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer font-medium ${
                  speechLang === 'en-IN' ? 'bg-cyan-500/25 text-cyan-300 font-bold border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Best for Indian English & mixed technical Hinglish terms"
              >
                🇮🇳 Hinglish / En (IN)
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange('hi-IN')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer font-medium ${
                  speechLang === 'hi-IN' ? 'bg-cyan-500/25 text-cyan-300 font-bold border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Hindi speech recognition"
              >
                🇮🇳 हिंदी (Hindi)
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange('en-US')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer font-medium ${
                  speechLang === 'en-US' ? 'bg-cyan-500/25 text-cyan-300 font-bold border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Standard US English"
              >
                🇺🇸 English (US)
              </button>
            </div>
          )}

          {/* Mode Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 border border-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setMode('voice')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                mode === 'voice'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              id="btn-mode-voice"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Voice Answer</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (isRecording) stopRecordingSession();
                setMode('text');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                mode === 'text'
                  ? 'bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow-md shadow-violet-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              id="btn-mode-text"
            >
              <Type className="w-3.5 h-3.5" />
              <span>Text Answer</span>
            </button>
          </div>
        </div>
      </div>

      {/* Browser Speech Recognition Notice (e.g. Brave/Firefox) */}
      {!speechSupported && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs">
          <Info className="w-4 h-4 flex-shrink-0" />
          <span>
            <strong>Gemini AI Voice Mode Active:</strong> Your browser routes audio directly to Google Gemini AI neural transcriber upon stopping speech.
          </span>
        </div>
      )}

      {/* Error Alert Banner */}
      {errorMessage && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Voice Mode Visualizer & Controls */}
      {mode === 'voice' && (
        <div className="mb-4">
          {/* Audio Waveform Display */}
          <div className="relative h-20 bg-slate-950/70 border border-slate-800/80 rounded-xl flex items-center justify-center px-4 overflow-hidden">
            {isRecording ? (
              <div className="flex items-center justify-center gap-1.5 w-full max-w-md h-full py-2">
                {audioLevels.map((lvl, idx) => (
                  <div
                    key={idx}
                    className="flex-1 bg-gradient-to-t from-cyan-400 via-blue-500 to-violet-400 rounded-full min-h-[6px] transition-all duration-75 ease-out shadow-sm shadow-cyan-500/20"
                    style={{ height: `${lvl}%` }}
                  />
                ))}
              </div>
            ) : isAiTranscribing ? (
              <div className="flex items-center gap-3 text-amber-400 text-xs font-medium">
                <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                <span>Transcribing audio with Gemini AI neural engine...</span>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-slate-500 text-xs">
                <Mic className="w-4 h-4 text-slate-600 animate-pulse" />
                <span>Click &quot;Start Speaking (Voice)&quot; — speak naturally, speech converts to text in real-time</span>
              </div>
            )}

            {isRecording && (
              <div className="absolute top-2.5 right-3 flex items-center gap-2 px-2.5 py-1 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-mono font-bold animate-pulse">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>LISTENING {formatTimer(recordingSeconds)}</span>
              </div>
            )}

            {isRecording && interimLiveText && (
              <div className="absolute bottom-2 left-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-950/90 border border-cyan-500/40 text-cyan-200 text-xs shadow-md animate-pulse">
                <span className="shrink-0 font-bold text-cyan-400">🎙️ Speaking now:</span>
                <span className="italic truncate text-slate-100">&quot;{interimLiveText}&quot;</span>
              </div>
            )}
          </div>

          {/* Voice Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
            <div className="flex items-center gap-2">
              {!isRecording ? (
                <button
                  type="button"
                  onClick={handleStartRecording}
                  disabled={disabled || isSubmitting || isAiTranscribing}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-cyan-500/25 transition-all transform active:scale-95 disabled:opacity-50 cursor-pointer"
                  id="btn-start-record"
                >
                  <Mic className="w-4 h-4" />
                  <span>Start Speaking (Voice)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStopRecording}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-rose-500/25 transition-all transform active:scale-95 cursor-pointer"
                  id="btn-stop-record"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>Stop Speaking</span>
                </button>
              )}

              {/* AI Transcribe Fallback Button */}
              {hasRecordedAudio && lastRecordedBlobRef.current && !isRecording && (
                <button
                  type="button"
                  onClick={() => lastRecordedBlobRef.current && transcribeBlobWithAI(lastRecordedBlobRef.current)}
                  disabled={isAiTranscribing || isSubmitting}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 text-xs font-medium transition-colors cursor-pointer"
                  title="Re-transcribe recorded audio with Gemini AI neural engine"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>{isAiTranscribing ? 'Transcribing...' : 'AI Audio Transcribe'}</span>
                </button>
              )}

              {transcript && (
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={isSubmitting || isRecording}
                  title="Clear Answer"
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
                  id="btn-clear-transcript"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400">
              {isRecording && (
                <span className="flex items-center gap-1.5 text-cyan-400 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  Live Speech-to-Text Active
                </span>
              )}
              <span className="font-mono">{wordCount} words</span>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Transcribed Textarea */}
      <div className="relative">
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-medium text-slate-400">
            {mode === 'voice' ? 'Live Transcribed Speech (Editable in Real-Time):' : 'Type Your Comprehensive Answer:'}
          </label>
          {transcript && (
            <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3 h-3" />
              <span>Captured ({wordCount} words)</span>
            </span>
          )}
        </div>
        <textarea
          ref={textareaRef}
          rows={5}
          value={transcript}
          onChange={handleTextareaChange}
          disabled={disabled || isSubmitting}
          placeholder={
            mode === 'voice'
              ? 'Click "Start Speaking (Voice)" and speak into your microphone. Your words will appear here in real time. You can edit any word before submitting.'
              : 'Structure your answer clearly: Explain the core concept, implementation details, tradeoffs, and edge cases...'
          }
          className={`w-full bg-slate-950/80 border ${
            isRecording
              ? 'border-cyan-500/60 ring-2 ring-cyan-500/20'
              : 'border-slate-800 focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20'
          } rounded-xl p-3.5 text-sm text-slate-100 placeholder-slate-600 outline-none transition-all resize-y font-sans leading-relaxed`}
          id="textarea-user-answer"
        />
      </div>

      {/* Submit Action Bar */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800/80">
        <div className="text-xs text-slate-500 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Real-time voice STT with multi-dimensional rubric evaluation</span>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!transcript.trim() || isSubmitting || disabled || isAiTranscribing}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-emerald-500/25 transition-all transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          id="btn-submit-answer"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              <span>Evaluating with AI...</span>
            </>
          ) : (
            <>
              <span>Submit Answer</span>
              <Sparkles className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
