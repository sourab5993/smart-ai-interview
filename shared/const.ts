export const UNAUTHED_ERR_MSG = "Please login (10001)";
export const NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
export const MAX_TRANSCRIPTION_AUDIO_BYTES = 1_400_000;
export const MAX_TRANSCRIPTION_AUDIO_BASE64_CHARS =
  4 * Math.ceil(MAX_TRANSCRIPTION_AUDIO_BYTES / 3);
