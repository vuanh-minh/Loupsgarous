import React from 'react';
import { motion } from 'motion/react';
import { EyeOff, Moon } from 'lucide-react';
import { PAvatar } from '../PAvatar';
import { type RoleActionBaseProps } from './roleActionTypes';

export function PetiteFilleAction({ state, currentPlayer, allPlayers, t }: RoleActionBaseProps) {
  const wokeUpIds = new Set<number>();

  Object.keys(state.werewolfVotes).forEach((wId) => { wokeUpIds.add(Number(wId)); });
  if (state.seerTargets && Object.keys(state.seerTargets).length > 0) {
    Object.keys(state.seerTargets).forEach((sId) => wokeUpIds.add(Number(sId)));
  }
  if (Object.keys(state.witchHealedThisNight || {}).length > 0 || (state.witchKillTargets && Object.keys(state.witchKillTargets).length > 0)) {
    allPlayers.filter((p) => p.alive && p.role === 'sorciere').forEach((w) => {
      if ((state.witchHealedThisNight || {})[w.id] || state.witchKillTargets?.[w.id] !== undefined) {
        wokeUpIds.add(w.id);
      }
    });
  }
  if ((state.cupidLinkedBy || []).length > 0 && state.turn === 1) {
    (state.cupidLinkedBy || []).forEach((cId) => wokeUpIds.add(cId));
  }
  if (state.guardTargets && Object.keys(state.guardTargets).length > 0) {
    Object.keys(state.guardTargets).forEach((gId) => wokeUpIds.add(Number(gId)));
  }
  if (state.corbeauTargets && Object.keys(state.corbeauTargets).length > 0) {
    Object.keys(state.corbeauTargets).forEach((cId) => wokeUpIds.add(Number(cId)));
  }
  if (state.foxTargets && Object.keys(state.foxTargets).length > 0) {
    Object.keys(state.foxTargets).forEach((fId) => wokeUpIds.add(Number(fId)));
  }
  wokeUpIds.delete(currentPlayer.id);
  const wokeUpPlayers = allPlayers.filter((p) => wokeUpIds.has(p.id));

  return (
    <div className="rounded-xl p-5 mb-5"
      style={{ background: 'linear-gradient(135deg, rgba(212,168,67,0.06), rgba(180,140,50,0.03))', border: '1px solid rgba(212,168,67,0.18)' }}>
      <div className="flex items-center gap-2 mb-1">
        <EyeOff size={14} style={{ color: t.gold }} />
        <span style={{ fontFamily: '"Cinzel", serif', color: t.gold, fontSize: '0.8rem' }}>Espionnage</span>
      </div>
      <p style={{ color: t.textMuted, fontSize: '0.6rem', marginBottom: '0.75rem' }}>Ces personnes se sont réveillées cette nuit, leur rôle t’est inconnu…</p>

      {wokeUpPlayers.length > 0 ? (
        <div className="grid grid-cols-4 gap-2">
          {wokeUpPlayers.map((p) => (
            <motion.div key={p.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-1 p-2 rounded-lg text-center"
              style={{ background: `rgba(${t.overlayChannel}, 0.04)`, border: `1px solid rgba(${t.overlayChannel}, 0.08)` }}>
              <div className="relative">
                <div className="w-7 h-7 rounded-full overflow-hidden"><PAvatar player={p} size="text-lg" /></div>
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                  style={{ background: t.gold, boxShadow: `0 0 6px ${t.gold}80`, animation: 'pulse 2s ease-in-out infinite' }} />
              </div>
              <span className="line-clamp-2 break-words" style={{ color: t.text, fontSize: '0.55rem', fontWeight: 600, lineHeight: 1.2 }}>{p.name}</span>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="p-3 rounded-lg text-center"
          style={{ background: `rgba(${t.overlayChannel}, 0.02)`, border: `1px solid rgba(${t.overlayChannel}, 0.06)` }}>
          <Moon size={16} style={{ color: t.textDim, margin: '0 auto', marginBottom: '0.3rem' }} />
          <p style={{ color: t.textMuted, fontSize: '0.6rem' }}>Personne ne s'est encore reveille...</p>
        </div>
      )}
    </div>
  );
}