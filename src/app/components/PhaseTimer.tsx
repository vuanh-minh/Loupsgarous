import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Timer, Sun, Moon } from 'lucide-react';
import type { GameThemeTokens } from '../context/gameTheme';

/** Compute remaining seconds from an ISO end timestamp */
export function computeRemaining(endAt: string | null): number {
  if (!endAt) return -1;
  const diff = new Date(endAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 1000));
}

/** Format seconds as MM:SS */
export function formatTime(totalSeconds: number): string {
  if (totalSeconds <= 0) return '00:00';
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/** Compute the endAt timestamp given a duration in seconds */
export function computeEndAt(durationSeconds: number): string {
  return new Date(Date.now() + durationSeconds * 1000).toISOString();
}

/* ================================================================
   PhaseTimerDisplay — Shows a countdown timer
   ================================================================ */
export function PhaseTimerDisplay({
  endAt,
  isNight,
  t,
  size = 'normal',
  backdropBlur = false,
}: {
  endAt: string | null;
  isNight: boolean;
  t: GameThemeTokens;
  size?: 'normal' | 'compact' | 'mini';
  backdropBlur?: boolean;
}) {
  const [remaining, setRemaining] = useState(() => computeRemaining(endAt));

  useEffect(() => {
    if (!endAt) {
      setRemaining(-1);
      return;
    }
    setRemaining(computeRemaining(endAt));
    const interval = setInterval(() => {
      const r = computeRemaining(endAt);
      setRemaining(r);
      if (r <= 0) clearInterval(interval);
    }, 250);
    return () => clearInterval(interval);
  }, [endAt]);

  if (!endAt || remaining < 0) return null;

  const isUrgent = remaining <= 60 && remaining > 0;
  const isExpired = remaining <= 0;
  const isCompact = size === 'compact';
  const isMini = size === 'mini';

  const timerColor = isExpired
    ? '#c41e3a'
    : isUrgent
      ? '#f59e0b'
      : isNight
        ? '#7c8db5'
        : '#d4a843';

  const bgColor = isExpired
    ? 'rgba(196,30,58,0.08)'
    : isUrgent
      ? 'rgba(245,158,11,0.06)'
      : isNight
        ? 'rgba(124,141,181,0.06)'
        : 'rgba(139,115,56,0.14)';

  const borderColor = isExpired
    ? 'rgba(196,30,58,0.2)'
    : isUrgent
      ? 'rgba(245,158,11,0.15)'
      : isNight
        ? 'rgba(124,141,181,0.12)'
        : 'rgba(139,115,56,0.25)';

  // Progress percentage (needs duration which we don't have here, but we show time)
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`flex items-center justify-center ${isMini ? 'rounded-full px-3 py-0.5 gap-1' : `rounded-xl gap-2 ${isCompact ? 'px-3 py-1.5' : 'px-4 py-2.5'}`}`}
      style={{
        background: isMini
          ? (isExpired ? 'rgba(196,30,58,0.12)' : isUrgent ? 'rgba(245,158,11,0.10)' : 'rgba(139,115,56,0.16)')
          : bgColor,
        border: `1px solid ${isMini
          ? (isExpired ? 'rgba(196,30,58,0.25)' : isUrgent ? 'rgba(245,158,11,0.20)' : 'rgba(139,115,56,0.30)')
          : borderColor}`,
        backdropFilter: backdropBlur ? 'blur(8px)' : 'none',
      }}
    >
      <motion.div
        animate={isUrgent && !isExpired ? { scale: [1, 1.15, 1] } : {}}
        transition={isUrgent ? { duration: 1, repeat: Infinity } : {}}
      >
        <Timer size={isMini ? 11 : isCompact ? 13 : 16} style={{ color: timerColor }} />
      </motion.div>
      <motion.span
        animate={isUrgent && !isExpired ? { opacity: [1, 0.5, 1] } : {}}
        transition={isUrgent ? { duration: 1, repeat: Infinity } : {}}
        style={{
          fontFamily: '"Cinzel", serif',
          color: timerColor,
          fontSize: isMini ? '0.7rem' : isCompact ? '0.85rem' : '1.1rem',
          fontWeight: 700,
          letterSpacing: '0.05em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {isExpired ? 'Temps ecoule !' : formatTime(remaining)}
      </motion.span>
    </motion.div>
  );
}

/* ================================================================
   PhaseTimerBar — Full width timer bar for GM with controls
   ================================================================ */
export function PhaseTimerBar({
  endAt,
  duration,
  isNight,
  t,
  onPause,
  onResume,
  onReset,
}: {
  endAt: string | null;
  duration: number;
  isNight: boolean;
  t: GameThemeTokens;
  onPause?: () => void;
  onResume?: () => void;
  onReset?: () => void;
}) {
  const [remaining, setRemaining] = useState(() => computeRemaining(endAt));

  useEffect(() => {
    if (!endAt) {
      setRemaining(-1);
      return;
    }
    setRemaining(computeRemaining(endAt));
    const interval = setInterval(() => {
      const r = computeRemaining(endAt);
      setRemaining(r);
      if (r <= 0) clearInterval(interval);
    }, 250);
    return () => clearInterval(interval);
  }, [endAt]);

  if (duration <= 0) return null;

  const isUrgent = remaining <= 60 && remaining > 0;
  const isExpired = remaining <= 0 && endAt !== null;
  const isPaused = endAt === null && duration > 0;

  const timerColor = isExpired
    ? '#c41e3a'
    : isUrgent
      ? '#f59e0b'
      : isNight
        ? '#7c8db5'
        : '#d4a843';

  const progress = endAt && remaining >= 0 ? Math.max(0, (remaining / duration) * 100) : 0;

  return (
    <div
      className="rounded-xl p-4 mb-4"
      style={{
        background: isExpired
          ? 'rgba(196,30,58,0.04)'
          : isNight
            ? 'rgba(124,141,181,0.04)'
            : 'rgba(212,168,67,0.04)',
        border: `1px solid ${isExpired ? 'rgba(196,30,58,0.15)' : isNight ? 'rgba(124,141,181,0.1)' : 'rgba(212,168,67,0.1)'}`,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <motion.div
            animate={isUrgent && !isExpired ? { scale: [1, 1.2, 1] } : {}}
            transition={isUrgent ? { duration: 1, repeat: Infinity } : {}}
          >
            <Timer size={15} style={{ color: timerColor }} />
          </motion.div>
          <span
            style={{
              fontFamily: '"Cinzel", serif',
              color: timerColor,
              fontSize: '0.7rem',
            }}
          >
            Chronometre de phase
          </span>
        </div>
        <motion.span
          animate={isUrgent && !isExpired ? { opacity: [1, 0.4, 1] } : {}}
          transition={isUrgent ? { duration: 1, repeat: Infinity } : {}}
          style={{
            fontFamily: '"Cinzel", serif',
            color: timerColor,
            fontSize: '1.3rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {isExpired ? '00:00' : isPaused ? '--:--' : formatTime(remaining)}
        </motion.span>
      </div>

      {/* Progress bar */}
      <div
        className="h-1.5 rounded-full overflow-hidden mb-2"
        style={{ background: `rgba(${isNight ? '124,141,181' : '212,168,67'},0.08)` }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{
            background: isUrgent
              ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
              : isNight
                ? 'linear-gradient(90deg, #7c8db5, #5b6a91)'
                : 'linear-gradient(90deg, #d4a843, #b8860b)',
          }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {isExpired && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            color: '#c41e3a',
            fontSize: '0.6rem',
            fontFamily: '"Cinzel", serif',
            textAlign: 'center',
          }}
        >
          Le temps est ecoule — transition automatique...
        </motion.p>
      )}
    </div>
  );
}

/* ================================================================
   Timer Duration Selector — for GM settings
   ================================================================ */
const TIMER_PRESETS = [
  { label: 'Desactive', value: 0, emoji: '⏸️' },
  { label: '3 min', value: 180, emoji: '⚡' },
  { label: '5 min', value: 300, emoji: '🏃' },
  { label: '10 min', value: 600, emoji: '⏱️' },
  { label: '15 min', value: 900, emoji: '🕐' },
  { label: '20 min', value: 1200, emoji: '🕑' },
  { label: '30 min', value: 1800, emoji: '🕒' },
];

/* ---- Inline preset picker for a single phase row ---- */
function PhasePresetRow({
  label,
  icon,
  accentColor,
  accentBg,
  accentBorder,
  value,
  onChange,
  t,
  compact,
}: {
  label: string;
  icon: React.ReactNode;
  accentColor: string;
  accentBg: string;
  accentBorder: string;
  value: number;
  onChange: (s: number) => void;
  t: GameThemeTokens;
  compact: boolean;
}) {
  const presets = TIMER_PRESETS.filter((p) => p.value > 0);
  const [customMin, setCustomMin] = useState('');
  const isCustom = value > 0 && !TIMER_PRESETS.some((p) => p.value === value);

  return (
    <div
      className="rounded-lg p-2.5"
      style={{ background: accentBg, border: `1px solid ${accentBorder}` }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span
          style={{
            fontFamily: '"Cinzel", serif',
            color: accentColor,
            fontSize: compact ? '0.55rem' : '0.6rem',
            fontWeight: 600,
          }}
        >
          {label}
        </span>
        <span
          className="ml-auto px-1.5 py-0.5 rounded-full"
          style={{
            background: `${accentColor}15`,
            border: `1px solid ${accentColor}30`,
            color: accentColor,
            fontSize: '0.5rem',
            fontFamily: '"Cinzel", serif',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatTime(value)}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {presets.map((preset) => {
          const isActive = value === preset.value;
          return (
            <button
              key={preset.value}
              onClick={() => onChange(preset.value)}
              className="px-2 py-1 rounded-md transition-all text-center cursor-pointer"
              style={{
                background: isActive ? `${accentColor}18` : `rgba(${t.overlayChannel}, 0.03)`,
                border: `1px solid ${isActive ? `${accentColor}40` : `rgba(${t.overlayChannel}, 0.06)`}`,
                color: isActive ? accentColor : t.textMuted,
                fontFamily: '"Cinzel", serif',
                fontSize: compact ? '0.45rem' : '0.5rem',
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {preset.label}
            </button>
          );
        })}
        <div className="flex items-center gap-1">
          <input
            type="number"
            min="1"
            max="120"
            placeholder="Min"
            value={isCustom ? Math.round(value / 60).toString() : customMin}
            onChange={(e) => {
              setCustomMin(e.target.value);
              const mins = parseInt(e.target.value);
              if (!isNaN(mins) && mins >= 1 && mins <= 120) {
                onChange(mins * 60);
              }
            }}
            className="w-10 px-1.5 py-1 rounded-md text-center outline-none"
            style={{
              background: `rgba(${t.overlayChannel}, 0.03)`,
              border: `1px solid ${isCustom ? `${accentColor}40` : `rgba(${t.overlayChannel}, 0.06)`}`,
              color: isCustom ? accentColor : t.textMuted,
              fontFamily: '"Cinzel", serif',
              fontSize: compact ? '0.45rem' : '0.5rem',
            }}
          />
          <span style={{ color: t.textDim, fontSize: '0.55rem' }}>min</span>
        </div>
      </div>
    </div>
  );
}

export function TimerDurationSelector({
  value,
  onChange,
  dayDuration = 900,
  nightDuration = 900,
  onDayDurationChange,
  onNightDurationChange,
  t,
  compact = false,
}: {
  value: number;
  onChange?: (seconds: number) => void;
  dayDuration?: number;
  nightDuration?: number;
  onDayDurationChange?: (seconds: number) => void;
  onNightDurationChange?: (seconds: number) => void;
  t: GameThemeTokens;
  compact?: boolean;
}) {
  const isEnabled = value > 0;

  return (
    <div>
      {/* Header + toggle */}
      <div className="flex items-center gap-2 mb-2">
        <Timer size={13} style={{ color: t.gold }} />
        <span
          style={{
            fontFamily: '"Cinzel", serif',
            color: t.gold,
            fontSize: compact ? '0.6rem' : '0.7rem',
          }}
        >
          Chronometre de phase
        </span>
        <button
          onClick={() => {
            if (isEnabled) {
              onChange?.(0);
            } else {
              onChange?.(dayDuration || 900);
            }
          }}
          className="ml-auto relative w-9 h-[18px] rounded-full transition-colors cursor-pointer"
          style={{
            background: isEnabled ? t.gold : `rgba(${t.overlayChannel}, 0.12)`,
          }}
        >
          <span
            className="absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full transition-transform"
            style={{
              background: isEnabled ? '#fff' : `rgba(${t.overlayChannel}, 0.3)`,
              transform: isEnabled ? 'translateX(18px)' : 'translateX(0)',
            }}
          />
        </button>
      </div>

      {/* Day / Night duration selectors — only visible when enabled */}
      {isEnabled && onDayDurationChange && onNightDurationChange && (
        <div className="flex flex-col gap-2 mt-2">
          <PhasePresetRow
            label="Jour"
            icon={<Sun size={11} style={{ color: '#d4a843' }} />}
            accentColor="#d4a843"
            accentBg="rgba(212,168,67,0.04)"
            accentBorder="rgba(212,168,67,0.1)"
            value={dayDuration}
            onChange={onDayDurationChange}
            t={t}
            compact={compact}
          />
          <PhasePresetRow
            label="Nuit"
            icon={<Moon size={11} style={{ color: '#7c8db5' }} />}
            accentColor="#7c8db5"
            accentBg="rgba(124,141,181,0.04)"
            accentBorder="rgba(124,141,181,0.1)"
            value={nightDuration}
            onChange={onNightDurationChange}
            t={t}
            compact={compact}
          />
          <p style={{ color: t.textDim, fontSize: '0.55rem', lineHeight: 1.4 }}>
            A la fin du chronometre, la phase passe automatiquement au jour/nuit suivant.
            Le MJ peut toujours changer manuellement.
          </p>
        </div>
      )}

      {/* Fallback for old usage without day/night split */}
      {isEnabled && (!onDayDurationChange || !onNightDurationChange) && (
        <>
          <div className={`flex flex-wrap gap-1.5 ${compact ? '' : 'mb-2'}`}>
            {TIMER_PRESETS.filter(p => p.value > 0).map((preset) => {
              const isActive = value === preset.value;
              return (
                <button
                  key={preset.value}
                  onClick={() => onChange?.(preset.value)}
                  className="px-2.5 py-1.5 rounded-lg transition-all text-center cursor-pointer"
                  style={{
                    background: isActive ? t.goldBg : `rgba(${t.overlayChannel}, 0.03)`,
                    border: `1px solid ${isActive ? t.goldBorder : `rgba(${t.overlayChannel}, 0.08)`}`,
                    color: isActive ? t.gold : t.textMuted,
                    fontFamily: '"Cinzel", serif',
                    fontSize: compact ? '0.5rem' : '0.55rem',
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  <span className="block text-xs mb-0.5">{preset.emoji}</span>
                  {preset.label}
                </button>
              );
            })}
          </div>
          <p style={{ color: t.textDim, fontSize: '0.55rem', lineHeight: 1.4 }}>
            A la fin du chronometre, la phase passe automatiquement au jour/nuit suivant.
          </p>
        </>
      )}
    </div>
  );
}