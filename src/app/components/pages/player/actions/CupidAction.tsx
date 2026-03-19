import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Heart, X, Search } from 'lucide-react';
import { PAvatar } from '../PAvatar';
import { type RoleActionBaseProps } from './roleActionTypes';

interface Props extends RoleActionBaseProps {
  onCupidLink: (id1: number, id2: number) => void;
  selectedTarget: number | null;
  setSelectedTarget: (v: number | null) => void;
}

export function CupidAction({ state, currentPlayer, allPlayers, onFlipBack, onCupidLink, selectedTarget, setSelectedTarget, t }: Props) {
  const [pendingCupidSecond, setPendingCupidSecond] = useState<number | null>(null);
  const [cupidSearch, setCupidSearch] = useState('');

  const cupidTargets = allPlayers.filter((p) => p.alive);
  const cupidSelection1 = selectedTarget;

  if ((state.cupidLinkedBy || []).includes(currentPlayer.id)) return null;

  const pendingSecondPlayer = pendingCupidSecond !== null ? allPlayers.find((p) => p.id === pendingCupidSecond) ?? null : null;
  const firstPlayer = cupidSelection1 !== null ? allPlayers.find((p) => p.id === cupidSelection1) ?? null : null;

  return (
    <div className="rounded-xl p-5 mb-5"
      style={{ background: 'linear-gradient(135deg, rgba(236,72,153,0.06), rgba(200,50,130,0.03))', border: '1px solid rgba(236,72,153,0.18)' }}>
      <div className="flex items-center gap-2 mb-1">
        <Heart size={14} style={{ color: '#ec4899' }} />
        <span style={{ fontFamily: '"Cinzel", serif', color: '#ec4899', fontSize: '0.8rem' }}>Choisir les Amoureux</span>
      </div>
      <p style={{ color: t.textMuted, fontSize: '0.6rem', marginBottom: '0.75rem' }}>
        {cupidSelection1 === null ? 'Selectionne le premier amoureux.' : pendingCupidSecond !== null ? 'Confirmer votre choix ?' : 'Selectionne le second amoureux.'}
      </p>

      {cupidSelection1 !== null && !pendingCupidSecond && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-3"
          style={{ background: 'rgba(236,72,153,0.08)', border: '1px solid rgba(236,72,153,0.15)' }}>
          <Heart size={11} style={{ color: '#ec4899', fill: '#ec4899' }} />
          <span style={{ color: '#ec4899', fontSize: '0.6rem' }}>
            1er: {(() => { const p1 = allPlayers.find((p) => p.id === cupidSelection1); return p1 ? <span className="inline-block align-middle mr-0.5 w-4 h-4 rounded-full overflow-hidden"><PAvatar player={p1} size="text-xs" /></span> : null; })()}{' '}
            {allPlayers.find((p) => p.id === cupidSelection1)?.name}
          </span>
          <button onClick={() => setSelectedTarget(null)} className="ml-auto w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <X size={10} style={{ color: t.textMuted }} />
          </button>
        </div>
      )}

      {pendingSecondPlayer && firstPlayer ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="rounded-lg p-4 text-center" style={{ background: 'rgba(236,72,153,0.1)', border: '1px solid rgba(236,72,153,0.3)' }}>
          <p style={{ color: t.textMuted, fontSize: '0.6rem', marginBottom: '0.5rem' }}>Lier ces deux joueurs ?</p>
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="flex flex-col items-center gap-1">
              <div className="w-9 h-9 rounded-full overflow-hidden"><PAvatar player={firstPlayer} size="text-2xl" /></div>
              <span style={{ color: '#f0c8d8', fontSize: '0.65rem', fontFamily: '"Cinzel", serif' }}>{firstPlayer.name}</span>
            </div>
            <Heart size={18} style={{ color: '#ec4899', fill: '#ec4899' }} />
            <div className="flex flex-col items-center gap-1">
              <div className="w-9 h-9 rounded-full overflow-hidden"><PAvatar player={pendingSecondPlayer} size="text-2xl" /></div>
              <span style={{ color: '#f0c8d8', fontSize: '0.65rem', fontFamily: '"Cinzel", serif' }}>{pendingSecondPlayer.name}</span>
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-2">
            <motion.button whileTap={{ scale: 0.95 }}
              onClick={() => { onCupidLink(cupidSelection1!, pendingCupidSecond!); setSelectedTarget(null); setPendingCupidSecond(null); if (onFlipBack) onFlipBack(); }}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg"
              style={{ background: 'rgba(236,72,153,0.2)', border: '1px solid rgba(236,72,153,0.4)', color: '#f0c8d8', fontSize: '0.65rem', fontFamily: '"Cinzel", serif' }}>
              <Heart size={13} /> Confirmer
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setPendingCupidSecond(null)}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg"
              style={{ background: `rgba(${t.overlayChannel}, 0.04)`, border: `1px solid rgba(${t.overlayChannel}, 0.12)`, color: t.textMuted, fontSize: '0.65rem', fontFamily: '"Cinzel", serif' }}>
              <X size={13} /> Annuler
            </motion.button>
          </div>
        </motion.div>
      ) : (
        <div>
          {cupidTargets.filter((tgt) => tgt.id !== cupidSelection1).length > 5 && (
            <div className="relative mb-2">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.textDim }} />
              <input type="text" placeholder="Rechercher un joueur..." value={cupidSearch} onChange={(e) => setCupidSearch(e.target.value)}
                className="w-full pl-8 pr-8 py-2 rounded-lg text-sm outline-none transition-all"
                style={{ background: `rgba(${t.overlayChannel}, 0.04)`, border: `1px solid ${cupidSearch ? 'rgba(236,72,153,0.3)' : `rgba(${t.overlayChannel}, 0.08)`}`, color: t.text, fontSize: '0.7rem' }} />
              {cupidSearch && (
                <button onClick={() => setCupidSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/10 transition-all">
                  <X size={11} style={{ color: t.textMuted }} />
                </button>
              )}
            </div>
          )}
          {(() => {
            const baseCupid = cupidTargets.filter((tgt) => tgt.id !== cupidSelection1);
            const filtered = cupidSearch ? baseCupid.filter((p) => p.name.toLowerCase().includes(cupidSearch.toLowerCase())) : baseCupid;
            return filtered.length === 0 ? (
              <p style={{ color: t.textMuted, fontSize: '0.65rem', textAlign: 'center', padding: '0.75rem 0' }}>Aucun joueur trouve pour "{cupidSearch}"</p>
            ) : (
              <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                {filtered.map((tgt) => {
                  const isSelf = tgt.id === currentPlayer.id;
                  return (
                    <motion.button key={tgt.id} whileTap={{ scale: 0.9 }}
                      onClick={() => { if (cupidSelection1 === null) { setSelectedTarget(tgt.id); } else { setPendingCupidSecond(tgt.id); } }}
                      className="flex flex-col items-center gap-1 p-2 rounded-lg transition-colors"
                      style={{ background: isSelf ? `${t.goldBg}` : `rgba(${t.overlayChannel}, 0.03)`, border: `1px solid ${isSelf ? t.goldBorder : `rgba(${t.overlayChannel}, 0.08)`}` }}>
                      <div className="w-8 h-8 rounded-full overflow-hidden mx-auto"><PAvatar player={tgt} size="text-xl" /></div>
                      <span style={{ color: t.textSecondary, fontSize: '0.5rem' }} className="w-full text-center line-clamp-2 break-words">{tgt.name}{isSelf ? ' (toi)' : ''}</span>
                    </motion.button>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}