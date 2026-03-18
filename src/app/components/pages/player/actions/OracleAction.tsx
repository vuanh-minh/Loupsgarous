import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Moon, Eye, EyeOff, RotateCcw, Loader2 } from 'lucide-react';
import { type RoleActionBaseProps } from './roleActionTypes';

interface Props extends RoleActionBaseProps {
  onOracleUse: () => void;
  onDismiss?: () => void;
}

export function OracleAction({ state, currentPlayer, onFlipBack, onOracleUse, onDismiss, t }: Props) {
  const [activated, setActivated] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [resultsShown, setResultsShown] = useState(false);

  const onFlipBackRef = useRef(onFlipBack);
  onFlipBackRef.current = onFlipBack;

  const hasUsed = !!(state.oracleUsed || {})[currentPlayer.id];
  const results: string[] = (state.oracleResults || {})[currentPlayer.id] || [];
  const hasResults = results.length > 0;

  // When results arrive from server, start countdown
  useEffect(() => {
    if (activated && hasResults && countdown === null && !resultsShown) {
      setCountdown(5);
    }
  }, [activated, hasResults, countdown, resultsShown]);

  // Countdown timer
  useEffect(() => {
    if (countdown === null || countdown <= 0) {
      if (countdown === 0) {
        setCountdown(null);
        setResultsShown(true);
        onDismiss?.();
        onFlipBackRef.current?.();
      }
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => (c !== null ? c - 1 : null)), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const showingResults = activated && hasResults && countdown !== null && countdown > 0;
  const isWaiting = activated && !hasResults && !resultsShown;
  const isDone = (hasUsed && !showingResults && !isWaiting) || resultsShown;

  const oracleColor = '#7c3aed';

  return (
    <div
      className="rounded-xl p-5 mb-5"
      style={{
        background: `linear-gradient(135deg, ${oracleColor}0a 0%, ${oracleColor}04 100%)`,
        border: `1px solid ${oracleColor}30`,
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Moon size={14} style={{ color: oracleColor }} />
        <span style={{ fontFamily: '"Cinzel", serif', color: oracleColor, fontSize: '0.8rem' }}>
          Issue de la nuit
        </span>
      </div>
      <p style={{ color: t.textMuted, fontSize: '0.6rem', marginBottom: '0.75rem' }}>
        Consultez les etoiles pour decouvrir ce qui se passe cette nuit.
      </p>

      <AnimatePresence mode="wait">
        {/* ── State 1: Not yet used — show action button ── */}
        {!activated && !hasUsed && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setActivated(true);
                onOracleUse();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg"
              style={{
                background: `${oracleColor}18`,
                border: `1px solid ${oracleColor}40`,
                color: oracleColor,
                fontFamily: '"Cinzel", serif',
                fontSize: '0.7rem',
                letterSpacing: '0.05em',
              }}
            >
              <Eye size={14} />
              Consulter les etoiles
            </motion.button>
          </motion.div>
        )}

        {/* ── State 2: Waiting for server results ── */}
        {isWaiting && (
          <motion.div
            key="waiting"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-lg p-5 text-center"
            style={{ background: `${oracleColor}08`, border: `1px solid ${oracleColor}25` }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              className="mx-auto mb-3"
              style={{ width: 'fit-content' }}
            >
              <Loader2 size={24} style={{ color: oracleColor }} />
            </motion.div>
            <p style={{ color: oracleColor, fontSize: '0.65rem', fontFamily: '"Cinzel", serif' }}>
              Les etoiles se devoilent...
            </p>
          </motion.div>
        )}

        {/* ── State 3: Showing results with countdown ── */}
        {showingResults && (
          <motion.div
            key="results"
            initial={{ opacity: 0, rotateY: 90 }}
            animate={{ opacity: 1, rotateY: 0 }}
            exit={{ opacity: 0, rotateY: -90 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200 }}
            className="rounded-lg p-5 text-center"
            style={{
              background: `linear-gradient(135deg, ${oracleColor}15, ${oracleColor}08)`,
              border: `1px solid ${oracleColor}40`,
            }}
          >
            <p
              style={{
                color: oracleColor,
                fontSize: '0.55rem',
                fontFamily: '"Cinzel", serif',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: '0.75rem',
              }}
            >
              Issue de la nuit
            </p>

            <div className="space-y-2 mb-4">
              {results.map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.15 }}
                  className="rounded-lg px-3 py-2"
                  style={{
                    background: `rgba(${t.overlayChannel}, 0.04)`,
                    border: `1px solid rgba(${t.overlayChannel}, 0.08)`,
                  }}
                >
                  <p style={{ color: '#c8d8f0', fontSize: '0.7rem', lineHeight: 1.5 }}>{line}</p>
                </motion.div>
              ))}
            </div>

            {/* Progress bar */}
            <div className="mx-auto" style={{ maxWidth: '12rem' }}>
              <div
                className="w-full rounded-full overflow-hidden"
                style={{ height: '4px', background: `rgba(${t.overlayChannel}, 0.1)` }}
              >
                <motion.div
                  key="oracle-progress"
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: 5, ease: 'linear' }}
                  style={{
                    height: '100%',
                    borderRadius: '9999px',
                    background: `linear-gradient(90deg, ${oracleColor}, ${oracleColor}90)`,
                    boxShadow: `0 0 8px ${oracleColor}50`,
                  }}
                />
              </div>
              <div className="flex items-center justify-center gap-1.5 mt-2">
                <EyeOff size={11} style={{ color: t.textDim }} />
                <p style={{ color: t.textDim, fontSize: '0.6rem' }}>{countdown}s</p>
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setCountdown(null);
                setResultsShown(true);
                onDismiss?.();
                onFlipBackRef.current?.();
              }}
              className="mt-3 flex items-center justify-center gap-1.5 mx-auto px-4 py-2 rounded-lg"
              style={{
                background: `rgba(${t.overlayChannel}, 0.04)`,
                border: `1px solid rgba(${t.overlayChannel}, 0.1)`,
                color: t.textMuted,
                fontSize: '0.6rem',
                fontFamily: '"Cinzel", serif',
              }}
            >
              <RotateCcw size={11} /> Retourner maintenant
            </motion.button>
          </motion.div>
        )}

        {/* ── State 4: Already used, results dismissed ── */}
        {isDone && (
          <motion.div
            key="done"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-lg p-4 text-center"
            style={{
              background: `rgba(${t.overlayChannel}, 0.02)`,
              border: `1px solid rgba(${t.overlayChannel}, 0.06)`,
            }}
          >
            <EyeOff size={18} style={{ color: t.textDim, margin: '0 auto' }} />
            <p style={{ color: t.textMuted, fontSize: '0.6rem', marginTop: '0.5rem' }}>
              Vous avez deja consulte les etoiles cette nuit.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
