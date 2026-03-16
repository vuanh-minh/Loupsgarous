import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Eye, Check, Moon, Crown, UserX } from 'lucide-react';
import { useGamePanelContext } from './GamePanelContext';
import { buildNightActions, computeVoteData } from './useGMGameLogic';
import { GMVoteTracking } from './GMVoteTracking';
import { GMNightDashboard } from './GMNightDashboard';
import { GMVillageGrid } from './GMVillageGrid';
import { GMPhaseBanner } from './GMPhaseBanner';
import { GMPhaseActions } from './GMPhaseActions';
import { GMAvatar, SectionHeader, getConnectionStatus } from './GMShared';
import { getRoleById } from '../../../data/roles';
import { type Player } from '../../../context/gameTypes';

/* ================================================================
   Game Controls — center column: phase banner, timer, actions,
   night dashboard, vote tracking, village grid
   Consumes shared state via GamePanelContext (no prop drilling).
   ================================================================ */

interface GMGameControlsProps {
  phaseOutcomePreview: React.ReactNode;
}

export function GMGameControls({ phaseOutcomePreview }: GMGameControlsProps) {
  const {
    state, alivePlayers, isNight, hasRole,
    leverLeSoleil, handleAdvanceTurn, resolveVote, addEvent,
    playerHeartbeats, t,
    selectedPlayer, setSelectedPlayer,
    updateState, handleResolveMaireElection, navigate,
    handleNightActionClick: onNightActionClick,
    handleStartNight1,
  } = useGamePanelContext();

  const [nightActionsTab, setNightActionsTab] = useState<'pending' | 'done'>('pending');

  const nightActions = React.useMemo(
    () => buildNightActions(state, hasRole, alivePlayers),
    [state, hasRole, alivePlayers],
  );

  const voteData = React.useMemo(
    () => computeVoteData(state, alivePlayers),
    [state, alivePlayers],
  );

  /* ── Role Reveal Phase (desktop) ── */
  if (state.roleRevealDone === false) {
    const revealedBy = state.roleRevealedBy ?? [];
    const totalPlayers = state.players.length;
    const allRevealed = revealedBy.length === totalPlayers;

    return (
      <div className="max-w-2xl mx-auto w-full p-6">
        {/* Rotating card animation + title */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center mb-6"
        >
          <motion.span
            className="text-6xl block mb-4"
            animate={{ rotateY: [0, 360] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          >
            🃏
          </motion.span>
          <h2 style={{ fontFamily: '"Cinzel Decorative", "Cinzel", serif', color: '#d4a843', fontSize: '1.4rem', marginBottom: '0.5rem' }}>
            Decouverte des roles
          </h2>
          <p style={{ color: '#8090b0', fontSize: '0.8rem', maxWidth: '24rem', margin: '0 auto' }}>
            Les joueurs decouvrent leur role secret. Attendez que tout le monde ait consulte son role avant de lancer la premiere nuit.
          </p>
          {/* Progress counter */}
          <div className="flex items-center justify-center gap-2 mt-3">
            <Eye size={14} style={{ color: '#d4a843' }} />
            <span style={{ color: '#8090b0', fontSize: '0.75rem' }}>
              <span style={{ color: allRevealed ? '#6b8e5a' : '#d4a843', fontWeight: 600 }}>
                {revealedBy.length}
              </span>
              {' / '}{totalPlayers} ont vu leur role
            </span>
            {allRevealed && <Check size={14} style={{ color: '#6b8e5a' }} />}
          </div>
        </motion.div>

        {/* Village grid with role-seen status */}
        <div
          className="rounded-xl p-5 mb-6"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {state.players.map((p: Player) => {
              const hasSeen = revealedBy.includes(p.id);
              return (
                <button
                  key={p.id}
                  className="flex flex-col items-center gap-1.5 cursor-pointer transition-transform hover:scale-110 active:scale-95"
                  onClick={() => {
                    sessionStorage.setItem('__gm_preview', '1');
                    navigate(`/player/${p.shortCode}`);
                  }}
                  title={`Voir la page de ${p.name}`}
                >
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center relative"
                    style={{
                      background: hasSeen ? 'rgba(107,142,90,0.12)' : 'rgba(255,255,255,0.04)',
                      border: `2px solid ${hasSeen ? 'rgba(107,142,90,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    }}
                  >
                    <GMAvatar player={p} size="text-xl" />
                    <div
                      className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{
                        background: hasSeen ? '#6b8e5a' : '#4a5568',
                        border: '2px solid #0a0e1a',
                      }}
                    >
                      {hasSeen && <Check size={8} style={{ color: '#fff' }} />}
                    </div>
                  </div>
                  <span
                    className="truncate max-w-[3.5rem] text-center"
                    style={{ color: hasSeen ? t.text : t.textDim, fontSize: '0.55rem' }}
                  >
                    {p.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Start button */}
        <div className="flex justify-center">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleStartNight1}
            className="flex items-center justify-center gap-3 py-4 px-10 rounded-xl transition-all"
            style={{
              background: 'linear-gradient(135deg, #d4a843, #b8860b)',
              color: '#0a0e1a',
              fontFamily: '"Cinzel", serif',
              fontSize: '1rem',
              fontWeight: 600,
              boxShadow: '0 4px 20px rgba(212,168,67,0.3)',
            }}
          >
            {state.maireElectionDone ? <Moon size={18} /> : <Crown size={18} />}
            {state.maireElectionDone ? 'Lancer la Nuit 1' : "Lancer l'Election du Maire"}
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto w-full p-6">
      {/* Phase Banner + Timer Bar */}
      <GMPhaseBanner state={state} isNight={isNight} alivePlayers={alivePlayers} t={t} />

      {/* Phase Actions */}
      <GMPhaseActions
        state={state}
        leverLeSoleil={leverLeSoleil}
        handleAdvanceTurn={handleAdvanceTurn}
        resolveVote={resolveVote}
        addEvent={addEvent}
        handleResolveMaireElection={handleResolveMaireElection}
        t={t}
        className="mb-4"
      />

      {/* Night role dashboard */}
      {isNight && state.nightStep === 'active' && (
        <GMNightDashboard
          nightActions={nightActions}
          nightActionsTab={nightActionsTab}
          setNightActionsTab={setNightActionsTab}
          onActionClick={onNightActionClick}
          t={t}
        />
      )}

      {/* Vote tracking */}
      {!isNight && (state.dayStep === 'vote' || state.dayStep === 'result') && (
        <GMVoteTracking voteData={voteData} isNight={isNight} t={t} />
      )}

      {/* Phase outcome preview — desktop */}
      {phaseOutcomePreview && <div className="pb-0">{phaseOutcomePreview}</div>}

      {/* Village Grid (present players only) */}
      <GMVillageGrid
        players={state.villagePresentIds
          ? state.players.filter((p: Player) => state.villagePresentIds!.includes(p.id))
          : state.players}
        selectedPlayer={selectedPlayer}
        maireId={state.maireId}
        onPlayerClick={(id) => setSelectedPlayer(id)}
        t={t}
        playerHeartbeats={playerHeartbeats}
        playerTags={state.playerTags}
      />

      {/* Absents Grid */}
      {state.villagePresentIds && (() => {
        const awayPlayers = state.players.filter(
          (p: Player) => p.alive && !state.villagePresentIds!.includes(p.id)
        );
        if (awayPlayers.length === 0) return null;
        return (
          <div
            className="rounded-xl p-5 mt-4"
            style={{
              background: 'rgba(245,158,11,0.03)',
              border: '1px solid rgba(245,158,11,0.12)',
            }}
          >
            <SectionHeader
              icon={<UserX size={14} style={{ color: '#f59e0b' }} />}
              title={`Absents (${awayPlayers.length})`}
              t={t}
            />
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 mt-3">
              {awayPlayers.map((p: Player) => {
                const role = getRoleById(p.role);
                const isSelected = selectedPlayer === p.id;
                const conn = playerHeartbeats
                  ? getConnectionStatus(p.shortCode, playerHeartbeats)
                  : null;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPlayer(isSelected ? null : p.id)}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all hover:bg-white/[0.02]"
                    style={{
                      background: isSelected ? 'rgba(245,158,11,0.08)' : 'transparent',
                      border: isSelected ? '1px solid rgba(245,158,11,0.2)' : '1px solid transparent',
                      opacity: 0.55,
                    }}
                  >
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center relative"
                      style={{
                        background: `${role?.color || '#666'}10`,
                        border: `2px solid ${role?.color || '#666'}30`,
                        filter: 'grayscale(0.4)',
                      }}
                    >
                      <GMAvatar player={p} size="text-xl" />
                      {conn && (
                        <span
                          className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                          style={{ background: conn.color, borderColor: '#0a1020' }}
                          title={conn.label}
                        />
                      )}
                    </div>
                    <span
                      className="truncate max-w-[3.5rem]"
                      style={{ color: t.textDim, fontSize: '0.6rem', textAlign: 'center' }}
                    >
                      {p.name}
                    </span>
                    <span style={{ fontSize: '0.55rem', color: role?.color || '#6b7b9b' }}>
                      {role?.emoji}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}