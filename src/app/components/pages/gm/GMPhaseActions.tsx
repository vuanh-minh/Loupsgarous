import React from 'react';
import { Moon, Sun, Crown, Zap } from 'lucide-react';
import { type Player, type GameState } from '../../../context/gameTypes';
import { type GameThemeTokens } from '../../../context/gameTheme';
import { SectionHeader, GMButton } from './GMShared';

/* ================================================================
   GMPhaseActions — context-aware action buttons for the current
   game phase (night → sunrise, day → maire election / close vote).
   Extracted from GMGameControls for readability and isolation.
   ================================================================ */

interface GMPhaseActionsProps {
  state: GameState;
  leverLeSoleil: () => void;
  handleAdvanceTurn: () => void;
  resolveVote: () => void;
  addEvent: (msg: string) => void;
  handleResolveMaireElection?: () => void;
  t: GameThemeTokens;
  className?: string;
  compact?: boolean;
}

export const GMPhaseActions = React.memo(function GMPhaseActions({
  state,
  leverLeSoleil,
  handleAdvanceTurn,
  resolveVote,
  addEvent,
  handleResolveMaireElection,
  t,
  className = '',
  compact = false,
}: GMPhaseActionsProps) {
  const candidates = state.maireCandidates ?? [];
  const isMaireElection =
    state.phase === 'day' &&
    !state.maireElectionDone &&
    state.turn === 1 &&
    state.roleRevealDone;

  // Compute leading candidate(s) for gold highlight
  const leadingCandidateIds = new Set<number>();
  if (isMaireElection && candidates.length > 0) {
    const tally: Record<number, number> = {};
    Object.values(state.votes).forEach((targetId) => {
      tally[targetId as number] = (tally[targetId as number] || 0) + 1;
    });
    let maxV = 0;
    candidates.forEach((cId) => {
      const count = tally[cId] || 0;
      if (count > maxV) maxV = count;
    });
    if (maxV > 0) {
      candidates.forEach((cId) => {
        if ((tally[cId] || 0) === maxV) leadingCandidateIds.add(cId);
      });
    }
  }

  const isVotePhase =
    state.phase === 'day' &&
    (state.dayStep === 'vote' || state.dayStep === 'result') &&
    (state.maireElectionDone || state.turn > 1);

  return (
    <div
      className={compact ? className : `rounded-xl p-5 ${className}`}
      style={compact ? undefined : {
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {!compact && <SectionHeader icon={<Zap size={14} />} title="Actions" t={t} />}
      <div className={`grid grid-cols-1 ${compact ? 'gap-2' : 'gap-3 mt-3'}`}>
        {/* Night → lever le soleil */}
        {state.phase === 'night' && (
          <GMButton
            onClick={leverLeSoleil}
            icon={<Sun size={compact ? 14 : 16} />}
            label="Lever le soleil"
            color="#f0c55b"
            primary
          />
        )}

        {/* Day — Maire election */}
        {isMaireElection && (
          <>
            {candidates.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 px-1 mb-1">
                <span
                  style={{
                    color: '#d4a843',
                    fontSize: '0.55rem',
                    fontFamily: '"Cinzel", serif',
                  }}
                >
                  {candidates.length} candidat{candidates.length > 1 ? 's' : ''} :
                </span>
                {candidates.map((cId: number) => {
                  const cp = state.players.find((p: Player) => p.id === cId);
                  if (!cp) return null;
                  const isLeading = leadingCandidateIds.has(cId);
                  return (
                    <span
                      key={cId}
                      className="px-1.5 py-0.5 rounded-full"
                      style={{
                        background: isLeading ? 'rgba(212,168,67,0.25)' : 'rgba(212,168,67,0.1)',
                        border: `1px solid ${isLeading ? 'rgba(212,168,67,0.7)' : 'rgba(212,168,67,0.25)'}`,
                        color: isLeading ? '#ffd700' : '#d4a843',
                        fontSize: '0.5rem',
                        fontFamily: '"Cinzel", serif',
                        fontWeight: isLeading ? 700 : 400,
                        boxShadow: isLeading ? '0 0 8px rgba(212,168,67,0.3)' : 'none',
                      }}
                    >
                      {cp.name}{isLeading ? ' ★' : ''}
                    </span>
                  );
                })}
              </div>
            )}
            <GMButton
              onClick={() => {
                if (handleResolveMaireElection) handleResolveMaireElection();
              }}
              icon={<Crown size={compact ? 14 : 16} />}
              label="Clore l'election du Maire"
              color="#d4a843"
              primary
            />
          </>
        )}

        {/* Day — Close vote & advance to night */}
        {isVotePhase && (
          <GMButton
            onClick={() => {
              if (state.dayStep === 'vote') {
                resolveVote();
                addEvent('Le vote est clos. Decompte des voix...');
              }
              handleAdvanceTurn();
            }}
            icon={<Moon size={compact ? 14 : 16} />}
            label="Clore le vote et passer a la nuit"
            color="#7c8db5"
            primary
          />
        )}
      </div>
    </div>
  );
});