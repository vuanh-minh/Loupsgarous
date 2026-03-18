import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, AlertCircle, ChevronDown, ChevronUp, Sparkles, Skull } from 'lucide-react';
import { ROLES } from '../../../data/roles';
import { type GameThemeTokens } from '../../../context/gameTheme';
import { type GamePreset } from '../../../data/gamePresets';

export function SetupRoleConfig({
  roleConfig,
  handleRoleChange,
  autoDistribute,
  isValid,
  hasEnoughWerewolves,
  playerCount,
  totalRoles,
  showRoles,
  setShowRoles,
  isMobile,
  t,
  presets,
  recommendedPresetId,
  applyPreset,
}: {
  roleConfig: Record<string, number>;
  handleRoleChange: (roleId: string, count: number) => void;
  autoDistribute: () => void;
  isValid: boolean;
  hasEnoughWerewolves: boolean;
  playerCount: number;
  totalRoles: number;
  showRoles: boolean;
  setShowRoles: (v: boolean | ((prev: boolean) => boolean)) => void;
  isMobile: boolean;
  t: GameThemeTokens;
  presets?: GamePreset[];
  recommendedPresetId?: string;
  applyPreset?: (presetId: string) => void;
}) {
  return (
    <div className="mb-3">
      <div
        onClick={() => setShowRoles((v: boolean) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowRoles((v: boolean) => !v); } }}
        className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors cursor-pointer"
        style={{ background: `rgba(${t.overlayChannel}, 0.02)`, border: `1px solid rgba(${t.overlayChannel}, 0.06)` }}
      >
        <div className="flex items-center gap-2.5 flex-wrap">
          <Shield size={14} style={{ color: t.gold }} />
          <span style={{ fontFamily: '"Cinzel", serif', color: t.gold, fontSize: '0.75rem' }}>Roles</span>
          <span
            className="px-2 py-0.5 rounded-full"
            style={{
              background: isValid ? 'rgba(74,124,89,0.1)' : 'rgba(196,30,58,0.1)',
              border: `1px solid ${isValid ? 'rgba(74,124,89,0.2)' : 'rgba(196,30,58,0.2)'}`,
              color: isValid ? '#6b8e5a' : '#c41e3a',
              fontSize: '0.6rem',
              fontFamily: '"Cinzel", serif',
            }}
          >
            {totalRoles}/{playerCount}{isValid ? ' \u2713' : ''}
          </span>
          {totalRoles > 0 && (() => {
            const goodCount = ROLES.filter(r => r.team === 'village').reduce((s, r) => s + (roleConfig[r.id] || 0), 0);
            const evilCount = ROLES.filter(r => r.team === 'werewolf').reduce((s, r) => s + (roleConfig[r.id] || 0), 0);
            const soloCount = ROLES.filter(r => r.team === 'solo').reduce((s, r) => s + (roleConfig[r.id] || 0), 0);
            const goodPct = Math.round((goodCount / totalRoles) * 100);
            const evilPct = Math.round((evilCount / totalRoles) * 100);
            return (
              <div className="flex items-center gap-1">
                <span className="px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(107,142,90,0.1)', border: '1px solid rgba(107,142,90,0.2)', color: '#6b8e5a', fontSize: '0.55rem', fontFamily: '"Cinzel", serif' }}>
                  {goodCount} ({goodPct}%)
                </span>
                <span className="px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(196,30,58,0.1)', border: '1px solid rgba(196,30,58,0.2)', color: '#c41e3a', fontSize: '0.55rem', fontFamily: '"Cinzel", serif' }}>
                  {evilCount} ({evilPct}%)
                </span>
                {soloCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#8b5cf6', fontSize: '0.55rem', fontFamily: '"Cinzel", serif' }}>
                    {soloCount}
                  </span>
                )}
              </div>
            );
          })()}
        </div>
        <div className="flex items-center gap-2">
          {!isValid && (
            <button
              onClick={(e) => { e.stopPropagation(); autoDistribute(); }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg transition-colors"
              style={{ background: t.goldBg, border: `1px solid ${t.goldBorder}` }}
            >
              <Sparkles size={10} style={{ color: t.gold }} />
              <span style={{ color: t.gold, fontSize: '0.55rem', fontFamily: '"Cinzel", serif' }}>Auto</span>
            </button>
          )}
          <motion.div animate={{ rotate: showRoles ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={14} style={{ color: t.textMuted }} />
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {showRoles && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            {/* ── Preset chips ── */}
            {presets && applyPreset && (
              <div className="mt-2.5 mb-1">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles size={10} style={{ color: t.gold }} />
                  <span style={{ color: t.textMuted, fontSize: '0.58rem', fontFamily: '"Cinzel", serif' }}>
                    Presets equilibres
                  </span>
                </div>
                <div className={`grid gap-1.5 ${isMobile ? 'grid-cols-2' : 'grid-cols-4'}`}>
                  {presets.map((preset) => {
                    const isRecommended = preset.id === recommendedPresetId;
                    const previewRoles = preset.roles(playerCount);
                    // Count wolf team using ROLES definitions
                    const wolfTeamIds = new Set(ROLES.filter(r => r.team === 'werewolf').map(r => r.id));
                    const wolfCount = Object.entries(previewRoles).reduce((sum, [id, c]) => wolfTeamIds.has(id) ? sum + c : sum, 0);
                    const villageCount = playerCount - wolfCount;
                    return (
                      <motion.button
                        key={preset.id}
                        whileTap={{ scale: 0.96 }}
                        onClick={(e) => { e.stopPropagation(); applyPreset(preset.id); }}
                        className="relative rounded-lg px-2.5 py-2 text-left transition-all cursor-pointer"
                        style={{
                          background: isRecommended
                            ? 'linear-gradient(135deg, rgba(212,168,67,0.12) 0%, rgba(184,134,11,0.06) 100%)'
                            : `rgba(${t.overlayChannel}, 0.025)`,
                          border: `1px solid ${isRecommended ? t.goldBorder : `rgba(${t.overlayChannel}, 0.08)`}`,
                        }}
                      >
                        {isRecommended && (
                          <span
                            className="absolute -top-1.5 right-2 px-1.5 py-0 rounded-full"
                            style={{
                              background: 'linear-gradient(135deg, #b8860b, #d4a843)',
                              color: '#0a0e1a',
                              fontSize: '0.45rem',
                              fontFamily: '"Cinzel", serif',
                              fontWeight: 700,
                              lineHeight: '1.2rem',
                            }}
                          >
                            Recommande
                          </span>
                        )}
                        <div className="flex items-center gap-1.5">
                          <span style={{ fontSize: '0.9rem' }}>{preset.emoji}</span>
                          <span style={{
                            fontFamily: '"Cinzel", serif',
                            color: isRecommended ? t.gold : t.text,
                            fontSize: '0.62rem',
                            fontWeight: 700,
                          }}>
                            {preset.label}
                          </span>
                        </div>
                        <p style={{ color: t.textDim, fontSize: '0.48rem', marginTop: '2px', lineHeight: 1.3 }}>
                          {preset.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span
                            className="px-1 py-0.5 rounded"
                            style={{
                              background: 'rgba(107,142,90,0.1)',
                              border: '1px solid rgba(107,142,90,0.15)',
                              color: '#6b8e5a',
                              fontSize: '0.48rem',
                              fontFamily: '"Cinzel", serif',
                            }}
                          >
                            {villageCount}
                          </span>
                          <span
                            className="px-1 py-0.5 rounded flex items-center gap-0.5"
                            style={{
                              background: 'rgba(196,30,58,0.1)',
                              border: '1px solid rgba(196,30,58,0.15)',
                              color: '#c41e3a',
                              fontSize: '0.48rem',
                              fontFamily: '"Cinzel", serif',
                            }}
                          >
                            {wolfCount}
                          </span>
                          <span
                            className="flex items-center gap-0.5"
                            style={{
                              color: t.textDim,
                              fontSize: '0.45rem',
                            }}
                          >
                            <Skull size={8} />
                            {preset.wolfKillsPerNight}/nuit
                          </span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            )}

            {!hasEnoughWerewolves && (
              <div className="rounded-lg px-3 py-1.5 mt-2 flex items-center gap-2" style={{ background: 'rgba(196,30,58,0.08)', border: '1px solid rgba(196,30,58,0.2)' }}>
                <AlertCircle size={12} style={{ color: '#c41e3a' }} />
                <span style={{ color: '#c41e3a', fontSize: '0.6rem' }}>Au moins 1 Loup-Garou requis</span>
              </div>
            )}
            <div className={`grid gap-2 mt-2 ${isMobile ? 'grid-cols-2' : 'grid-cols-3 lg:grid-cols-4'}`}>
              {ROLES.map((role) => {
                const count = roleConfig[role.id] || 0;
                const isActive = count > 0;
                return (
                  <div
                    key={role.id}
                    className="rounded-xl p-2.5 flex flex-col items-center gap-1.5 transition-colors"
                    style={{
                      background: isActive ? `linear-gradient(135deg, ${role.color}10 0%, ${role.color}05 100%)` : 'rgba(255,255,255,0.015)',
                      border: `1px solid ${isActive ? role.color + '30' : `rgba(${t.overlayChannel}, 0.06)`}`,
                    }}
                  >
                    <div className="flex items-center gap-1.5 w-full">
                      <span className="text-lg leading-none">{role.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="truncate" style={{ fontFamily: '"Cinzel", serif', color: isActive ? role.color : t.textMuted, fontSize: '0.65rem', lineHeight: 1.2 }}>{role.name}</h3>
                        <p style={{ color: t.textDim, fontSize: '0.5rem', lineHeight: 1.2 }}>{role.team === 'village' ? 'Village' : role.team === 'werewolf' ? 'Loup' : 'Solo'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={(e) => { e.stopPropagation(); handleRoleChange(role.id, count - 1); }} className="w-7 h-7 rounded-full flex items-center justify-center transition-colors" style={{ background: `rgba(${t.overlayChannel}, 0.08)`, border: `1px solid rgba(${t.overlayChannel}, 0.15)`, opacity: count <= role.minCount ? 0.25 : 1, touchAction: 'manipulation' }} disabled={count <= role.minCount}>
                        <ChevronDown size={12} style={{ color: t.text }} />
                      </button>
                      <span className="w-5 text-center" style={{ fontFamily: '"Cinzel", serif', color: isActive ? t.gold : t.textDim, fontSize: '0.9rem', fontWeight: 600 }}>{count}</span>
                      <button type="button" onClick={(e) => { e.stopPropagation(); handleRoleChange(role.id, count + 1); }} className="w-7 h-7 rounded-full flex items-center justify-center transition-colors" style={{ background: `rgba(${t.overlayChannel}, 0.08)`, border: `1px solid rgba(${t.overlayChannel}, 0.15)`, opacity: count >= role.maxCount ? 0.25 : 1, touchAction: 'manipulation' }} disabled={count >= role.maxCount}>
                        <ChevronUp size={12} style={{ color: t.text }} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}