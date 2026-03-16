import { type Player } from '../../../context/gameTypes';
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Heart } from 'lucide-react';
import { ROLES, getRoleById } from '../../../data/roles';
import { type GameThemeTokens } from '../../../context/gameTheme';
import { GMAvatar } from './GMShared';

/* ================================================================
   Revive Confirm Modal
   ================================================================ */
export function ReviveConfirmModal({
  player,
  onConfirm,
  onCancel,
  t,
}: {
  player: Player;
  onConfirm: (roleId: string) => void;
  onCancel: () => void;
  t: GameThemeTokens;
}) {
  const currentRole = getRoleById(player.role);
  const [selectedRoleId, setSelectedRoleId] = useState(player.role);
  const selectedRole = getRoleById(selectedRoleId);

  const villageRoles = ROLES.filter((r) => r.team === 'village');
  const werewolfRoles = ROLES.filter((r) => r.team === 'werewolf');
  const soloRoles = ROLES.filter((r) => r.team === 'solo');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-md rounded-2xl p-5 max-h-[85vh] flex flex-col"
        style={{
          background: 'linear-gradient(135deg, #0d1a0d, #0f1629 50%, #0d1a0d)',
          border: '2px solid rgba(107,142,90,0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-4">
          <span className="text-3xl mb-2 block">&#10024;</span>
          <h2 style={{ fontFamily: '"Cinzel", serif', color: '#6b8e5a', fontSize: '1rem' }}>
            Ressusciter un joueur
          </h2>
          <div className="flex items-center justify-center gap-2 mt-2">
            <GMAvatar player={player} size="text-xl" />
            <span style={{ color: t.text, fontSize: '0.9rem', fontWeight: 500 }}>
              {player.name}
            </span>
          </div>
          <p style={{ color: t.textMuted, fontSize: '0.65rem', marginTop: '0.35rem' }}>
            Role actuel : {currentRole?.emoji} {currentRole?.name || player.role}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto mb-4 space-y-3" style={{ minHeight: 0 }}>
          <p style={{ color: t.textSecondary, fontSize: '0.7rem', fontFamily: '"Cinzel", serif' }}>
            Choisir le role
          </p>

          {/* Village roles */}
          <div>
            <p style={{ color: '#6b8e5a', fontSize: '0.55rem', fontFamily: '"Cinzel", serif', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.35rem' }}>
              Village
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {villageRoles.map((r) => {
                const isSelected = selectedRoleId === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRoleId(r.id)}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all text-left"
                    style={{
                      background: isSelected ? 'rgba(107,142,90,0.2)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isSelected ? 'rgba(107,142,90,0.5)' : 'rgba(255,255,255,0.06)'}`,
                    }}
                  >
                    <span className="text-sm shrink-0">{r.emoji}</span>
                    <span className="truncate" style={{ color: isSelected ? '#6b8e5a' : t.textMuted, fontSize: '0.6rem' }}>
                      {r.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Werewolf roles */}
          <div>
            <p style={{ color: '#c41e3a', fontSize: '0.55rem', fontFamily: '"Cinzel", serif', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.35rem' }}>
              Loups-Garous
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {werewolfRoles.map((r) => {
                const isSelected = selectedRoleId === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRoleId(r.id)}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all text-left"
                    style={{
                      background: isSelected ? 'rgba(196,30,58,0.15)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isSelected ? 'rgba(196,30,58,0.4)' : 'rgba(255,255,255,0.06)'}`,
                    }}
                  >
                    <span className="text-sm shrink-0">{r.emoji}</span>
                    <span className="truncate" style={{ color: isSelected ? '#c41e3a' : t.textMuted, fontSize: '0.6rem' }}>
                      {r.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {soloRoles.length > 0 && (
            <div>
              <p style={{ color: '#a78bfa', fontSize: '0.55rem', fontFamily: '"Cinzel", serif', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.35rem' }}>
                Solitaires
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {soloRoles.map((r) => {
                  const isSelected = selectedRoleId === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setSelectedRoleId(r.id)}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all text-left"
                      style={{
                        background: isSelected ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${isSelected ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.06)'}`,
                      }}
                    >
                      <span className="text-sm shrink-0">{r.emoji}</span>
                      <span className="truncate" style={{ color: isSelected ? '#a78bfa' : t.textMuted, fontSize: '0.6rem' }}>
                        {r.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {selectedRole && (
          <div
            className="rounded-lg p-3 mb-4"
            style={{
              background: `${selectedRole.color}10`,
              border: `1px solid ${selectedRole.color}25`,
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span>{selectedRole.emoji}</span>
              <span style={{ color: selectedRole.color, fontSize: '0.75rem', fontFamily: '"Cinzel", serif' }}>
                {selectedRole.name}
              </span>
              {selectedRoleId !== player.role && (
                <span
                  className="ml-auto px-1.5 py-0.5 rounded-full"
                  style={{
                    background: 'rgba(212,168,67,0.15)',
                    border: '1px solid rgba(212,168,67,0.3)',
                    color: '#d4a843',
                    fontSize: '0.5rem',
                    fontFamily: '"Cinzel", serif',
                  }}
                >
                  Changement
                </span>
              )}
            </div>
            <p style={{ color: t.textMuted, fontSize: '0.6rem', lineHeight: 1.4 }}>
              {selectedRole.description}
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all hover:bg-white/5"
            style={{
              border: '1px solid rgba(255,255,255,0.1)',
              color: t.textMuted,
              fontFamily: '"Cinzel", serif',
              fontSize: '0.75rem',
            }}
          >
            <X size={14} />
            Annuler
          </button>
          <button
            onClick={() => onConfirm(selectedRoleId)}
            className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all hover:shadow-lg active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #6b8e5a, #4a7040)',
              color: '#fff',
              fontFamily: '"Cinzel", serif',
              fontSize: '0.75rem',
              boxShadow: '0 4px 15px rgba(107,142,90,0.3)',
            }}
          >
            <Heart size={14} />
            Confirmer
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
