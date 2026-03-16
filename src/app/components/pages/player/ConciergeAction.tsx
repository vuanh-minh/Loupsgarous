import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, EyeOff, Search, X, Target, CircleCheck } from 'lucide-react';
import { type Player, type GameState } from '../../../context/GameContext';
import { type GameThemeTokens } from '../../../context/gameTheme';
import type { CSSProperties } from 'react';
import { resolveAvatarUrl } from '../../../data/avatarResolver';

/** Renders a player's avatar — image if uploaded, emoji otherwise */
function PAvatar({ player, size = 'text-lg', className = '', style }: {
  player: Pick<Player, 'avatar' | 'avatarUrl' | 'name'> & { alive?: boolean };
  size?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const resolvedUrl = resolveAvatarUrl(player.avatarUrl);
  const sizeMap: Record<string, string> = {
    'text-xs': 'w-4 h-4', 'text-sm': 'w-5 h-5', 'text-base': 'w-6 h-6',
    'text-lg': 'w-7 h-7', 'text-xl': 'w-8 h-8', 'text-2xl': 'w-9 h-9', 'text-3xl': 'w-10 h-10', 'text-4xl': 'w-12 h-12',
  };
  if (resolvedUrl) {
    return (
      <img
        src={resolvedUrl}
        alt={player.name}
        className={`${sizeMap[size] || 'w-7 h-7'} rounded-full object-cover inline-block ${className}`}
        style={{ filter: player.alive === false ? 'grayscale(1)' : 'none', ...style }}
      />
    );
  }
  return <span className={`${size} ${className}`} style={{ filter: player.alive === false ? 'grayscale(1)' : 'none', ...style }}>{player.avatar}</span>;
}

// Compute movement result for a given player
function computeResult(targetId: number, state: GameState, allPlayers: Player[]): { result: string; emoji: string } {
  const tp = allPlayers.find(p => p.id === targetId);
  if (!tp) return { result: 'Joueur introuvable.', emoji: '?' };
  const role = tp.role;

  // Wolves: visited their vote target
  if (role === 'loup-garou' && state.werewolfVotes?.[targetId] !== undefined) {
    const visited = allPlayers.find(p => p.id === state.werewolfVotes[targetId]);
    return visited
      ? { result: `Ce joueur a rendu visite a ${visited.name} cette nuit.`, emoji: 'visit' }
      : { result: 'Ce joueur est sorti cette nuit.', emoji: 'out' };
  }

  // Voyante: visited seer target
  if (role === 'voyante' && state.seerTargets?.[targetId] !== undefined) {
    const visited = allPlayers.find(p => p.id === state.seerTargets[targetId]);
    return visited
      ? { result: `Ce joueur a rendu visite a ${visited.name} cette nuit.`, emoji: 'visit' }
      : { result: 'Ce joueur est sorti cette nuit.', emoji: 'out' };
  }

  // Sorciere
  if (role === 'sorciere') {
    if ((state.witchKillTargets ?? {})[targetId] !== undefined) {
      const visited = allPlayers.find(p => p.id === state.witchKillTargets[targetId]);
      return visited
        ? { result: `Ce joueur a rendu visite a ${visited.name} cette nuit.`, emoji: 'visit' }
        : { result: 'Ce joueur est sorti cette nuit.', emoji: 'out' };
    }
    if ((state.witchHealedThisNight ?? {})[targetId]) {
      if (state.witchHealTarget !== null) {
        const visited = allPlayers.find(p => p.id === state.witchHealTarget);
        return visited
          ? { result: `Ce joueur a rendu visite a ${visited.name} cette nuit.`, emoji: 'visit' }
          : { result: 'Ce joueur est sorti cette nuit.', emoji: 'out' };
      }
      return { result: 'Ce joueur est sorti cette nuit.', emoji: 'out' };
    }
  }

  // Garde: visited guard target
  if (role === 'garde' && (state.guardTargets ?? {})[targetId] !== undefined) {
    const visited = allPlayers.find(p => p.id === state.guardTargets[targetId]);
    return visited
      ? { result: `Ce joueur a rendu visite a ${visited.name} cette nuit.`, emoji: 'visit' }
      : { result: 'Ce joueur est sorti cette nuit.', emoji: 'out' };
  }

  // Corbeau: visited corbeau target
  if (role === 'corbeau' && (state.corbeauTargets ?? {})[targetId] !== undefined) {
    const visited = allPlayers.find(p => p.id === state.corbeauTargets[targetId]);
    return visited
      ? { result: `Ce joueur a rendu visite a ${visited.name} cette nuit.`, emoji: 'visit' }
      : { result: 'Ce joueur est sorti cette nuit.', emoji: 'out' };
  }

  // Cupidon: visited (turn 1 only, non-visiting power = went out)
  if (role === 'cupidon' && (state.cupidLinkedBy ?? []).includes(targetId)) {
    return { result: 'Ce joueur est sorti cette nuit.', emoji: 'out' };
  }

  // Renard: sniffed (non-visiting — went out)
  if (role === 'renard' && (state.foxTargets ?? {})[targetId] !== undefined) {
    return { result: 'Ce joueur est sorti cette nuit.', emoji: 'out' };
  }

  // Concierge checking another concierge
  if (role === 'concierge' && (state.conciergeTargets ?? {})[targetId] !== undefined) {
    const visited = allPlayers.find(p => p.id === state.conciergeTargets[targetId]);
    return visited
      ? { result: `Ce joueur a rendu visite a ${visited.name} cette nuit.`, emoji: 'visit' }
      : { result: 'Ce joueur est sorti cette nuit.', emoji: 'out' };
  }

  // Active night roles that haven't acted yet — they still "went out"
  const activeNightRoles = ['loup-garou', 'voyante', 'sorciere', 'garde', 'corbeau', 'cupidon', 'renard', 'concierge'];
  if (activeNightRoles.includes(role)) {
    return { result: 'Ce joueur est sorti cette nuit.', emoji: 'out' };
  }

  // Default: stayed home (villageois, chasseur, petite-fille, etc.)
  return { result: 'Ce joueur est reste chez lui cette nuit.', emoji: 'home' };
}

const EMOJI_MAP: Record<string, string> = { visit: '\uD83D\uDC41\uFE0F', out: '\uD83D\uDEB6', home: '\uD83C\uDFE0', '?': '\u2753' };

export function ConciergeAction({
  state, alivePlayers, currentPlayer, allPlayers, onConciergeTarget, onFlipBack, t,
}: {
  state: GameState;
  alivePlayers: Player[];
  currentPlayer: Player;
  allPlayers: Player[];
  onConciergeTarget?: (targetId: number) => void;
  onFlipBack?: () => void;
  t: GameThemeTokens;
}) {
  const [pendingTarget, setPendingTarget] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [revealInfo, setRevealInfo] = useState<{ target: Player; result: string; emoji: string; countdown: number } | null>(null);

  const onFlipBackRef = useRef(onFlipBack);
  onFlipBackRef.current = onFlipBack;

  // Auto-flip after reveal countdown
  useEffect(() => {
    if (!revealInfo) return;
    if (revealInfo.countdown <= 0) {
      setRevealInfo(null);
      onFlipBackRef.current?.();
      return;
    }
    const timer = setTimeout(() => {
      setRevealInfo((prev) => prev ? { ...prev, countdown: prev.countdown - 1 } : null);
    }, 1000);
    return () => clearTimeout(timer);
  }, [revealInfo]);

  const conciergeActed = (state.conciergeTargets ?? {})[currentPlayer.id] !== undefined;
  const targets = alivePlayers.filter(p => p.id !== currentPlayer.id);
  const filteredTargets = search
    ? targets.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : targets;

  // Reveal with countdown
  if (revealInfo) {
    const displayEmoji = EMOJI_MAP[revealInfo.emoji] || revealInfo.emoji;
    const isVisit = revealInfo.emoji === 'visit';
    const isOut = revealInfo.emoji === 'out';
    const resultColor = isVisit ? '#0ea5e9' : isOut ? '#f59e0b' : '#6b7b9b';
    return (
      <div
        className="rounded-xl p-5 mb-5"
        style={{
          background: isVisit
            ? 'linear-gradient(135deg, rgba(14,165,233,0.08), rgba(2,132,199,0.04))'
            : isOut
              ? 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(217,119,6,0.04))'
              : 'linear-gradient(135deg, rgba(107,123,155,0.08), rgba(74,85,104,0.04))',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: isVisit ? 'rgba(14,165,233,0.2)' : isOut ? 'rgba(245,158,11,0.2)' : 'rgba(107,123,155,0.15)',
        }}
      >
        <p style={{ color: '#0ea5e9', fontSize: '0.55rem', fontFamily: '"Cinzel", serif', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.75rem', textAlign: 'center' }}>
          Rapport du Concierge
        </p>
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{ background: `rgba(${t.overlayChannel}, 0.06)`, borderWidth: '1px', borderStyle: 'solid', borderColor: `rgba(${t.overlayChannel}, 0.1)` }}>
            <PAvatar player={revealInfo.target} size="text-sm" />
            <span style={{ color: t.text, fontSize: '0.7rem', fontWeight: 600 }}>
              {revealInfo.target.name}
            </span>
          </div>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 rounded-lg text-center"
          style={{
            background: isVisit ? 'rgba(14,165,233,0.08)' : isOut ? 'rgba(245,158,11,0.08)' : 'rgba(107,123,155,0.06)',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: isVisit ? 'rgba(14,165,233,0.15)' : isOut ? 'rgba(245,158,11,0.15)' : 'rgba(107,123,155,0.1)',
          }}
        >
          <span style={{ fontSize: '2rem' }}>{displayEmoji}</span>
          <p style={{
            color: resultColor,
            fontSize: '0.8rem', fontWeight: 700, marginTop: '0.4rem',
            fontFamily: '"Cinzel", serif',
            textShadow: `0 0 12px ${resultColor}40`,
          }}>
            {revealInfo.result}
          </p>
        </motion.div>
        <div className="flex flex-col items-center mt-3">
          <p style={{ color: t.textDim, fontSize: '0.5rem', fontStyle: 'italic', textAlign: 'center' }}>
            {isVisit
              ? 'Vous ne connaissez pas la raison de cette visite.'
              : isOut
                ? 'Vous ne connaissez pas la raison de cette sortie.'
                : ''}
          </p>
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <EyeOff size={11} style={{ color: t.textDim }} />
            <p style={{ color: t.textDim, fontSize: '0.6rem' }}>
              {revealInfo.countdown}s
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (conciergeActed) {
    return (
      <div className="rounded-xl p-4 mb-5 text-center"
        style={{ background: 'rgba(14,165,233,0.06)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(14,165,233,0.15)' }}>
        <span className="text-2xl mb-2 block">{'\uD83D\uDD11'}</span>
        <p style={{ color: '#0ea5e9', fontSize: '0.7rem', fontFamily: '"Cinzel", serif' }}>
          Observation enregistree
        </p>
        <p style={{ color: t.textMuted, fontSize: '0.55rem', marginTop: '0.25rem' }}>
          Retournez la carte et attendez le jour.
        </p>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-3 mb-3">
      <div className="text-center mb-3">
        <span className="text-3xl mb-1 block">{'\uD83D\uDD11'}</span>
        <h3 style={{ fontFamily: '"Cinzel", serif', color: '#0ea5e9', fontSize: '0.85rem' }}>
          Observation nocturne
        </h3>
        <p style={{ color: t.textMuted, fontSize: '0.6rem', marginTop: '0.25rem' }}>
          Choisis un joueur pour savoir s'il est sorti cette nuit.
        </p>
      </div>

      {/* Search */}
      {targets.length > 5 && (
        <div className="relative mb-2.5">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.textDim }} />
          <input
            type="text"
            placeholder="Rechercher un joueur..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-8 py-2 rounded-lg text-sm outline-none transition-all"
            style={{
              background: `rgba(${t.overlayChannel}, 0.04)`,
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: search ? 'rgba(14,165,233,0.3)' : `rgba(${t.overlayChannel}, 0.08)`,
              color: t.text, fontSize: '0.7rem',
            }}
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/10 transition-all">
              <X size={11} style={{ color: t.textMuted }} />
            </button>
          )}
        </div>
      )}

      {/* Player list */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {filteredTargets.length === 0 ? (
          <p className="col-span-4" style={{ color: t.textMuted, fontSize: '0.65rem', textAlign: 'center', padding: '0.75rem 0' }}>
            Aucun joueur trouve pour "{search}"
          </p>
        ) : filteredTargets.map(p => {
          const isSelected = pendingTarget === p.id;
          return (
            <motion.button
              key={p.id}
              whileTap={{ scale: 0.9 }}
              onClick={() => setPendingTarget(isSelected ? null : p.id)}
              className="flex flex-col items-center gap-1 p-2 rounded-lg transition-colors relative"
              style={{
                background: isSelected
                  ? 'rgba(14,165,233,0.1)'
                  : `rgba(${t.overlayChannel}, 0.03)`,
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: isSelected ? 'rgba(14,165,233,0.3)' : `rgba(${t.overlayChannel}, 0.08)`,
              }}
            >
              <PAvatar player={p} size="text-xl" />
              <span style={{ color: isSelected ? '#0ea5e9' : t.textSecondary, fontSize: '0.5rem', fontWeight: isSelected ? 700 : 400 }} className="w-full text-center line-clamp-2 break-words">
                {p.name}
              </span>
              {isSelected && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ background: '#0ea5e9', color: '#fff' }}>
                  <CircleCheck size={10} />
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>

    {/* Confirm button */}
    <AnimatePresence>
      {pendingTarget !== null && !revealInfo && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="sticky bottom-0 z-10 -mx-4 px-4 pb-4 pt-3"
          style={{
            background: `linear-gradient(to top, ${t.pageBg} 60%, transparent)`,
          }}
        >
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              const targetPlayer = allPlayers.find(p => p.id === pendingTarget);
              if (!targetPlayer) return;
              const { result, emoji } = computeResult(pendingTarget, state, allPlayers);
              setRevealInfo({ target: targetPlayer, result, emoji, countdown: 10 });
              if (onConciergeTarget) onConciergeTarget(pendingTarget);
            }}
            className="w-full py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
            style={{
              background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
              color: 'white',
              fontFamily: '"Cinzel", serif',
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.05em',
              boxShadow: '0 4px 15px rgba(14,165,233,0.3)',
            }}
          >
            <Eye size={14} />
            Observer ce joueur
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}