import React from 'react';
import { motion } from 'motion/react';
import { Crosshair, X } from 'lucide-react';
import { PAvatar } from '../PAvatar';
import { type RoleActionBaseProps } from './roleActionTypes';

interface Props extends RoleActionBaseProps {
  onHunterPreTarget?: (targetId: number | null) => void;
}

export function HunterAction({ state, alivePlayers, currentPlayer, onHunterPreTarget, t }: Props) {
  const preTarget = (state.hunterPreTargets || {})[currentPlayer.id] ?? null;
  const preTargetPlayer = preTarget !== null ? alivePlayers.find(p => p.id === preTarget) ?? null : null;
  const hunterTargets = alivePlayers.filter(p => p.id !== currentPlayer.id);

  return (
    <div className="rounded-xl p-4 mb-5"
      style={{ background: 'linear-gradient(135deg, rgba(217,119,6,0.06), rgba(180,100,5,0.03))', border: '1px solid rgba(217,119,6,0.18)' }}>
      <div className="flex items-center gap-2 mb-2">
        <Crosshair size={14} style={{ color: '#d97706' }} />
        <span style={{ fontFamily: '"Cinzel", serif', color: '#d97706', fontSize: '0.8rem' }}>Dernier souffle</span>
      </div>
      <p style={{ color: t.textMuted, fontSize: '0.55rem', marginBottom: '0.5rem', lineHeight: 1.4 }}>
        Choisis ta cible a l'avance. Si tu es elimine, ton arme tirera automatiquement.
      </p>

      {preTargetPlayer ? (
        <div>
          <div className="rounded-lg p-3 mb-2 flex items-center gap-3"
            style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)' }}>
            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
              <PAvatar player={preTargetPlayer} size="text-xl" />
            </div>
            <div className="flex-1">
              <p style={{ color: '#d97706', fontSize: '0.7rem', fontFamily: '"Cinzel", serif' }}>{preTargetPlayer.name}</p>
              <p style={{ color: t.textMuted, fontSize: '0.5rem' }}>Cible verrouillée</p>
            </div>
            <Crosshair size={16} style={{ color: '#d97706', opacity: 0.6 }} />
          </div>
          <motion.button whileTap={{ scale: 0.95 }}
            onClick={() => { if (onHunterPreTarget) onHunterPreTarget(null); }}
            className="w-full py-2 rounded-lg flex items-center justify-center gap-2"
            style={{ background: `rgba(${t.overlayChannel}, 0.04)`, border: `1px solid rgba(${t.overlayChannel}, 0.1)`, color: t.textMuted, fontFamily: '"Cinzel", serif', fontSize: '0.6rem' }}>
            <X size={12} /> Changer de cible
          </motion.button>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {hunterTargets.map((p) => (
            <motion.button key={p.id} whileTap={{ scale: 0.9 }}
              onClick={() => { if (onHunterPreTarget) onHunterPreTarget(p.id); }}
              className="flex flex-col items-center gap-1 p-2 rounded-lg transition-colors"
              style={{ background: `rgba(${t.overlayChannel}, 0.03)`, border: `1px solid rgba(${t.overlayChannel}, 0.08)` }}>
              <div className="w-8 h-8 rounded-full overflow-hidden mx-auto">
                <PAvatar player={p} size="text-xl" />
              </div>
              <span style={{ color: t.textSecondary, fontSize: '0.5rem' }} className="w-full text-center line-clamp-2 break-words">{p.name}</span>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}