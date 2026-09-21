import React from 'react';
import { motion } from 'motion/react';

interface ScoreRingProps {
  score: number;
  maxScore?: number;
  size?: number;
  strokeWidth?: number;
  color?: 'cyan' | 'violet' | 'blue' | 'emerald' | 'amber' | 'gradient';
  label?: string;
  sublabel?: string;
  showPercentage?: boolean;
}

export const ScoreRing: React.FC<ScoreRingProps> = ({
  score,
  maxScore = 100,
  size = 140,
  strokeWidth = 10,
  color = 'gradient',
  label,
  sublabel,
  showPercentage = true,
}) => {
  const percentage = Math.min(100, Math.max(0, Math.round((score / maxScore) * 100)));
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const colorClasses = {
    cyan: '#06b6d4',
    violet: '#8b5cf6',
    blue: '#3b82f6',
    emerald: '#10b981',
    amber: '#f59e0b',
    gradient: 'url(#scoreGradient)',
  };

  return (
    <div className="relative inline-flex flex-col items-center justify-center" id="score-ring">
      <svg width={size} height={size} className="transform -rotate-90">
        <defs>
          <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="50%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        {/* Background Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(51, 65, 85, 0.4)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Animated Fill Circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colorClasses[color]}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.4, ease: 'easeOut' }}
          strokeLinecap="round"
          fill="transparent"
        />
      </svg>
      {/* Center Label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-100 font-mono">
          {score}
          {showPercentage && <span className="text-sm font-medium text-slate-400 ml-0.5">%</span>}
        </span>
        {label && <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>}
      </div>
      {sublabel && <span className="mt-2 text-xs font-medium text-slate-400">{sublabel}</span>}
    </div>
  );
};
