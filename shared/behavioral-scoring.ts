export type BehavioralFrame = {
  timestampMs: number;
  faceCount: number;
  faceVisible: boolean;
  gaze: "camera" | "away" | "unavailable";
  blink: boolean | null;
  yaw: number | null;
  pitch: number | null;
  roll: number | null;
  poseVisible: boolean;
  torsoMovement: number | null;
  handsVisible: number;
  handMovement: number | null;
  lightingOk: boolean | null;
  trackingReliable: boolean;
};

export type SpeechMeasurement = {
  durationSeconds: number;
  transcriptAvailable: boolean;
  transcriptConfidence: number | null;
  pauseCount?: number | null;
  speakingRateWpm?: number | null;
};

export type BehavioralCategory = {
  key: "gaze" | "head" | "movement" | "camera" | "speech";
  label: string;
  score: number | null;
  coverage: number;
  reliability: number;
  available: boolean;
  explanation: string;
};

export type BehavioralSummary = {
  categories: BehavioralCategory[];
  behavioralScore: number | null;
  coverage: number;
  reliability: number;
  insufficientData: boolean;
  sampleAdequacy: {
    observedFrames: number;
    reliableFrames: number;
    observedDurationSeconds: number;
    minimumReliableFrames: number;
    minimumDurationSeconds: number;
    sufficient: boolean;
    reason: string | null;
  };
  eyeGaze: {
    cameraDirectedSeconds: number;
    awaySeconds: number;
    unavailableSeconds: number;
    changes: number;
  };
  head: {
    meanYaw: number | null;
    meanPitch: number | null;
    meanRoll: number | null;
    yawRange: number | null;
    pitchRange: number | null;
    rollRange: number | null;
    stableSeconds: number;
  };
  movement: {
    poseCoverage: number;
    handCoverage: number;
    handMovementFrequency: number;
    torsoMovementAmplitude: number | null;
  };
  camera: {
    faceVisiblePercentage: number;
    multipleFaceEvents: Array<{ timestampMs: number; durationSeconds: number }>;
    ambiguousTrackingSeconds: number;
    framingCoverage: number | null;
  };
  speech: SpeechMeasurement | null;
  events: Array<{ type: string; timestampMs: number; detail: string }>;
};

const WEIGHTS = {
  gaze: 0.25,
  head: 0.2,
  movement: 0.2,
  camera: 0.15,
  speech: 0.2,
} as const;

const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, value));
const mean = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const range = (values: number[]) =>
  values.length ? Math.max(...values) - Math.min(...values) : null;
const percent = (numerator: number, denominator: number) =>
  denominator > 0 ? clamp((numerator / denominator) * 100) : 0;
const MIN_RELIABLE_FRAMES = 8;
const MIN_RELIABLE_DURATION_SECONDS = 3.5;

function validFrames(frames: BehavioralFrame[]) {
  return frames.filter(frame => frame.trackingReliable && frame.faceVisible);
}

function buildMultipleFaceEvents(frames: BehavioralFrame[]) {
  const events: Array<{ timestampMs: number; durationSeconds: number }> = [];
  let active: { timestampMs: number; lastMs: number } | null = null;
  for (const frame of frames) {
    if (frame.faceCount > 1) {
      if (!active) active = { timestampMs: frame.timestampMs, lastMs: frame.timestampMs };
      else active.lastMs = frame.timestampMs;
    } else if (active) {
      events.push({
        timestampMs: active.timestampMs,
        durationSeconds: Math.max(0, (active.lastMs - active.timestampMs) / 1000),
      });
      active = null;
    }
  }
  if (active)
    events.push({
      timestampMs: active.timestampMs,
      durationSeconds: Math.max(0, (active.lastMs - active.timestampMs) / 1000),
    });
  return events;
}

