import { type Player } from '../../../context/gameTypes';
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Crown } from 'lucide-react';
import { GMAvatar } from './GMShared';

/* ================================================================
   GM Maire Succession Modal — shown when the Maire dies.
   The GM (or the dying Maire on their player view) picks a successor.
   ================================================================ */
export function GMMaireSuccessionModal({
  players,
  dyingMaireId,
  onChooseSuccessor,
  onAutoAssign,
  villagePresentIds,
  onDismiss,
}: {
  players: Player[];
  dyingMaireId: number | null;
  onChooseSuccessor: (successorId: number) => void;
  onAutoAssign: () => void;
  villagePresentIds?: number[] | null;
  onDismiss?: () => void;
}) {
  const vpSet = villagePresentIds ? new Set(villagePresentIds) : null;
  const alive = players.filter((p) => p.alive && p.id !== dyingMaireId && (!vpSet || vpSet.has(p.id)));
  const [target, setTarget] = useState<number | null>(null);
  const dyingMaire = dyingMaireId !== null ? players.find((p) => p.id === dyingMaireId) : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md rounded-2xl p-6 flex flex-col relative"
        style={{
          background: 'linear-gradient(135deg, #1a1200, #0f1629 50%, #1a0a00)',
          border: '2px solid rgba(212,168,67,0.4)',
          maxHeight: 'calc(100dvh - 2rem)',
        }}
      >
        {/* Close button */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: '#8090b0',
              border: '1px solid rgba(255,255,255,0.1)',
              fontSize: '1rem',
            }}
          >
            ✕
          </button>
        )}
        <div className="text-center flex-shrink-0">
          <span className="text-4xl mb-3 block">👑</span>
          <h2 style={{ fontFamily: '"Cinzel", serif', color: '#d4a843', fontSize: '1.1rem' }}>
            Succession du Maire
          </h2>
          <p style={{ color: '#d4a843', fontSize: '0.75rem', marginTop: '0.25rem', opacity: 0.8 }}>
            {dyingMaire && <GMAvatar player={dyingMaire} size="text-sm" className="inline-block align-middle mr-1" />}
            {dyingMaire?.name || 'Le Maire'} est mort — choisissez son successeur
          </p>
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
                    background: target === p.id ? 'rgba(212,168,67,0.2)' : 'rgba(255,255,255,0.05)',
                    border: `2px solid ${target === p.id ? '#d4a843' : 'rgba(255,255,255,0.1)'}`,
                  }}
                >
                  <GMAvatar player={p} size="text-xl" />
                </div>
                <span style={{ color: target === p.id ? '#d4a843' : '#8090b0', fontSize: '0.6rem' }}>
                  {p.name}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 mt-5 flex-shrink-0">
          <button
            onClick={onAutoAssign}
            className="flex-1 py-3 rounded-xl flex items-center justify-center gap-2"
            style={{
              background: 'rgba(255,255,255,0.04)',
              color: '#8090b0',
              fontFamily: '"Cinzel", serif',
              fontSize: '0.75rem',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            Aleatoire
          </button>
          <button
            onClick={() => { if (target !== null) onChooseSuccessor(target); }}
            disabled={target === null}
            className="flex-[2] py-3 rounded-xl flex items-center justify-center gap-2"
            style={{
              background: target !== null ? 'linear-gradient(135deg, #d4a843, #b8922e)' : 'rgba(255,255,255,0.04)',
              color: target !== null ? 'white' : '#4a5568',
              fontFamily: '"Cinzel", serif',
              fontSize: '0.85rem',
            }}
          >
            <Crown size={16} />
            Nommer Maire
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}