/**
 * PhaseTransitionOverlay.tsx — Full-screen cinematic overlay
 * shown between day→night and night→day phase transitions.
 *
 * Rendered via createPortal above everything.
 * Animation phases:
 *   1. Fade in + subtle zoom  (0.8s)
 *   2. Hold with gentle pan   (2.4s)
 *   3. Fade out               (0.8s)
 */
import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
const transitionImg = '/assets/backgrounds/transition-night-to-day.png';
const dayToNightImg = '/assets/backgrounds/transition-day-to-night.png';

/** Hook: is screen < 640px? */
function useIsMobile(breakpoint = 640) {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < breakpoint);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    setMobile(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return mobile;
}

type TransitionDir = "day-to-night" | "night-to-day";

interface Props {
  phase: string;
  turn: number;
  onTransitionChange?: (active: boolean) => void;
}

const TOTAL_DURATION = 4000; // ms  (0.8 + 2.4 + 0.8)

export const PhaseTransitionOverlay = React.memo(
  function PhaseTransitionOverlay({ phase, turn, onTransitionChange }: Props) {
    const prevRef = useRef<string | null>(null);
    const prevTurnRef = useRef<number>(turn);
    const [dir, setDir] = useState<TransitionDir | null>(null);
    const [show, setShow] = useState(false);
    const mounted = useRef(false);
    const [labels, setLabels] = useState<{ old: string; new: string }>({ old: "", new: "" });

    /* Detect phase change */
    useEffect(() => {
      if (!mounted.current) {
        mounted.current = true;
        prevRef.current = phase;
        prevTurnRef.current = turn;
        return;
      }
      const prev = prevRef.current;
      const prevTurn = prevTurnRef.current;
      prevRef.current = phase;
      prevTurnRef.current = turn;
      if (!prev || prev === phase) return;

      let d: TransitionDir | null = null;
      if (
        (prev === "day" || prev === "maire_election") &&
        phase === "night"
      ) {
        d = "day-to-night";
        setLabels({ old: `Jour ${prevTurn}`, new: `Nuit ${turn}` });
      }
      if (prev === "night" && phase === "day") {
        d = "night-to-day";
        setLabels({ old: `Nuit ${prevTurn}`, new: `Jour ${turn}` });
      }
      if (!d) return;

      setDir(d);
      setShow(true);
      onTransitionChange?.(true);
    }, [phase, turn]);

    /* Auto-dismiss */
    useEffect(() => {
      if (!show) return;
      const t = setTimeout(
        () => {
          setShow(false);
          onTransitionChange?.(false);
        },
        TOTAL_DURATION,
      );
      return () => clearTimeout(t);
    }, [show]);

    const isNightfall = dir === "day-to-night";
    const bgImage = isNightfall ? dayToNightImg : transitionImg;

    /* Sliding day counter constants */
    const SLIDE_DISTANCE = 80; // px
    const SLIDE_DURATION = 0.9;
    const SLIDE_DELAY = 0.3;
    const labelStyle: React.CSSProperties = {
      fontFamily: '"Cinzel Decorative", "Cinzel", serif',
      fontSize: "20px",
      fontWeight: 700,
      color: isNightfall ? "#8090b0" : "#c8b080",
      textShadow: "0 2px 16px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.5)",
      letterSpacing: "6px",
      textTransform: "uppercase",
      whiteSpace: "nowrap" as const,
      gridArea: "1 / 1",
    };

    const overlay = (
      <AnimatePresence onExitComplete={() => setDir(null)}>
        {show && dir && (
          <motion.div
            key={`sp-transition-${dir}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              overflow: "hidden",
              pointerEvents: "auto",
            }}
          >
            {/* Village image — static background */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `url(${bgImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center bottom",
                imageRendering: "pixelated",
              }}
            />

            {/* Tint — cool blue for nightfall, warm amber for dawn */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.2, delay: 0.3 }}
              style={{
                position: "absolute",
                inset: 0,
                background: isNightfall
                  ? "linear-gradient(180deg, rgba(5,8,22,0.50) 0%, rgba(15,18,45,0.40) 50%, rgba(25,18,50,0.50) 100%)"
                  : "linear-gradient(180deg, rgba(200,150,60,0.18) 0%, rgba(240,190,90,0.12) 50%, rgba(200,150,60,0.18) 100%)",
              }}
            />

            {/* Vignette */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.55) 100%)",
              }}
            />

            {/* Caption */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "14px",
              }}
            >
              {/* Day counter — sliding timeline */}
              <div
                style={{
                  display: "grid",
                  justifyItems: "center",
                  height: "30px",
                  overflow: "hidden",
                  marginBottom: "6px",
                }}
              >
                {/* Old label — slides up and out */}
                <motion.span
                  initial={{ y: 0, opacity: 1 }}
                  animate={{ y: -SLIDE_DISTANCE, opacity: 0 }}
                  transition={{
                    duration: SLIDE_DURATION,
                    delay: SLIDE_DELAY,
                    ease: [0.4, 0, 0.2, 1],
                  }}
                  style={labelStyle}
                >
                  {labels.old}
                </motion.span>

                {/* New label — slides up from bottom */}
                <motion.span
                  initial={{ y: SLIDE_DISTANCE, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{
                    duration: SLIDE_DURATION,
                    delay: SLIDE_DELAY,
                    ease: [0.4, 0, 0.2, 1],
                  }}
                  style={labelStyle}
                >
                  {labels.new}
                </motion.span>
              </div>

              {/* Icon */}
              <motion.span
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  duration: 0.6,
                  delay: 0.3,
                  ease: "easeOut",
                }}
                style={{
                  fontSize: "42px",
                  filter:
                    "drop-shadow(0 2px 12px rgba(0,0,0,0.6))",
                }}
              >
                {isNightfall ? "🌙" : "☀️"}
              </motion.span>

              {/* Title */}
              <motion.p
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.7,
                  delay: 0.5,
                  ease: "easeOut",
                }}
                style={{
                  fontFamily:
                    '"Cinzel Decorative", "Cinzel", serif',
                  fontSize: "28px",
                  fontWeight: 700,
                  color: isNightfall ? "#c8d6e5" : "#f5e6c8",
                  textShadow:
                    "0 2px 24px rgba(0,0,0,0.8), 0 0 50px rgba(0,0,0,0.5)",
                  textAlign: "center",
                  letterSpacing: "4px",
                  textTransform: "uppercase",
                }}
              >
                {isNightfall
                  ? "La nuit tombe..."
                  : "Le jour se lève..."}
              </motion.p>

              {/* Decorative line */}
              <motion.div
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 0.5 }}
                transition={{
                  duration: 0.9,
                  delay: 0.8,
                  ease: "easeOut",
                }}
                style={{
                  width: "140px",
                  height: "1.5px",
                  background: isNightfall
                    ? "linear-gradient(90deg, transparent, #7c8db5, transparent)"
                    : "linear-gradient(90deg, transparent, #d4a843, transparent)",
                }}
              />

              {/* Subtitle */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.7 }}
                transition={{ duration: 0.6, delay: 1.1 }}
                style={{
                  fontFamily: '"Cinzel", serif',
                  fontSize: "14px",
                  color: isNightfall ? "#8090b0" : "#c8b080",
                  textShadow: "0 1px 8px rgba(0,0,0,0.6)",
                  letterSpacing: "2px",
                }}
              >
                {isNightfall
                  ? "Les créatures rôdent..."
                  : "Le village se réveille..."}
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );

    return createPortal(overlay, document.body);
  },
);