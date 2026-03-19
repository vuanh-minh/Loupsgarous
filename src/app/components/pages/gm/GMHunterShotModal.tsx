import { type Player } from '../../../context/gameTypes';
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Target } from 'lucide-react';
import { GMAvatar } from './GMShared';

/* ================================================================
   Hunter Shot Modal (GM version)
   ================================================================ */
export function GMHunterShotModal({
  players,
  hunterId,
  preTarget,
  onShoot,
  villagePresentIds,
}: {
  players: Player[];
  hunterId: number | null;
  preTarget?: number | null;
  onShoot: (targetId: number) => void;
  villagePresentIds?: number[] | null;
}) {
  const vpSet = villagePresentIds ? new Set(villagePresentIds) : null;
  const alive = players.filter((p) => p.alive && p.id !== hunterId && (!vpSet || vpSet.has(p.id)));
  const validPreTarget = preTarget != null && alive.some(p => p.id === preTarget) ? preTarget : null;
  const [target, setTarget] = useState<number | null>(validPreTarget);
  const hunter = hunterId !== null ? players.find((p) => p.id === hunterId) : null;
  const preTargetPlayer = validPreTarget !== null ? players.find(p => p.id === validPreTarget) : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md rounded-2xl p-6 flex flex-col"
        style={{
          background: 'linear-gradient(135deg, #1a1200, #0f1629 50%, #1a0a00)',
          border: '2px solid rgba(217,119,6,0.4)',
          maxHeight: 'calc(100dvh - 2rem)',
        }}
      >
        <div className="text-center flex-shrink-0">
          <span className="text-4xl mb-3 block">&#x1F3F9;</span>
          <h2 style={{ fontFamily: '"Cinzel", serif', color: '#d97706', fontSize: '1.1rem' }}>
            Dernier souffle !
          </h2>
          <p style={{ color: '#d4a843', fontSize: '0.75rem', marginTop: '0.25rem' }}>
            {hunter && <GMAvatar player={hunter} size="text-sm" className="inline-block align-middle mr-1" />} {hunter?.name || 'Le Chasseur'} est elimine
          </p>
          {preTargetPlayer && (
            <p style={{ color: '#d97706', fontSize: '0.65rem', marginTop: '0.25rem', opacity: 0.8 }}>
              Cible pre-selectionnee : {preTargetPlayer.name}
            </p>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto mt-5 -mx-1 px-1">
          <div className="grid grid-cols-4 gap-3">
            {alive.map((p) => (
              <button
                key={p.id}
                onClick={() => setTarget(p.id)}
                className="flex flex-col items-center gap-1"
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{
                    background: target === p.id ? 'rgba(217,119,6,0.2)' : 'rgba(255,255,255,0.05)',
                    border: `2px solid ${target === p.id ? '#d97706' : 'rgba(255,255,255,0.1)'}`,
                  }}
                >
                  <GMAvatar player={p} size="text-xl" />
                </div>
                <span style={{ color: target === p.id ? '#d97706' : '#8090b0', fontSize: '0.6rem' }}>
                  {p.name}
                </span>
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => { if (target !== null) onShoot(target); }}
          disabled={target === null}
          className="mt-5 w-full py-3 rounded-xl flex items-center justify-center gap-2 flex-shrink-0"
          style={{
            background: target !== null ? 'linear-gradient(135deg, #d97706, #b45309)' : 'rgba(255,255,255,0.04)',
            color: target !== null ? 'white' : '#4a5568',
            fontFamily: '"Cinzel", serif',
            fontSize: '0.85rem',
          }}
        >
          <Target size={16} />
          Tirer !
        </button>
      </motion.div>
    </motion.div>
  );
}