import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, Check, Copy, CheckCheck } from 'lucide-react';
import { UserX } from 'lucide-react';
import { useGamePanelContext } from './GamePanelContext';
import { buildNightActions, computeVoteData } from './useGMGameLogic';
import { GMVoteTracking } from './GMVoteTracking';
import { GMNightDashboard } from './GMNightDashboard';
import { GMVillageGrid } from './GMVillageGrid';
import { GMPhaseBanner } from './GMPhaseBanner';
import { GMAvatar, SectionHeader } from './GMShared';
import { type Player } from '../../../context/gameTypes';

/* ================================================================
   Mobile Controls View — Game controls optimized for mobile
   Consumes shared state via GamePanelContext (no prop drilling).
   ================================================================ */

interface MobileControlsViewProps {
  phaseOutcomePreview: React.ReactNode;
}

export function MobileControlsView({ phaseOutcomePreview }: MobileControlsViewProps) {
  const {
    state, alivePlayers, isNight, hasRole,
    selectedPlayer, setSelectedPlayer, t,
    updateState, navigate,
    nightActionsTab, setNightActionsTab,
    setMobileView,
    handleNightActionClick: onNightActionClick,
    onNavigateToPlayersTab,
  } = useGamePanelContext();

  const [revealSelectedPlayer, setRevealSelectedPlayer] = React.useState<Player | null>(null);
  const [codeCopied, setCodeCopied] = React.useState(false);

  const nightActions = React.useMemo(() => {
    const allActions = buildNightActions(state, hasRole, alivePlayers);
    return allActions.map((a) => ({ ...a, detail: a.compactDetail }));
  }, [state, hasRole, alivePlayers]);

  const voteData = React.useMemo(
    () => computeVoteData(state, alivePlayers),
    [state, alivePlayers],
  );

  /* ── Role Reveal Phase ── */
  if (state.roleRevealDone === false) {
    const revealedBy = state.roleRevealedBy ?? [];
    const totalPlayers = state.players.length;
    const allRevealed = revealedBy.length === totalPlayers;
    const compact = totalPlayers > 16;

    return (
      <div className="px-3 py-4 space-y-4 flex flex-col flex-1 min-h-0">
        {/* Rotating card animation + title */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <motion.span
            className="text-5xl block mb-3"
            animate={{ rotateY: [0, 360] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          >
            🃏
          </motion.span>
          <h2 style={{ fontFamily: '"Cinzel Decorative", "Cinzel", serif', color: '#d4a843', fontSize: '1.1rem', marginBottom: '0.3rem' }}>
            Decouverte des roles
          </h2>
          {/* Progress counter */}
          <div className="flex items-center justify-center gap-2 mt-2">
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

        {/* Selected player code display */}
        <AnimatePresence>
          {revealSelectedPlayer && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div
                className="rounded-xl p-3 flex items-center justify-between gap-3"
                style={{
                  background: 'rgba(212,168,67,0.08)',
                  border: '1px solid rgba(212,168,67,0.25)',
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <GMAvatar player={revealSelectedPlayer} size="text-lg" />
                  <div className="min-w-0">
                    <span style={{ color: '#8090b0', fontSize: '0.65rem' }}>{revealSelectedPlayer.name}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span style={{ fontFamily: '"Cinzel", serif', color: '#d4a843', fontSize: '1.2rem', fontWeight: 700, letterSpacing: '0.15em' }}>
                        {revealSelectedPlayer.shortCode}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const text = revealSelectedPlayer.shortCode;
                    const ta = document.createElement('textarea');
                    ta.value = text;
                    ta.style.position = 'fixed';
                    ta.style.opacity = '0';
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                    setCodeCopied(true);
                    setTimeout(() => setCodeCopied(false), 2000);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer flex-shrink-0"
                  style={{
                    background: codeCopied ? 'rgba(107,142,90,0.2)' : 'rgba(212,168,67,0.15)',
                    border: `1px solid ${codeCopied ? 'rgba(107,142,90,0.4)' : 'rgba(212,168,67,0.3)'}`,
                    color: codeCopied ? '#6b8e5a' : '#d4a843',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                  }}
                >
                  {codeCopied ? <CheckCheck size={13} /> : <Copy size={13} />}
                  {codeCopied ? 'Copie !' : 'Copier'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Village grid with role-seen status */}
        <div
          className="rounded-xl p-3 flex-1 min-h-0 overflow-y-auto"
          style={{
            background: `rgba(${t.overlayChannel}, 0.02)`,
            border: `1px solid rgba(${t.overlayChannel}, 0.06)`,
          }}
        >
          <div className={compact ? 'grid grid-cols-5 gap-2' : 'grid grid-cols-4 gap-2.5'}>
            {state.players.map((p: Player) => {
              const hasSeen = revealedBy.includes(p.id);
              const isSelected = revealSelectedPlayer?.id === p.id;
              const avatarSize = compact ? 'w-9 h-9' : 'w-11 h-11';
              const badgeSize = compact ? 'w-3.5 h-3.5' : 'w-4 h-4';
              const emojiSize = compact ? 'text-base' : 'text-lg';
              const nameFontSize = compact ? '0.48rem' : '0.52rem';
              return (
                <button
                  key={p.id}
                  className="flex flex-col items-center gap-1"
                  onClick={() => {
                    setRevealSelectedPlayer(p);
                    setCodeCopied(false);
                  }}
                >
                  <div
                    className={`${avatarSize} rounded-full flex items-center justify-center relative transition-all`}
                    style={{
                      background: isSelected ? 'rgba(212,168,67,0.18)' : hasSeen ? 'rgba(107,142,90,0.12)' : 'rgba(255,255,255,0.04)',
                      border: `2px solid ${isSelected ? 'rgba(212,168,67,0.6)' : hasSeen ? 'rgba(107,142,90,0.4)' : 'rgba(255,255,255,0.1)'}`,
                      boxShadow: isSelected ? '0 0 8px rgba(212,168,67,0.3)' : 'none',
                    }}
                  >
                    <GMAvatar player={p} size={emojiSize} />
                    <div
                      className={`absolute -bottom-0.5 -right-0.5 ${badgeSize} rounded-full flex items-center justify-center`}
                      style={{
                        background: hasSeen ? '#6b8e5a' : '#4a5568',
                        border: '2px solid #0a0e1a',
                      }}
                    >
                      {hasSeen && <Check size={compact ? 6 : 8} style={{ color: '#fff' }} />}
                    </div>
                  </div>
                  <span
                    className="truncate w-full text-center"
                    style={{
                      color: hasSeen ? t.text : t.textDim,
                      fontSize: nameFontSize,
                      maxWidth: compact ? '2.8rem' : '3.5rem',
                      margin: '0 auto',
                    }}
                  >
                    {p.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-3 space-y-3">
      {/* Compact Phase Banner + Timer Bar */}
      <GMPhaseBanner state={state} isNight={isNight} alivePlayers={alivePlayers} t={t} compact />

      {/* Night role dashboard — mobile compact */}
      {isNight && state.nightStep === 'active' && (
        <GMNightDashboard
          nightActions={nightActions}
          nightActionsTab={nightActionsTab}
          setNightActionsTab={setNightActionsTab}
          onActionClick={onNightActionClick}
          t={t}
          compact
        />
      )}

      {/* Vote tracking — mobile compact */}
      {!isNight && (state.dayStep === 'vote' || state.dayStep === 'result') && (
        <GMVoteTracking voteData={voteData} isNight={isNight} t={t} compact />
      )}

      {/* Phase outcome preview — mobile */}
      {phaseOutcomePreview}

      {/* Compact Village Grid — mobile (present players only when absents exist) */}
      <GMVillageGrid
        players={
          state.villagePresentIds
            ? state.players.filter((p: Player) => state.villagePresentIds!.includes(p.id))
            : state.players
        }
        selectedPlayer={selectedPlayer}
        maireId={state.maireId}
        onPlayerClick={(id) => { if (onNavigateToPlayersTab) { onNavigateToPlayersTab(id); } else { setSelectedPlayer(selectedPlayer === id ? null : id); setMobileView('players'); } }}
        t={t}
        compact
        playerTags={state.playerTags}
      />

      {/* Absents Grid — mobile */}
      {state.villagePresentIds && (() => {
        const awayPlayers = state.players.filter(
          (p: Player) => p.alive && !state.villagePresentIds!.includes(p.id)
        );
        if (awayPlayers.length === 0) return null;
        return (
          <div
            className="rounded-xl p-3"
            style={{
              background: 'rgba(245,158,11,0.03)',
              border: '1px solid rgba(245,158,11,0.12)',
            }}
          >
            <SectionHeader
              icon={<UserX size={12} style={{ color: '#f59e0b' }} />}
              title={`Absents (${awayPlayers.length})`}
              t={t}
            />
            <div className="grid grid-cols-4 gap-2 mt-2">
              {awayPlayers.map((p: Player) => (
                <button
                  key={p.id}
                  className="flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all"
                  style={{
                    background: selectedPlayer === p.id ? 'rgba(245,158,11,0.08)' : 'transparent',
                    border: selectedPlayer === p.id ? '1px solid rgba(245,158,11,0.2)' : '1px solid transparent',
                    opacity: 0.55,
                  }}
                  onClick={() => { if (onNavigateToPlayersTab) { onNavigateToPlayersTab(p.id); } else { setSelectedPlayer(selectedPlayer === p.id ? null : p.id); setMobileView('players'); } }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{
                      background: 'rgba(245,158,11,0.06)',
                      border: '1.5px solid rgba(245,158,11,0.2)',
                    }}
                  >
                    <GMAvatar player={p} size="text-lg" />
                  </div>
                  <span
                    className="truncate max-w-[3rem]"
                    style={{ color: t.textDim, fontSize: '0.5rem', textAlign: 'center' }}
                  >
                    {p.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })()}

    </div>
  );
}