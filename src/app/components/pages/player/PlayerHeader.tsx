import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import {
  Moon, Sun, ChevronDown, Users, Sparkles,
  CircleCheck, ScrollText, LogOut, Eye, RefreshCw,
} from 'lucide-react';
import { type Player, type GameState } from '../../../context/GameContext';
import { getRoleById, type RoleDefinition } from '../../../data/roles';
import { type GameThemeTokens } from '../../../context/gameTheme';
import { type PanelId } from './useSwipeNavigation';
import { PAvatar } from './PAvatar';

interface PlayerHeaderProps {
  state: GameState;
  currentPlayer: Player;
  currentPlayerId: number | null;
  t: GameThemeTokens;
  isNight: boolean;
  isPracticeMode: boolean;
  isSimulationMode: boolean;
  isDiscoveryRealMode: boolean;
  isCurrentPlayerDead: boolean;
  isGMPreview: boolean;
  gmBackButton: React.ReactNode;
  alivePlayers: Player[];
  deadPlayers: Player[];
  isResyncing: boolean;
  onResync: () => void;
  onOpenJournal: () => void;
  activePanel?: PanelId;
}

export const PlayerHeader = React.memo(function PlayerHeader({
  state,
  currentPlayer,
  currentPlayerId,
  t,
  isNight,
  isPracticeMode,
  isSimulationMode,
  isDiscoveryRealMode,
  isCurrentPlayerDead,
  isGMPreview,
  gmBackButton,
  alivePlayers,
  deadPlayers,
  isResyncing,
  onResync,
  onOpenJournal,
  activePanel = 'game',
}: PlayerHeaderProps) {
  const navigate = useNavigate();
  const [showGMMenu, setShowGMMenu] = useState(false);
  const gmMenuRef = useRef<HTMLDivElement>(null);

  // Close GM menu on click outside
  useEffect(() => {
    if (!showGMMenu) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (gmMenuRef.current && !gmMenuRef.current.contains(e.target as Node)) {
        setShowGMMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [showGMMenu]);

  const phaseLabel = isPracticeMode
    ? 'Decouverte'
    : isNight
      ? `Nuit ${state.turn}`
      : `Jour ${state.turn}`;

  const phaseColor = isPracticeMode ? t.gold : isNight ? t.nightSky : t.daySky;
  const PhaseIcon = isPracticeMode ? Sparkles : isNight ? Moon : Sun;

  // Light parchment style for Village/Quêtes tabs in day mode
  const isLightHeader = !isNight && !isPracticeMode && (activePanel === 'village' || activePanel === 'quests');
  const isCleanChip = isLightHeader || ((isNight || isPracticeMode) && (activePanel === 'village' || activePanel === 'quests'));

  // Chip color varies by active tab
  const chipColors = (() => {
    if (isNight || isPracticeMode) {
      if (activePanel === 'village' || activePanel === 'quests') return { bg: 'transparent', border: 'transparent' };
      return { bg: 'rgba(0,0,0,0.45)', border: 'rgba(255,255,255,0.15)' };
    }
    // Day – light header uses transparent chip
    if (isLightHeader) return { bg: 'transparent', border: 'transparent' };
    return { bg: 'rgba(0,0,0,0.35)', border: 'rgba(255,255,255,0.12)' };
  })();

  return (
    <div
      className="px-4 py-2 flex-shrink-0 relative z-[60]"
      style={{
        paddingTop: 'max(calc(env(safe-area-inset-top, 12px) + 6px), 12px)',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        {/* Left side: GM back + phase/alive chip */}
        <div className="flex items-center gap-2 min-w-0">
          {gmBackButton}

          {/* Phase + alive chip — tap to resync */}
          <button
            onClick={onResync}
            disabled={isResyncing}
            className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full active:scale-95 transition-transform"
            style={{
              background: chipColors.bg,
              border: `1px solid ${chipColors.border}`,
              backdropFilter: isCleanChip ? undefined : 'blur(16px)',
              boxShadow: isCleanChip ? 'none' : '0 2px 8px rgba(0,0,0,0.3)',
              transition: 'background 0.3s, border-color 0.3s, box-shadow 0.3s',
              cursor: isResyncing ? 'default' : 'pointer',
            }}
            title="Resynchroniser"
          >
            {isResyncing ? (
              <RefreshCw size={13} className="animate-spin" style={{ color: isLightHeader ? '#D4A030' : phaseColor }} />
            ) : (
              <PhaseIcon size={13} style={{ color: isLightHeader ? '#D4A030' : phaseColor }} />
            )}
            <span style={{
              fontFamily: '"Cinzel", serif',
              color: isLightHeader ? '#D4A030' : phaseColor,
              fontSize: isLightHeader ? '0.875rem' : '0.7rem',
              fontWeight: 700,
              textShadow: isLightHeader ? 'none' : '0 1px 3px rgba(0,0,0,0.4)',
            }}>
              {phaseLabel}
            </span>
            <span style={{
              width: 1,
              height: 12,
              background: isLightHeader ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.18)',
            }} />
            <Users size={12} style={{ color: isLightHeader ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)' }} />
            <span style={{
              color: isLightHeader ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.75)',
              fontSize: isLightHeader ? '0.8125rem' : '0.65rem',
              fontWeight: 500,
              letterSpacing: isLightHeader ? '-0.005em' : undefined,
            }}>
              {alivePlayers.length}/{state.players.length}
            </span>
          </button>

          {/* Simulation / Discovery badge */}
          {isSimulationMode && (
            <span
              className="px-2 py-0.5 rounded-full"
              style={{
                background: 'rgba(167,130,227,0.12)',
                border: '1px solid rgba(167,130,227,0.25)',
                color: '#a782e3',
                fontSize: '0.55rem',
                fontFamily: '"Cinzel", serif',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              Entrainement
            </span>
          )}
          {isDiscoveryRealMode && (
            <span
              className="px-2 py-0.5 rounded-full"
              style={{
                background: 'rgba(107,142,90,0.12)',
                border: '1px solid rgba(107,142,90,0.25)',
                color: '#6b8e5a',
                fontSize: '0.55rem',
                fontFamily: '"Cinzel", serif',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              Nuit 1
            </span>
          )}
        </div>

        {/* Right side: Journal + GM player switcher */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenJournal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors active:scale-95"
            style={{
              background: isLightHeader ? '#e6e1d2' : (isNight || isPracticeMode ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.3)'),
              border: `1px solid ${isLightHeader ? '#cfcabd' : (isNight || isPracticeMode ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.12)')}`,
              backdropFilter: isLightHeader ? undefined : 'blur(16px)',
              boxShadow: isLightHeader ? 'none' : '0 2px 8px rgba(0,0,0,0.3)',
              transition: 'background 0.3s, border-color 0.3s, box-shadow 0.3s',
            }}
            title="Ouvrir le journal"
            aria-label="Ouvrir le journal de la partie"
          >
            <ScrollText size={12} style={{ color: isLightHeader ? '#7a6a4a' : (isNight || isPracticeMode ? 'rgba(255,255,255,0.85)' : '#f0d78c') }} />
            <span style={{
              color: isLightHeader ? '#7a6a4a' : (isNight || isPracticeMode ? 'rgba(255,255,255,0.9)' : '#f0d78c'),
              fontSize: isLightHeader ? '0.6875rem' : '0.55rem',
              fontFamily: '"Cinzel", serif',
              fontWeight: 700,
              textShadow: isLightHeader ? 'none' : '0 1px 3px rgba(0,0,0,0.4)',
            }}>
              Journal
            </span>
          </button>

          {/* GM Preview player switcher */}
          {isGMPreview && (
            <div className="relative" ref={gmMenuRef}>
              <button
                onClick={() => setShowGMMenu((v) => !v)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg cursor-pointer transition-opacity active:opacity-70"
                style={{
                  background: 'rgba(139,92,246,0.1)',
                  border: '1px solid rgba(139,92,246,0.3)',
                }}
              >
                <Eye size={12} style={{ color: '#a78bfa' }} />
                <span style={{ color: '#a78bfa', fontSize: '0.6rem', fontFamily: '"Cinzel", serif' }}>
                  {currentPlayer.name}
                </span>
                <ChevronDown size={10} style={{ color: '#a78bfa', opacity: 0.6, transition: 'transform 0.2s', transform: showGMMenu ? 'rotate(180deg)' : 'rotate(0)' }} />
              </button>
              <AnimatePresence>
                {showGMMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-1 z-50 rounded-xl overflow-hidden shadow-lg"
                    style={{
                      background: isNight ? '#1a1025' : '#f5eed9',
                      border: `1px solid ${isNight ? 'rgba(139,92,246,0.35)' : 'rgba(120,90,200,0.3)'}`,
                      minWidth: '240px',
                      width: 'min(280px, 75vw)',
                      maxHeight: 'min(60vh, 400px)',
                      backdropFilter: 'blur(16px)',
                      boxShadow: isNight ? '0 8px 32px rgba(0,0,0,0.6)' : '0 8px 32px rgba(0,0,0,0.12)',
                    }}
                  >
                    <div
                      className="px-3.5 py-2 flex items-center gap-2"
                      style={{ borderBottomWidth: 1, borderBottomStyle: 'solid' as const, borderBottomColor: isNight ? 'rgba(139,92,246,0.15)' : 'rgba(120,90,200,0.15)' }}
                    >
                      <Eye size={12} style={{ color: isNight ? '#a78bfa' : '#7c5cbf', opacity: 0.7 }} />
                      <span style={{ fontSize: '0.6rem', color: isNight ? '#a78bfa' : '#7c5cbf', opacity: 0.7, fontFamily: '"Cinzel", serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Vue joueur
                      </span>
                    </div>
                    <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: 'min(50vh, 340px)', WebkitOverflowScrolling: 'touch' }}>
                      {state.players.map((p) => {
                        const isCurrent = p.id === currentPlayerId;
                        return (
                          <button
                            key={p.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowGMMenu(false);
                              if (!isCurrent) {
                                sessionStorage.setItem('__gm_preview', '1');
                                navigate(`/player/${p.shortCode}`);
                                window.location.reload();
                              }
                            }}
                            className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors cursor-pointer"
                            style={{
                              background: isCurrent ? (isNight ? 'rgba(139,92,246,0.1)' : 'rgba(120,90,200,0.1)') : 'transparent',
                              borderLeft: isCurrent ? `3px solid ${isNight ? '#a78bfa' : '#7c5cbf'}` : '3px solid transparent',
                              opacity: p.alive ? 1 : 0.5,
                              minHeight: '44px',
                            }}
                          >
                            <div className="flex-1 min-w-0">
                              <span className="truncate block" style={{
                                color: isCurrent ? (isNight ? '#a78bfa' : '#7c5cbf') : (isNight ? t.text : '#2a2010'),
                                fontSize: '0.8rem',
                                fontWeight: isCurrent ? 600 : 400,
                              }}>
                                {(() => { const r = getRoleById(p.role); return r ? r.emoji + ' ' : ''; })()}{p.name}
                              </span>
                              {!p.alive && (
                                <span style={{ fontSize: '0.65rem', color: isNight ? t.textMuted : '#8a7e65' }}>Eliminé</span>
                              )}
                            </div>
                            {isCurrent && (
                              <CircleCheck size={14} style={{ color: isNight ? '#a78bfa' : '#7c5cbf', flexShrink: 0 }} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});