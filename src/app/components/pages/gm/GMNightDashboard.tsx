import React from 'react';
import { Moon, Clock, Check, ExternalLink } from 'lucide-react';
import { type Player } from '../../../context/gameTypes';
import { type GameThemeTokens } from '../../../context/gameTheme';
import { type NightAction } from './useGMGameLogic';

/* ================================================================
   GMNightDashboard — shared night-actions dashboard (desktop + mobile).
   Displays pending/done tabs and action cards.
   `compact` switches between desktop (full) and mobile (slim) layout.
   ================================================================ */

interface GMNightDashboardProps {
  /** Pre-built night actions (caller should remap detail for mobile). */
  nightActions: NightAction[];
  nightActionsTab: 'pending' | 'done';
  setNightActionsTab: (tab: 'pending' | 'done') => void;
  onActionClick: (players: Player[], label: string, emoji: string, color: string, actionId: string) => void;
  t: GameThemeTokens;
  compact?: boolean;
}

export const GMNightDashboard = React.memo(function GMNightDashboard({
  nightActions, nightActionsTab, setNightActionsTab, onActionClick, t, compact = false,
}: GMNightDashboardProps) {
  const pendingActions = nightActions.filter((a) => !a.done);
  const doneActions = nightActions.filter((a) => a.done);
  const filteredActions = nightActionsTab === 'pending' ? pendingActions : doneActions;

  if (compact) {
    /* ── MOBILE ── */
    return (
      <div
        className="rounded-xl p-3"
        style={{
          background: `rgba(${t.overlayChannel}, 0.02)`,
          border: `1px solid rgba(${t.overlayChannel}, 0.08)`,
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <Moon size={12} style={{ color: t.nightSky }} />
          <span style={{ fontFamily: '"Cinzel", serif', color: t.nightSky, fontSize: '0.7rem' }}>
            Actions simultanees
          </span>
          <span
            className="ml-auto px-1.5 py-0.5 rounded-full"
            style={{
              background: `rgba(${t.overlayChannel}, 0.08)`,
              color: t.nightSky,
              fontSize: '0.5rem',
              fontFamily: '"Cinzel", serif',
            }}
          >
            {doneActions.length}/{nightActions.length}
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-2 p-0.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <button
            onClick={() => setNightActionsTab('pending')}
            className="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-md transition-all"
            style={{
              background: nightActionsTab === 'pending' ? 'rgba(212,168,67,0.12)' : 'transparent',
              border: nightActionsTab === 'pending' ? '1px solid rgba(212,168,67,0.25)' : '1px solid transparent',
              color: nightActionsTab === 'pending' ? '#d4a843' : '#6b7b9b',
              fontSize: '0.6rem',
              fontFamily: '"Cinzel", serif',
            }}
          >
            <Clock size={9} />
            En attente
            {pendingActions.length > 0 && (
              <span className="px-1 py-0.5 rounded-full" style={{ background: 'rgba(212,168,67,0.15)', color: '#d4a843', fontSize: '0.5rem', fontWeight: 700 }}>
                {pendingActions.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setNightActionsTab('done')}
            className="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-md transition-all"
            style={{
              background: nightActionsTab === 'done' ? 'rgba(107,142,90,0.12)' : 'transparent',
              border: nightActionsTab === 'done' ? '1px solid rgba(107,142,90,0.25)' : '1px solid transparent',
              color: nightActionsTab === 'done' ? '#6b8e5a' : '#6b7b9b',
              fontSize: '0.6rem',
              fontFamily: '"Cinzel", serif',
            }}
          >
            <Check size={9} />
            Done
            {doneActions.length > 0 && (
              <span className="px-1 py-0.5 rounded-full" style={{ background: 'rgba(107,142,90,0.15)', color: '#6b8e5a', fontSize: '0.5rem', fontWeight: 700 }}>
                {doneActions.length}
              </span>
            )}
          </button>
        </div>

        {/* Action cards — 2-col grid */}
        <div className="grid grid-cols-2 gap-2">
          {filteredActions.length === 0 ? (
            <div className="col-span-2 text-center py-3" style={{ color: '#6b7b9b', fontSize: '0.6rem' }}>
              {nightActionsTab === 'pending' ? 'Toutes les actions sont terminees !' : 'Aucune action terminee'}
            </div>
          ) : (
            filteredActions.map((action) => (
              <div
                key={action.id}
                className="flex items-center gap-2 p-2.5 rounded-lg cursor-pointer active:scale-[0.97] transition-all"
                style={{
                  background: action.done ? 'rgba(107,142,90,0.06)' : `${action.color}08`,
                  border: `1px solid ${action.done ? 'rgba(107,142,90,0.15)' : `${action.color}18`}`,
                }}
                onClick={() => onActionClick(action.players, action.label, action.emoji, action.color, action.id)}
              >
                <span className="text-base">{action.emoji}</span>
                <div className="flex-1 min-w-0">
                  <span style={{ fontFamily: '"Cinzel", serif', color: action.done ? '#6b8e5a' : action.color, fontSize: '0.65rem', display: 'block' }}>
                    {action.label}
                  </span>
                  <p className="truncate" style={{ color: t.textMuted, fontSize: '0.5rem', marginTop: '0.05rem' }}>
                    {action.detail}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <ExternalLink size={8} style={{ color: t.textMuted, opacity: 0.4 }} />
                  {action.done ? (
                    <Check size={10} style={{ color: '#6b8e5a' }} />
                  ) : (
                    <Clock size={10} style={{ color: t.textMuted }} />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  /* ── DESKTOP ── */
  return (
    <div className="rounded-xl p-5 mb-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(124,141,181,0.12)' }}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Moon size={14} style={{ color: '#7c8db5' }} />
        <span style={{ fontFamily: '"Cinzel", serif', color: '#7c8db5', fontSize: '0.8rem' }}>Actions simultanees</span>
        <span className="ml-auto px-2 py-0.5 rounded-full" style={{ background: 'rgba(124,141,181,0.1)', border: '1px solid rgba(124,141,181,0.2)', color: '#7c8db5', fontSize: '0.55rem', fontFamily: '"Cinzel", serif' }}>
          {doneActions.length}/{nightActions.length} terminees
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-3 p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
        <button
          onClick={() => setNightActionsTab('pending')}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md transition-all"
          style={{
            background: nightActionsTab === 'pending' ? 'rgba(212,168,67,0.12)' : 'transparent',
            border: nightActionsTab === 'pending' ? '1px solid rgba(212,168,67,0.25)' : '1px solid transparent',
            color: nightActionsTab === 'pending' ? '#d4a843' : '#6b7b9b',
            fontSize: '0.7rem',
            fontFamily: '"Cinzel", serif',
          }}
        >
          <Clock size={11} />
          En attente
          {pendingActions.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(212,168,67,0.15)', color: '#d4a843', fontSize: '0.55rem', fontWeight: 700 }}>
              {pendingActions.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setNightActionsTab('done')}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md transition-all"
          style={{
            background: nightActionsTab === 'done' ? 'rgba(107,142,90,0.12)' : 'transparent',
            border: nightActionsTab === 'done' ? '1px solid rgba(107,142,90,0.25)' : '1px solid transparent',
            color: nightActionsTab === 'done' ? '#6b8e5a' : '#6b7b9b',
            fontSize: '0.7rem',
            fontFamily: '"Cinzel", serif',
          }}
        >
          <Check size={11} />
          Done
          {doneActions.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(107,142,90,0.15)', color: '#6b8e5a', fontSize: '0.55rem', fontWeight: 700 }}>
              {doneActions.length}
            </span>
          )}
        </button>
      </div>

      {/* Action cards — vertical list */}
      <div className="space-y-2">
        {filteredActions.length === 0 ? (
          <div className="text-center py-4" style={{ color: '#6b7b9b', fontSize: '0.7rem' }}>
            {nightActionsTab === 'pending' ? 'Toutes les actions sont terminees !' : 'Aucune action terminee pour le moment'}
          </div>
        ) : (
          filteredActions.map((action) => (
            <div
              key={action.id}
              className="flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer hover:brightness-125"
              style={{
                background: action.done ? 'rgba(107,142,90,0.06)' : `${action.color}08`,
                border: `1px solid ${action.done ? 'rgba(107,142,90,0.15)' : `${action.color}18`}`,
              }}
              onClick={() => onActionClick(action.players, action.label, action.emoji, action.color, action.id)}
              title={action.players.length > 0 ? `Voir ${action.players.map(p => p.name).join(', ')}` : undefined}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  background: action.done ? 'rgba(107,142,90,0.1)' : `${action.color}12`,
                  border: `1px solid ${action.done ? 'rgba(107,142,90,0.2)' : `${action.color}25`}`,
                }}
              >
                <span className="text-lg">{action.emoji}</span>
              </div>
              <div className="flex-1 min-w-0">
                <span style={{ fontFamily: '"Cinzel", serif', color: action.done ? '#6b8e5a' : action.color, fontSize: '0.75rem' }}>
                  {action.label}
                </span>
                <p style={{ color: '#6b7b9b', fontSize: '0.6rem', marginTop: '0.1rem' }} className="truncate">
                  {action.detail}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <ExternalLink size={10} style={{ color: '#6b7b9b', opacity: 0.5 }} />
                {action.done ? (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(107,142,90,0.15)' }}>
                    <Check size={12} style={{ color: '#6b8e5a' }} />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <Clock size={12} style={{ color: '#6b7b9b' }} />
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
});
