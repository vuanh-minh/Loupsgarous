import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { EyeOff, Target, CircleCheck, X, Search, RotateCcw } from 'lucide-react';
import { type Player } from '../../../../context/GameContext';
import { PAvatar } from '../PAvatar';
import { type RoleActionBaseProps } from './roleActionTypes';

export interface FoxActionHandle {
  foxReady: boolean;
  onFoxConfirm: () => void;
}

interface Props extends RoleActionBaseProps {
  onFoxTarget?: (playerIds: number[]) => void;
  onFoxReadyChange?: (ready: boolean, confirmFn: (() => void) | null) => void;
}

export function FoxAction({ state, alivePlayers, currentPlayer, allPlayers, onFlipBack, onFoxTarget, onFoxReadyChange, t }: Props) {
  const [foxSelectedIds, setFoxSelectedIds] = useState<number[]>([]);
  const [foxSearch, setFoxSearch] = useState('');
  const [foxRevealInfo, setFoxRevealInfo] = useState<{ players: Player[]; hasWolf: boolean; countdown: number } | null>(null);

  const onFlipBackRef = useRef(onFlipBack);
  onFlipBackRef.current = onFlipBack;

  useEffect(() => {
    if (!foxRevealInfo) return;
    if (foxRevealInfo.countdown <= 0) {
      setFoxRevealInfo(null);
      onFlipBackRef.current?.();
      return;
    }
    const timer = setTimeout(() => {
      setFoxRevealInfo((prev) => prev ? { ...prev, countdown: prev.countdown - 1 } : null);
    }, 1000);
    return () => clearTimeout(timer);
  }, [foxRevealInfo]);

  const hasActed = (state.foxTargets ?? {})[currentPlayer.id] !== undefined;
  const targets = alivePlayers.filter(p => p.id !== currentPlayer.id);

  const handleFoxConfirm = () => {
    if (foxSelectedIds.length !== 3 || foxRevealInfo) return;
    const foxPlayers = foxSelectedIds.map(id => allPlayers.find(p => p.id === id)).filter(Boolean) as Player[];
    const hasWolf = foxSelectedIds.some((pid) => { const p = allPlayers.find((pl) => pl.id === pid); return p?.role === 'loup-garou'; });
    setFoxRevealInfo({ players: foxPlayers, hasWolf, countdown: 5 });
    if (onFoxTarget) onFoxTarget(foxSelectedIds);
  };

  const handleFoxConfirmRef = useRef(handleFoxConfirm);
  handleFoxConfirmRef.current = handleFoxConfirm;

  const foxReady = foxSelectedIds.length === 3 && !foxRevealInfo && !hasActed;

  useEffect(() => {
    onFoxReadyChange?.(foxReady, foxReady ? () => handleFoxConfirmRef.current() : null);
  }, [foxReady, onFoxReadyChange]);

  if (foxRevealInfo) {
    const resultColor = foxRevealInfo.hasWolf ? '#ef4444' : '#22c55e';
    return (
      <div className="rounded-xl p-5 mb-5"
        style={{
          background: foxRevealInfo.hasWolf
            ? 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(220,38,38,0.04))'
            : 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(22,163,74,0.04))',
          border: `1px solid ${foxRevealInfo.hasWolf ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
        }}>
        <p style={{ color: '#f97316', fontSize: '0.55rem', fontFamily: '"Cinzel", serif', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.75rem', textAlign: 'center' }}>Resultat du flair</p>
        <div className="flex items-center justify-center gap-2 mb-3 flex-wrap">
          {foxRevealInfo.players.map(p => (
            <div key={p.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: `rgba(${t.overlayChannel}, 0.06)`, border: `1px solid rgba(${t.overlayChannel}, 0.1)` }}>
              <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0"><PAvatar player={p} size="text-sm" /></div>
              <span style={{ color: t.text, fontSize: '0.6rem', fontWeight: 600 }}>{p.name}</span>
            </div>
          ))}
        </div>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="p-4 rounded-lg text-center"
          style={{ background: foxRevealInfo.hasWolf ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)', border: `1px solid ${foxRevealInfo.hasWolf ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)'}` }}>
          <span style={{ fontSize: '2rem' }}>{foxRevealInfo.hasWolf ? '🐺' : '✅'}</span>
          <p style={{ color: resultColor, fontSize: '0.8rem', fontWeight: 700, marginTop: '0.4rem', fontFamily: '"Cinzel", serif', textShadow: `0 0 12px ${resultColor}40` }}>
            {foxRevealInfo.hasWolf ? 'Au moins un Loup se cache parmi eux !' : 'Aucun loup dans ce groupe.'}
          </p>
        </motion.div>
        <div className="mt-4 mx-auto" style={{ maxWidth: '12rem' }}>
          <div className="w-full rounded-full overflow-hidden" style={{ height: '4px', background: `rgba(${t.overlayChannel}, 0.1)` }}>
            <motion.div key="fox-progress" initial={{ width: '100%' }} animate={{ width: '0%' }} transition={{ duration: 5, ease: 'linear' }}
              style={{ height: '100%', borderRadius: '9999px', background: 'linear-gradient(90deg, #f97316, #f9731690)', boxShadow: '0 0 8px rgba(249,115,22,0.5)' }} />
          </div>
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <EyeOff size={11} style={{ color: t.textDim }} />
            <p style={{ color: t.textDim, fontSize: '0.6rem' }}>{foxRevealInfo.countdown}s</p>
          </div>
        </div>
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setFoxRevealInfo(null); if (onFlipBack) onFlipBack(); }}
          className="mt-3 flex items-center justify-center gap-1.5 mx-auto px-4 py-2 rounded-lg"
          style={{ background: `rgba(${t.overlayChannel}, 0.04)`, border: `1px solid rgba(${t.overlayChannel}, 0.1)`, color: t.textMuted, fontSize: '0.6rem', fontFamily: '"Cinzel", serif' }}>
          <RotateCcw size={11} /> Retourner maintenant
        </motion.button>
      </div>
    );
  }

  if (hasActed) return null;

  const toggleFoxSelection = (playerId: number) => {
    setFoxSelectedIds(prev => {
      if (prev.includes(playerId)) return prev.filter(id => id !== playerId);
      if (prev.length >= 3) return prev;
      return [...prev, playerId];
    });
  };

  const filteredFoxTargets = foxSearch ? targets.filter(p => p.name.toLowerCase().includes(foxSearch.toLowerCase())) : targets;

  return (
    <>
      <div className="rounded-xl p-5 mb-5"
        style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.06), rgba(234,88,12,0.03))', border: '1px solid rgba(249,115,22,0.18)' }}>
        <div className="flex items-center gap-2 mb-1">
          <span style={{ fontSize: '1.1rem' }}>🦊</span>
          <span style={{ fontFamily: '"Cinzel", serif', color: '#f97316', fontSize: '0.8rem', fontWeight: 700 }}>Flair nocturne</span>
        </div>
        <p style={{ color: t.textMuted, fontSize: '0.6rem', marginBottom: '0.75rem' }}>
          Selectionne exactement <strong style={{ color: '#f97316' }}>3 joueurs</strong> a flairer. Tu sauras si au moins un loup se cache parmi eux.
        </p>

        <div className="flex items-center gap-2 mb-3">
          {[0, 1, 2].map(i => {
            const foxPlayer = foxSelectedIds.length > i ? allPlayers.find(p => p.id === foxSelectedIds[i]) : undefined;
            return (
              <div key={i} className="flex items-center justify-center w-7 h-7 rounded-full transition-all"
                style={{
                  background: foxSelectedIds.length > i ? 'rgba(249,115,22,0.2)' : `rgba(${t.overlayChannel}, 0.04)`,
                  border: `2px solid ${foxSelectedIds.length > i ? '#f97316' : `rgba(${t.overlayChannel}, 0.1)`}`,
                }}>
                {foxPlayer ? <div className="w-full h-full rounded-full overflow-hidden"><PAvatar player={foxPlayer} size="text-xs" /></div> : <span style={{ color: t.textDim, fontSize: '0.5rem' }}>{i + 1}</span>}
              </div>
            );
          })}
          <span style={{ color: t.textMuted, fontSize: '0.55rem', marginLeft: '0.5rem' }}>
            {foxSelectedIds.length}/3 selectionne{foxSelectedIds.length > 1 ? 's' : ''}
          </span>
        </div>

        {targets.length > 5 && (
          <div className="relative mb-2.5">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.textDim }} />
            <input type="text" placeholder="Rechercher un joueur..." value={foxSearch} onChange={e => setFoxSearch(e.target.value)}
              className="w-full pl-8 pr-8 py-2 rounded-lg text-sm outline-none transition-all"
              style={{ background: `rgba(${t.overlayChannel}, 0.04)`, border: `1px solid ${foxSearch ? 'rgba(249,115,22,0.3)' : `rgba(${t.overlayChannel}, 0.08)`}`, color: t.text, fontSize: '0.7rem' }} />
            {foxSearch && (
              <button onClick={() => setFoxSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/10 transition-all">
                <X size={11} style={{ color: t.textMuted }} />
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-4 gap-2 mb-3">
          {filteredFoxTargets.length === 0 ? (
            <p className="col-span-4" style={{ color: t.textMuted, fontSize: '0.65rem', textAlign: 'center', padding: '0.75rem 0' }}>Aucun joueur trouve pour "{foxSearch}"</p>
          ) : filteredFoxTargets.map(p => {
            const isSelected = foxSelectedIds.includes(p.id);
            const isFull = foxSelectedIds.length >= 3 && !isSelected;
            return (
              <motion.button key={p.id} whileTap={{ scale: 0.9 }} onClick={() => toggleFoxSelection(p.id)} disabled={isFull}
                className="flex flex-col items-center gap-1 p-2 rounded-lg transition-colors relative"
                style={{
                  background: isSelected ? 'rgba(249,115,22,0.1)' : `rgba(${t.overlayChannel}, 0.03)`,
                  border: `1px solid ${isSelected ? 'rgba(249,115,22,0.3)' : `rgba(${t.overlayChannel}, 0.08)`}`,
                  opacity: isFull ? 0.4 : 1,
                }}>
                <div className="w-8 h-8 rounded-full overflow-hidden mx-auto"><PAvatar player={p} size="text-xl" /></div>
                <span style={{ color: isSelected ? '#f97316' : t.textSecondary, fontSize: '0.5rem', fontWeight: isSelected ? 700 : 400 }} className="w-full text-center line-clamp-2 break-words">{p.name}</span>
                {isSelected && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: '#f97316', color: '#fff' }}>
                    <CircleCheck size={10} />
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </>
  );
}