import React, { useState } from 'react';
import { motion } from 'motion/react';
import { FlaskConical, X, Search } from 'lucide-react';
import { PAvatar } from '../PAvatar';
import { type RoleActionBaseProps } from './roleActionTypes';

interface Props extends RoleActionBaseProps {
  onEmpoisonneurTarget: (targetId: number) => void;
}

export function EmpoisonneurAction({ state, alivePlayers, currentPlayer, allPlayers, onFlipBack, onEmpoisonneurTarget, t }: Props) {
  const [pendingTarget, setPendingTarget] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const hasChosen = state.empoisonneurTargets?.[currentPlayer.id] !== undefined;
  const targets = alivePlayers.filter((p) => p.id !== currentPlayer.id);
  const pendingPlayer = pendingTarget !== null ? allPlayers.find((p) => p.id === pendingTarget) ?? null : null;
  const chosenPlayer = hasChosen ? allPlayers.find((p) => p.id === state.empoisonneurTargets?.[currentPlayer.id]) ?? null : null;

  const COLOR = '#65a30d';

  return (
    <div className="rounded-xl p-5 mb-5"
      style={{ background: `linear-gradient(135deg, rgba(101,163,13,0.06), rgba(80,140,10,0.03))`, border: `1px solid rgba(101,163,13,0.18)` }}>
      <div className="flex items-center gap-2 mb-1">
        <FlaskConical size={14} style={{ color: COLOR }} />
        <span style={{ fontFamily: '"Cinzel", serif', color: COLOR, fontSize: '0.8rem' }}>Empoisonner un joueur</span>
      </div>
      <p style={{ color: t.textMuted, fontSize: '0.6rem', marginBottom: '0.75rem' }}>
        Choisis un joueur a empoisonner. Sa prochaine quete sera automatiquement sabotee.
      </p>

      {pendingPlayer && !hasChosen ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="rounded-lg p-4 text-center" style={{ background: 'rgba(101,163,13,0.1)', border: '1px solid rgba(101,163,13,0.3)' }}>
          <p style={{ color: t.textMuted, fontSize: '0.6rem', marginBottom: '0.5rem' }}>Confirmer l'empoisonnement ?</p>
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0"><PAvatar player={pendingPlayer} size="text-2xl" /></div>
            <span style={{ color: '#c8d8f0', fontSize: '0.85rem', fontFamily: '"Cinzel", serif' }}>{pendingPlayer.name}</span>
          </div>
          <div className="flex flex-col items-stretch gap-2">
            <motion.button whileTap={{ scale: 0.95 }}
              onClick={() => { onEmpoisonneurTarget(pendingTarget!); setPendingTarget(null); if (onFlipBack) onFlipBack(); }}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg"
              style={{ background: 'rgba(101,163,13,0.2)', border: '1px solid rgba(101,163,13,0.4)', color: '#c8d8f0', fontSize: '0.65rem', fontFamily: '"Cinzel", serif' }}>
              <FlaskConical size={13} /> Confirmer
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setPendingTarget(null)}
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
              <input type="text" placeholder="Rechercher un joueur..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-8 py-2 rounded-lg text-sm outline-none transition-all"
                style={{ background: `rgba(${t.overlayChannel}, 0.04)`, border: `1px solid ${search ? 'rgba(101,163,13,0.3)' : `rgba(${t.overlayChannel}, 0.08)`}`, color: t.text, fontSize: '0.7rem' }} />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/10 transition-all">
                  <X size={11} style={{ color: t.textMuted }} />
                </button>
              )}
            </div>
          )}
          {(() => {
            const filtered = search ? targets.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())) : targets;
            return filtered.length === 0 ? (
              <p style={{ color: t.textMuted, fontSize: '0.65rem', textAlign: 'center', padding: '0.75rem 0' }}>Aucun joueur trouve pour "{search}"</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {filtered.map((tgt) => (
                  <motion.button key={tgt.id} whileTap={{ scale: 0.9 }} onClick={() => { setPendingTarget(tgt.id); }}
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
      ) : chosenPlayer ? (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="rounded-lg p-5 text-center" style={{ background: 'rgba(101,163,13,0.08)', border: '1px solid rgba(101,163,13,0.25)' }}>
          <p style={{ color: COLOR, fontSize: '0.55rem', fontFamily: '"Cinzel", serif', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Poison applique</p>
          <div className="w-12 h-12 shrink-0 rounded-full overflow-hidden mx-auto mb-2">
            <PAvatar player={chosenPlayer} size="text-2xl" />
          </div>
          <p style={{ color: '#c8d8f0', fontSize: '0.8rem', fontFamily: '"Cinzel", serif' }}>{chosenPlayer.name}</p>
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <FlaskConical size={14} style={{ color: COLOR }} />
            <span style={{ color: COLOR, fontSize: '0.7rem', fontFamily: '"Cinzel", serif' }}>Sera confus(e)</span>
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}
