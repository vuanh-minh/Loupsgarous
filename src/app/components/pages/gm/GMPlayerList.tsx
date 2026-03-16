import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users, Crown, Shield, Skull, ExternalLink,
  Search, X, Star, Heart, Bell, Scroll,
  Tag, Plus, Send, ChevronDown, CheckCircle2, XCircle, Clock, Handshake,
  Check, UserX, Dices, Lightbulb, Eye,
} from 'lucide-react';
import { type Player } from '../../../context/GameContext';
import { type Quest, type Hint, type PlayerHint, type DynamicHint } from '../../../context/gameTypes';
import { API_BASE, publicAnonKey } from '../../../context/apiConfig';
import { getRoleById } from '../../../data/roles';
import { GMAvatar, SectionHeader, getConnectionStatus, buildQuests } from './GMShared';
import { GMSendHintButton } from '../../HintComponents';
import { sendPushNotifications } from '../../../context/useNotifications';
import { useGamePanelContext } from './GamePanelContext';
import { computeScores } from '../../../data/scoring';
import { GMNotifyModal } from './GMNotifyModal';

/* ================================================================
   Player List — search, filter tabs, alive/dead lists, mobile detail
   Consumes shared state via GamePanelContext (no prop drilling).
   ================================================================ */

/* ── Inline Notify Button (self-contained state) ── */
function NotifyIconButton({ player, shortCode, gameId, isNight, state, updateState }: {
  player: Player;
  shortCode: string;
  gameId: string;
  isNight: boolean;
  state: any;
  updateState: (updater: (s: any) => any) => void;
}) {
  const [sent, setSent] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const handleSend = useCallback((message: string) => {
    sendPushNotifications(gameId, [shortCode], 'Loup-Garou', message, 'gm-notify-action');
    // Write to game state so the player's polling picks it up reliably
    updateState((s: any) => ({
      ...s,
      gmAlerts: { ...(s.gmAlerts || {}), [shortCode]: Date.now() },
      gmAlertMessages: { ...(s.gmAlertMessages || {}), [shortCode]: message },
    }));
    setSent(true);
    setShowModal(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSent(false), 2000);
  }, [shortCode, gameId, updateState]);

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setShowModal(true); }}
        disabled={sent}
        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
        style={{
          border: `1px solid ${sent ? 'rgba(107,142,90,0.3)' : 'rgba(212,168,67,0.25)'}`,
          background: sent ? 'rgba(107,142,90,0.08)' : undefined,
        }}
        title={sent ? 'Envoyé' : 'Notifier'}
      >
        {sent ? <Check size={12} style={{ color: '#6b8e5a' }} /> : <Bell size={12} style={{ color: '#d4a843' }} />}
      </button>
      {showModal && (
        <GMNotifyModal
          player={player}
          state={state}
          isNight={isNight}
          onSend={handleSend}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

export function GMPlayerList() {
  const {
    state, alivePlayers, deadPlayers, isNight,
    selectedPlayer, setSelectedPlayer,
    isMobile, playerHeartbeats, t, navigate,
    eliminatePlayer, addEvent, setGuardTarget,
    onSendHintToPlayer, broadcastTestNotification,
    setRevivePendingId, updateState,
  } = useGamePanelContext();

  const [playerSearch, setPlayerSearch] = useState('');
  const [playerListTab, setPlayerListTab] = useState<'all' | 'good' | 'evil'>('all');
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [showRevealPicker, setShowRevealPicker] = useState(false);

  const selectedPlayerData = selectedPlayer !== null ? state.players.find((p: Player) => p.id === selectedPlayer) : null;
  const selectedRole = selectedPlayerData ? getRoleById(selectedPlayerData.role) : null;

  // Compute assigned quests for the selected player
  const selectedPlayerAssignedIds = selectedPlayerData
    ? ((state.questAssignments || {})[selectedPlayerData.id] || [])
    : [];
  const selectedPlayerQuests = (state.quests || []).filter(
    (q: Quest) => selectedPlayerAssignedIds.includes(q.id)
  );
  const unassignedQuests = (state.quests || []).filter(
    (q: Quest) => {
      if (selectedPlayerAssignedIds.includes(q.id)) return false;
      // Dead players cannot be assigned new collaborative quests
      if (selectedPlayerData && !selectedPlayerData.alive && (q.questType || 'individual') === 'collaborative') return false;
      return true;
    }
  );

  const handleRevealQuest = useCallback((questId: number, playerId: number) => {
    updateState((s) => {
      const quest = (s.quests || []).find(q => q.id === questId);
      if (!quest) return s;

      const newAssignments: Record<number, number[]> = {};
      for (const [k, v] of Object.entries(s.questAssignments || {})) {
        newAssignments[Number(k)] = [...v];
      }
      if (!newAssignments[playerId]) newAssignments[playerId] = [];
      if (!newAssignments[playerId].includes(questId)) {
        newAssignments[playerId].push(questId);
      }

      const isCollab = (quest.questType || 'individual') === 'collaborative';
      let updatedQuests = s.quests || [];
      if (isCollab) {
        updatedQuests = updatedQuests.map(q => {
          if (q.id !== questId) return q;
          const groups: number[][] = (q.collaborativeGroups || []).map(g => [...g]);
          const maxSize = q.collaborativeGroupSize || 3;
          const incompleteIdx = groups.findIndex(g => g.length < maxSize);
          if (incompleteIdx >= 0) {
            groups[incompleteIdx].push(playerId);
          } else {
            groups.push([playerId]);
          }
          return { ...q, collaborativeGroups: groups };
        });
      }

      return { ...s, quests: updatedQuests, questAssignments: newAssignments };
    });
    setShowRevealPicker(false);
  }, [updateState]);

  const handleDistributeRandomQuest = useCallback(() => {
    if (unassignedQuests.length === 0 || !selectedPlayerData) return;
    const picked = unassignedQuests[Math.floor(Math.random() * unassignedQuests.length)];
    handleRevealQuest(picked.id, selectedPlayerData.id);
    addEvent(`Quête "${picked.title}" distribuée à ${selectedPlayerData.name}.`);
  }, [unassignedQuests, selectedPlayerData, handleRevealQuest, addEvent]);

  // ── Player Hints (received by selected player) ──
  const playerHintEntries = useMemo(() => {
    if (!selectedPlayerData) return [];
    const ph: PlayerHint[] = state.playerHints ?? [];
    const allHints: Hint[] = state.hints ?? [];
    const myPH = ph.filter((p) => p.playerId === selectedPlayerData.id);
    return myPH
      .map((p) => {
        const hint = allHints.find((h) => h.id === p.hintId);
        return hint ? { ...p, hint } : null;
      })
      .filter(Boolean) as (PlayerHint & { hint: Hint })[];
  }, [state.playerHints, state.hints, selectedPlayerData?.id]);

  // ── Grant dynamic hint to selected player ──
  const [grantingHint, setGrantingHint] = useState(false);
  const [grantHintResult, setGrantHintResult] = useState<'success' | 'empty' | null>(null);
  const handleGrantHint = useCallback(async () => {
    if (!selectedPlayerData || !state.gameId || grantingHint) return;
    setGrantingHint(true);
    setGrantHintResult(null);
    try {
      const res = await fetch(`${API_BASE}/game/action/grant-hint`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameId: state.gameId,
          password: 'loupgarou',
          playerId: selectedPlayerData.id,
        }),
      });
      const data = await res.json();
      if (data.success && data.hintId) {
        setGrantHintResult('success');
        addEvent(`Indice dynamique distribue a ${selectedPlayerData.name}.`);
      } else {
        setGrantHintResult('empty');
      }
    } catch (err) {
      console.log('Grant hint error:', err);
      setGrantHintResult('empty');
    } finally {
      setGrantingHint(false);
      setTimeout(() => setGrantHintResult(null), 3000);
    }
  }, [selectedPlayerData, state.gameId, grantingHint, addEvent]);

  const availableDynamicHintCount = useMemo(() => {
    const dh: DynamicHint[] = state.dynamicHints ?? [];
    return dh.filter((h) => !h.revealed).length;
  }, [state.dynamicHints]);

  const availableTags = state.availableTags || [];
  const playerTags: Record<number, string[]> = state.playerTags || {};

  const teamFilter = (p: Player) => {
    if (playerListTab === 'all') return true;
    const role = getRoleById(p.role);
    if (playerListTab === 'good') return role?.team === 'village';
    return role?.team === 'werewolf' || role?.team === 'solo';
  };

  const searchFilter = (p: Player) => {
    if (!playerSearch) return true;
    const q = playerSearch.toLowerCase();
    if (p.name.toLowerCase().includes(q)) return true;
    const role = getRoleById(p.role);
    if (role && role.name.toLowerCase().includes(q)) return true;
    return false;
  };

  const tagFilter = (p: Player) => {
    if (!activeTagFilter) return true;
    return (playerTags[p.id] || []).includes(activeTagFilter);
  };

  const allPlayers = [...alivePlayers, ...deadPlayers];
  const goodCount = allPlayers.filter((p) => getRoleById(p.role)?.team === 'village').length;
  const evilCount = allPlayers.filter((p) => { const r = getRoleById(p.role); return r?.team === 'werewolf' || r?.team === 'solo'; }).length;

  const tabs: Array<{ key: 'all' | 'good' | 'evil'; label: string; count: number; color: string; activeColor: string; activeBg: string; activeBorder: string }> = [
    { key: 'all', label: 'Tous', count: allPlayers.length, color: '#7c8db5', activeColor: '#d4a843', activeBg: 'rgba(212,168,67,0.12)', activeBorder: 'rgba(212,168,67,0.25)' },
    { key: 'good', label: 'Village', count: goodCount, color: '#7c8db5', activeColor: '#6b8e5a', activeBg: 'rgba(107,142,90,0.12)', activeBorder: 'rgba(107,142,90,0.25)' },
    { key: 'evil', label: 'Loups', count: evilCount, color: '#7c8db5', activeColor: '#c41e3a', activeBg: 'rgba(196,30,58,0.12)', activeBorder: 'rgba(196,30,58,0.25)' },
  ];

  const filteredAlive = alivePlayers.filter(teamFilter).filter(searchFilter).filter(tagFilter);
  const filteredDead = deadPlayers.filter(teamFilter).filter(searchFilter).filter(tagFilter);

  // Split alive into present and away
  const filteredPresent = state.villagePresentIds
    ? filteredAlive.filter((p) => state.villagePresentIds!.includes(p.id))
    : filteredAlive;
  const filteredAway = state.villagePresentIds
    ? filteredAlive.filter((p) => !state.villagePresentIds!.includes(p.id))
    : [];

  /* ── Live scoring & dense ranking ── */
  const rankMap = useMemo(() => {
    const scores = computeScores(state);
    const map = new Map<number, { rank: number; total: number }>();
    let rank = 1;
    for (let i = 0; i < scores.length; i++) {
      if (i > 0 && scores[i].total < scores[i - 1].total) {
        rank = i + 1;
      }
      map.set(scores[i].playerId, { rank, total: scores[i].total });
    }
    return map;
  }, [state]);

  return (
    <div className={isMobile ? 'px-3 py-3' : 'p-4'}>
      {/* Search bar */}
      <div className="relative mb-3">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: t.textMuted }} />
        <input
          type="text"
          placeholder="Rechercher joueur ou rôle..."
          value={playerSearch}
          onChange={(e) => setPlayerSearch(e.target.value)}
          className="w-full pl-8 pr-8 py-2 rounded-lg text-sm outline-none transition-all"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${playerSearch ? 'rgba(212,168,67,0.3)' : 'rgba(255,255,255,0.06)'}`,
            color: t.text,
            fontSize: '0.75rem',
            fontFamily: '"Cinzel", serif',
          }}
        />
        {playerSearch && (
          <button
            onClick={() => setPlayerSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/10 transition-all"
          >
            <X size={12} style={{ color: t.textMuted }} />
          </button>
        )}
      </div>

      {/* Alignment filter tabs */}
      <div className="flex gap-0.5 mb-3 p-0.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
        {tabs.map((tab) => {
          const isActive = playerListTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setPlayerListTab(tab.key)}
              className="flex-1 flex items-center justify-center gap-1 py-1 px-1 rounded-md transition-all whitespace-nowrap overflow-hidden"
              style={{
                background: isActive ? tab.activeBg : 'transparent',
                border: isActive ? `1px solid ${tab.activeBorder}` : '1px solid transparent',
                color: isActive ? tab.activeColor : tab.color,
                fontSize: '0.6rem',
                fontFamily: '"Cinzel", serif',
              }}
            >
              {tab.key === 'good' && <Shield size={9} className="shrink-0" />}
              {tab.key === 'evil' && <Skull size={9} className="shrink-0" />}
              {tab.key === 'all' && <Users size={9} className="shrink-0" />}
              <span className="truncate">{tab.label}</span>
              <span
                className="px-1 py-px rounded-full shrink-0"
                style={{
                  background: isActive ? `${tab.activeColor}18` : 'rgba(255,255,255,0.04)',
                  color: isActive ? tab.activeColor : '#6b7b9b',
                  fontSize: '0.45rem',
                  fontWeight: 700,
                  lineHeight: 1.4,
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tag filter pills */}
      {availableTags.length > 0 && (
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          <Tag size={11} style={{ color: t.textMuted, flexShrink: 0 }} />
          {availableTags.map((tag) => {
            const isActive = activeTagFilter === tag;
            const tagCount = allPlayers.filter(p => (playerTags[p.id] || []).includes(tag)).length;
            return (
              <button
                key={tag}
                onClick={() => setActiveTagFilter(isActive ? null : tag)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full transition-all cursor-pointer"
                style={{
                  background: isActive ? 'rgba(168,85,247,0.18)' : 'rgba(168,85,247,0.05)',
                  border: `1px solid ${isActive ? 'rgba(168,85,247,0.4)' : 'rgba(168,85,247,0.12)'}`,
                  color: isActive ? '#d8b4fe' : '#a78bfa',
                  fontSize: '0.55rem',
                  fontFamily: '"Cinzel", serif',
                }}
              >
                <span>{tag}</span>
                <span
                  className="px-1 rounded-full"
                  style={{
                    background: isActive ? 'rgba(168,85,247,0.2)' : 'rgba(168,85,247,0.08)',
                    fontSize: '0.45rem',
                    fontWeight: 700,
                    lineHeight: 1.4,
                  }}
                >
                  {tagCount}
                </span>
              </button>
            );
          })}
          {activeTagFilter && (
            <button
              onClick={() => setActiveTagFilter(null)}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full transition-all cursor-pointer"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: t.textMuted,
                fontSize: '0.5rem',
              }}
            >
              <X size={8} />
              Retirer
            </button>
          )}
        </div>
      )}

      {/* Alive section header */}
      <SectionHeader icon={<Users size={14} />} title={`Vivants (${filteredPresent.length})`} t={t} />
      {filteredPresent.length === 0 && filteredAway.length === 0 && (
        <p style={{ color: t.textMuted, fontSize: '0.7rem', textAlign: 'center', padding: '0.75rem 0' }}>
          {playerSearch ? 'Aucun joueur vivant ne correspond.' : 'Aucun joueur dans cette categorie.'}
        </p>
      )}

      {/* Alive players (present only) */}
      <div className="space-y-1">
        {filteredPresent.map((p) => {
          const role = getRoleById(p.role);
          const isSelected = selectedPlayer === p.id;
          const conn = getConnectionStatus(p.shortCode, playerHeartbeats);
          const scoring = rankMap.get(p.id);
          return (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedPlayer(isSelected ? null : p.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedPlayer(isSelected ? null : p.id); }}
              className="w-full flex items-center gap-3 p-2.5 rounded-lg transition-all hover:bg-white/[0.02] cursor-pointer"
              style={{
                background: isSelected ? 'rgba(212,168,67,0.08)' : 'transparent',
                border: isSelected ? '1px solid rgba(212,168,67,0.2)' : '1px solid transparent',
              }}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 relative overflow-visible"
                style={{
                  background: `${role?.color || '#666'}12`,
                  border: `1.5px solid ${role?.color || '#666'}30`,
                  overflow: 'visible',
                }}
              >
                <GMAvatar player={p} size="text-lg" />
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                  style={{ background: conn.color, borderColor: '#0a1020' }}
                  title={conn.label}
                />
                {state.maireId === p.id && (
                  <div
                    className="absolute -top-1 -left-1 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: '#d4a843', border: '1.5px solid #0a1020' }}
                    title="Maire"
                  >
                    <Crown size={8} style={{ color: '#0a0e1a' }} />
                  </div>
                )}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p style={{ color: t.text, fontSize: '0.8rem' }} className="truncate">
                  {p.name} {state.maireId === p.id ? '🏛️' : ''}
                </p>
                <div className="flex items-center gap-1.5">
                  <span style={{ color: role?.color || t.textMuted, fontSize: '0.6rem' }}>
                    {role?.emoji} {role?.name}
                  </span>
                  <span style={{ color: conn.color, fontSize: '0.5rem' }}>
                    · {conn.label}
                  </span>
                </div>
              </div>
              {/* Rank & points badge */}
              {scoring && (
                <div
                  className="flex flex-col items-center shrink-0 px-1.5 py-0.5 rounded-md"
                  style={{
                    background: scoring.rank <= 3 ? 'rgba(212,168,67,0.1)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${scoring.rank <= 3 ? 'rgba(212,168,67,0.2)' : 'rgba(255,255,255,0.06)'}`,
                    minWidth: '2rem',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      fontFamily: '"Cinzel", serif',
                      color: scoring.rank === 1 ? '#d4a843' : scoring.rank === 2 ? '#a0b4cc' : scoring.rank === 3 ? '#cd7f32' : '#6b7b9b',
                      lineHeight: 1.2,
                    }}
                  >
                    #{scoring.rank}
                  </span>
                  <span
                    style={{
                      fontSize: '0.45rem',
                      color: '#7c8db5',
                      lineHeight: 1.2,
                      fontWeight: 600,
                    }}
                  >
                    {scoring.total} pts
                  </span>
                </div>
              )}
              <GMSendHintButton
                playerId={p.id}
                t={t}
                onClick={() => onSendHintToPlayer?.(p.id)}
              />
              {p.shortCode && broadcastTestNotification && (
                null
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  sessionStorage.setItem('__gm_preview', '1');
                  navigate(`/player/${p.shortCode}`);
                }}
                className="w-7 h-7 rounded flex items-center justify-center hover:bg-white/5 opacity-50 hover:opacity-100 transition-all"
                title="Ouvrir la page joueur"
              >
                <ExternalLink size={12} style={{ color: t.textMuted }} />
              </button>
              <NotifyIconButton player={p} shortCode={p.shortCode} gameId={state.gameId} isNight={isNight} state={state} updateState={updateState} />
            </div>
          );
        })}
      </div>

      {/* Away players */}
      {filteredAway.length > 0 && (
        <div className="mt-4">
          <SectionHeader icon={<UserX size={14} style={{ color: '#f59e0b' }} />} title={`Absents (${filteredAway.length})`} t={t} />
          <div className="space-y-1">
            {filteredAway.map((p) => {
              const role = getRoleById(p.role);
              const isSelected = selectedPlayer === p.id;
              const conn = getConnectionStatus(p.shortCode, playerHeartbeats);
              const scoring = rankMap.get(p.id);
              return (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedPlayer(isSelected ? null : p.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedPlayer(isSelected ? null : p.id); }}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg transition-all hover:bg-white/[0.02] cursor-pointer"
                  style={{
                    background: isSelected ? 'rgba(245,158,11,0.08)' : 'transparent',
                    border: isSelected ? '1px solid rgba(245,158,11,0.2)' : '1px solid transparent',
                    opacity: isSelected ? 1 : 0.6,
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 relative overflow-visible"
                    style={{
                      background: `${role?.color || '#666'}12`,
                      border: `1.5px solid ${role?.color || '#666'}30`,
                      overflow: 'visible',
                      filter: 'grayscale(0.4)',
                    }}
                  >
                    <GMAvatar player={p} size="text-lg" />
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                      style={{ background: conn.color, borderColor: '#0a1020' }}
                      title={conn.label}
                    />
                    {state.maireId === p.id && (
                      <div
                        className="absolute -top-1 -left-1 w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ background: '#d4a843', border: '1.5px solid #0a1020' }}
                        title="Maire"
                      >
                        <Crown size={8} style={{ color: '#0a0e1a' }} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p style={{ color: t.text, fontSize: '0.8rem' }} className="truncate">
                      {p.name} {state.maireId === p.id ? '🏛️' : ''}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span style={{ color: role?.color || t.textMuted, fontSize: '0.6rem' }}>
                        {role?.emoji} {role?.name}
                      </span>
                      <span style={{ color: conn.color, fontSize: '0.5rem' }}>
                        · {conn.label}
                      </span>
                      <span
                        className="px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', fontSize: '0.45rem', fontWeight: 700 }}
                      >
                        ABSENT
                      </span>
                    </div>
                  </div>
                  {scoring && (
                    <div
                      className="flex flex-col items-center shrink-0 px-1.5 py-0.5 rounded-md"
                      style={{
                        background: scoring.rank <= 3 ? 'rgba(212,168,67,0.1)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${scoring.rank <= 3 ? 'rgba(212,168,67,0.2)' : 'rgba(255,255,255,0.06)'}`,
                        minWidth: '2rem',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.6rem',
                          fontWeight: 700,
                          fontFamily: '"Cinzel", serif',
                          color: scoring.rank === 1 ? '#d4a843' : scoring.rank === 2 ? '#a0b4cc' : scoring.rank === 3 ? '#cd7f32' : '#6b7b9b',
                          lineHeight: 1.2,
                        }}
                      >
                        #{scoring.rank}
                      </span>
                      <span
                        style={{
                          fontSize: '0.45rem',
                          color: '#7c8db5',
                          lineHeight: 1.2,
                          fontWeight: 600,
                        }}
                      >
                        {scoring.total} pts
                      </span>
                    </div>
                  )}
                  <GMSendHintButton
                    playerId={p.id}
                    t={t}
                    onClick={() => onSendHintToPlayer?.(p.id)}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      sessionStorage.setItem('__gm_preview', '1');
                      navigate(`/player/${p.shortCode}`);
                    }}
                    className="w-7 h-7 rounded flex items-center justify-center hover:bg-white/5 opacity-50 hover:opacity-100 transition-all"
                    title="Ouvrir la page joueur"
                  >
                    <ExternalLink size={12} style={{ color: t.textMuted }} />
                  </button>
                  <NotifyIconButton player={p} shortCode={p.shortCode} gameId={state.gameId} isNight={isNight} state={state} updateState={updateState} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dead players */}
      {filteredDead.length > 0 && (
        <div className="mt-4">
          <SectionHeader icon={<Skull size={14} />} title={`Cimetiere (${filteredDead.length})`} t={t} />
          <div className="space-y-1">
            {filteredDead.map((p) => {
              const role = getRoleById(p.role);
              const isSelected = selectedPlayer === p.id;
              const hasUsedLastWill = !!(state.lastWillUsed ?? {})[p.id];
              // Resolve last will target: check votes (day) and earlyVotes (night)
              const lastWillTargetId = hasUsedLastWill
                ? (state.votes?.[p.id] ?? state.earlyVotes?.[p.id] ?? null)
                : null;
              const lastWillTarget = lastWillTargetId !== null
                ? state.players.find((pl: Player) => pl.id === lastWillTargetId)
                : null;
              return (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedPlayer(isSelected ? null : p.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedPlayer(isSelected ? null : p.id); }}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg transition-all cursor-pointer hover:opacity-60"
                  style={{
                    opacity: isSelected ? 0.8 : 0.4,
                    background: isSelected ? 'rgba(107,142,90,0.08)' : 'transparent',
                    border: isSelected ? '1px solid rgba(107,142,90,0.2)' : '1px solid transparent',
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 relative overflow-visible"
                    style={{
                      background: isSelected ? 'rgba(107,142,90,0.08)' : 'rgba(255,255,255,0.02)',
                      border: `1.5px solid ${isSelected ? 'rgba(107,142,90,0.3)' : 'rgba(255,255,255,0.05)'}`,
                    }}
                  >
                    <GMAvatar player={p} size="text-lg" />
                    {hasUsedLastWill && (
                      <div
                        className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ background: '#7c3aed', border: '1.5px solid #0a1020' }}
                        title={`Derniere volonte utilisee${lastWillTarget ? ` contre ${lastWillTarget.name}` : ''}`}
                      >
                        <Scroll size={7} style={{ color: 'white' }} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p style={{ color: isSelected ? t.text : '#4a5568', fontSize: '0.8rem' }} className="truncate">
                      {p.name}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p style={{ color: '#3a4050', fontSize: '0.6rem' }}>
                        {role?.emoji} {role?.name}
                      </p>
                      <span style={{ color: '#c41e3a', fontSize: '0.5rem' }}>· 💀 Elimine</span>
                      {hasUsedLastWill && (
                        <span
                          className="px-1.5 py-0.5 rounded-full flex items-center gap-1"
                          style={{
                            background: 'rgba(139,92,246,0.12)',
                            border: '1px solid rgba(139,92,246,0.25)',
                            color: '#a78bfa',
                            fontSize: '0.45rem',
                            fontFamily: '"Cinzel", serif',
                            lineHeight: 1,
                          }}
                        >
                          <Scroll size={7} />
                          {lastWillTarget ? `→ ${lastWillTarget.name}` : 'Volonte'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected player details (mobile only, bottom sheet) */}
      <AnimatePresence>
      {isMobile && selectedPlayerData && selectedRole && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[90]"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={() => setSelectedPlayer(null)}
          />
          {/* Bottom sheet */}
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[91] rounded-t-2xl p-4 max-h-[75vh] overflow-y-auto"
            style={{
              background: isNight
                ? `linear-gradient(165deg, ${selectedRole.color}08, rgba(18,20,42,0.97))`
                : 'linear-gradient(165deg, rgba(245,238,217,0.98), rgba(235,228,210,0.98))',
              border: `1px solid ${isNight ? selectedRole.color + '20' : 'rgba(200,180,138,0.5)'}`,
              borderBottom: 'none',
              boxShadow: isNight
                ? '0 -8px 30px rgba(0,0,0,0.5)'
                : '0 -8px 30px rgba(0,0,0,0.12), 0 -2px 8px rgba(0,0,0,0.06)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center mb-3">
              <div className="w-10 h-1 rounded-full" style={{ background: isNight ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }} />
            </div>

            <div className="flex items-center gap-3 mb-3">
              <GMAvatar player={selectedPlayerData} size="text-xl" />
              <div className="flex-1 min-w-0">
                <h3 style={{ color: t.text, fontSize: '0.9rem', fontWeight: 600 }}>{selectedPlayerData.name} {state.maireId === selectedPlayerData.id ? '🏛️' : ''}</h3>
                <p style={{ color: selectedRole.color, fontSize: '0.7rem', fontFamily: '"Cinzel", serif', fontWeight: isNight ? 400 : 700, filter: isNight ? 'none' : 'brightness(0.65)' }}>
                  {selectedRole.emoji} {selectedRole.name}
                  {state.maireId === selectedPlayerData.id && <span style={{ color: t.gold, filter: 'none' }}> · Maire</span>}
                </p>
                {/* Player Tags */}
                {((state.playerTags || {})[selectedPlayerData.id] || []).length > 0 && (
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {((state.playerTags || {})[selectedPlayerData.id] || []).map((tag: string) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full"
                        style={{
                          background: isNight ? 'rgba(168,85,247,0.1)' : 'rgba(168,85,247,0.08)',
                          border: `1px solid ${isNight ? 'rgba(168,85,247,0.2)' : 'rgba(168,85,247,0.25)'}`,
                          color: isNight ? '#c084fc' : '#7c3aed',
                          fontSize: '0.5rem',
                        }}
                      >
                        <Tag size={8} />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => navigate(`/player/${selectedPlayerData.shortCode}`)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ border: `1px solid ${isNight ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'}` }}
                >
                  <ExternalLink size={12} style={{ color: t.textMuted }} />
                </button>
                {selectedPlayerData.shortCode && state.gameId && (
                  <NotifyIconButton player={selectedPlayerData} shortCode={selectedPlayerData.shortCode} gameId={state.gameId} isNight={isNight} state={state} updateState={updateState} />
                )}
                {selectedPlayerData.alive ? (
                  <button
                    onClick={() => {
                      eliminatePlayer(selectedPlayerData.id);
                      addEvent(`${selectedPlayerData.name} a fuit le village.`);
                    }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ border: '1px solid rgba(196,30,58,0.2)' }}
                    title="Eliminer"
                  >
                    <Skull size={12} style={{ color: '#c41e3a' }} />
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setRevivePendingId(selectedPlayerData.id);
                      setSelectedPlayer(null);
                    }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ border: '1px solid rgba(107,142,90,0.3)' }}
                    title="Ressusciter"
                  >
                    <Heart size={12} style={{ color: '#6b8e5a' }} />
                  </button>
                )}
                {/* Close button */}
                <button
                  onClick={() => setSelectedPlayer(null)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{
                    border: `1px solid ${isNight ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                    background: isNight ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                  }}
                  title="Fermer"
                >
                  <X size={14} style={{ color: t.textMuted }} />
                </button>
              </div>
            </div>
            <p style={{ color: isNight ? '#8090b0' : '#4a3a25', fontSize: '0.7rem', lineHeight: 1.4 }}>
              {selectedRole.description}
            </p>
            {/* Guard target picker — mobile inline */}
            {selectedPlayerData.role === 'garde' && isNight && state.nightStep === 'active' && selectedPlayerData.alive && (
              <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(59,130,246,0.15)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Shield size={12} style={{ color: '#3b82f6' }} />
                  <span style={{ fontFamily: '"Cinzel", serif', color: '#3b82f6', fontSize: '0.65rem' }}>
                    Protection
                  </span>
                  {state.guardTargets?.[selectedPlayerData.id] !== undefined && (
                    <span className="ml-auto px-2 py-0.5 rounded-full" style={{ background: 'rgba(107,142,90,0.1)', border: '1px solid rgba(107,142,90,0.2)', color: '#6b8e5a', fontSize: '0.5rem' }}>
                      ✓ {state.players.find((p: Player) => p.id === state.guardTargets?.[selectedPlayerData.id])?.name}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {alivePlayers
                    .filter((p: Player) => p.id !== selectedPlayerData.id && p.id !== (state.guardLastTargets?.[selectedPlayerData.id] ?? null))
                    .map((p: Player) => {
                      const isSelected2 = state.guardTargets?.[selectedPlayerData.id] === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => setGuardTarget(selectedPlayerData.id, isSelected2 ? null : p.id)}
                          className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition-all"
                          style={{
                            background: isSelected2
                              ? 'rgba(59,130,246,0.15)'
                              : isNight ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                            border: `1px solid ${isSelected2 ? 'rgba(59,130,246,0.4)' : isNight ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                          }}
                        >
                          <GMAvatar player={p} size="text-sm" />
                          <span style={{ fontSize: '0.45rem', color: isSelected2 ? '#3b82f6' : t.textMuted, textAlign: 'center', lineHeight: 1.1 }}>
                            {p.name}
                          </span>
                        </button>
                      );
                    })}
                </div>
                {(state.guardLastTargets?.[selectedPlayerData.id] ?? null) !== null && (
                  <p style={{ color: '#ef4444', fontSize: '0.45rem', marginTop: '0.35rem' }}>
                    ⚠ {state.players.find((p: Player) => p.id === state.guardLastTargets?.[selectedPlayerData.id])?.name} ne peut pas etre protege (nuit precedente)
                  </p>
                )}
              </div>
            )}
            {/* Mobile Quests */}
            <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${isNight ? selectedRole.color + '20' : 'rgba(180,155,85,0.25)'}` }}>
              <div className="flex items-center gap-1.5 mb-2">
                <Star size={11} style={{ color: t.gold }} />
                <span style={{ fontFamily: '"Cinzel", serif', color: t.gold, fontSize: '0.65rem', fontWeight: 700 }}>Objectifs</span>
              </div>
              <div className="space-y-2">
                {buildQuests(selectedPlayerData, selectedRole, state, alivePlayers).map((quest) => (
                  <div
                    key={quest.id}
                    className="rounded-lg p-2.5 flex items-center gap-2.5"
                    style={{ background: `${quest.color}${isNight ? '06' : '0a'}`, border: `1px solid ${quest.color}${isNight ? '15' : '22'}` }}
                  >
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                      style={{ background: `${quest.color}12` }}
                    >
                      <span className="text-sm">{quest.emoji}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span style={{ fontFamily: '"Cinzel", serif', color: quest.color, fontSize: '0.6rem', fontWeight: isNight ? 400 : 700, filter: isNight ? 'none' : 'brightness(0.65)' }}>
                          {quest.title}
                        </span>
                        <span style={{ color: isNight ? t.textMuted : '#4a3a25', fontSize: '0.5rem', fontWeight: 600 }}>{quest.detail}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div
                          className="flex-1 h-1 rounded-full overflow-hidden"
                          style={{ background: isNight ? `rgba(${t.overlayChannel}, 0.05)` : 'rgba(0,0,0,0.06)' }}
                        >
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: quest.color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(quest.progress, 100)}%` }}
                            transition={{ duration: 0.8 }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Assigned Quests (from quest system) */}
            <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${isNight ? 'rgba(212,168,67,0.15)' : 'rgba(180,155,85,0.25)'}` }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Scroll size={11} style={{ color: t.gold }} />
                  <span style={{ fontFamily: '"Cinzel", serif', color: t.gold, fontSize: '0.65rem', fontWeight: 700 }}>
                    Quêtes distribuées
                  </span>
                  <span
                    className="px-1.5 py-0.5 rounded-full"
                    style={{
                      background: isNight ? 'rgba(212,168,67,0.12)' : 'rgba(212,168,67,0.15)',
                      color: t.gold,
                      fontSize: '0.5rem',
                      fontWeight: 700,
                    }}
                  >
                    {selectedPlayerQuests.length}
                  </span>
                </div>
                {unassignedQuests.length > 0 && (
                  <button
                    onClick={() => setShowRevealPicker(!showRevealPicker)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg transition-all"
                    style={{
                      background: isNight ? 'rgba(212,168,67,0.1)' : 'rgba(212,168,67,0.12)',
                      border: `1px solid ${isNight ? 'rgba(212,168,67,0.25)' : 'rgba(212,168,67,0.3)'}`,
                      color: t.gold,
                      fontSize: '0.55rem',
                      fontFamily: '"Cinzel", serif',
                    }}
                  >
                    <Plus size={10} />
                    Révéler
                    <ChevronDown size={10} style={{ transform: showRevealPicker ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </button>
                )}
                {unassignedQuests.length > 0 && (
                  <button
                    onClick={handleDistributeRandomQuest}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg transition-all"
                    style={{
                      background: isNight ? 'rgba(212,168,67,0.1)' : 'rgba(212,168,67,0.12)',
                      border: `1px solid ${isNight ? 'rgba(212,168,67,0.25)' : 'rgba(212,168,67,0.3)'}`,
                      color: t.gold,
                      fontSize: '0.55rem',
                      fontFamily: '"Cinzel", serif',
                    }}
                  >
                    <Dices size={10} />
                    Aléatoire
                  </button>
                )}
              </div>

              {/* Assigned quest cards */}
              {selectedPlayerQuests.length > 0 ? (
                <div className="space-y-1.5">
                  {selectedPlayerQuests.map((q: Quest) => {
                    const status = q.playerStatuses?.[selectedPlayerData.id] || 'active';
                    const isCollab = (q.questType || 'individual') === 'collaborative';
                    const tasksTotal = q.tasks?.length || 0;
                    const tasksAnswered = q.tasks?.filter(
                      (tk) => tk.playerAnswers?.[selectedPlayerData.id] !== undefined
                    ).length || 0;
                    const tasksCorrect = q.tasks?.filter(
                      (tk) => tk.playerResults?.[selectedPlayerData.id] === true
                    ).length || 0;

                    const statusConfig = {
                      active: { icon: <Clock size={10} />, label: 'En cours', color: '#d4a843', bg: 'rgba(212,168,67,0.1)' },
                      'pending-resolution': { icon: <Clock size={10} />, label: 'En attente', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
                      success: { icon: <CheckCircle2 size={10} />, label: 'Réussie', color: '#6b8e5a', bg: 'rgba(107,142,90,0.1)' },
                      fail: { icon: <XCircle size={10} />, label: 'Échouée', color: '#c41e3a', bg: 'rgba(196,30,58,0.1)' },
                    }[status] || { icon: <Clock size={10} />, label: status, color: t.textMuted, bg: 'rgba(128,128,128,0.1)' };

                    const progress = tasksTotal > 0 ? (tasksAnswered / tasksTotal) * 100 : 0;

                    return (
                      <div
                        key={q.id}
                        className="rounded-lg p-2.5"
                        style={{
                          background: isNight ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                          border: `1px solid ${isNight ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              {isCollab && <Handshake size={10} style={{ color: isNight ? '#FFD672' : '#836825' }} />}
                              <span
                                className="truncate"
                                style={{
                                  color: t.text,
                                  fontSize: '0.65rem',
                                  fontFamily: '"Cinzel", serif',
                                  fontWeight: 600,
                                }}
                              >
                                {q.title}
                              </span>
                            </div>
                            <p
                              className="truncate"
                              style={{ color: t.textMuted, fontSize: '0.5rem', lineHeight: 1.3 }}
                            >
                              {q.description}
                            </p>
                          </div>
                          <span
                            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full shrink-0"
                            style={{
                              background: statusConfig.bg,
                              border: `1px solid ${statusConfig.color}30`,
                              color: statusConfig.color,
                              fontSize: '0.45rem',
                              fontWeight: 600,
                            }}
                          >
                            {statusConfig.icon}
                            {statusConfig.label}
                          </span>
                        </div>
                        {/* Progress bar */}
                        {status === 'active' && tasksTotal > 0 && (
                          <div className="mt-1.5 flex items-center gap-2">
                            <div
                              className="flex-1 h-1 rounded-full overflow-hidden"
                              style={{ background: isNight ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)' }}
                            >
                              <motion.div
                                className="h-full rounded-full"
                                style={{ background: '#d4a843' }}
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.6 }}
                              />
                            </div>
                            <span style={{ color: t.textMuted, fontSize: '0.45rem', fontWeight: 600 }}>
                              {tasksAnswered}/{tasksTotal}
                            </span>
                          </div>
                        )}
                        {status === 'success' && tasksTotal > 0 && (
                          <div className="mt-1">
                            <span style={{ color: '#6b8e5a', fontSize: '0.45rem' }}>
                              ✓ {tasksCorrect}/{tasksTotal} tâche(s) réussie(s)
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ color: t.textMuted, fontSize: '0.6rem', textAlign: 'center', padding: '0.5rem 0' }}>
                  Aucune quête distribuée
                </p>
              )}

              {/* Reveal quest picker */}
              <AnimatePresence>
                {showRevealPicker && unassignedQuests.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 space-y-1">
                      <span style={{ color: t.textMuted, fontSize: '0.5rem', fontFamily: '"Cinzel", serif' }}>
                        Choisir une quête à révéler :
                      </span>
                      {unassignedQuests.map((q: Quest) => {
                        const isCollab = (q.questType || 'individual') === 'collaborative';
                        return (
                          <button
                            key={q.id}
                            onClick={() => handleRevealQuest(q.id, selectedPlayerData.id)}
                            className="w-full flex items-center gap-2 p-2 rounded-lg transition-all text-left"
                            style={{
                              background: isNight ? 'rgba(212,168,67,0.04)' : 'rgba(212,168,67,0.06)',
                              border: `1px solid ${isNight ? 'rgba(212,168,67,0.12)' : 'rgba(212,168,67,0.18)'}`,
                            }}
                          >
                            <div
                              className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                              style={{ background: isNight ? 'rgba(212,168,67,0.1)' : 'rgba(212,168,67,0.12)' }}
                            >
                              {isCollab ? <Handshake size={10} style={{ color: t.gold }} /> : <Scroll size={10} style={{ color: t.gold }} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span
                                className="block truncate"
                                style={{ color: t.text, fontSize: '0.6rem', fontFamily: '"Cinzel", serif', fontWeight: 600 }}
                              >
                                {q.title}
                              </span>
                              <span className="block truncate" style={{ color: t.textMuted, fontSize: '0.45rem' }}>
                                {q.description}
                                {isCollab && ' · Collaborative'}
                              </span>
                            </div>
                            <Send size={11} style={{ color: t.gold, flexShrink: 0 }} />
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Mobile Player Hints */}
            <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${isNight ? 'rgba(59,130,246,0.15)' : 'rgba(100,120,180,0.2)'}` }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Lightbulb size={11} style={{ color: isNight ? '#60a5fa' : '#3b6fc4' }} />
                  <span style={{ fontFamily: '"Cinzel", serif', color: isNight ? '#60a5fa' : '#3b6fc4', fontSize: '0.65rem', fontWeight: 700 }}>
                    Indices recus
                  </span>
                  <span
                    className="px-1.5 py-0.5 rounded-full"
                    style={{
                      background: isNight ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.15)',
                      color: isNight ? '#60a5fa' : '#3b6fc4',
                      fontSize: '0.5rem',
                      fontWeight: 700,
                    }}
                  >
                    {playerHintEntries.length}
                  </span>
                </div>
                <button
                  onClick={handleGrantHint}
                  disabled={grantingHint || availableDynamicHintCount === 0}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg transition-all"
                  style={{
                    background: availableDynamicHintCount > 0 && !grantingHint
                      ? (isNight ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.12)')
                      : 'rgba(128,128,128,0.06)',
                    border: `1px solid ${availableDynamicHintCount > 0 && !grantingHint
                      ? (isNight ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.3)')
                      : 'rgba(128,128,128,0.15)'}`,
                    color: availableDynamicHintCount > 0 && !grantingHint
                      ? (isNight ? '#60a5fa' : '#3b6fc4')
                      : '#4a5568',
                    fontSize: '0.55rem',
                    fontFamily: '"Cinzel", serif',
                    opacity: availableDynamicHintCount === 0 || grantingHint ? 0.5 : 1,
                  }}
                >
                  {grantingHint ? (
                    <><div className="w-2.5 h-2.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /> ...</>
                  ) : grantHintResult === 'success' ? (
                    <><Check size={10} /> OK</>
                  ) : (
                    <><Send size={10} /> Distribuer</>
                  )}
                </button>
              </div>

              {grantHintResult === 'empty' && (
                <div className="mb-2 px-2 py-1 rounded-lg" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                  <span style={{ color: '#ef4444', fontSize: '0.5rem' }}>Aucun indice disponible.</span>
                </div>
              )}

              {playerHintEntries.length === 0 ? (
                <p style={{ color: t.textMuted, fontSize: '0.6rem', textAlign: 'center', padding: '0.5rem 0' }}>
                  Aucun indice recu
                </p>
              ) : (
                <div className="space-y-1.5">
                  {playerHintEntries.map((entry) => {
                    const { hint } = entry;
                    const timeStr = hint.createdAt
                      ? new Date(hint.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                      : '';
                    return (
                      <div
                        key={`${hint.id}-${entry.sentAt}`}
                        className="flex items-start gap-2 rounded-lg p-2.5"
                        style={{
                          background: entry.revealed
                            ? (isNight ? 'rgba(107,142,90,0.04)' : 'rgba(107,142,90,0.06)')
                            : (isNight ? 'rgba(59,130,246,0.04)' : 'rgba(59,130,246,0.06)'),
                          border: `1px solid ${entry.revealed
                            ? (isNight ? 'rgba(107,142,90,0.12)' : 'rgba(107,142,90,0.18)')
                            : (isNight ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.15)')}`,
                        }}
                      >
                        <div
                          className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                          style={{
                            background: entry.revealed
                              ? 'rgba(107,142,90,0.12)'
                              : 'rgba(59,130,246,0.1)',
                          }}
                        >
                          {entry.revealed ? (
                            <Eye size={10} style={{ color: '#6b8e5a' }} />
                          ) : (
                            <Lightbulb size={10} style={{ color: '#60a5fa' }} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          {hint.text && (
                            <p
                              className="break-words"
                              style={{
                                color: t.text,
                                fontSize: '0.6rem',
                                fontStyle: 'italic',
                                fontFamily: '"IM Fell English", serif',
                                lineHeight: 1.4,
                              }}
                            >
                              &ldquo;{hint.text}&rdquo;
                            </p>
                          )}
                          {hint.imageUrl && (
                            <img
                              src={hint.imageUrl}
                              alt="Indice"
                              className="mt-1 rounded-lg max-h-16 object-cover"
                              style={{ border: `1px solid ${isNight ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}` }}
                            />
                          )}
                          <div className="flex items-center gap-1.5 mt-1">
                            <span
                              className="px-1 py-0.5 rounded-full"
                              style={{
                                background: entry.revealed ? 'rgba(107,142,90,0.1)' : (isNight ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'),
                                color: entry.revealed ? '#6b8e5a' : t.textDim,
                                fontSize: '0.45rem',
                                fontWeight: 600,
                              }}
                            >
                              {entry.revealed ? 'Lu' : 'Non lu'}
                            </span>
                            {timeStr && (
                              <span style={{ color: t.textDim, fontSize: '0.45rem' }}>{timeStr}</span>
                            )}
                            {hint.fromDynamic && (
                              <span
                                className="px-1 py-0.5 rounded-full"
                                style={{
                                  background: 'rgba(168,85,247,0.08)',
                                  color: '#a78bfa',
                                  fontSize: '0.4rem',
                                  fontWeight: 600,
                                }}
                              >
                                Dynamique
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {availableDynamicHintCount > 0 && (
                <p className="mt-1.5" style={{ color: t.textDim, fontSize: '0.5rem', textAlign: 'right' }}>
                  {availableDynamicHintCount} indice{availableDynamicHintCount > 1 ? 's' : ''} dispo.
                </p>
              )}
            </div>
          </motion.div>
        </>
      )}
      </AnimatePresence>
    </div>
  );
}