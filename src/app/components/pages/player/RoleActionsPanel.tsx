import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Moon, Sun, Skull, UserCircle, RotateCcw, Search,
} from 'lucide-react';
import { type Player, type GameState } from '../../../context/GameContext';
import { type RoleDefinition } from '../../../data/roles';
import { type GameThemeTokens } from '../../../context/gameTheme';
import { PAvatar } from './PAvatar';
import { ConciergeAction } from './ConciergeAction';
import {
  WerewolfAction, SeerAction, CupidAction, WitchAction,
  PetiteFilleAction, GuardAction, CorbeauAction, HunterAction, FoxAction,
  OracleAction, EmpoisonneurAction,
} from './actions';

/* ---- Role Actions Panel ---- */
export function RoleActionsPanel({
  state, alivePlayers, currentPlayer, currentRole, hasRole,
  selectedTarget, setSelectedTarget,
  allPlayers, onFlipBack,
  onWerewolfVote, onSeerTarget, onWitchHeal, onWitchKill, onCancelWitchKill, onCupidLink,
  onGuardTarget, onCorbeauTarget, onHunterPreTarget,
  onFoxTarget,
  onConciergeTarget,
  onOracleUse,
  onOracleDismiss,
  onEmpoisonneurTarget,
  isDiscoveryPhase = false,
  onDiscoveryTarget,
  discoveryPreTarget,
  practiceMode = false,
  t,
}: {
  state: GameState;
  alivePlayers: Player[];
  currentPlayer: Player | null;
  currentRole?: RoleDefinition;
  hasRole: (roleId: string) => boolean;
  selectedTarget: number | null;
  setSelectedTarget: (v: number | null) => void;
  allPlayers: Player[];
  onFlipBack?: () => void;
  onWerewolfVote: (wolfId: number, targetId: number, message?: string) => void;
  onSeerTarget: (targetId: number) => void;
  onWitchHeal: () => void;
  onWitchKill: (targetId: number) => void;
  onCancelWitchKill: () => void;
  onCupidLink: (id1: number, id2: number) => void;
  onGuardTarget: (targetId: number) => void;
  onCorbeauTarget: (targetId: number, message: string, imageUrl?: string) => void;
  onHunterPreTarget?: (targetId: number | null) => void;
  onFoxTarget?: (playerIds: number[]) => void;
  onConciergeTarget?: (targetId: number) => void;
  onOracleUse?: () => void;
  onOracleDismiss?: () => void;
  onEmpoisonneurTarget?: (targetId: number) => void;
  isDiscoveryPhase?: boolean;
  onDiscoveryTarget?: (wolfId: number, targetId: number) => void;
  discoveryPreTarget?: { id: number; name: string; isPresent: boolean } | null;
  practiceMode?: boolean;
  t: GameThemeTokens;
}) {
  const [foxConfirmFn, setFoxConfirmFn] = useState<(() => void) | null>(null);

  const handleFoxReadyChange = useCallback((ready: boolean, confirmFn: (() => void) | null) => {
    setFoxConfirmFn(() => ready ? confirmFn : null);
  }, []);

  if (!currentPlayer) {
    return (
      <div className="px-4 py-4 pb-6 flex flex-col items-center justify-center h-full">
        <UserCircle size={40} style={{ color: t.gold }} />
        <p style={{ color: t.textMuted, fontSize: '0.8rem', marginTop: '1rem' }}>
          Aucun joueur selectionne.
        </p>
      </div>
    );
  }

  if (!currentPlayer.alive) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-4">
          <div className="w-12 h-12 shrink-0 rounded-full overflow-hidden mb-2">
            <PAvatar player={currentPlayer} size="text-2xl" style={{ filter: 'grayscale(1)' }} />
          </div>
          <Skull size={28} style={{ color: '#c41e3a' }} className="mb-2" />
          <h3 style={{ fontFamily: '"Cinzel", serif', color: '#c41e3a', fontSize: '0.9rem' }}>
            {currentPlayer.name} est elimine
          </h3>
          <p style={{ color: t.textMuted, fontSize: '0.7rem', marginTop: '0.25rem' }}>
            Ton role etait : {currentRole?.emoji} {currentRole?.name}
          </p>
        </div>
        {onFlipBack && (
          <div
            className="shrink-0 px-4 pb-4 pt-2"
            style={{ background: `linear-gradient(to top, ${t.pageBg}, ${t.pageBg}ee 70%, transparent)` }}
          >
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              onClick={onFlipBack}
              whileTap={{ scale: 0.95 }}
              className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl transition-all duration-200"
              style={{
                background: `rgba(${t.overlayChannel}, 0.04)`,
                border: `1px solid rgba(${t.overlayChannel}, 0.08)`,
                color: t.textMuted,
                fontFamily: '"Cinzel", serif',
                fontSize: '0.65rem',
                letterSpacing: '0.05em',
              }}
            >
              <RotateCcw size={13} />
              Retourner la carte
            </motion.button>
          </div>
        )}
      </div>
    );
  }

  // Shared base props for all action components
  const baseProps = { state, alivePlayers, currentPlayer, allPlayers, onFlipBack, practiceMode, t };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4">
      {/* Role card header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        {currentRole && (
          <div
            className="rounded-xl p-3 mb-3 relative overflow-hidden"
          >
            <div className="relative flex items-center gap-3">
              <div className="text-3xl flex-shrink-0">{currentRole.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3
                    className="m-0"
                    style={{
                      fontFamily: '"Cinzel", serif',
                      color: currentRole.color,
                      fontSize: '0.95rem',
                      textShadow: `0 0 15px ${currentRole.color}30`,
                    }}
                  >
                    {currentRole.name}
                  </h3>
                  <div
                    className="inline-block px-2 py-0 rounded-full"
                    style={{
                      background: currentRole.team === 'werewolf' ? 'rgba(196,30,58,0.15)' : 'rgba(107,142,90,0.15)',
                      border: `1px solid ${currentRole.team === 'werewolf' ? 'rgba(196,30,58,0.3)' : 'rgba(107,142,90,0.3)'}`,
                      fontSize: '0.5rem',
                      color: currentRole.team === 'werewolf' ? '#c41e3a' : '#6b8e5a',
                      fontFamily: '"Cinzel", serif',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {currentRole.team === 'village' ? 'Village' : 'Loup-Garou'}
                  </div>
                </div>
                <p className="m-0" style={{ color: t.textSecondary, fontSize: '0.65rem', marginTop: '0.25rem', lineHeight: 1.4 }}>
                  {currentRole.description}
                </p>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Practice mode badges */}
      {practiceMode && currentRole && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg p-2.5 mb-4 flex items-center justify-center gap-2"
          style={{ background: 'rgba(167,130,227,0.08)', border: '1px solid rgba(167,130,227,0.2)' }}
        >
          <RotateCcw size={12} style={{ color: '#a782e3' }} />
          <span style={{ color: '#a782e3', fontSize: '0.6rem', fontFamily: '"Cinzel", serif', letterSpacing: '0.05em' }}>
            Mode simulation — Vos actions n'ont aucun effet reel
          </span>
        </motion.div>
      )}

      {practiceMode && currentRole && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="rounded-lg p-2.5 mb-4 flex items-center gap-2"
          style={{ background: t.goldBg, border: `1px solid ${t.goldBorder}` }}>
          <RotateCcw size={13} style={{ color: t.gold }} />
          <p style={{ color: t.textSecondary, fontSize: '0.55rem', lineHeight: 1.4 }}>
            Utilisez le bouton <strong style={{ color: t.gold }}>Retourner la carte</strong> en bas pour proteger votre identite.
          </p>
        </motion.div>
      )}

      {practiceMode && currentRole && currentRole.id !== 'villageois' && currentRole.id !== 'chasseur' && currentRole.id !== 'petite-fille' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="rounded-lg p-2.5 mb-4 flex items-center gap-2"
          style={{ background: 'rgba(100,140,180,0.06)', border: '1px solid rgba(100,140,180,0.15)' }}>
          <Moon size={13} style={{ color: t.nightSky }} />
          <p style={{ color: t.textSecondary, fontSize: '0.55rem', lineHeight: 1.4 }}>
            Une fois votre pouvoir utilise pendant la nuit, votre carte affichera un ecran de <strong style={{ color: t.nightSky }}>sommeil</strong> — comme un simple villageois. Personne ne verra votre role !
          </p>
        </motion.div>
      )}

      {/* ---- Night Actions ---- */}
      {((state.phase === 'night' && (state.nightStep === 'active' || state.nightStep === 'done')) || practiceMode) && currentRole && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          {currentPlayer.role === 'loup-garou' && (
            <WerewolfAction
              {...baseProps}
              onWerewolfVote={onWerewolfVote}
              isDiscoveryPhase={isDiscoveryPhase}
              onDiscoveryTarget={onDiscoveryTarget}
              discoveryPreTarget={discoveryPreTarget}
            />
          )}

          {currentPlayer.role === 'voyante' && (
            <SeerAction {...baseProps} onSeerTarget={onSeerTarget} />
          )}

          {currentPlayer.role === 'cupidon' && (
            <CupidAction {...baseProps} onCupidLink={onCupidLink} selectedTarget={selectedTarget} setSelectedTarget={setSelectedTarget} />
          )}

          {currentPlayer.role === 'sorciere' && (
            <WitchAction {...baseProps} onWitchHeal={onWitchHeal} onWitchKill={onWitchKill} onCancelWitchKill={onCancelWitchKill} />
          )}

          {currentPlayer.role === 'petite-fille' && (
            <PetiteFilleAction {...baseProps} />
          )}

          {currentPlayer.role === 'garde' && (
            <GuardAction {...baseProps} onGuardTarget={onGuardTarget} />
          )}

          {currentPlayer.role === 'corbeau' && (
            <CorbeauAction {...baseProps} onCorbeauTarget={onCorbeauTarget} />
          )}

          {currentPlayer.role === 'chasseur' && (
            <HunterAction {...baseProps} onHunterPreTarget={onHunterPreTarget} />
          )}

          {currentPlayer.role === 'renard' && (
            <FoxAction {...baseProps} onFoxTarget={onFoxTarget} onFoxReadyChange={handleFoxReadyChange} />
          )}

          {/* Concierge (already extracted) */}
          {currentPlayer.role === 'concierge' && state.phase === 'night' && (
            <ConciergeAction
              state={state}
              alivePlayers={alivePlayers}
              currentPlayer={currentPlayer}
              allPlayers={allPlayers}
              onConciergeTarget={onConciergeTarget}
              onFlipBack={onFlipBack}
              t={t}
            />
          )}

          {/* Oracle (already extracted) */}
          {currentPlayer.role === 'oracle' && state.phase === 'night' && onOracleUse && (
            <OracleAction
              state={state}
              alivePlayers={alivePlayers}
              currentPlayer={currentPlayer}
              allPlayers={allPlayers}
              onOracleUse={onOracleUse}
              onDismiss={onOracleDismiss}
              onFlipBack={onFlipBack}
              t={t}
            />
          )}

          {/* Empoisonneur (already extracted) */}
          {currentPlayer.role === 'empoisonneur' && state.phase === 'night' && onEmpoisonneurTarget && (
            <EmpoisonneurAction
              state={state}
              alivePlayers={alivePlayers}
              currentPlayer={currentPlayer}
              allPlayers={allPlayers}
              onEmpoisonneurTarget={onEmpoisonneurTarget}
              onFlipBack={onFlipBack}
              t={t}
            />
          )}

          {/* Villageois — no night action */}
          {currentPlayer.role === 'villageois' && (
            <div
              className="rounded-xl p-4 mb-5 text-center"
              style={{ background: `rgba(${t.overlayChannel}, 0.02)`, border: `1px solid rgba(${t.overlayChannel}, 0.06)` }}
            >
              <Moon size={20} style={{ color: t.textDim, margin: '0 auto' }} />
              <p style={{ color: t.textMuted, fontSize: '0.65rem', marginTop: '0.5rem' }}>
                Le village dort... Aucune action pour toi cette nuit.
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* Day phase indicator */}
      {state.phase === 'day' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl p-4 mb-5 text-center"
          style={{ background: t.goldBg, border: `1px solid ${t.goldBorder}` }}
        >
          <Sun size={18} style={{ color: t.gold, margin: '0 auto' }} />
          <p style={{ color: t.gold, fontSize: '0.65rem', fontFamily: '"Cinzel", serif', marginTop: '0.5rem' }}>
            {state.dayStep === 'vote' ? 'Le vote est en cours !' : 'Le village delibere...'}
          </p>
        </motion.div>
      )}
      </div>

      {/* Sticky bottom buttons */}
      {(onFlipBack || currentPlayer.role === 'renard') && (
        <div
          className="shrink-0 px-4 pb-4 pt-2 flex flex-col gap-2"
          style={{
            background: `linear-gradient(to top, ${t.pageBg}, ${t.pageBg}ee 70%, transparent)`,
          }}
        >
          <AnimatePresence>
            {currentPlayer.role === 'renard' && foxConfirmFn && (
              <motion.button
                key="fox-confirm"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => foxConfirmFn()}
                className="w-full py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
                style={{
                  background: 'linear-gradient(135deg, #f97316, #ea580c)',
                  color: 'white',
                  fontFamily: '"Cinzel", serif',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  boxShadow: '0 4px 15px rgba(249,115,22,0.3)',
                }}
              >
                <Search size={14} /> Flairer ce groupe
              </motion.button>
            )}
          </AnimatePresence>
          {onFlipBack && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              onClick={onFlipBack}
              whileTap={{ scale: 0.95 }}
              className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl transition-all duration-200"
              style={{
                background: `rgba(${t.overlayChannel}, 0.04)`,
                border: `1px solid rgba(${t.overlayChannel}, 0.12)`,
                color: t.textSecondary,
                fontFamily: '"Cinzel", serif',
                fontSize: '0.65rem',
                letterSpacing: '0.05em',
              }}
            >
              <RotateCcw size={13} />
              Retourner la carte
            </motion.button>
          )}
        </div>
      )}
    </div>
  );
}