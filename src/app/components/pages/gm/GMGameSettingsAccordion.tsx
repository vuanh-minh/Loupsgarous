import React, { useState, useCallback, useMemo } from 'react';
import { Settings, ChevronDown, Copy, Check, ShieldAlert, KeyRound } from 'lucide-react';
import { motion } from 'motion/react';
import { type GameState } from '../../../context/gameTypes';
import { type GameThemeTokens } from '../../../context/gameTheme';
import { GMPhaseTimerSettings } from './GMPhaseTimerSettings';
import { GMWolfKillsStepper } from './GMWolfKillsStepper';
import { GMWolfInactivitySettings } from './GMWolfInactivitySettings';
import { GMVillagerInactivitySettings } from './GMVillagerInactivitySettings';
import { GMRandomVoteSettings } from './GMRandomVoteSettings';
import { GMDayEliminationsStepper } from './GMDayEliminationsStepper';
import { GMRoleRevealQuestSettings } from './GMRoleRevealQuestSettings';

/* ================================================================
   GMGameSettingsAccordion — collapsible "Reglages de partie" that
   groups phase timer, wolf kills stepper, and wolf inactivity.
   Used in both desktop GMGameControls and mobile MobileControlsView.
   ================================================================ */

interface GMGameSettingsAccordionProps {
  state: GameState;
  updateState: (fn: (s: GameState) => GameState) => void;
  t: GameThemeTokens;
  className?: string;
}

const SUPER_ADMIN_CODE = '0000';

