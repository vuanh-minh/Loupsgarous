import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Eye, EyeOff, X, Search, RotateCcw } from 'lucide-react';
import { getRoleById, type RoleDefinition } from '../../../../data/roles';
import { type Player } from '../../../../context/GameContext';
import { PAvatar } from '../PAvatar';
import { type RoleActionBaseProps } from './roleActionTypes';

interface Props extends RoleActionBaseProps {
  onSeerTarget: (targetId: number) => void;
}

export function SeerAction({ state, alivePlayers, currentPlayer, allPlayers, onFlipBack, onSeerTarget, t }: Props) {
  const [pendingSeerTarget, setPendingSeerTarget] = useState<number | null>(null);
  const [seerSearch, setSeerSearch] = useState('');
  const [seerRevealInfo, setSeerRevealInfo] = useState<{ player: Player; role: RoleDefinition; countdown: number } | null>(null);

  const onFlipBackRef = useRef(onFlipBack);
  onFlipBackRef.current = onFlipBack;

  useEffect(() => {
    if (!seerRevealInfo) return;
    if (seerRevealInfo.countdown <= 0) {
      setSeerRevealInfo(null);
      onFlipBackRef.current?.();
      return;
    }
    const timer = setTimeout(() => {
      setSeerRevealInfo((prev) => prev ? { ...prev, countdown: prev.countdown - 1 } : null);
    }, 1000);
    return () => clearTimeout(timer);
  }, [seerRevealInfo]);

  const targets = alivePlayers.filter((p) => p.id !== currentPlayer.id);
  const hasChosen = state.seerTargets?.[currentPlayer.id] !== undefined;

  const pendingSeerPlayer = pendingSeerTarget !== null
    ? allPlayers.find((p) => p.id === pendingSeerTarget) ?? null
    : null;

  return (
    <div
      className="rounded-xl p-5 mb-5"
      style={{
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.06) 0%, rgba(139, 92, 246, 0.02) 100%)',
        border: '1px solid rgba(138,180,248,0.18)',
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Eye size={14} style={{ color: '#8ab4f8' }} />
        <span style={{ fontFamily: '"Cinzel", serif', color: '#8ab4f8', fontSize: '0.8rem' }}>
          Sonder un joueur
        </span>
      </div>
      <p style={{ color: t.textMuted, fontSize: '0.6rem', marginBottom: '0.75rem' }}>
        Choisis un joueur pour decouvrir son role.
      </p>

      {pendingSeerPlayer && !hasChosen ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-lg p-4 text-center"
          style={{ background: 'rgba(138,180,248,0.1)', border: '1px solid rgba(138,180,248,0.3)' }}
        >
          <p style={{ color: t.textMuted, fontSize: '0.6rem', marginBottom: '0.5rem' }}>Confirmer votre choix ?</p>
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0"><PAvatar player={pendingSeerPlayer} size="text-2xl" /></div>
            <span style={{ color: '#c8d8f0', fontSize: '0.85rem', fontFamily: '"Cinzel", serif' }}>{pendingSeerPlayer.name}</span>
          </div>
          <div className="flex flex-col items-stretch gap-2">
            <motion.button whileTap={{ scale: 0.95 }}
              onClick={() => {
                const targetPlayer = allPlayers.find((p) => p.id === pendingSeerTarget);
                const targetRole = targetPlayer ? getRoleById(targetPlayer.role) : null;
                onSeerTarget(pendingSeerTarget!);
                setPendingSeerTarget(null);
                if (targetPlayer && targetRole) {
                  setSeerRevealInfo({ player: targetPlayer, role: targetRole, countdown: 5 });
                } else {
                  if (onFlipBack) onFlipBack();
                }
              }}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg"
              style={{ background: 'rgba(138,180,248,0.2)', border: '1px solid rgba(138,180,248,0.4)', color: '#c8d8f0', fontSize: '0.65rem', fontFamily: '"Cinzel", serif' }}>
              <Eye size={13} /> Confirmer
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setPendingSeerTarget(null)}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg"
              style={{ background: `rgba(${t.overlayChannel}, 0.04)`, border: `1px solid rgba(${t.overlayChannel}, 0.12)`, color: t.textMuted, fontSize: '0.65rem', fontFamily: '"Cinzel", serif' }}>
              <X size={13} /> Annuler
            </motion.button>
          </div>
        </motion.div>
      ) : !hasChosen ? (
        <div>
          {targets.length > 5 && (
            <div className="relative mb-2">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.textDim }} />
              <input type="text" placeholder="Rechercher un joueur..." value={seerSearch} onChange={(e) => setSeerSearch(e.target.value)}
                className="w-full pl-8 pr-8 py-2 rounded-lg text-sm outline-none transition-all"
                style={{ background: `rgba(${t.overlayChannel}, 0.04)`, border: `1px solid ${seerSearch ? 'rgba(138,180,248,0.3)' : `rgba(${t.overlayChannel}, 0.08)`}`, color: t.text, fontSize: '0.7rem' }} />
              {seerSearch && (
                <button onClick={() => setSeerSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/10 transition-all">
                  <X size={11} style={{ color: t.textMuted }} />
                </button>
              )}
            </div>
          )}
          {(() => {
            const filtered = seerSearch ? targets.filter((p) => p.name.toLowerCase().includes(seerSearch.toLowerCase())) : targets;
            return filtered.length === 0 ? (
              <p style={{ color: t.textMuted, fontSize: '0.65rem', textAlign: 'center', padding: '0.75rem 0' }}>Aucun joueur trouve pour "{seerSearch}"</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {filtered.map((tgt) => (
                  <motion.button key={tgt.id} whileTap={{ scale: 0.9 }} onClick={() => { setPendingSeerTarget(tgt.id); }}
                    className="flex flex-col items-center gap-1 p-2 rounded-lg transition-colors"
                    style={{ background: `rgba(${t.overlayChannel}, 0.03)`, border: `1px solid rgba(${t.overlayChannel}, 0.08)` }}>
                    <div className="w-8 h-8 rounded-full overflow-hidden mx-auto"><PAvatar player={tgt} size="text-xl" /></div>
                    <span style={{ color: t.textSecondary, fontSize: '0.5rem' }} className="w-full text-center line-clamp-2 break-words">{tgt.name}</span>
                  </motion.button>
                ))}
              </div>
            );
          })()}
        </div>
      ) : seerRevealInfo ? (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="rounded-lg p-5 text-center"
          style={{ background: `linear-gradient(135deg, ${seerRevealInfo.role.color}15, ${seerRevealInfo.role.color}08)`, border: `1px solid ${seerRevealInfo.role.color}40` }}>
          <p style={{ color: '#8ab4f8', fontSize: '0.55rem', fontFamily: '"Cinzel", serif', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Vision revelee</p>
          <div className="w-12 h-12 shrink-0 rounded-full overflow-hidden mx-auto mb-2">
            <PAvatar player={seerRevealInfo.player} size="text-2xl" />
          </div>
          <p style={{ color: '#c8d8f0', fontSize: '0.8rem', fontFamily: '"Cinzel", serif', marginBottom: '0.25rem' }}>{seerRevealInfo.player.name}</p>
          <div className="text-4xl my-2">{seerRevealInfo.role.emoji}</div>
          <p style={{ fontFamily: '"Cinzel", serif', color: seerRevealInfo.role.color, fontSize: '1rem', textShadow: `0 0 12px ${seerRevealInfo.role.color}40` }}>{seerRevealInfo.role.name}</p>
          <div className="inline-block px-2.5 py-0.5 rounded-full mt-2"
            style={{ background: seerRevealInfo.role.team === 'werewolf' ? 'rgba(196,30,58,0.15)' : 'rgba(107,142,90,0.15)', border: `1px solid ${seerRevealInfo.role.team === 'werewolf' ? 'rgba(196,30,58,0.3)' : 'rgba(107,142,90,0.3)'}`, fontSize: '0.6rem', color: seerRevealInfo.role.team === 'werewolf' ? '#c41e3a' : '#6b8e5a', fontFamily: '"Cinzel", serif', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {seerRevealInfo.role.team === 'village' ? 'Village' : seerRevealInfo.role.team === 'werewolf' ? 'Loup-Garou' : 'Solitaire'}
          </div>
          <div className="mt-4 mx-auto" style={{ maxWidth: '12rem' }}>
            <div className="w-full rounded-full overflow-hidden" style={{ height: '4px', background: `rgba(${t.overlayChannel}, 0.1)` }}>
              <motion.div key="seer-progress" initial={{ width: '100%' }} animate={{ width: '0%' }} transition={{ duration: 5, ease: 'linear' }}
                style={{ height: '100%', borderRadius: '9999px', background: `linear-gradient(90deg, ${seerRevealInfo.role.color}, ${seerRevealInfo.role.color}90)`, boxShadow: `0 0 8px ${seerRevealInfo.role.color}50` }} />
            </div>
            <div className="flex items-center justify-center gap-1.5 mt-2">
              <EyeOff size={11} style={{ color: t.textDim }} />
              <p style={{ color: t.textDim, fontSize: '0.6rem' }}>{seerRevealInfo.countdown}s</p>
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setSeerRevealInfo(null); if (onFlipBack) onFlipBack(); }}
            className="mt-3 flex items-center justify-center gap-1.5 mx-auto px-4 py-2 rounded-lg"
            style={{ background: `rgba(${t.overlayChannel}, 0.04)`, border: `1px solid rgba(${t.overlayChannel}, 0.1)`, color: t.textMuted, fontSize: '0.6rem', fontFamily: '"Cinzel", serif' }}>
            <RotateCcw size={11} /> Retourner maintenant
          </motion.button>
        </motion.div>
      ) : null}
    </div>
  );
}