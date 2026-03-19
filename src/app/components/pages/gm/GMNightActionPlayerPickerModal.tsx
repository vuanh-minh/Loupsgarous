import { type Player } from '../../../context/gameTypes';
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check, X, Clock, ExternalLink } from 'lucide-react';
import { getRoleById } from '../../../data/roles';
import { type GameThemeTokens } from '../../../context/gameTheme';
import { GMAvatar } from './GMShared';

/* ================================================================
   Night Action Player Picker Modal
   ================================================================ */
export function NightActionPlayerPickerModal({
  actionLabel,
  actionEmoji,
  actionColor,
  players,
  playerStatuses,
  onSelect,
  onClose,
  t,
}: {
  actionLabel: string;
  actionEmoji: string;
  actionColor: string;
  players: Player[];
  playerStatuses: Record<number, { done: boolean; detail: string }>;
  onSelect: (player: Player) => void;
  onClose: () => void;
  t: GameThemeTokens;
}) {
  const doneCount = players.filter(p => playerStatuses[p.id]?.done).length;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-sm rounded-2xl p-5"
        style={{
          background: 'linear-gradient(135deg, #0d1117, #0f1629 50%, #0d1117)',
          border: `2px solid ${actionColor}44`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="text-center mb-4">
          <span className="text-3xl mb-2 block">{actionEmoji}</span>
          <h2 style={{ fontFamily: '"Cinzel", serif', color: actionColor, fontSize: '0.95rem' }}>
            {actionLabel}
          </h2>
          <div className="flex items-center justify-center gap-2 mt-1.5">
            <p style={{ color: t.textMuted, fontSize: '0.6rem' }}>
              Choisir un joueur a previsualiser
            </p>
            <span
              className="px-1.5 py-0.5 rounded-full"
              style={{
                fontSize: '0.5rem',
                fontWeight: 600,
                background: doneCount === players.length ? 'rgba(107,142,90,0.15)' : 'rgba(255,255,255,0.06)',
                color: doneCount === players.length ? '#6b8e5a' : t.textMuted,
                border: `1px solid ${doneCount === players.length ? 'rgba(107,142,90,0.25)' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              {doneCount}/{players.length}
            </span>
          </div>
        </div>

        {/* Player list */}
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {players.map((player) => {
            const role = getRoleById(player.role);
            const status = playerStatuses[player.id];
            const isDone = status?.done ?? false;
            return (
              <button
                key={player.id}
                onClick={() => onSelect(player)}
                className="w-full flex items-center gap-3 p-3 rounded-xl transition-all hover:brightness-125 active:scale-[0.97]"
                style={{
                  background: isDone ? 'rgba(107,142,90,0.06)' : `${actionColor}0a`,
                  border: `1px solid ${isDone ? 'rgba(107,142,90,0.18)' : `${actionColor}20`}`,
                }}
              >
                {/* Avatar with status dot */}
                <div className="relative shrink-0">
                  <GMAvatar player={player} size="text-xl" />
                  <div
                    className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center"
                    style={{
                      background: isDone ? '#1a2a1a' : '#1a1a2a',
                      border: `1.5px solid ${isDone ? '#6b8e5a' : '#6b7b9b'}`,
                    }}
                  >
                    {isDone ? (
                      <Check size={7} style={{ color: '#6b8e5a' }} />
                    ) : (
                      <Clock size={7} style={{ color: '#6b7b9b' }} />
                    )}
                  </div>
                </div>

                <div className="flex-1 text-left min-w-0">
                  <span
                    className="block truncate"
                    style={{ color: t.text, fontSize: '0.8rem', fontWeight: 500 }}
                  >
                    {player.name}
                  </span>
                  <span
                    className="block truncate"
                    style={{
                      color: isDone ? actionColor : '#6b7b9b',
                      fontSize: '0.55rem',
                      opacity: 0.9,
                    }}
                  >
                    {isDone ? '\u2713 ' : '\u23F3 '}{status?.detail || (role?.emoji + ' ' + (role?.name || player.role))}
                  </span>
                </div>

                {/* Done / Pending badge */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {isDone ? (
                    <span
                      className="px-1.5 py-0.5 rounded-full"
                      style={{
                        fontSize: '0.45rem',
                        fontWeight: 600,
                        background: 'rgba(107,142,90,0.12)',
                        color: '#6b8e5a',
                        border: '1px solid rgba(107,142,90,0.2)',
                      }}
                    >
                      FAIT
                    </span>
                  ) : (
                    <span
                      className="px-1.5 py-0.5 rounded-full"
                      style={{
                        fontSize: '0.45rem',
                        fontWeight: 600,
                        background: `${actionColor}10`,
                        color: actionColor,
                        border: `1px solid ${actionColor}25`,
                      }}
                    >
                      EN ATTENTE
                    </span>
                  )}
                  <ExternalLink size={10} style={{ color: t.textMuted, opacity: 0.4 }} />
                </div>
              </button>
            );
          })}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="mt-4 w-full py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: t.textMuted,
            fontSize: '0.7rem',
            fontFamily: '"Cinzel", serif',
          }}
        >
          <X size={12} />
          Fermer
        </button>
      </motion.div>
    </motion.div>
  );
}