export const GMGameSettingsAccordion = React.memo(function GMGameSettingsAccordion({
  state, updateState, t, className = '',
}: GMGameSettingsAccordionProps) {
  const [open, setOpen] = useState(true);
  const [copiedAdmin, setCopiedAdmin] = useState(false);
  const [copiedGM, setCopiedGM] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  // Derive game-specific GM access code from gameId
  const gmAccessCode = useMemo(() => {
    if (!state.gameId) return '----';
    return state.gameId.replace(/-/g, '').slice(0, 4).toUpperCase();
  }, [state.gameId]);

  const copyAdminCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(SUPER_ADMIN_CODE);
      setCopiedAdmin(true);
      setTimeout(() => setCopiedAdmin(false), 2000);
    } catch { /* ignore */ }
  }, []);

  const copyGMCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(gmAccessCode);
      setCopiedGM(true);
      setTimeout(() => setCopiedGM(false), 2000);
    } catch { /* ignore */ }
  }, [gmAccessCode]);

  // Summary badges
  const timerOn = state.phaseTimerDuration > 0;
  const wolfKills = state.wolfKillsPerNight || 1;
  const inactivityThreshold = state.wolfInactivityThreshold ?? 2;
  const inactivityOn = inactivityThreshold > 0;
  const villagerInactivityThreshold = state.villagerInactivityThreshold ?? 2;
  const villagerInactivityOn = villagerInactivityThreshold > 0;
  const randomVoteOn = state.randomVoteIfInactive !== false;
  const dayElims = state.dayEliminationsCount || 1;

  return (
    <div
      className={`rounded-xl overflow-hidden ${className}`}
      style={{
        background: `rgba(${t.overlayChannel}, 0.02)`,
        border: `1px solid rgba(${t.overlayChannel}, 0.08)`,
      }}
    >
      {/* Header — always visible */}
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer"
        style={{ background: 'transparent' }}
      >
        <div className="flex items-center gap-2">
          <Settings size={13} style={{ color: t.gold }} />
          <span style={{ fontFamily: '"Cinzel", serif', color: t.gold, fontSize: '0.7rem' }}>
            Reglages de partie
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick summary badges when collapsed */}
          {!open && (
            <div className="flex items-center gap-1.5">
              <Badge
                label={timerOn ? '⏱ On' : '⏱ Off'}
                active={timerOn}
                t={t}
              />
              <Badge
                label={`🐺 ×${wolfKills}`}
                active
                t={t}
              />
              <Badge
                label={inactivityOn ? `💀 ${inactivityThreshold}n` : '💀 Off'}
                active={inactivityOn}
                t={t}
              />
              <Badge
                label={villagerInactivityOn ? `🚪 ${villagerInactivityThreshold}j` : '🚪 Off'}
                active={villagerInactivityOn}
                t={t}
              />
              <Badge
                label={randomVoteOn ? '🎲 On' : '🎲 Off'}
                active={randomVoteOn}
                t={t}
              />
              {dayElims > 1 && (
                <Badge
                  label={`⚔️ ×${dayElims}`}
                  active
                  t={t}
                />
              )}
            </div>
          )}
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ type: 'tween', duration: 0.2 }}
            className="flex items-center"
          >
            <ChevronDown size={14} style={{ color: t.textMuted }} />
          </motion.span>
        </div>
      </button>

      {/* Collapsible body */}
      <motion.div
        initial={false}
        animate={{
          height: open ? 'auto' : 0,
          opacity: open ? 1 : 0,
        }}
        transition={{ type: 'tween', duration: 0.25 }}
        style={{ overflow: 'hidden' }}
      >
        <div className="px-3 pb-3 flex flex-col gap-3">
          <GMPhaseTimerSettings state={state} updateState={updateState} t={t} />
          <GMWolfKillsStepper
            wolfKillsPerNight={wolfKills}
            updateState={updateState}
            t={t}
          />
          <GMDayEliminationsStepper
            dayEliminationsCount={state.dayEliminationsCount || 1}
            updateState={updateState}
            t={t}
          />
          <GMWolfInactivitySettings state={state} updateState={updateState} t={t} />
          <GMVillagerInactivitySettings state={state} updateState={updateState} t={t} />
          <GMRandomVoteSettings state={state} updateState={updateState} t={t} />
          <GMRoleRevealQuestSettings state={state} updateState={updateState} t={t} />

          {/* GM access code for this game */}
          <div
            className="flex items-center justify-between rounded-lg px-3 py-2.5 mt-1"
            style={{
              background: `rgba(${t.overlayChannel}, 0.04)`,
              border: `1px solid rgba(${t.overlayChannel}, 0.1)`,
            }}
          >
            <div className="flex items-center gap-2">
              <KeyRound size={13} style={{ color: t.gold, opacity: 0.8 }} />
              <span style={{ fontFamily: '"Cinzel", serif', color: t.textMuted, fontSize: '0.65rem' }}>
                Code GM
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="tracking-widest"
                style={{
                  fontFamily: 'monospace',
                  color: t.gold,
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  letterSpacing: '0.15em',
                }}
              >
                {gmAccessCode}
              </span>
              <button
                onClick={copyGMCode}
                className="w-7 h-7 rounded-md flex items-center justify-center transition-all active:scale-90"
                style={{
                  background: copiedGM ? 'rgba(74,222,128,0.15)' : `rgba(${t.overlayChannel}, 0.06)`,
                  border: `1px solid ${copiedGM ? 'rgba(74,222,128,0.3)' : `rgba(${t.overlayChannel}, 0.12)`}`,
                }}
              >
                {copiedGM ? (
                  <Check size={12} style={{ color: '#4ade80' }} />
                ) : (
                  <Copy size={12} style={{ color: t.textMuted }} />
                )}
              </button>
            </div>
          </div>

          {/* Super admin code (all games) */}
          <div
            className="flex items-center justify-between rounded-lg px-3 py-2.5 mt-1"
            style={{
              background: `rgba(${t.overlayChannel}, 0.04)`,
              border: `1px solid rgba(${t.overlayChannel}, 0.1)`,
            }}
          >
            <div className="flex items-center gap-2">
              <ShieldAlert size={13} style={{ color: t.gold, opacity: 0.8 }} />
              <span style={{ fontFamily: '"Cinzel", serif', color: t.textMuted, fontSize: '0.65rem' }}>
                Code Admin
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="tracking-widest"
                style={{
                  fontFamily: '"Cinzel", serif',
                  color: t.gold,
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  letterSpacing: '0.2em',
                }}
              >
                {SUPER_ADMIN_CODE}
              </span>
              <button
                onClick={copyAdminCode}
                className="w-7 h-7 rounded-md flex items-center justify-center transition-all active:scale-90"
                style={{
                  background: copiedAdmin ? 'rgba(74,222,128,0.15)' : `rgba(${t.overlayChannel}, 0.06)`,
                  border: `1px solid ${copiedAdmin ? 'rgba(74,222,128,0.3)' : `rgba(${t.overlayChannel}, 0.12)`}`,
                }}
              >
                {copiedAdmin ? (
                  <Check size={12} style={{ color: '#4ade80' }} />
                ) : (
                  <Copy size={12} style={{ color: t.textMuted }} />
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
});

/* ── Tiny inline badge ── */

interface BadgeProps {
  label: string;
  active: boolean;
  t: GameThemeTokens;
}

const Badge = React.memo(function Badge({ label, active, t }: BadgeProps) {
  return (
    <span
      className="px-1.5 py-0.5 rounded-full whitespace-nowrap"
      style={{
        fontSize: '0.5rem',
        fontFamily: '"Cinzel", serif',
        fontWeight: 600,
        color: active ? t.gold : t.textDim,
        background: active ? `rgba(${t.overlayChannel}, 0.06)` : `rgba(${t.overlayChannel}, 0.03)`,
        border: `1px solid ${active ? `rgba(${t.overlayChannel}, 0.12)` : `rgba(${t.overlayChannel}, 0.06)`}`,
      }}
    >
      {label}
    </span>
  );
});