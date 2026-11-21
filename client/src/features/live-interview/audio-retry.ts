export type LiveAudioRetryAction = "transcribe" | "save-transcript" | null;

export function getLiveAudioRetryAction(input: {
  capturedAudioAvailable: boolean;
  transcriptDraft: string;
  persistedTranscript: string | null | undefined;
}): LiveAudioRetryAction {
  if (input.persistedTranscript?.trim()) return null;
  if (input.transcriptDraft.trim()) return "save-transcript";
  if (input.capturedAudioAvailable) return "transcribe";
  return null;
}
