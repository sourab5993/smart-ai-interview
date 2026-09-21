// Reusable UI and formatting helper utilities across all views and components

/**
 * Format seconds into MM:SS string
 */
export function formatTimer(totalSeconds: number): string {
  const mins = Math.floor(Math.max(0, totalSeconds) / 60);
  const secs = Math.floor(Math.max(0, totalSeconds) % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Return consistent text color class based on score threshold
 */
export function getScoreColor(score: number): string {
  if (score >= 85) return 'text-emerald-400';
  if (score >= 70) return 'text-cyan-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-rose-400';
}

/**
 * Return consistent background, text, and border badge styling for score tags
 */
export function getScoreBadgeClass(score: number): string {
  if (score >= 85) return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
  if (score >= 70) return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30';
  if (score >= 50) return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
  return 'bg-rose-500/10 text-rose-300 border-rose-500/30';
}

/**
 * Return badge style classes based on difficulty level
 */
export function getDifficultyBadgeClass(difficulty: string): string {
  const lower = (difficulty || '').toLowerCase();
  if (lower.includes('hard') || lower.includes('advanced')) {
    return 'bg-rose-500/10 text-rose-300 border-rose-500/30';
  }
  if (lower.includes('medium') || lower.includes('intermediate')) {
    return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
  }
  return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
}

/**
 * Count clean whitespace-separated words in a string
 */
export function countWords(text: string): number {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Format an ISO date string into a user-friendly localized date
 */
export function formatReadableDate(isoString: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}
