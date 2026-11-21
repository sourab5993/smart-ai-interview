export function completionAdjustedScore(
  answerQuality: number,
  answeredCount: number,
  questionCount: number
) {
  const quality = Math.max(0, Math.min(100, Number(answerQuality) || 0));
  const total = Math.max(0, Number(questionCount) || 0);
  const answered = Math.max(0, Math.min(total, Number(answeredCount) || 0));
  return total ? Math.round(quality * (answered / total)) : Math.round(quality);
}
