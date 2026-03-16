import React from 'react';
import { Skull, Shield, Zap, Vote, Heart, AlertCircle, Crown } from 'lucide-react';
import { type Player, type GameState } from '../../../context/gameTypes';
import { getRoleById } from '../../../data/roles';
import { type GameThemeTokens } from '../../../context/gameTheme';
import { GMAvatar } from './GMShared';

/* ================================================================
   Phase Outcome Preview — shows predicted night/day outcome
   Extracted from GMGamePanel.tsx
   ================================================================ */

interface GMPhaseOutcomeProps {
  state: GameState;
  isNight: boolean;
  alivePlayers: Player[];
  t: GameThemeTokens;
}

export const GMPhaseOutcome = React.memo(function GMPhaseOutcome({
  state,
  isNight,
  alivePlayers,
  t,
}: GMPhaseOutcomeProps) {
  if (state.screen !== 'game') return null;

  const isMaireElection =
    !isNight &&
    state.phase === 'day' &&
    !state.maireElectionDone &&
    state.turn === 1 &&
    state.roleRevealDone;

  const items: Array<{ key: string; icon: React.ReactNode; label: string; player: Player; color: string; detail?: string }> = [];

  if (isNight) {
    // Wolf vote leader
    const wolfVotes = state.werewolfVotes;
    if (Object.keys(wolfVotes).length > 0) {
      const tally: Record<number, number> = {};
      Object.values(wolfVotes).forEach(targetId => {
        tally[targetId as number] = (tally[targetId as number] || 0) + 1;
      });
      let maxV = 0;
      const tops: number[] = [];
      Object.entries(tally).forEach(([id, count]) => {
        if (count > maxV) { maxV = count; tops.length = 0; tops.push(parseInt(id)); }
        else if (count === maxV) tops.push(parseInt(id));
      });
      const totalWolves = alivePlayers.filter(p => getRoleById(p.role)?.id === 'loup-garou').length;
      const wasHealed = Object.keys(state.witchHealedThisNight || {}).length > 0;
      tops.forEach(tId => {
        const p = state.players.find((pl: Player) => pl.id === tId);
        if (p) items.push({
          key: `wolf-${tId}`,
          icon: wasHealed ? <Shield size={11} /> : <Skull size={11} />,
          label: wasHealed ? 'Sauve par la sorciere' : 'Cible des loups',
          player: p,
          color: wasHealed ? '#10b981' : '#c41e3a',
          detail: wasHealed ? undefined : `${maxV}/${totalWolves} vote${maxV > 1 ? 's' : ''}`,
        });
      });
    }

    // Witch kill targets
    const witchKills = state.witchKillTargets;
    const witchKillIds = [...new Set(Object.values(witchKills))] as number[];
    witchKillIds.forEach(tId => {
      const p = state.players.find((pl: Player) => pl.id === tId);
      if (p) items.push({
        key: `witch-kill-${tId}`,
        icon: <Zap size={11} />,
        label: 'Poison sorciere',
        player: p,
        color: '#8b5cf6',
      });
    });
  } else {
    // Day: village vote leader
    const dayVotes = state.votes;
    if (Object.keys(dayVotes).length > 0) {
      const tally: Record<number, number> = {};
      Object.entries(dayVotes).forEach(([voterId, targetId]) => {
        const weight = (state.maireId !== null && parseInt(voterId) === state.maireId) ? 2 : 1;
        tally[targetId as number] = (tally[targetId as number] || 0) + weight;
      });
      let maxV = 0;
      const tops: number[] = [];
      Object.entries(tally).forEach(([id, count]) => {
        if (count > maxV) { maxV = count; tops.length = 0; tops.push(parseInt(id)); }
        else if (count === maxV) tops.push(parseInt(id));
      });
      const totalVoters = alivePlayers.length;
      const voted = Object.keys(dayVotes).length;
      tops.forEach(tId => {
        const p = state.players.find((pl: Player) => pl.id === tId);
        if (p) items.push({
          key: `vote-${tId}`,
          icon: isMaireElection ? <Crown size={11} /> : <Vote size={11} />,
          label: tops.length > 1 ? 'Egalite' : (isMaireElection ? 'Elu' : 'Condamne'),
          player: p,
          color: isMaireElection ? '#d4a843' : (tops.length > 1 ? '#f59e0b' : '#c41e3a'),
          detail: `${maxV} voix · ${voted}/${totalVoters}`,
        });
      });
    }
  }

  if (items.length === 0) return null;

  // Compute lover cascading deaths
  const dyingIds = new Set(items.filter(i => i.label !== 'Sauve par la sorciere').map(i => i.player.id));
  const loverItems: typeof items = [];
  for (const [l1, l2] of (state.loverPairs || [])) {
    const check = (dying: number, partner: number) => {
      if (dyingIds.has(dying) && !dyingIds.has(partner)) {
        const lover = state.players.find((p: Player) => p.id === partner);
        const partnerP = state.players.find((p: Player) => p.id === dying);
        if (lover && lover.alive) {
          loverItems.push({
            key: `lover-${partner}`,
            icon: <Heart size={11} />,
            label: 'Mort de chagrin',
            player: lover,
            color: '#ec4899',
            detail: `Amoureux de ${partnerP?.name || '?'}`,
          });
          dyingIds.add(partner);
        }
      }
    };
    check(l1, l2);
    check(l2, l1);
  }
  const allItems = [...items, ...loverItems];

  const colorToRgb = (c: string) => {
    switch (c) {
      case '#c41e3a': return '196,30,58';
      case '#8b5cf6': return '139,92,246';
      case '#ec4899': return '236,72,153';
      case '#10b981': return '16,185,129';
      case '#f59e0b': return '245,158,11';
      case '#d4a843': return '212,168,67';
      default: return '255,255,255';
    }
  };

  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: isNight
          ? 'linear-gradient(135deg, rgba(196,30,58,0.06), rgba(139,92,246,0.04))'
          : isMaireElection
            ? 'linear-gradient(135deg, rgba(212,168,67,0.06), rgba(212,168,67,0.04))'
            : 'linear-gradient(135deg, rgba(196,30,58,0.06), rgba(245,158,11,0.04))',
        border: `1px solid rgba(${isNight ? '196,30,58' : isMaireElection ? '212,168,67' : '196,30,58'}, 0.12)`,
      }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <AlertCircle size={11} style={{ color: isNight ? '#c41e3a' : isMaireElection ? '#d4a843' : '#f59e0b' }} />
        <span style={{
          fontFamily: '"Cinzel", serif',
          fontSize: '0.6rem',
          color: isNight ? '#c41e3a' : isMaireElection ? '#d4a843' : '#f59e0b',
          letterSpacing: '0.04em',
        }}>
          {isNight ? 'Issue de la nuit' : isMaireElection ? "Issue de l'election" : 'Issue du vote'}
        </span>
      </div>
      <div className="space-y-1.5">
        {allItems.map(item => (
          <div
            key={item.key}
            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5"
            style={{
              background: `rgba(${colorToRgb(item.color)}, 0.06)`,
            }}
          >
            <span style={{ color: item.color }}>{item.icon}</span>
            <GMAvatar player={item.player} size="text-xs" />
            <div className="flex-1 min-w-0">
              <p className="truncate" style={{ fontSize: '0.7rem', color: t.text, fontWeight: 300 }}>
                {item.player.name}
              </p>
              <p style={{ fontSize: '0.5rem', color: item.color }}>
                {item.label}
                {item.detail && <span style={{ color: t.textMuted }}> · {item.detail}</span>}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});