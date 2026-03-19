/**
 * GamePanel.tsx — Orchestrator.
 *
 * Sub-components (in /src/app/components/pages/player/):
 *   gamePanelTypes.ts        — shared prop types
 *   VictimBanner.tsx         — night/day victim banner
 *   PhaseBanner.tsx          — phase status card
 *   LoverBanner.tsx          — cupid lover notification
 *   VoteSection.tsx          — vote grid + confirmation/cancel
 *   MaireCandidacySection.tsx — candidacy button + modal
 */
import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CircleCheck, Vote, X } from 'lucide-react';
import type { GamePanelProps } from './gamePanelTypes';
import { PlayerHintSection } from '../../HintComponents';
import { VictimBanner } from './VictimBanner';
import { PhaseBanner } from './PhaseBanner';
import { LoverBanner } from './LoverBanner';
import { VoteSection, type VoteSectionHandle } from './VoteSection';

export type { GamePanelProps } from './gamePanelTypes';

export function GamePanel({
  alivePlayers,
  phase, dayStep,
  currentPlayerId,
  votes, onVote, onCancelVote, currentPlayerAlive,
  canFlip, onFlip, currentRole,
  hypotheses,
  isPracticeMode = false,
  isSimulationMode = false,
  isDemoMode = false,
  tutorialStep = 0,
  isVillageois = false,
  t,
  deadPlayers = [],
  events = [],
  turn = 1,
  hints = [],
  playerHints = [],
  onRevealHint,
  phaseTimerEndAt,
  loverPairs = [],
  allPlayers = [],
  maireId = null,
  maireElectionDone = false,
  maireCandidates = [],
  maireCampaignMessages = {},
  onDeclareCandidacy,
  onWithdrawCandidacy,
  nominations = {},
  lastWillUsed = {},
  dayEliminationsCount,
  isFlipped = false,
  onFlipBack: _onFlipBack,
  roleBackContent,
  onSetHypothesis,
  gameId,
}: GamePanelProps) {
  const voteSectionRef = useRef<VoteSectionHandle>(null);

  // ── Derived state ──
  const isNight = phase === 'night';
  const isMaireElection = !isNight && dayStep === 'vote' && !maireElectionDone && turn === 1;
  const isVotePhase = !isNight && dayStep === 'vote';
  const myVote = currentPlayerId !== null ? votes[currentPlayerId] : undefined;
  const isCandidate = currentPlayerId !== null && maireCandidates.includes(currentPlayerId);

  // Vote counts (Maire's vote = 2 during regular votes, not during Maire election)
  // Dernière volonté (dead players who used last will) included in tally
  const aliveIdSet = new Set(alivePlayers.map((p) => p.id));
  const voteCounts: Record<number, number> = {};
  if (isVotePhase) {
    Object.entries(votes).forEach(([voterId, targetId]) => {
      const vid = parseInt(voterId);
      if (!aliveIdSet.has(vid) && !lastWillUsed[vid]) return; // skip dead players without dernière volonté
      const weight = (!isMaireElection && maireId !== null && vid === maireId) ? 2 : 1;
      voteCounts[targetId] = (voteCounts[targetId] || 0) + weight;
    });
  }

  const maireVoteTarget = (!isMaireElection && maireId !== null && votes[maireId] !== undefined)
    ? votes[maireId]
    : undefined;

  // Count total alive voters who have voted
  const totalVotes = isVotePhase
    ? Object.keys(votes).filter((id) => aliveIdSet.has(parseInt(id))).length
    : 0;

  return (
    <div className="px-4 pb-6 flex flex-col min-h-full relative overflow-hidden" style={{ paddingTop: '1rem', paddingBottom: 'calc(120px + 16px + env(safe-area-inset-bottom, 12px))' }}>
      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-full flex-1">
        {/* Last victim / night victims banner */}
        <VictimBanner
          isNight={isNight}
          isPracticeMode={isPracticeMode}
          phase={phase}
          turn={turn}
          events={events}
          deadPlayers={deadPlayers}
          t={t}
        />

        {/* Hero banner removed — maire election now uses immersive timer */}

        {/* Phase status card — 3D flip during night */}
        <div
          className={`relative z-10 flex flex-col ${isVotePhase ? '' : 'flex-1'} min-h-0 ${isVotePhase ? '' : ''}`}
          style={{ perspective: (isNight || isPracticeMode) && currentPlayerAlive ? '1200px' : undefined, marginBottom: isVotePhase ? 'clamp(6px, 1.5vh, 16px)' : undefined }}
        >
          <motion.div
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            className={`flex flex-col ${isVotePhase ? '' : 'flex-1'} min-h-0`}
            style={{ transformStyle: 'preserve-3d', position: 'relative' }}
          >
            {/* FRONT FACE — PhaseBanner */}
            <div
              className={`flex flex-col ${isVotePhase ? '' : 'flex-1'} min-h-0`}
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                pointerEvents: isFlipped ? 'none' : 'auto',
                visibility: isFlipped ? 'hidden' : 'visible',
                zIndex: isFlipped ? 0 : 1,
              }}
            >
              <PhaseBanner
                isNight={isNight}
                isVotePhase={isVotePhase}
                isMaireElection={isMaireElection}
                currentPlayerAlive={currentPlayerAlive}
                canFlip={canFlip}
                onFlip={onFlip}
                isPracticeMode={isPracticeMode}
                isSimulationMode={isSimulationMode}
                isDemoMode={isDemoMode}
                tutorialStep={tutorialStep}
                isVillageois={isVillageois}
                currentRole={currentRole}
                phaseTimerEndAt={phaseTimerEndAt}
                t={t}
                totalVotes={totalVotes}
                totalAlivePlayers={alivePlayers.length}
                dayEliminationsCount={dayEliminationsCount}
              />
            </div>

            {/* BACK FACE — Role action content */}
            {(isNight || isPracticeMode) && currentPlayerAlive && roleBackContent && (
              <div
                className="absolute inset-0 flex flex-col min-h-0 rounded-xl overflow-hidden"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  background: 'rgba(12,13,21,0.9)',
                  border: `1px solid rgba(124,141,181,0.15)`,
                  pointerEvents: isFlipped ? 'auto' : 'none',
                  visibility: isFlipped ? 'visible' : 'hidden',
                  zIndex: isFlipped ? 1 : 0,
                }}
              >
                {roleBackContent}
              </div>
            )}
          </motion.div>
        </div>

        {/* Vote section (only during vote phase) — placed right after PhaseBanner */}
        <VoteSection
          ref={voteSectionRef}
          alivePlayers={alivePlayers}
          allPlayers={allPlayers}
          currentPlayerId={currentPlayerId}
          currentPlayerAlive={currentPlayerAlive}
          votes={votes}
          onVote={onVote}
          onCancelVote={onCancelVote}
          isMaireElection={isMaireElection}
          isVotePhase={isVotePhase}
          voteCounts={voteCounts}
          myVote={myVote}
          maireVoteTarget={maireVoteTarget}
          maireId={maireId ?? null}
          maireCandidates={maireCandidates}
          maireCampaignMessages={maireCampaignMessages}
          hypotheses={hypotheses}
          nominations={nominations}
          t={t}
          isCandidate={isCandidate}
          onDeclareCandidacy={onDeclareCandidacy}
          onWithdrawCandidacy={onWithdrawCandidacy}
        />

        {/* Lover banner */}
        <LoverBanner
          currentPlayerId={currentPlayerId}
          isPracticeMode={isPracticeMode}
          loverPairs={loverPairs}
          allPlayers={allPlayers}
          t={t}
        />

        {/* Practice mode tutorial tips (simulation only) */}
        {isSimulationMode && !isVillageois && tutorialStep >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg p-3 mb-3 mt-3 text-center"
            style={{
              background: 'rgba(107,142,90,0.08)',
              border: '1px solid rgba(107,142,90,0.2)',
            }}
          >
            <div className="flex items-center justify-center gap-2 mb-1">
              <CircleCheck size={13} style={{ color: '#6b8e5a' }} />
              <span style={{ color: '#6b8e5a', fontSize: '0.65rem', fontFamily: '"Cinzel", serif' }}>
                Parfait !
              </span>
            </div>
            <p style={{ color: t.textMuted, fontSize: '0.55rem', lineHeight: 1.5 }}>
              Continuez a vous entrainer. Touchez la carte pour simuler vos pouvoirs.
            </p>
          </motion.div>
        )}

        {/* Discovery phase waiting message for passive roles */}
        {isPracticeMode && (isVillageois || currentRole?.id === 'petite-fille') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-lg p-3 mt-3 text-center"
            style={{
              background: `${t.nightSky}0f`,
              border: `1px solid ${t.nightSky}1f`,
            }}
          >
            <p style={{ color: t.textMuted, fontSize: '0.6rem', lineHeight: 1.5 }}>
              Explorez l'onglet <strong style={{ color: t.textSecondary }}>Village</strong> ou le <strong style={{ color: t.textSecondary }}>Journal</strong> en attendant le debut de la partie.
            </p>
          </motion.div>
        )}

        {/* Non-vote day/night info */}
        {!isVotePhase && !isNight && (
          <>
            <div
              className="rounded-xl p-4 text-center"
              style={{ background: t.goldBg, border: `1px solid ${t.goldBorder}` }}
            >
              <p style={{ color: t.textSecondary, fontSize: '0.65rem' }}>
                En attente du vote ou de la decision du Maitre du Jeu...
              </p>
            </div>
          </>
        )}

        {/* Night info for players who can't flip */}
        {isNight && !canFlip && (
          null
        )}

        {/* Hint section — Night phase (bottom of panel, hidden when card is flipped) */}
        {isNight && !isFlipped && currentPlayerId !== null && !isPracticeMode && (
          <div className="mt-auto relative" style={{ zIndex: 20, paddingTop: '16px' }}>
            <PlayerHintSection
              hints={hints}
              playerHints={playerHints}
              playerId={currentPlayerId}
              t={t}
              onReveal={(hintId) => onRevealHint?.(hintId)}
              compact
              players={allPlayers}
              onSetHypothesis={onSetHypothesis}
              gameId={gameId}
            />
          </div>
        )}

        {/* Hint section — Day phase (both vote & non-vote), pushed to bottom */}
        {!isNight && currentPlayerId !== null && !isPracticeMode && (
          <div className="mt-auto relative" style={{ zIndex: 20, paddingTop: '16px' }}>
            <PlayerHintSection
              hints={hints}
              playerHints={playerHints}
              playerId={currentPlayerId}
              t={t}
              onReveal={(hintId) => onRevealHint?.(hintId)}
              compact
              players={allPlayers}
              onSetHypothesis={onSetHypothesis}
              gameId={gameId}
            />
          </div>
        )}

        {/* ── "Nominer" button — between Indices and footer ── */}
        <AnimatePresence>
          {isVotePhase && !isMaireElection && myVote === undefined && currentPlayerAlive && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="relative z-30 px-[0px] pb-[0px]"
              style={{ paddingTop: 'clamp(6px, 1.5vh, 15px)' }}
            >
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => voteSectionRef.current?.openNominate()}
                className="w-full flex items-center justify-center gap-2 rounded-[14px] transition-colors"
                style={{
                  background: 'rgba(61,52,36,0.8)',
                  border: '1.6px solid rgba(212,168,67,0.3)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                  color: '#d4a843',
                  fontSize: 'clamp(14px, 4vw, 16px)',
                  fontFamily: '"Cinzel", serif',
                  fontWeight: 700,
                  backdropFilter: 'blur(12px)',
                  padding: 'clamp(10px, 2vh, 14px) 0',
                }}
              >
                <Vote size={16} />
                Nominer
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── "Annuler" cancel-vote button — shown when player has voted ── */}
        <AnimatePresence>
          {isVotePhase && myVote !== undefined && currentPlayerId !== null && currentPlayerAlive && (
            <motion.div
              key="cancel-vote-btn"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="relative z-30"
              style={{ paddingTop: 'clamp(6px, 1.5vh, 15px)' }}
            >
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => onCancelVote(currentPlayerId)}
                className="w-full flex items-center justify-center gap-2 rounded-[14px] transition-colors"
                style={{
                  background: 'rgba(140,40,50,0.25)',
                  border: '1.6px solid rgba(196,30,58,0.35)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                  color: '#ff8a95',
                  fontSize: 'clamp(13px, 3.5vw, 15px)',
                  fontFamily: '"Cinzel", serif',
                  fontWeight: 700,
                  backdropFilter: 'blur(12px)',
                  padding: 'clamp(10px, 2vh, 14px) 0',
                }}
              >
                <X size={16} />
                Annuler mon vote
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}