export function aggregateBehavioralObservations(
  frames: BehavioralFrame[],
  speech: SpeechMeasurement | null = null
): BehavioralSummary {
  const ordered = frames.slice().sort((a, b) => a.timestampMs - b.timestampMs);
  const valid = validFrames(ordered);
  const total = ordered.length;
  const validCount = valid.length;
  const durationSeconds = total > 1
    ? Math.max(0, (ordered[ordered.length - 1].timestampMs - ordered[0].timestampMs) / 1000)
    : 0;
  const reliableDurationSeconds = valid.length > 1
    ? Math.max(0, (valid[valid.length - 1].timestampMs - valid[0].timestampMs) / 1000)
    : 0;
  const sampleSufficient = validCount >= MIN_RELIABLE_FRAMES && reliableDurationSeconds >= MIN_RELIABLE_DURATION_SECONDS;
  const stepSeconds = total > 1 ? durationSeconds / (total - 1) : 0;
  const cameraFrames = valid.filter(frame => frame.gaze === "camera").length;
  const awayFrames = valid.filter(frame => frame.gaze === "away").length;
  const unavailableFrames = Math.max(0, total - cameraFrames - awayFrames);
  const yaw = valid.map(frame => frame.yaw).filter((value): value is number => value !== null && Number.isFinite(value));
  const pitch = valid.map(frame => frame.pitch).filter((value): value is number => value !== null && Number.isFinite(value));
  const roll = valid.map(frame => frame.roll).filter((value): value is number => value !== null && Number.isFinite(value));
  const poseFrames = ordered.filter(frame => frame.poseVisible).length;
  const handFrames = ordered.filter(frame => frame.handsVisible > 0).length;
  const movements = ordered
    .map(frame => frame.handMovement)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const torso = ordered
    .map(frame => frame.torsoMovement)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const multipleFaceEvents = buildMultipleFaceEvents(ordered);
  const ambiguousTrackingSeconds = ordered.filter(frame => !frame.trackingReliable).length * stepSeconds;
  const events = multipleFaceEvents.map(event => ({
    type: "additional_visible_face",
    timestampMs: event.timestampMs,
    detail: `More than one visible face was detected for approximately ${event.durationSeconds.toFixed(1)} seconds. This is a factual camera event, not an identity or intent conclusion.`,
  }));
  let gazeChanges = 0;
  let priorGaze: BehavioralFrame["gaze"] | null = null;
  for (const frame of valid) {
    if (priorGaze && frame.gaze !== priorGaze) gazeChanges++;
    priorGaze = frame.gaze;
  }

  const categories: BehavioralCategory[] = [];
  const gazeCoverage = percent(valid.filter(frame => frame.gaze !== "unavailable").length, total);
  categories.push({
    key: "gaze",
    label: "Approximate camera-directed gaze",
    score: sampleSufficient && gazeCoverage >= 20 ? percent(cameraFrames, Math.max(1, cameraFrames + awayFrames)) : null,
    coverage: gazeCoverage,
    reliability: clamp(gazeCoverage * 0.85 * Math.min(1, validCount / MIN_RELIABLE_FRAMES, reliableDurationSeconds / MIN_RELIABLE_DURATION_SECONDS)),
    available: sampleSufficient && gazeCoverage >= 20,
    explanation: "Camera-relative gaze estimates use visible facial landmarks and are not a psychological or honesty measure.",
  });
  const headCoverage = percent(yaw.length + pitch.length + roll.length > 0 ? validCount : 0, total);
  const headRanges = [range(yaw), range(pitch), range(roll)].filter((value): value is number => value !== null);
  const movementNoise = headRanges.length ? Math.max(...headRanges) : null;
  categories.push({
    key: "head",
    label: "Head movement stability",
    score: sampleSufficient && headCoverage >= 20 && movementNoise !== null ? clamp(100 - Math.min(100, movementNoise * 1.4)) : null,
    coverage: headCoverage,
    reliability: clamp(headCoverage * 0.9 * Math.min(1, validCount / MIN_RELIABLE_FRAMES, reliableDurationSeconds / MIN_RELIABLE_DURATION_SECONDS)),
    available: sampleSufficient && headCoverage >= 20 && movementNoise !== null,
    explanation: "Head pose is normalized against the session camera view; coaching thresholds are configurable and not universal.",
  });
  const movementCoverage = percent(poseFrames + handFrames > 0 ? poseFrames + handFrames : 0, Math.max(1, total * 2));
  categories.push({
    key: "movement",
    label: "Upper-body and hand coverage",
    score: sampleSufficient && movementCoverage >= 20 ? clamp(100 - Math.min(100, (mean(movements) ?? 0) * 350)) : null,
    coverage: movementCoverage,
    reliability: clamp(movementCoverage * 0.8 * Math.min(1, validCount / MIN_RELIABLE_FRAMES, reliableDurationSeconds / MIN_RELIABLE_DURATION_SECONDS)),
    available: sampleSufficient && movementCoverage >= 20,
    explanation: "Movement metrics describe visible coverage and change; a lack of gestures is not treated as a negative trait.",
  });
  const cameraCoverage = percent(validCount, total);
  categories.push({
    key: "camera",
    label: "Visible-face coverage",
    score: sampleSufficient && cameraCoverage >= 20 ? cameraCoverage : null,
    coverage: cameraCoverage,
    reliability: clamp(cameraCoverage * Math.min(1, validCount / MIN_RELIABLE_FRAMES, reliableDurationSeconds / MIN_RELIABLE_DURATION_SECONDS)),
    available: sampleSufficient && cameraCoverage >= 20,
    explanation: "This is only the percentage of usable samples with a visible face. Additional-face events are factual and never reduce this measure; actual framing or lighting quality is not inferred.",
  });
  const hasSpeechMeasurement = Boolean(
    speech && ((speech.pauseCount != null && Number.isFinite(speech.pauseCount)) ||
      (speech.speakingRateWpm != null && Number.isFinite(speech.speakingRateWpm)))
  );
  const speechAvailable = Boolean(speech?.transcriptAvailable && Number.isFinite(speech.durationSeconds) && speech.durationSeconds > 0 && hasSpeechMeasurement);
  const speechCoverage = speechAvailable ? 100 : 0;
  categories.push({
    key: "speech",
    label: "Speech delivery and timing",
    score: speechAvailable
      ? clamp(70 + Math.min(20, (speech?.speakingRateWpm || 0) > 0 ? 10 : 0) - Math.min(15, (speech?.pauseCount || 0) * 1.5))
      : null,
    coverage: speechCoverage,
    reliability: speechAvailable && speech?.transcriptConfidence != null && Number.isFinite(speech.transcriptConfidence)
      ? clamp(speech.transcriptConfidence * 100)
      : 0,
    available: speechAvailable,
    explanation: "Speech timing uses the recorded answer and transcription metadata; pauses and accents are not competence judgments.",
  });

  const available = categories.filter(category => category.available && category.score !== null);
  const weightTotal = available.reduce((sum, category) => sum + WEIGHTS[category.key], 0);
  const behavioralScore = weightTotal >= 0.45
    ? Math.round(available.reduce((sum, category) => sum + (category.score || 0) * WEIGHTS[category.key], 0) / weightTotal)
    : null;
  const coverage = available.length
    ? Math.round(available.reduce((sum, category) => sum + category.coverage, 0) / categories.length)
    : 0;
  const reliability = available.length
    ? Math.round(available.reduce((sum, category) => sum + category.reliability, 0) / available.length)
    : 0;

  return {
    categories,
    behavioralScore,
    coverage,
    reliability,
    insufficientData: behavioralScore === null,
    sampleAdequacy: {
      observedFrames: total,
      reliableFrames: validCount,
      observedDurationSeconds: Math.round(reliableDurationSeconds * 10) / 10,
      minimumReliableFrames: MIN_RELIABLE_FRAMES,
      minimumDurationSeconds: MIN_RELIABLE_DURATION_SECONDS,
      sufficient: sampleSufficient,
      reason: sampleSufficient ? null : `At least ${MIN_RELIABLE_FRAMES} reliable face samples spanning ${MIN_RELIABLE_DURATION_SECONDS} seconds are required for camera-based scores.`,
    },
    eyeGaze: {
      cameraDirectedSeconds: cameraFrames * stepSeconds,
      awaySeconds: awayFrames * stepSeconds,
      unavailableSeconds: unavailableFrames * stepSeconds,
      changes: gazeChanges,
    },
    head: {
      meanYaw: mean(yaw),
      meanPitch: mean(pitch),
      meanRoll: mean(roll),
      yawRange: range(yaw),
      pitchRange: range(pitch),
      rollRange: range(roll),
      stableSeconds: valid.filter(frame => Math.abs(frame.yaw || 0) < 18).length * stepSeconds,
    },
    movement: {
      poseCoverage: percent(poseFrames, total),
      handCoverage: percent(handFrames, total),
      handMovementFrequency: movements.filter(value => value > 0.018).length,
      torsoMovementAmplitude: mean(torso),
    },
    camera: {
      faceVisiblePercentage: cameraCoverage,
      multipleFaceEvents,
      ambiguousTrackingSeconds,
      framingCoverage: ordered.some(frame => frame.lightingOk !== null)
        ? percent(ordered.filter(frame => frame.lightingOk === true).length, ordered.filter(frame => frame.lightingOk !== null).length)
        : null,
    },
    speech,
    events,
  };
}

export function combinedPracticeScore(answerQuality: number | null, behavioralScore: number | null) {
  if (answerQuality === null || behavioralScore === null) return null;
  return Math.round(clamp(answerQuality) * 0.8 + clamp(behavioralScore) * 0.2);
}
