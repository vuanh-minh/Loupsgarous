import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Skull, Users, Target, X, Search, CircleCheck, ChevronDown, MessageCircle, BookmarkCheck, RefreshCw, AlertTriangle } from 'lucide-react';
import { PAvatar } from '../PAvatar';
import { type RoleActionBaseProps } from './roleActionTypes';

interface Props extends RoleActionBaseProps {
  onWerewolfVote: (wolfId: number, targetId: number, message?: string) => void;
  /** True when we are in the "Découverte des rôles" phase */
  isDiscoveryPhase?: boolean;
  /** Called when the wolf pre-selects a target during discovery */
  onDiscoveryTarget?: (wolfId: number, targetId: number) => void;
  /** Night-1-only: the discovery pre-selected target, or null if they are away */
  discoveryPreTarget?: { id: number; name: string; isPresent: boolean } | null;
}

export function WerewolfAction({ state, alivePlayers, currentPlayer, allPlayers, onFlipBack, onWerewolfVote, t, isDiscoveryPhase, onDiscoveryTarget, discoveryPreTarget }: Props) {
  const [pendingWolfTarget, setPendingWolfTarget] = useState<number | null>(null);
  const [pendingMessage, setPendingMessage] = useState('');
  const [showMeute, setShowMeute] = useState(false);
  const [wolfTargetSearch, setWolfTargetSearch] = useState('');

  // Night 1: pre-fill confirmation modal when discovery target is present
  useEffect(() => {
    if (discoveryPreTarget?.isPresent && pendingWolfTarget === null) {
      setPendingWolfTarget(discoveryPreTarget.id);
    }
  // only run once on mount when this condition is first true
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discoveryPreTarget?.isPresent, discoveryPreTarget?.id]);

  const wolves = allPlayers.filter((p) => p.alive && p.role === 'loup-garou');
  // During discovery: target all alive players (incl. future away ones). Normal night: present alive players.
  const targets = isDiscoveryPhase
    ? allPlayers.filter((p) => p.alive && p.id !== currentPlayer.id)
    : alivePlayers;

  // Discovery: the wolf's existing pre-selection (if any)
  const savedDiscoveryTargetId = state.discoveryWolfTargets?.[currentPlayer.id] ?? null;
  const savedDiscoveryTarget = savedDiscoveryTargetId !== null
    ? allPlayers.find((p) => p.id === savedDiscoveryTargetId) ?? null
    : null;
  const [changingDiscovery, setChangingDiscovery] = useState(false);

  const tally: Record<number, number> = {};
  Object.values(state.werewolfVotes).forEach((tid: number) => {
    tally[tid] = (tally[tid] || 0) + 1;
  });

  const maxKills = Math.max(1, state.wolfKillsPerNight || 1);
  const killZoneIds = new Set(
    Object.entries(tally)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxKills)
      .map(([id]) => parseInt(id))
  );

  const pendingTarget = pendingWolfTarget !== null
    ? allPlayers.find((p) => p.id === pendingWolfTarget) ?? null
    : null;

  // Collect other wolves' votes with their messages
  const wolfVoteMessages: { wolfId: number; wolfName: string; wolfAvatar: string; targetId: number; targetName: string; targetPlayer: any; message: string }[] = [];
  const voteMessages = (state as any).werewolfVoteMessages || {};
  for (const [wIdStr, tId] of Object.entries(state.werewolfVotes)) {
    const wId = Number(wIdStr);
    if (wId === currentPlayer.id) continue;
    const wolf = allPlayers.find((p) => p.id === wId);
    const target = allPlayers.find((p) => p.id === (tId as number));
    if (wolf && target) {
      wolfVoteMessages.push({
        wolfId: wId,
        wolfName: wolf.name,
        wolfAvatar: wolf.avatar,
        targetId: tId as number,
        targetName: target.name,
        targetPlayer: target,
        message: voteMessages[wId] || '',
      });
    }
  }

  return (
    <div
      className="rounded-xl p-5 mb-5"
      style={{
        background: 'linear-gradient(135deg, rgba(196,30,58,0.06), rgba(140,20,40,0.03))',
        border: '1px solid rgba(196,30,58,0.18)',
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Skull size={14} style={{ color: '#c41e3a' }} />
        <span style={{ fontFamily: '"Cinzel", serif', color: '#c41e3a', fontSize: '0.8rem' }}>
          {isDiscoveryPhase ? 'Désigner une cible' : `Choisir ${(state.wolfKillsPerNight || 1) === 1 ? 'une victime' : `${state.wolfKillsPerNight} victimes`}`}
        </span>
      </div>
      <p style={{ color: t.textMuted, fontSize: '0.6rem', marginBottom: '0.75rem' }}>
        {isDiscoveryPhase
          ? 'Pré-sélectionnez votre victime pour la Nuit 1. Votre choix sera confirmé si elle est présente.'
          : 'Designe un villageois a eliminer cette nuit.'}
      </p>

      {/* Night 1: discovery target is away → informational banner */}
      {!isDiscoveryPhase && discoveryPreTarget && !discoveryPreTarget.isPresent && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-lg px-3 py-2 mb-3"
          style={{
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.25)',
          }}
        >
          <AlertTriangle size={12} style={{ color: '#f59e0b', flexShrink: 0 }} />
          <p style={{ color: '#f5deb3', fontSize: '0.6rem', lineHeight: 1.4 }}>
            Votre cible <strong>{discoveryPreTarget.name}</strong> est absente — choisissez une nouvelle victime.
          </p>
        </motion.div>
      )}

      {wolves.length > 1 && (
        <div className="mb-3">
          <button
            onClick={() => setShowMeute((v) => !v)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg w-full cursor-pointer transition-colors"
            style={{
              background: 'rgba(196,30,58,0.06)',
              border: '1px solid rgba(196,30,58,0.1)',
            }}
          >
            <Users size={11} style={{ color: '#c41e3a' }} />
            <span style={{ color: t.textSecondary, fontSize: '0.55rem', fontFamily: '"Cinzel", serif' }}>
              Voir la meute
            </span>
            <span style={{ color: '#c41e3a', fontSize: '0.6rem', opacity: 0.7, marginLeft: '2px' }}>
              ({wolves.length})
            </span>
            <ChevronDown
              size={12}
              style={{
                color: '#c41e3a',
                opacity: 0.6,
                marginLeft: 'auto',
                transition: 'transform 0.2s',
                transform: showMeute ? 'rotate(180deg)' : 'rotate(0)',
              }}
            />
          </button>
          <AnimatePresence>
            {showMeute && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div
                  className="flex items-center gap-2 px-3 py-2 mt-1 rounded-lg flex-wrap"
                  style={{
                    background: 'rgba(196,30,58,0.04)',
                    border: '1px solid rgba(196,30,58,0.08)',
                  }}
                >
                  {wolves.map((w) => {
                    const hasVoted = state.werewolfVotes[w.id] !== undefined;
                    return (
                      <span
                        key={w.id}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full"
                        style={{
                          background: w.id === currentPlayer.id
                            ? t.goldBg
                            : hasVoted ? 'rgba(196,30,58,0.12)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${w.id === currentPlayer.id ? t.goldBorder : hasVoted ? 'rgba(196,30,58,0.25)' : 'rgba(255,255,255,0.08)'}`,
                          fontSize: '0.6rem',
                        }}
                      >
                        <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0"><PAvatar player={w} size="text-sm" /></div>
                        <span style={{ color: w.id === currentPlayer.id ? t.gold : t.text, fontSize: '0.55rem' }}>
                          {w.name}
                        </span>
                        {hasVoted && <CircleCheck size={8} style={{ color: '#c41e3a' }} />}
                      </span>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Other wolves' votes with messages */}
      {wolfVoteMessages.length > 0 && (
        <div className="mb-3 space-y-1.5">
          <div className="flex items-center gap-1.5 mb-1">
            <MessageCircle size={10} style={{ color: '#c41e3a', opacity: 0.7 }} />
            <span style={{ fontFamily: '"Cinzel", serif', color: t.textMuted, fontSize: '0.55rem' }}>
              Votes de la meute
            </span>
          </div>
          {wolfVoteMessages.map((wv) => {
            const inKillZone = killZoneIds.has(wv.targetId);
            return (
              <div
                key={wv.wolfId}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
                style={{
                  background: inKillZone ? 'rgba(196,30,58,0.08)' : `rgba(${t.overlayChannel}, 0.03)`,
                  border: `1px solid ${inKillZone ? 'rgba(196,30,58,0.2)' : `rgba(${t.overlayChannel}, 0.06)`}`,
                }}
              >
                {/* Wolf avatar */}
                <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 opacity-70">
                  <PAvatar player={{ avatar: wv.wolfAvatar, avatarUrl: undefined } as any} size="text-sm" />
                </div>
                {/* Arrow */}
                <span style={{ color: '#c41e3a', fontSize: '0.6rem', opacity: 0.5 }}>→</span>
                {/* Target avatar */}
                <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
                  <PAvatar player={wv.targetPlayer} size="text-sm" />
                </div>
                {/* Target name + message */}
                <div className="flex-1 min-w-0">
                  <span
                    className="block truncate"
                    style={{
                      color: inKillZone ? '#e8c8c8' : t.textSecondary,
                      fontSize: '0.6rem',
                      fontWeight: inKillZone ? 600 : 400,
                    }}
                  >
                    {wv.targetName}
                  </span>
                  {wv.message && (
                    <span
                      className="block truncate"
                      style={{
                        color: t.textMuted,
                        fontSize: '0.5rem',
                        fontStyle: 'italic',
                        marginTop: '1px',
                      }}
                    >
                      « {wv.message} »
                    </span>
                  )}
                </div>
                {inKillZone && <Skull size={10} style={{ color: '#c41e3a', opacity: 0.6 }} />}
              </div>
            );
          })}
        </div>
      )}

      {/* Discovery phase: saved pre-selection */}
      {isDiscoveryPhase && savedDiscoveryTarget && !changingDiscovery ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-lg p-4 text-center"
          style={{
            background: 'rgba(196,30,58,0.08)',
            border: '1px solid rgba(196,30,58,0.25)',
          }}
        >
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <BookmarkCheck size={12} style={{ color: '#c41e3a' }} />
            <p style={{ color: t.textMuted, fontSize: '0.6rem' }}>Cible pré-désignée</p>
          </div>
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
              <PAvatar player={savedDiscoveryTarget} size="text-2xl" />
            </div>
            <span style={{ color: '#e8c8c8', fontSize: '0.85rem', fontFamily: '"Cinzel", serif' }}>
              {savedDiscoveryTarget.name}
            </span>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setChangingDiscovery(true)}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg mx-auto"
            style={{
              background: `rgba(${t.overlayChannel}, 0.04)`,
              border: `1px solid rgba(${t.overlayChannel}, 0.12)`,
              color: t.textMuted,
              fontSize: '0.65rem',
              fontFamily: '"Cinzel", serif',
            }}
          >
            <RefreshCw size={12} />
            Modifier
          </motion.button>
        </motion.div>
      ) : isDiscoveryPhase ? (
        /* Discovery phase: target picker (all alive players incl. future away) */
        <div>
          {targets.length > 5 && (
            <div className="relative mb-1">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: t.textMuted }} />
              <input
                type="text"
                placeholder="Rechercher un joueur..."
                value={wolfTargetSearch}
                onChange={(e) => setWolfTargetSearch(e.target.value)}
                className="w-full pl-8 pr-8 py-2 rounded-lg text-sm outline-none transition-all mx-[0px] my-[16px]"
                style={{
                  background: `rgba(${t.overlayChannel}, 0.04)`,
                  border: `1px solid ${wolfTargetSearch ? 'rgba(196,30,58,0.3)' : `rgba(${t.overlayChannel}, 0.08)`}`,
                  color: t.text,
                  fontSize: '0.7rem',
                }}
              />
              {wolfTargetSearch && (
                <button
                  onClick={() => setWolfTargetSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/10 transition-all"
                >
                  <X size={11} style={{ color: t.textMuted }} />
                </button>
              )}
            </div>
          )}
          <div className="grid grid-cols-4 gap-2">
            {(wolfTargetSearch
              ? targets.filter((tgt) => tgt.name.toLowerCase().includes(wolfTargetSearch.toLowerCase()))
              : targets
            ).map((tgt) => {
              const isSelected = savedDiscoveryTargetId === tgt.id;
              return (
                <motion.button
                  key={tgt.id}
                  layout
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    onDiscoveryTarget?.(currentPlayer.id, tgt.id);
                    setChangingDiscovery(false);
                    setWolfTargetSearch('');
                  }}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg transition-colors relative"
                  style={{
                    background: isSelected ? 'rgba(196,30,58,0.1)' : `rgba(${t.overlayChannel}, 0.03)`,
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: isSelected ? 'rgba(196,30,58,0.35)' : `rgba(${t.overlayChannel}, 0.08)`,
                  }}
                >
                  <div className="w-8 h-8 rounded-full overflow-hidden mx-auto">
                    <PAvatar player={tgt} size="text-xl" />
                  </div>
                  <span
                    className="w-full text-center line-clamp-2 break-words"
                    style={{ color: isSelected ? '#e8c8c8' : t.textSecondary, fontSize: '0.5rem', fontWeight: isSelected ? 600 : 400 }}
                  >
                    {tgt.name}
                  </span>
                </motion.button>
              );
            })}
          </div>
          {wolfTargetSearch && targets.filter((tgt) => tgt.name.toLowerCase().includes(wolfTargetSearch.toLowerCase())).length === 0 && (
            <p style={{ color: t.textMuted, fontSize: '0.65rem', textAlign: 'center', padding: '0.5rem 0' }}>
              Aucun joueur ne correspond.
            </p>
          )}
        </div>
      ) : (
        /* Normal night: confirmation overlay or target picker */
        pendingTarget ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-lg p-4 text-center"
          style={{
            background: 'rgba(196,30,58,0.1)',
            border: '1px solid rgba(196,30,58,0.3)',
          }}
        >
          <p style={{ color: t.textMuted, fontSize: '0.6rem', marginBottom: '0.5rem' }}>
            Confirmer votre choix ?
          </p>
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0"><PAvatar player={pendingTarget} size="text-2xl" /></div>
            <span style={{ color: '#e8c8c8', fontSize: '0.85rem', fontFamily: '"Cinzel", serif' }}>
              {pendingTarget.name}
            </span>
          </div>

          {/* Optional message input */}
          <div className="mb-3">
            <textarea
              placeholder="Message pour la meute (optionnel)..."
              value={pendingMessage}
              onChange={(e) => setPendingMessage(e.target.value.slice(0, 140))}
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
              style={{
                background: `rgba(${t.overlayChannel}, 0.06)`,
                border: `1px solid ${pendingMessage ? 'rgba(196,30,58,0.3)' : `rgba(${t.overlayChannel}, 0.1)`}`,
                color: t.text,
                fontSize: '0.65rem',
                fontStyle: pendingMessage ? 'normal' : 'italic',
              }}
            />
            <p style={{ color: t.textDim, fontSize: '0.45rem', textAlign: 'right', marginTop: '2px' }}>
              {pendingMessage.length}/140
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                onWerewolfVote(currentPlayer.id, pendingWolfTarget!, pendingMessage.trim() || undefined);
                setPendingWolfTarget(null);
                setPendingMessage('');
                if (onFlipBack) onFlipBack();
              }}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg"
              style={{
                background: 'rgba(196,30,58,0.2)',
                border: '1px solid rgba(196,30,58,0.4)',
                color: '#e8c8c8',
                fontSize: '0.65rem',
                fontFamily: '"Cinzel", serif',
              }}
            >
              <Target size={13} />
              Confirmer
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => { setPendingWolfTarget(null); setPendingMessage(''); }}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg"
              style={{
                background: `rgba(${t.overlayChannel}, 0.04)`,
                border: `1px solid rgba(${t.overlayChannel}, 0.12)`,
                color: t.textMuted,
                fontSize: '0.65rem',
                fontFamily: '"Cinzel", serif',
              }}
            >
              <X size={13} />
              Annuler
            </motion.button>
          </div>
        </motion.div>
      ) : (
        <div>
          {targets.length > 5 && (
            <div className="relative mb-1">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: t.textMuted }} />
              <input
                type="text"
                placeholder="Rechercher un joueur..."
                value={wolfTargetSearch}
                onChange={(e) => setWolfTargetSearch(e.target.value)}
                className="w-full pl-8 pr-8 py-2 rounded-lg text-sm outline-none transition-all mx-[0px] my-[16px]"
                style={{
                  background: `rgba(${t.overlayChannel}, 0.04)`,
                  border: `1px solid ${wolfTargetSearch ? 'rgba(196,30,58,0.3)' : `rgba(${t.overlayChannel}, 0.08)`}`,
                  color: t.text,
                  fontSize: '0.7rem',
                }}
              />
              {wolfTargetSearch && (
                <button
                  onClick={() => setWolfTargetSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/10 transition-all"
                >
                  <X size={11} style={{ color: t.textMuted }} />
                </button>
              )}
            </div>
          )}
          <div className="grid grid-cols-4 gap-2">
          {(wolfTargetSearch
            ? targets.filter((tgt) => tgt.name.toLowerCase().includes(wolfTargetSearch.toLowerCase()))
            : targets
          )
            .slice()
            .sort((a, b) => (tally[b.id] || 0) - (tally[a.id] || 0))
            .map((tgt) => {
            const otherVotes = tally[tgt.id] || 0;
            const inKillZone = killZoneIds.has(tgt.id);

            return (
              <motion.button
                key={tgt.id}
                layout
                whileTap={{ scale: 0.9 }}
                onClick={() => { setPendingWolfTarget(tgt.id); }}
                className="flex flex-col items-center gap-1 p-2 rounded-lg transition-colors relative"
                style={{
                  background: inKillZone
                    ? 'rgba(196,30,58,0.1)'
                    : `rgba(${t.overlayChannel}, 0.03)`,
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: inKillZone
                    ? 'rgba(196,30,58,0.35)'
                    : `rgba(${t.overlayChannel}, 0.08)`,
                  boxShadow: inKillZone
                    ? '0 0 12px rgba(196,30,58,0.15), inset 0 0 12px rgba(196,30,58,0.05)'
                    : 'none',
                }}
              >
                <div className="w-8 h-8 rounded-full overflow-hidden mx-auto"><PAvatar player={tgt} size="text-xl" /></div>
                <span
                  className="w-full text-center line-clamp-2 break-words"
                  style={{ color: inKillZone ? '#e8c8c8' : t.textSecondary, fontSize: '0.5rem', fontWeight: inKillZone ? 600 : 400 }}
                >
                  {tgt.name}
                </span>
                {otherVotes > 0 && (
                  <span
                    className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center"
                    style={{
                      background: inKillZone ? 'rgba(196,30,58,0.8)' : 'rgba(196,30,58,0.5)',
                      color: '#fff',
                      fontSize: '0.5rem',
                      fontFamily: '"Cinzel", serif',
                      fontWeight: 700,
                    }}
                  >
                    {otherVotes}
                  </span>
                )}
              </motion.button>
            );
          })}
          </div>
          {wolfTargetSearch && targets.filter((tgt) => tgt.name.toLowerCase().includes(wolfTargetSearch.toLowerCase())).length === 0 && (
            <p style={{ color: t.textMuted, fontSize: '0.65rem', textAlign: 'center', padding: '0.5rem 0' }}>
              Aucun joueur ne correspond.
            </p>
          )}
        </div>
        )
      )}
    </div>
  );
}
