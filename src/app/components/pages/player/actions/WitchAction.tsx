import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Star, Skull, Heart, X, Search, CircleCheck, RefreshCw, ArrowLeft, Droplets, FlaskConical } from 'lucide-react';
import { PAvatar } from '../PAvatar';
import { type RoleActionBaseProps } from './roleActionTypes';

interface Props extends RoleActionBaseProps {
  onWitchHeal: () => void;
  onWitchKill: (targetId: number) => void;
  onCancelWitchKill: () => void;
}

type WitchView = 'pick' | 'heal' | 'poison';

export function WitchAction({ state, alivePlayers, currentPlayer, allPlayers, onFlipBack, onWitchHeal, onWitchKill, onCancelWitchKill, t }: Props) {
  const [view, setView] = useState<WitchView>('pick');
  const [pendingWitchKillTarget, setPendingWitchKillTarget] = useState<number | null>(null);
  const [witchPoisonSearch, setWitchPoisonSearch] = useState('');

  const wolfVoteCounts: Record<number, number> = {};
  Object.values(state.werewolfVotes).forEach((tid: number) => { wolfVoteCounts[tid] = (wolfVoteCounts[tid] || 0) + 1; });
  const topWolfEntry = Object.entries(wolfVoteCounts).sort((a, b) => b[1] - a[1])[0];
  const interimWolfTarget = topWolfEntry ? parseInt(topWolfEntry[0]) : null;
  const witchVictimId = state.werewolfTarget ?? interimWolfTarget;
  const witchVictim = witchVictimId !== null ? allPlayers.find((p) => p.id === witchVictimId) ?? null : null;
  const killTargets = alivePlayers.filter((p) => p.id !== currentPlayer.id);
  const pendingKillPlayer = pendingWitchKillTarget !== null ? allPlayers.find((p) => p.id === pendingWitchKillTarget) ?? null : null;

  const healUsed = (state.witchHealUsedBy || []).includes(currentPlayer.id);
  const poisonPermanentlyUsed = (state.witchKillUsedBy || []).includes(currentPlayer.id) && state.witchKillTargets?.[currentPlayer.id] === undefined;
  const poisonTargetSelected = state.witchKillTargets?.[currentPlayer.id] !== undefined;

  /* ── Potion card ── */
  const PotionCard = ({ type, disabled, badge }: { type: 'heal' | 'poison'; disabled: boolean; badge?: string }) => {
    const isHeal = type === 'heal';
    const accent = isHeal ? { bg: 'rgba(107,142,90,0.12)', border: 'rgba(107,142,90,0.3)', color: '#6b8e5a', glow: 'rgba(107,142,90,0.15)' }
      : { bg: 'rgba(196,30,58,0.1)', border: 'rgba(196,30,58,0.25)', color: '#c41e3a', glow: 'rgba(196,30,58,0.12)' };
    return (
      <motion.button
        whileTap={disabled ? undefined : { scale: 0.95 }}
        onClick={() => { if (!disabled) setView(type); }}
        className="relative flex flex-col overflow-hidden rounded-xl w-full"
        style={{
          background: accent.bg,
          border: `1px solid ${accent.border}`,
          opacity: disabled ? 0.4 : 1,
          boxShadow: disabled ? 'none' : `0 0 20px ${accent.glow}`,
        }}
      >
        {/* Icon area */}
        <div className="relative w-full flex flex-col items-center justify-end gap-3 pb-4 pt-6" style={{ aspectRatio: '3/4' }}>
          {/* Radial glow background */}
          <div className="absolute inset-0" style={{
            background: `radial-gradient(circle at 50% 40%, ${isHeal ? 'rgba(107,142,90,0.2)' : 'rgba(196,30,58,0.15)'} 0%, transparent 70%)`,
          }} />
          {/* Main icon */}
          <div className="relative z-10 flex items-center justify-center rounded-full" style={{
            width: '4rem',
            height: '4rem',
            background: isHeal ? 'rgba(107,142,90,0.12)' : 'rgba(196,30,58,0.1)',
            border: `1px solid ${isHeal ? 'rgba(107,142,90,0.25)' : 'rgba(196,30,58,0.2)'}`,
            boxShadow: `0 0 30px ${accent.glow}`,
          }}>
            {isHeal
              ? <Droplets size={28} style={{ color: '#6b8e5a' }} />
              : <FlaskConical size={28} style={{ color: '#c41e3a' }} />}
          </div>
          {/* Used badge */}
          {badge && (
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full" style={{
              background: badge.startsWith('✓') ? 'rgba(107,142,90,0.25)' : 'rgba(196,30,58,0.25)',
              border: badge.startsWith('✓') ? '1px solid rgba(107,142,90,0.4)' : '1px solid rgba(196,30,58,0.4)',
            }}>
              <span style={{ color: badge.startsWith('✓') ? '#6b8e5a' : '#c41e3a', fontSize: '0.5rem', fontFamily: '"Cinzel", serif', fontWeight: 600 }}>{badge}</span>
            </div>
          )}
          {/* Title */}
          <div className="relative z-10 px-3 text-center">
            <p style={{
              fontFamily: '"Cinzel", serif',
              color: accent.color,
              fontSize: '0.72rem',
              fontWeight: 700,
              lineHeight: 1.3,
            }}>
              {isHeal ? 'Potion de Guérison' : 'Potion de Poison'}
            </p>
            <p style={{
              color: 'rgba(200,200,200,0.6)',
              fontSize: '0.48rem',
              marginTop: '0.15rem',
              lineHeight: 1.3,
            }}>
              {isHeal ? 'Sauvez la victime des loups' : 'Empoisonnez un joueur'}
            </p>
          </div>
        </div>
      </motion.button>
    );
  };

  /* ── Back button ── */
  const BackButton = () => (
    <motion.button
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => { setView('pick'); setPendingWitchKillTarget(null); setWitchPoisonSearch(''); }}
      className="flex items-center gap-1.5 mb-3"
      style={{ color: '#a782e3', fontSize: '0.6rem', fontFamily: '"Cinzel", serif' }}
    >
      <ArrowLeft size={12} />
      Retour aux potions
    </motion.button>
  );

  /* ── Heal view ── */
  const HealView = () => {
    const blindMode = !witchVictim;
    const victim = witchVictim;

    return (
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.25 }}>
        <BackButton />
        <div className="rounded-xl p-4" style={{ background: 'rgba(107,142,90,0.06)', border: '1px solid rgba(107,142,90,0.18)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span style={{ fontSize: '1.2rem' }}>💚</span>
            <span style={{ fontFamily: '"Cinzel", serif', color: '#6b8e5a', fontSize: '0.8rem', fontWeight: 700 }}>Potion de Guérison</span>
          </div>

          {victim ? (
            <div>
              <p style={{ color: t.textSecondary, fontSize: '0.6rem', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                Les loups ont ciblé : <span style={{ color: '#c41e3a', fontWeight: 600 }}>{victim.name}</span>
              </p>
              <div className="flex flex-col items-center justify-center gap-1.5 mb-3 p-3 rounded-lg" style={{ background: 'rgba(196,30,58,0.06)', border: '1px solid rgba(196,30,58,0.15)' }}>
                <div className="w-12 h-12 shrink-0 rounded-full overflow-hidden">
                  <PAvatar player={victim as any} size="text-2xl" />
                </div>
                <div className="text-center">
                  <p style={{ color: '#e8c8c8', fontSize: '0.8rem', fontFamily: '"Cinzel", serif', fontWeight: 600 }}>{victim.name}</p>
                  <p style={{ color: '#c41e3a', fontSize: '0.5rem' }}>En danger de mort</p>
                </div>
              </div>
            </div>
          ) : (
            <p style={{ color: t.textMuted, fontSize: '0.55rem', marginBottom: '0.75rem', lineHeight: 1.5 }}>
              Les loups n'ont pas encore choisi de cible. La potion sera utilisée à l'aveugle.
            </p>
          )}

          <div className="flex flex-col gap-2">
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => { onWitchHeal(); setView('pick'); if (onFlipBack) onFlipBack(); }}
                className="w-full py-2.5 rounded-lg flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, rgba(107,142,90,0.2), rgba(107,142,90,0.1))', border: '1px solid rgba(107,142,90,0.3)', color: '#6b8e5a', fontFamily: '"Cinzel", serif', fontSize: '0.7rem' }}>
                <Heart size={14} /> {victim ? `Sauver ${victim.name}` : 'Sauver la prochaine cible'}
              </motion.button>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setView('pick'); if (onFlipBack) onFlipBack(); }}
                className="w-full py-2.5 rounded-lg flex items-center justify-center gap-2"
                style={{ background: `rgba(${t.overlayChannel}, 0.04)`, border: `1px solid rgba(${t.overlayChannel}, 0.1)`, color: t.textMuted, fontFamily: '"Cinzel", serif', fontSize: '0.7rem' }}>
                <X size={14} /> Ne rien faire
              </motion.button>
            </div>
        </div>
      </motion.div>
    );
  };

  /* ── Poison view ── */
  const PoisonView = () => (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
      <BackButton />
      <div className="rounded-xl p-4" style={{ background: 'rgba(196,30,58,0.04)', border: '1px solid rgba(196,30,58,0.15)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span style={{ fontSize: '1.2rem' }}>💀</span>
          <span style={{ fontFamily: '"Cinzel", serif', color: '#c41e3a', fontSize: '0.8rem', fontWeight: 700 }}>Potion de Poison</span>
        </div>

        {pendingKillPlayer && !poisonTargetSelected ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="rounded-lg p-4 text-center" style={{ background: 'rgba(196,30,58,0.1)', border: '1px solid rgba(196,30,58,0.3)' }}>
            <p style={{ color: t.textMuted, fontSize: '0.6rem', marginBottom: '0.5rem' }}>Confirmer l'empoisonnement ?</p>
            <div className="flex flex-col items-center justify-center gap-1.5 mb-3">
              <div className="w-12 h-12 shrink-0 rounded-full overflow-hidden">
                <PAvatar player={pendingKillPlayer} size="text-2xl" />
              </div>
              <span style={{ color: '#e8c8c8', fontSize: '0.85rem', fontFamily: '"Cinzel", serif' }}>{pendingKillPlayer.name}</span>
            </div>
            <div className="flex flex-col items-stretch gap-2">
              <motion.button whileTap={{ scale: 0.95 }}
                onClick={() => { onWitchKill(pendingWitchKillTarget!); setPendingWitchKillTarget(null); setView('pick'); if (onFlipBack) onFlipBack(); }}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg"
                style={{ background: 'rgba(196,30,58,0.2)', border: '1px solid rgba(196,30,58,0.4)', color: '#e8c8c8', fontSize: '0.65rem', fontFamily: '"Cinzel", serif' }}>
                <Skull size={13} /> Confirmer
              </motion.button>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setPendingWitchKillTarget(null)}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg"
                style={{ background: `rgba(${t.overlayChannel}, 0.04)`, border: `1px solid rgba(${t.overlayChannel}, 0.12)`, color: t.textMuted, fontSize: '0.65rem', fontFamily: '"Cinzel", serif' }}>
                <X size={13} /> Annuler
              </motion.button>
            </div>
          </motion.div>
        ) : poisonTargetSelected ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="p-3 rounded-lg" style={{ background: 'rgba(196,30,58,0.1)', border: '1px solid rgba(196,30,58,0.25)' }}>
            <div className="text-center">
              <CircleCheck size={16} style={{ color: '#c41e3a', margin: '0 auto' }} />
              <p style={{ color: '#c41e3a', fontSize: '0.65rem', fontFamily: '"Cinzel", serif', marginTop: '0.3rem' }}>Poison administré</p>
              <p style={{ color: t.textMuted, fontSize: '0.6rem', marginTop: '0.15rem' }}>
                {allPlayers.find((p) => p.id === state.witchKillTargets?.[currentPlayer.id])?.name || 'Cible'} sera empoisonné(e).
              </p>
            </div>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => { onCancelWitchKill(); }}
              className="w-full mt-2.5 py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
              style={{ background: 'rgba(196,30,58,0.15)', border: '1px solid rgba(196,30,58,0.3)', color: '#c41e3a', fontSize: '0.6rem', fontFamily: '"Cinzel", serif' }}>
              <RefreshCw size={10} /> Changer de cible
            </motion.button>
          </motion.div>
        ) : (
          <div>
            <p style={{ color: t.textMuted, fontSize: '0.55rem', marginBottom: '0.5rem' }}>Choisis un joueur à empoisonner cette nuit.</p>
            {killTargets.length > 5 && (
              <div className="relative mb-2">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.textDim }} />
                <input type="text" placeholder="Rechercher un joueur..." value={witchPoisonSearch} onChange={(e) => setWitchPoisonSearch(e.target.value)}
                  className="w-full pl-8 pr-8 py-2 rounded-lg text-sm outline-none transition-all"
                  style={{ background: `rgba(${t.overlayChannel}, 0.04)`, border: `1px solid ${witchPoisonSearch ? 'rgba(196,30,58,0.3)' : `rgba(${t.overlayChannel}, 0.08)`}`, color: t.text, fontSize: '0.7rem' }} />
                {witchPoisonSearch && (
                  <button onClick={() => setWitchPoisonSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/10 transition-all">
                    <X size={11} style={{ color: t.textMuted }} />
                  </button>
                )}
              </div>
            )}
            {(() => {
              const filtered = witchPoisonSearch ? killTargets.filter((p) => p.name.toLowerCase().includes(witchPoisonSearch.toLowerCase())) : killTargets;
              return filtered.length === 0 ? (
                <p style={{ color: t.textMuted, fontSize: '0.65rem', textAlign: 'center', padding: '0.75rem 0' }}>Aucun joueur trouvé pour "{witchPoisonSearch}"</p>
              ) : (
                <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                  {filtered.map((tgt) => (
                    <motion.button key={tgt.id} whileTap={{ scale: 0.9 }} onClick={() => { setPendingWitchKillTarget(tgt.id); }}
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
        )}
      </div>
    </motion.div>
  );

  return (
    <div className="rounded-xl p-5 mb-5"
      style={{ background: 'linear-gradient(135deg, rgba(167,130,227,0.06), rgba(130,100,190,0.03))', border: '1px solid rgba(167,130,227,0.18)' }}>
      <div className="flex items-center gap-2 mb-4">
        <Star size={14} style={{ color: '#a782e3' }} />
        <span style={{ fontFamily: '"Cinzel", serif', color: '#a782e3', fontSize: '0.8rem' }}>Potions</span>
      </div>

      <AnimatePresence mode="wait">
        {view === 'pick' ? (
          <motion.div
            key="pick"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-2 gap-3"
          >
            <PotionCard type="heal" disabled={healUsed} badge={healUsed ? 'Utilisée' : undefined} />
            <PotionCard type="poison" disabled={poisonPermanentlyUsed} badge={poisonPermanentlyUsed ? 'Utilisée' : poisonTargetSelected ? '✓ Choisie' : undefined} />
          </motion.div>
        ) : view === 'heal' ? (
          <HealView key="heal" />
        ) : (
          <PoisonView key="poison" />
        )}
      </AnimatePresence>
    </div>
  );
}