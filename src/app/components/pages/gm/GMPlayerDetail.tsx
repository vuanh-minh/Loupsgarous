import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Moon, Crown, Shield, Skull, Vote, Eye,
  Check, Heart, Star, BookOpen, ExternalLink,
  Clock, RefreshCw, Scroll, Dices,
  Tag, Camera, Bell, ChevronDown, Image,
  Lightbulb, Send, Swords, CheckCircle2, UserX, UserCheck,
} from 'lucide-react';
import { type Player } from '../../../context/GameContext';
import { getRoleById, ROLES } from '../../../data/roles';
import type { RoleDefinition } from '../../../data/roles';
import { API_BASE, publicAnonKey } from '../../../context/apiConfig';
import { GMAvatar, SectionHeader, getConnectionStatus, buildQuests } from './GMShared';
import { useGamePanelContext } from './GamePanelContext';
import { sendPushNotifications } from '../../../context/useNotifications';
import { AvatarGalleryModal } from './AvatarGalleryModal';
import { type Quest, type Hint, type PlayerHint, type DynamicHint } from '../../../context/gameTypes';

/* ================================================================
   Player Detail — desktop right-panel player view
   Consumes shared state via GamePanelContext (no prop drilling).
   ================================================================ */

export function GMPlayerDetail() {
  const {
    state, selectedPlayer, alivePlayers, isNight,
    playerHeartbeats, t, navigate,
    eliminatePlayer, addEvent, setGuardTarget, setRevivePendingId,
    updateState,
  } = useGamePanelContext();

  const selectedPlayerData = selectedPlayer !== null
    ? state.players.find((p: Player) => p.id === selectedPlayer)
    : null;
  const selectedRole = selectedPlayerData ? getRoleById(selectedPlayerData.role) : null;

  // Avatar upload — self-contained (uses same API endpoint as GameMasterPage)
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [showAvatarGallery, setShowAvatarGallery] = useState(false);
  const handleGallerySelect = useCallback((avatarUrl: string) => {
    if (!selectedPlayerData) return;
    updateState((s) => ({
      ...s,
      players: s.players.map((p) =>
        p.id === selectedPlayerData.id ? { ...p, avatarUrl } : p
      ),
    }));
  }, [selectedPlayerData, updateState]);
  const handleAvatarUpload = useCallback(async (file: File) => {
    if (!selectedPlayerData || !state.gameId) return;
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('gameId', state.gameId);
      formData.append('playerId', String(selectedPlayerData.id));
      formData.append('password', 'loupgarou');
      const res = await fetch(`${API_BASE}/game/avatar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.avatarUrl) {
        updateState((s) => ({
          ...s,
          players: s.players.map((p) =>
            p.id === selectedPlayerData.id ? { ...p, avatarUrl: data.avatarUrl } : p
          ),
        }));
      } else {
        console.log('Avatar upload failed:', data.error);
      }
    } catch (err) {
      console.log('Avatar upload error:', err);
    } finally {
      setAvatarUploading(false);
    }
  }, [selectedPlayerData, state.gameId, updateState]);

  // Hypotheses fetching
  const [playerHypotheses, setPlayerHypotheses] = useState<Record<number, string>>({});
  const [hypothesesLoading, setHypothesesLoading] = useState(false);

  // Notify player — brief visual feedback
  const [notifySent, setNotifySent] = useState(false);
  const notifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleNotifyPlayer = useCallback(() => {
    if (!selectedPlayerData?.shortCode || !state.gameId) return;
    sendPushNotifications(
      state.gameId,
      [selectedPlayerData.shortCode],
      'Loup-Garou',
      '🔔 Vous avez une action à réaliser.',
      'gm-notify-action',
    );
    // Write to game state so the player's polling picks it up reliably
    updateState((s) => ({
      ...s,
      gmAlerts: { ...(s.gmAlerts || {}), [selectedPlayerData.shortCode]: Date.now() },
    }));
    setNotifySent(true);
    if (notifyTimerRef.current) clearTimeout(notifyTimerRef.current);
    notifyTimerRef.current = setTimeout(() => setNotifySent(false), 2000);
  }, [selectedPlayerData?.shortCode, state.gameId, updateState]);

  // Reset notify feedback when switching player
  useEffect(() => {
    setNotifySent(false);
    if (notifyTimerRef.current) clearTimeout(notifyTimerRef.current);
    setShowRolePicker(false);
  }, [selectedPlayer]);

  // Role change picker (only during role reveal phase)
  const [showRolePicker, setShowRolePicker] = useState(false);
  const rolePickerRef = useRef<HTMLDivElement>(null);
  const isRoleRevealPhase = state.roleRevealDone === false;

  const handleChangeRole = useCallback((newRoleId: string) => {
    if (!selectedPlayerData) return;
    updateState((s) => ({
      ...s,
      players: s.players.map((p) =>
        p.id === selectedPlayerData.id ? { ...p, role: newRoleId } : p
      ),
    }));
    addEvent(`Role de ${selectedPlayerData.name} change en ${getRoleById(newRoleId)?.name || newRoleId}.`);
    setShowRolePicker(false);
  }, [selectedPlayerData, updateState, addEvent]);

  // Close role picker on outside click
  useEffect(() => {
    if (!showRolePicker) return;
    const handleClick = (e: MouseEvent) => {
      if (rolePickerRef.current && !rolePickerRef.current.contains(e.target as Node)) {
        setShowRolePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showRolePicker]);

  const fetchPlayerHypotheses = useCallback(async (sc: string, gId: string, isInitial: boolean) => {
    if (isInitial) setHypothesesLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/game/hypothesis?shortCode=${encodeURIComponent(sc)}&gameId=${encodeURIComponent(gId)}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } },
      );
      if (res.ok) {
        const data = await res.json();
        setPlayerHypotheses(data.hypotheses && typeof data.hypotheses === 'object' ? data.hypotheses : {});
      }
    } catch (err) {
      console.log('GM: load player hypotheses error:', err);
    } finally {
      if (isInitial) setHypothesesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedPlayerData || !selectedPlayerData.shortCode || !state.gameId) {
      setPlayerHypotheses({});
      return;
    }
    let cancelled = false;
    const sc = selectedPlayerData.shortCode;
    const gId = state.gameId!;
    fetchPlayerHypotheses(sc, gId, true);
    const interval = setInterval(() => {
      if (!cancelled) fetchPlayerHypotheses(sc, gId, false);
    }, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [selectedPlayer, selectedPlayerData?.shortCode, state.gameId, fetchPlayerHypotheses]);

  if (!selectedPlayerData || !selectedRole) return null;

  const conn = getConnectionStatus(selectedPlayerData.shortCode, playerHeartbeats);
  const isWolf = selectedPlayerData.role === 'loup-garou';
  const isSeer = selectedPlayerData.role === 'voyante';
  const isWitch = selectedPlayerData.role === 'sorciere';
  const isCupid = selectedPlayerData.role === 'cupidon';
  const isHunter = selectedPlayerData.role === 'chasseur';
  const isGuard = selectedPlayerData.role === 'garde';
  const myWolfVote = isWolf ? state.werewolfVotes[selectedPlayerData.id] ?? null : null;
  const myWolfTarget = myWolfVote !== null ? state.players.find((p: Player) => p.id === myWolfVote) : null;
  const myDayVote = state.votes[selectedPlayerData.id] ?? null;
  const myDayTarget = myDayVote !== null ? state.players.find((p: Player) => p.id === myDayVote) : null;
  const seerTarget = isSeer && state.seerTargets?.[selectedPlayerData.id] !== undefined ? state.players.find((p: Player) => p.id === state.seerTargets?.[selectedPlayerData.id]) : null;
  const seerResultRole = isSeer && state.seerResults?.[selectedPlayerData.id] ? state.seerResults[selectedPlayerData.id] : null;

  // ── Quest distribution ──
  const playerAssignedQuestIds: number[] = (state.questAssignments || {})[selectedPlayerData.id] || [];
  const playerQuestCount = playerAssignedQuestIds.length;
  const unassignedQuestsForPlayer = (state.quests || []).filter((q: Quest) => {
    if (playerAssignedQuestIds.includes(q.id)) return false;
    if (!selectedPlayerData.alive && (q.questType || 'individual') === 'collaborative') return false;
    return true;
  });
  const handleDistributeRandomQuest = useCallback(() => {
    if (unassignedQuestsForPlayer.length === 0 || !selectedPlayerData) return;
    const picked = unassignedQuestsForPlayer[Math.floor(Math.random() * unassignedQuestsForPlayer.length)];
    updateState((s) => {
      const newAssignments: Record<number, number[]> = {};
      for (const [k, v] of Object.entries(s.questAssignments || {})) {
        newAssignments[Number(k)] = [...v];
      }
      if (!newAssignments[selectedPlayerData.id]) newAssignments[selectedPlayerData.id] = [];
      if (!newAssignments[selectedPlayerData.id].includes(picked.id)) {
        newAssignments[selectedPlayerData.id].push(picked.id);
      }
      const isCollab = (picked.questType || 'individual') === 'collaborative';
      let updatedQuests = s.quests || [];
      if (isCollab) {
        updatedQuests = updatedQuests.map(q => {
          if (q.id !== picked.id) return q;
          const groups: number[][] = (q.collaborativeGroups || []).map(g => [...g]);
          const maxSize = q.collaborativeGroupSize || 3;
          const incompleteIdx = groups.findIndex(g => g.length < maxSize);
          if (incompleteIdx >= 0) {
            groups[incompleteIdx].push(selectedPlayerData.id);
          } else {
            groups.push([selectedPlayerData.id]);
          }
          return { ...q, collaborativeGroups: groups };
        });
      }
      return { ...s, quests: updatedQuests, questAssignments: newAssignments };
    });
    addEvent(`Quête "${picked.title}" distribuée à ${selectedPlayerData.name}.`);
  }, [unassignedQuestsForPlayer, selectedPlayerData, updateState, addEvent]);

  // ── Player Hints (received) ──
  const playerHintEntries = useMemo(() => {
    const ph: PlayerHint[] = state.playerHints ?? [];
    const allHints: Hint[] = state.hints ?? [];
    const myPH = ph.filter((p) => p.playerId === selectedPlayerData?.id);
    return myPH
      .map((p) => {
        const hint = allHints.find((h) => h.id === p.hintId);
        return hint ? { ...p, hint } : null;
      })
      .filter(Boolean) as (PlayerHint & { hint: Hint })[];
  }, [state.playerHints, state.hints, selectedPlayerData?.id]);

  // ── Grant dynamic hint to this player (calls server endpoint) ──
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

  // Count available dynamic hints for this player (hints not yet granted to them)
  const availableDynamicHintCount = useMemo(() => {
    const dh: DynamicHint[] = state.dynamicHints ?? [];
    const pid = selectedPlayerData?.id;
    if (pid == null) return 0;
    return dh.filter((h) => !(h.grantedToPlayerIds ?? []).includes(pid)).length;
  }, [state.dynamicHints, selectedPlayerData?.id]);

  return (
    <div className="max-w-2xl mx-auto w-full p-6">
      {/* Player Identity Card */}
      <motion.div key={selectedPlayerData.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl p-6 mb-5 relative" style={{ background: `linear-gradient(135deg, ${selectedRole.color}12, rgba(255,255,255,0.02))`, border: `1px solid ${selectedRole.color}30` }}>
        <div className="absolute inset-0 opacity-5 rounded-xl overflow-hidden" style={{ background: `radial-gradient(circle at 30% 20%, ${selectedRole.color}, transparent 60%)` }} />
        <div className="relative flex flex-wrap md:flex-nowrap items-start gap-4">
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden relative group/avatar" style={{ background: `${selectedRole.color}15`, border: `2px solid ${selectedRole.color}40` }}>
              {avatarUploading ? (
                <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <GMAvatar player={selectedPlayerData} size="text-3xl" />
              )}
              {/* Desktop hover overlay */}
              <div className="absolute inset-0 rounded-full flex items-center justify-center gap-2 opacity-0 group-hover/avatar:opacity-100 transition-opacity max-md:hidden" style={{ background: 'rgba(0,0,0,0.55)' }}>
                <label className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer hover:bg-white/20 transition-colors" title="Importer une photo">
                  <Camera size={13} style={{ color: '#d4a843' }} />
                  <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); e.target.value = ''; }} />
                </label>
                <button onClick={() => setShowAvatarGallery(true)} className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer hover:bg-white/20 transition-colors" title="Choisir depuis la galerie">
                  <Image size={13} style={{ color: '#d4a843' }} />
                </button>
              </div>
              {/* Mobile tap badge — camera */}
              <label
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer md:hidden"
                style={{ background: 'rgba(212,168,67,0.9)', border: '2px solid #0a1020', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }}
              >
                <Camera size={10} style={{ color: '#0a1020' }} />
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); e.target.value = ''; }} />
              </label>
              {/* Mobile tap badge — gallery */}
              <button
                onClick={() => setShowAvatarGallery(true)}
                className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer md:hidden"
                style={{ background: 'rgba(138,180,248,0.9)', border: '2px solid #0a1020', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }}
              >
                <Image size={10} style={{ color: '#0a1020' }} />
              </button>
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2" style={{ background: conn.color, borderColor: '#0a1020' }} title={conn.label} />
            {state.maireId === selectedPlayerData.id && (<div className="absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#d4a843', border: '2px solid #0a1020' }} title="Maire"><Crown size={10} style={{ color: '#0a0e1a' }} /></div>)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 style={{ color: t.text, fontSize: '1.15rem', fontFamily: '"Cinzel", serif' }}>{selectedPlayerData.name} {state.maireId === selectedPlayerData.id ? '🏛️' : ''} <span style={{ color: t.textMuted, fontSize: '0.65rem', fontFamily: 'monospace', letterSpacing: '0.04em', fontWeight: 400 }}>#{selectedPlayerData.shortCode}</span></h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xl">{selectedRole.emoji}</span>
              {isRoleRevealPhase ? (
                <div className="relative" ref={rolePickerRef}>
                  <button
                    onClick={() => setShowRolePicker(!showRolePicker)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer hover:bg-white/5"
                    style={{
                      border: `1px solid ${selectedRole.color}40`,
                      background: showRolePicker ? `${selectedRole.color}12` : 'transparent',
                    }}
                  >
                    <span style={{ color: selectedRole.color, fontSize: '0.85rem', fontFamily: '"Cinzel", serif' }}>{selectedRole.name}</span>
                    <ChevronDown size={12} style={{ color: selectedRole.color, transform: showRolePicker ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </button>
                  {showRolePicker && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 top-full mt-1 z-50 rounded-xl p-1.5 max-h-64 overflow-y-auto w-56"
                      style={{
                        background: 'rgba(16,18,36,0.97)',
                        border: '1px solid rgba(212,168,67,0.2)',
                        boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                        backdropFilter: 'blur(16px)',
                      }}
                    >
                      {ROLES.map((role: RoleDefinition) => {
                        const isCurrent = role.id === selectedPlayerData.role;
                        return (
                          <button
                            key={role.id}
                            onClick={() => { if (!isCurrent) handleChangeRole(role.id); }}
                            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all text-left"
                            style={{
                              background: isCurrent ? `${role.color}15` : 'transparent',
                              border: isCurrent ? `1px solid ${role.color}30` : '1px solid transparent',
                              cursor: isCurrent ? 'default' : 'pointer',
                            }}
                            onMouseEnter={(e) => { if (!isCurrent) (e.currentTarget.style.background = 'rgba(255,255,255,0.04)'); }}
                            onMouseLeave={(e) => { if (!isCurrent) (e.currentTarget.style.background = 'transparent'); }}
                          >
                            <span className="text-base shrink-0">{role.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <span className="block truncate" style={{ color: isCurrent ? role.color : '#c8d0e0', fontSize: '0.7rem', fontFamily: '"Cinzel", serif', fontWeight: isCurrent ? 600 : 400 }}>
                                {role.name}
                              </span>
                              <span className="block truncate" style={{ color: role.team === 'werewolf' ? 'rgba(196,30,58,0.6)' : role.team === 'solo' ? 'rgba(168,85,247,0.6)' : 'rgba(107,142,90,0.6)', fontSize: '0.45rem', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>
                                {role.team === 'village' ? 'Village' : role.team === 'werewolf' ? 'Loup-Garou' : 'Solo'}
                              </span>
                            </div>
                            {isCurrent && <Check size={12} style={{ color: role.color, flexShrink: 0 }} />}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </div>
              ) : (
                <span style={{ color: selectedRole.color, fontSize: '0.85rem', fontFamily: '"Cinzel", serif' }}>{selectedRole.name}</span>
              )}
              <span className="px-2 py-0.5 rounded-full" style={{ background: selectedRole.team === 'werewolf' ? 'rgba(196,30,58,0.15)' : 'rgba(107,142,90,0.15)', border: `1px solid ${selectedRole.team === 'werewolf' ? 'rgba(196,30,58,0.3)' : 'rgba(107,142,90,0.3)'}`, color: selectedRole.team === 'werewolf' ? '#c41e3a' : '#6b8e5a', fontSize: '0.5rem', fontFamily: '"Cinzel", serif', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>{selectedRole.team === 'village' ? 'Village' : 'Loup-Garou'}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: selectedPlayerData.alive ? 'rgba(107,142,90,0.1)' : 'rgba(196,30,58,0.1)', border: `1px solid ${selectedPlayerData.alive ? 'rgba(107,142,90,0.2)' : 'rgba(196,30,58,0.2)'}`, color: selectedPlayerData.alive ? '#6b8e5a' : '#c41e3a', fontSize: '0.55rem', fontFamily: '"Cinzel", serif' }}>{selectedPlayerData.alive ? '● Vivant' : '💀 Elimine'}</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: conn.bg || 'rgba(74,85,104,0.1)', color: conn.color, fontSize: '0.55rem', fontFamily: '"Cinzel", serif' }}>{conn.label}</span>
              {!selectedPlayerData.alive && !!(state.lastWillUsed ?? {})[selectedPlayerData.id] && (() => {
                const lwTargetId = state.votes?.[selectedPlayerData.id] ?? state.earlyVotes?.[selectedPlayerData.id] ?? null;
                const lwTarget = lwTargetId !== null ? state.players.find((p: Player) => p.id === lwTargetId) : null;
                return (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#a78bfa', fontSize: '0.55rem', fontFamily: '"Cinzel", serif' }}>
                    <Scroll size={9} />
                    Volonte{lwTarget ? ` → ${lwTarget.name}` : ''}
                  </span>
                );
              })()}
            </div>
            {/* Player Tags */}
            {((state.playerTags || {})[selectedPlayerData.id] || []).length > 0 && (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {((state.playerTags || {})[selectedPlayerData.id] || []).map((tag: string) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)', color: '#c084fc', fontSize: '0.55rem', fontFamily: '"Cinzel", serif' }}
                  >
                    <Tag size={9} />
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 w-full md:w-auto flex-wrap md:flex-nowrap">
            <button onClick={() => navigate(`/player/${selectedPlayerData.shortCode}`)} className="px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-white/5 transition-colors" style={{ border: `1px solid rgba(${t.overlayChannel}, 0.08)`, color: t.textMuted, fontSize: '0.7rem' }}><ExternalLink size={12} />Page joueur</button>
            <button
              onClick={handleNotifyPlayer}
              disabled={notifySent}
              className="px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              style={{
                border: `1px solid ${notifySent ? 'rgba(107,142,90,0.3)' : 'rgba(212,168,67,0.25)'}`,
                color: notifySent ? '#6b8e5a' : '#d4a843',
                fontSize: '0.7rem',
                background: notifySent ? 'rgba(107,142,90,0.08)' : undefined,
              }}
            >
              {notifySent ? <Check size={12} /> : <Bell size={12} />}
              {notifySent ? 'Envoyé' : 'Notifier'}
            </button>
            {selectedPlayerData.alive ? (
              <button onClick={() => { eliminatePlayer(selectedPlayerData.id); addEvent(`${selectedPlayerData.name} a fuit le village.`); }} className="px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-red-900/20 transition-colors" style={{ border: '1px solid rgba(196,30,58,0.2)', color: '#c41e3a', fontSize: '0.7rem' }}><Skull size={12} />Eliminer</button>
            ) : (
              <button onClick={() => setRevivePendingId(selectedPlayerData.id)} className="px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-green-900/20 transition-colors" style={{ border: '1px solid rgba(107,142,90,0.3)', color: '#6b8e5a', fontSize: '0.7rem' }}><Heart size={12} />Ressusciter</button>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Actions status ── */}
      {selectedPlayerData.alive && (() => {
        const pid = selectedPlayerData.id;
        const role = selectedPlayerData.role;
        const nightActionRoles: Record<string, () => { done: boolean; label: string }> = {
          'loup-garou': () => ({
            done: state.werewolfVotes?.[pid] !== undefined,
            label: state.werewolfVotes?.[pid] !== undefined
              ? `A voté → ${state.players.find((p: Player) => p.id === state.werewolfVotes[pid])?.name || '?'}`
              : 'En attente de vote',
          }),
          'voyante': () => ({
            done: state.seerTargets?.[pid] !== undefined,
            label: state.seerTargets?.[pid] !== undefined
              ? `A sondé → ${state.players.find((p: Player) => p.id === state.seerTargets[pid])?.name || '?'}`
              : 'En attente',
          }),
          'sorciere': () => {
            const healed = !!(state.witchHealedThisNight || {})[pid];
            const killed = state.witchKillTargets?.[pid] !== undefined;
            return {
              done: healed || killed,
              label: healed || killed
                ? [healed && 'Guérison', killed && `Poison → ${state.players.find((p: Player) => p.id === state.witchKillTargets?.[pid])?.name || '?'}`].filter(Boolean).join(' · ')
                : 'Aucune potion',
            };
          },
          'garde': () => ({
            done: state.guardTargets?.[pid] !== undefined,
            label: state.guardTargets?.[pid] !== undefined
              ? `Protège → ${state.players.find((p: Player) => p.id === state.guardTargets[pid])?.name || '?'}`
              : 'En attente',
          }),
          'cupidon': () => ({
            done: (state.cupidLinkedBy || []).length > 0,
            label: (state.cupidLinkedBy || []).length > 0 ? 'Amoureux liés' : 'En attente du lien',
          }),
          'corbeau': () => ({
            done: state.corbeauTargets?.[pid] !== undefined,
            label: state.corbeauTargets?.[pid] !== undefined
              ? `Cible → ${state.players.find((p: Player) => p.id === state.corbeauTargets[pid])?.name || '?'}`
              : 'En attente',
          }),
        };
        const nightActionFn = nightActionRoles[role];
        const hasNightRole = !!nightActionFn;
        const nightAction = nightActionFn ? nightActionFn() : null;
        const hasDayVoted = state.votes?.[pid] !== undefined;
        const dayVoteTarget = hasDayVoted ? state.players.find((p: Player) => p.id === state.votes[pid]) : null;

        return (
          <div
            className="rounded-xl p-3 mb-4 space-y-2"
            style={{ background: 'rgba(147,130,220,0.04)', border: '1px solid rgba(147,130,220,0.15)' }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Swords size={14} style={{ color: '#a78bfa' }} />
              <span style={{ fontFamily: '"Cinzel", serif', color: '#a78bfa', fontSize: '0.75rem', fontWeight: 600 }}>Actions</span>
            </div>
            {/* Night action */}
            {hasNightRole && nightAction && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{
                  background: nightAction.done ? 'rgba(107,142,90,0.06)' : 'rgba(234,179,8,0.05)',
                  border: `1px solid ${nightAction.done ? 'rgba(107,142,90,0.2)' : 'rgba(234,179,8,0.2)'}`,
                }}
              >
                <Moon size={12} style={{ color: nightAction.done ? '#6b8e5a' : '#eab308' }} />
                <span style={{ fontSize: '0.7rem', color: t.textSecondary, fontFamily: '"Cinzel", serif' }}>Nuit</span>
                <span className="ml-auto flex items-center gap-1.5" style={{ fontSize: '0.65rem', color: nightAction.done ? '#6b8e5a' : '#eab308' }}>
                  {nightAction.done ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                  {nightAction.label}
                </span>
              </div>
            )}
            {!hasNightRole && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: 'rgba(100,116,139,0.04)', border: '1px solid rgba(100,116,139,0.1)' }}
              >
                <Moon size={12} style={{ color: '#64748b' }} />
                <span style={{ fontSize: '0.7rem', color: t.textSecondary, fontFamily: '"Cinzel", serif' }}>Nuit</span>
                <span className="ml-auto" style={{ fontSize: '0.65rem', color: '#64748b' }}>Aucune action</span>
              </div>
            )}
            {/* Day vote */}
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{
                background: hasDayVoted ? 'rgba(107,142,90,0.06)' : 'rgba(234,179,8,0.05)',
                border: `1px solid ${hasDayVoted ? 'rgba(107,142,90,0.2)' : 'rgba(234,179,8,0.2)'}`,
              }}
            >
              <Vote size={12} style={{ color: hasDayVoted ? '#6b8e5a' : '#eab308' }} />
              <span style={{ fontSize: '0.7rem', color: t.textSecondary, fontFamily: '"Cinzel", serif' }}>Vote du jour</span>
              <span className="ml-auto flex items-center gap-1.5" style={{ fontSize: '0.65rem', color: hasDayVoted ? '#6b8e5a' : '#eab308' }}>
                {hasDayVoted ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                {hasDayVoted ? `A voté → ${dayVoteTarget?.name || '?'}` : 'Pas encore voté'}
              </span>
            </div>
          </div>
        );
      })()}

      {/* ── Distribute Quest Bar ── */}
      <div
        className="rounded-xl p-3 mb-5 flex items-center justify-between"
        style={{
          background: 'rgba(212,168,67,0.04)',
          border: '1px solid rgba(212,168,67,0.15)',
        }}
      >
        <div className="flex items-center gap-2">
          <Scroll size={14} style={{ color: '#d4a843' }} />
          <span style={{ fontFamily: '"Cinzel", serif', color: '#d4a843', fontSize: '0.75rem', fontWeight: 600 }}>
            Quêtes distribuées
          </span>
          <span
            className="px-1.5 py-0.5 rounded-full"
            style={{
              background: 'rgba(212,168,67,0.12)',
              color: '#d4a843',
              fontSize: '0.55rem',
              fontWeight: 700,
              fontFamily: '"Cinzel", serif',
            }}
          >
            {playerQuestCount}
          </span>
        </div>
        <button
          onClick={handleDistributeRandomQuest}
          disabled={unassignedQuestsForPlayer.length === 0}
          className="px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer hover:brightness-110"
          style={{
            background: unassignedQuestsForPlayer.length > 0 ? 'rgba(212,168,67,0.1)' : 'rgba(128,128,128,0.06)',
            border: `1px solid ${unassignedQuestsForPlayer.length > 0 ? 'rgba(212,168,67,0.3)' : 'rgba(128,128,128,0.15)'}`,
            color: unassignedQuestsForPlayer.length > 0 ? '#d4a843' : '#4a5568',
            fontSize: '0.65rem',
            fontFamily: '"Cinzel", serif',
            opacity: unassignedQuestsForPlayer.length === 0 ? 0.5 : 1,
          }}
        >
          <Dices size={12} />
          Distribuer une quête
        </button>
      </div>

      {/* Role Description */}
      <div className="rounded-xl p-4 mb-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <SectionHeader icon={<BookOpen size={14} />} title="Role & Pouvoir" t={t} />
        <p style={{ color: '#8090b0', fontSize: '0.75rem', lineHeight: 1.5, marginTop: '0.5rem' }}>{selectedRole.description}</p>
        <p style={{ color: t.textMuted, fontSize: '0.65rem', marginTop: '0.5rem', fontStyle: 'italic' }}>{selectedRole.power}</p>
      </div>

      {/* Night Actions Summary */}
      {isNight && state.nightStep === 'active' && selectedPlayerData.alive && (
        <div className="rounded-xl p-4 mb-5" style={{ background: 'rgba(124,141,181,0.04)', border: '1px solid rgba(124,141,181,0.12)' }}>
          <SectionHeader icon={<Moon size={14} />} title="Actions nocturnes" t={t} />
          <div className="space-y-2 mt-3">
            {isWolf && (<div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: myWolfVote !== null ? 'rgba(107,142,90,0.06)' : 'rgba(196,30,58,0.04)', border: `1px solid ${myWolfVote !== null ? 'rgba(107,142,90,0.15)' : 'rgba(196,30,58,0.1)'}` }}><span className="text-lg">🐺</span><div className="flex-1 min-w-0"><span style={{ fontFamily: '"Cinzel", serif', color: '#c41e3a', fontSize: '0.75rem' }}>Vote de meute</span><p className="truncate" style={{ color: t.textMuted, fontSize: '0.6rem', marginTop: '0.1rem' }}>{myWolfTarget ? `Cible: ${myWolfTarget.name}` : 'En attente de vote'}</p></div>{myWolfVote !== null ? (<div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(107,142,90,0.15)' }}><Check size={12} style={{ color: '#6b8e5a' }} /></div>) : (<div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: `rgba(${t.overlayChannel}, 0.04)` }}><Clock size={12} style={{ color: t.textMuted }} /></div>)}</div>)}
            {isSeer && (<div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: state.seerTargets?.[selectedPlayerData.id] !== undefined ? 'rgba(107,142,90,0.06)' : 'rgba(138,180,248,0.04)', border: `1px solid ${state.seerTargets?.[selectedPlayerData.id] !== undefined ? 'rgba(107,142,90,0.15)' : 'rgba(138,180,248,0.1)'}` }}><span className="text-lg">🔮</span><div className="flex-1 min-w-0"><span style={{ fontFamily: '"Cinzel", serif', color: '#8ab4f8', fontSize: '0.75rem' }}>Vision</span><p className="truncate" style={{ color: t.textMuted, fontSize: '0.6rem', marginTop: '0.1rem' }}>{seerTarget ? `Sonde: ${seerTarget.name}${seerResultRole ? ` → ${seerResultRole.emoji} ${seerResultRole.name}` : ''}` : 'En attente de la vision'}</p></div>{state.seerTargets?.[selectedPlayerData.id] !== undefined ? (<div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(107,142,90,0.15)' }}><Check size={12} style={{ color: '#6b8e5a' }} /></div>) : (<div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: `rgba(${t.overlayChannel}, 0.04)` }}><Clock size={12} style={{ color: t.textMuted }} /></div>)}</div>)}
            {isWitch && (() => { const myHealUsed = (state.witchHealUsedBy || []).includes(selectedPlayerData.id); const myKillUsed = (state.witchKillUsedBy || []).includes(selectedPlayerData.id); const myKillTarget = state.witchKillTargets?.[selectedPlayerData.id] ?? null; const myHealedThisNight = !!(state.witchHealedThisNight || {})[selectedPlayerData.id]; const witchActed = myHealedThisNight || myKillTarget !== null; return (<div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: witchActed ? 'rgba(107,142,90,0.06)' : 'rgba(167,130,227,0.04)', border: `1px solid ${witchActed ? 'rgba(107,142,90,0.15)' : 'rgba(167,130,227,0.1)'}` }}><span className="text-lg">🧙‍♀️</span><div className="flex-1 min-w-0"><span style={{ fontFamily: '"Cinzel", serif', color: '#a782e3', fontSize: '0.75rem' }}>Potions</span><p className="truncate" style={{ color: t.textMuted, fontSize: '0.6rem', marginTop: '0.1rem' }}>{`${!myHealUsed ? '🟢 Guerison' : '🔴 Guerison'} · ${!myKillUsed || myKillTarget !== null ? '🟢 Poison' : '🔴 Poison'}`}{myHealedThisNight ? ' — Guerison utilisee' : ''}{myKillTarget !== null ? ` — Poison: ${state.players.find((p: Player) => p.id === myKillTarget)?.name || '?'}` : ''}</p></div>{witchActed ? (<div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(107,142,90,0.15)' }}><Check size={12} style={{ color: '#6b8e5a' }} /></div>) : (<div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: `rgba(${t.overlayChannel}, 0.04)` }}><Clock size={12} style={{ color: t.textMuted }} /></div>)}</div>); })()}
            {isCupid && (() => { const myCupidLinked = (state.cupidLinkedBy || []).includes(selectedPlayerData.id); return (<div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: myCupidLinked ? 'rgba(107,142,90,0.06)' : 'rgba(236,72,153,0.04)', border: `1px solid ${myCupidLinked ? 'rgba(107,142,90,0.15)' : 'rgba(236,72,153,0.1)'}` }}><span className="text-lg">💘</span><div className="flex-1 min-w-0"><span style={{ fontFamily: '"Cinzel", serif', color: '#ec4899', fontSize: '0.75rem' }}>Lien d'amour</span><p className="truncate" style={{ color: t.textMuted, fontSize: '0.6rem', marginTop: '0.1rem' }}>{myCupidLinked ? (() => { const pairs = state.loverPairs || []; const pair = pairs.length > 0 ? pairs[pairs.length - 1] : null; const l1 = pair ? state.players.find((p: Player) => p.id === pair[0]) : null; const l2 = pair ? state.players.find((p: Player) => p.id === pair[1]) : null; return `${l1?.name || '?'} ❤️ ${l2?.name || '?'}`; })() : 'En attente du lien'}</p></div>{myCupidLinked ? (<div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(107,142,90,0.15)' }}><Check size={12} style={{ color: '#6b8e5a' }} /></div>) : (<div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: `rgba(${t.overlayChannel}, 0.04)` }}><Clock size={12} style={{ color: t.textMuted }} /></div>)}</div>); })()}
            {isGuard && (() => { const myGuardTarget = state.guardTargets?.[selectedPlayerData.id] ?? null; const myGuardLast = state.guardLastTargets?.[selectedPlayerData.id] ?? null; return (<div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: myGuardTarget !== null ? 'rgba(107,142,90,0.06)' : 'rgba(59,130,246,0.04)', border: `1px solid ${myGuardTarget !== null ? 'rgba(107,142,90,0.15)' : 'rgba(59,130,246,0.1)'}` }}><span className="text-lg">🛡️</span><div className="flex-1 min-w-0"><span style={{ fontFamily: '"Cinzel", serif', color: '#3b82f6', fontSize: '0.75rem' }}>Protection</span><p className="truncate" style={{ color: t.textMuted, fontSize: '0.6rem', marginTop: '0.1rem' }}>{myGuardTarget !== null ? `Protege: ${state.players.find((p: Player) => p.id === myGuardTarget)?.name || '?'}` : 'En attente de la protection'}{myGuardLast !== null && ` (Interdit: ${state.players.find((p: Player) => p.id === myGuardLast)?.name || '?'})`}</p></div>{myGuardTarget !== null ? (<div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(107,142,90,0.15)' }}><Check size={12} style={{ color: '#6b8e5a' }} /></div>) : (<div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: `rgba(${t.overlayChannel}, 0.04)` }}><Clock size={12} style={{ color: t.textMuted }} /></div>)}</div>); })()}
            {selectedPlayerData.role === 'corbeau' && (() => { const myCorbeauTarget = (state.corbeauTargets ?? {})[selectedPlayerData.id] ?? null; const targetPlayer2 = myCorbeauTarget !== null ? state.players.find((p: Player) => p.id === myCorbeauTarget) : null; const myCorbeauMsg = (state.corbeauMessages ?? {})[selectedPlayerData.id] || ''; return (<div className="rounded-lg p-3" style={{ background: myCorbeauTarget !== null ? 'rgba(107,142,90,0.06)' : 'rgba(74,54,96,0.04)', border: `1px solid ${myCorbeauTarget !== null ? 'rgba(107,142,90,0.15)' : 'rgba(74,54,96,0.1)'}` }}><div className="flex items-center gap-3"><span className="text-lg">🐦‍⬛</span><div className="flex-1 min-w-0"><span style={{ fontFamily: '"Cinzel", serif', color: '#4a3660', fontSize: '0.75rem' }}>Indice corrompu</span><p className="truncate" style={{ color: t.textMuted, fontSize: '0.6rem', marginTop: '0.1rem' }}>{myCorbeauTarget !== null ? `→ ${targetPlayer2?.name || '?'}` : 'En attente de l\'indice'}</p></div>{myCorbeauTarget !== null ? (<div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(107,142,90,0.15)' }}><Check size={12} style={{ color: '#6b8e5a' }} /></div>) : (<div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: `rgba(${t.overlayChannel}, 0.04)` }}><Clock size={12} style={{ color: t.textMuted }} /></div>)}</div>{myCorbeauMsg && (<div className="mt-2 ml-9 rounded px-2.5 py-1.5" style={{ background: 'rgba(74,54,96,0.06)', border: '1px dashed rgba(74,54,96,0.15)' }}><p style={{ color: '#4a3660', fontSize: '0.55rem', fontStyle: 'italic', fontFamily: '"IM Fell English", serif' }}>"{myCorbeauMsg}"</p></div>)}</div>); })()}
            {isHunter && (() => { const hunterPT = (state.hunterPreTargets || {})[selectedPlayerData.id] ?? null; const hunterPTPlayer = hunterPT !== null ? state.players.find((p: Player) => p.id === hunterPT) : null; return (<div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'rgba(217,119,6,0.04)', border: '1px solid rgba(217,119,6,0.1)' }}><span className="text-lg">🏹</span><div className="flex-1"><span style={{ fontFamily: '"Cinzel", serif', color: '#d97706', fontSize: '0.75rem' }}>Dernier souffle</span>{hunterPTPlayer ? (<p style={{ color: '#d97706', fontSize: '0.6rem', marginTop: '0.1rem', opacity: 0.8 }}>Cible : <strong>{hunterPTPlayer.name}</strong></p>) : (<p style={{ color: t.textMuted, fontSize: '0.6rem', marginTop: '0.1rem' }}>Aucune cible selectionnee</p>)}</div></div>); })()}
            {selectedPlayerData.role === 'villageois' && (<div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: `rgba(${t.overlayChannel}, 0.02)`, border: `1px solid rgba(${t.overlayChannel}, 0.05)` }}><Moon size={16} style={{ color: t.textDim }} /><p style={{ color: t.textMuted, fontSize: '0.65rem' }}>Aucune action nocturne — le village dort.</p></div>)}
          </div>
        </div>
      )}

      {/* Guard Target Selection */}
      {isGuard && isNight && state.nightStep === 'active' && selectedPlayerData.alive && (
        <div className="rounded-xl p-4 mb-5" style={{ background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.15)' }}>
          <SectionHeader icon={<Shield size={14} />} title="Protection du Garde" t={t} />
          <p style={{ color: t.textMuted, fontSize: '0.6rem', marginTop: '0.35rem', marginBottom: '0.75rem', lineHeight: 1.5 }}>Choisissez un joueur a proteger cette nuit.{(state.guardLastTargets?.[selectedPlayerData.id] ?? null) !== null && (<span style={{ color: '#ef4444' }}>{' '}Interdit : {state.players.find((p: Player) => p.id === state.guardLastTargets?.[selectedPlayerData.id])?.name || '?'} (nuit precedente).</span>)}<span style={{ color: '#ef4444' }}> Ne peut pas se proteger lui-meme.</span></p>
          <div className="grid grid-cols-3 gap-2">
            {alivePlayers.filter((p: Player) => p.id !== selectedPlayerData.id && p.id !== (state.guardLastTargets?.[selectedPlayerData.id] ?? null)).map((p: Player) => { const isSelG = state.guardTargets?.[selectedPlayerData.id] === p.id; return (<button key={p.id} onClick={() => setGuardTarget(selectedPlayerData.id, isSelG ? null : p.id)} className="flex flex-col items-center gap-1 p-2 rounded-lg transition-all" style={{ background: isSelG ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.02)', border: `1px solid ${isSelG ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.06)'}`, cursor: 'pointer' }}><GMAvatar player={p} size="text-lg" /><span style={{ fontSize: '0.55rem', color: isSelG ? '#3b82f6' : t.textMuted, fontWeight: isSelG ? 600 : 400, textAlign: 'center', lineHeight: 1.2 }}>{p.name}</span>{isSelG && (<span style={{ fontSize: '0.5rem', color: '#3b82f6' }}>🛡️ Protege</span>)}</button>); })}
          </div>
        </div>
      )}

      {/* Day Vote Status */}
      {!isNight && state.dayStep === 'vote' && selectedPlayerData.alive && (
        <div className="rounded-xl p-4 mb-5" style={{ background: 'rgba(212,168,67,0.03)', border: '1px solid rgba(212,168,67,0.12)' }}>
          <SectionHeader icon={!state.maireElectionDone && state.turn === 1 ? <Crown size={14} /> : <Vote size={14} />} title={!state.maireElectionDone && state.turn === 1 ? 'Election du Maire' : 'Vote du village'} t={t} />
          <div className="mt-3 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            {myDayTarget ? (<div className="flex items-center gap-3"><Check size={14} style={{ color: '#6b8e5a' }} /><span style={{ color: '#6b8e5a', fontSize: '0.75rem', fontFamily: '"Cinzel", serif' }}>A vote pour :</span><GMAvatar player={myDayTarget} size="text-sm" className="inline-block" /><span style={{ color: t.text, fontSize: '0.75rem' }}>{myDayTarget.name}</span></div>) : (<div className="flex items-center gap-3"><Clock size={14} style={{ color: t.textMuted }} /><span style={{ color: t.textMuted, fontSize: '0.75rem' }}>N'a pas encore vote</span></div>)}
          </div>
        </div>
      )}

      {/* Lovers info */}
      {state.loverPairs && state.loverPairs.some((pair: [number, number]) => pair.includes(selectedPlayerData.id)) && (
        <div className="rounded-xl p-4 mb-5" style={{ background: 'rgba(236,72,153,0.04)', border: '1px solid rgba(236,72,153,0.15)' }}>
          <div className="flex items-center gap-2"><Heart size={14} style={{ color: '#ec4899', fill: '#ec4899' }} /><span style={{ color: '#ec4899', fontSize: '0.8rem', fontFamily: '"Cinzel", serif' }}>Amoureux</span></div>
          <p style={{ color: '#8090b0', fontSize: '0.7rem', marginTop: '0.5rem' }}>Lie avec{' '}{(() => { const pair = (state.loverPairs || []).find((p: [number, number]) => p.includes(selectedPlayerData.id)); const loverId = pair ? (pair[0] === selectedPlayerData.id ? pair[1] : pair[0]) : null; const lover = state.players.find((p: Player) => p.id === loverId); return lover ? <><GMAvatar player={lover} size="text-sm" className="inline-block align-middle mx-0.5" /><strong style={{ color: '#ec4899' }}>{lover.name}</strong></> : '?'; })()}{' '}— si l'un meurt, l'autre aussi.</p>
        </div>
      )}

      {/* Player Hypotheses */}
      <div className="rounded-xl p-4 mb-5" style={{ background: 'rgba(138,92,246,0.03)', border: '1px solid rgba(138,92,246,0.12)' }}>
        <div className="flex items-center justify-between mb-2">
          <SectionHeader icon={<Eye size={14} />} title="Hypotheses du joueur" t={t} />
          <button onClick={() => { if (selectedPlayerData?.shortCode && state.gameId) fetchPlayerHypotheses(selectedPlayerData.shortCode, state.gameId, false); }} className="p-1.5 rounded-lg transition-colors hover:bg-white/[0.05]" title="Rafraichir les hypotheses"><RefreshCw size={12} style={{ color: '#8b5cf6' }} /></button>
        </div>
        {hypothesesLoading ? (<div className="flex items-center gap-2 py-3"><Clock size={12} style={{ color: '#6b7b9b' }} /><span style={{ color: '#6b7b9b', fontSize: '0.7rem' }}>Chargement...</span></div>) : (() => {
          const entries = Object.entries(playerHypotheses).filter(([, roleId]) => roleId);
          if (entries.length === 0) return (<div className="py-3 text-center"><p style={{ color: '#4a5568', fontSize: '0.7rem' }}>Aucune hypothese enregistree</p></div>);
          return (<div className="grid grid-cols-2 gap-2 mt-3">{entries.map(([targetIdStr, roleId]) => { const targetId = parseInt(targetIdStr); const tp = state.players.find((p: Player) => p.id === targetId); const guessedRole = getRoleById(roleId); if (!tp || !guessedRole) return null; const actualRole = getRoleById(tp.role); const isCorrect = tp.role === roleId; return (<div key={targetId} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: isCorrect ? 'rgba(107,142,90,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${isCorrect ? 'rgba(107,142,90,0.15)' : 'rgba(255,255,255,0.05)'}` }}><div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: `${guessedRole.color}12`, border: `1px solid ${guessedRole.color}30` }}><GMAvatar player={tp} size="text-sm" /></div><div className="flex-1 min-w-0"><p className="truncate" style={{ color: t.text, fontSize: '0.65rem' }}>{tp.name}</p><div className="flex items-center gap-1"><span style={{ fontSize: '0.55rem' }}>{guessedRole.emoji}</span><span style={{ color: guessedRole.color, fontSize: '0.55rem' }}>{guessedRole.name}</span>{isCorrect && <Check size={9} style={{ color: '#6b8e5a', marginLeft: '2px' }} />}</div></div>{actualRole && actualRole.id !== guessedRole.id && (<div className="shrink-0" title={`Role reel: ${actualRole.name}`}><span style={{ fontSize: '0.5rem', color: '#4a5568' }}>({actualRole.emoji})</span></div>)}</div>); })}</div>);
        })()}
      </div>

      {/* Player Quests */}
      <div className="rounded-xl p-4 mb-5" style={{ background: 'rgba(212,168,67,0.03)', border: '1px solid rgba(212,168,67,0.12)' }}>
        <SectionHeader icon={<Star size={14} />} title="Quêtes" t={t} />
        <div className="space-y-2.5 mt-3">
          {buildQuests(selectedPlayerData, selectedRole, state, alivePlayers).map((quest) => (<div key={quest.id} className="rounded-lg p-3" style={{ background: `${quest.color}06`, border: `1px solid ${quest.color}15` }}><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${quest.color}12` }}><span className="text-base">{quest.emoji}</span></div><div className="flex-1 min-w-0"><div className="flex items-center justify-between"><h4 style={{ fontFamily: '"Cinzel", serif', color: quest.color, fontSize: '0.75rem' }}>{quest.title}</h4><span style={{ color: t.textMuted, fontSize: '0.6rem' }}>{quest.detail}</span></div><p style={{ color: t.textMuted, fontSize: '0.6rem', marginTop: '0.1rem' }}>{quest.description}</p><div className="mt-1.5 flex items-center gap-2"><div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: `rgba(${t.overlayChannel}, 0.05)` }}><motion.div className="h-full rounded-full" style={{ background: quest.color }} initial={{ width: 0 }} animate={{ width: `${Math.min(quest.progress, 100)}%` }} transition={{ duration: 0.8 }} /></div></div></div></div></div>))}
        </div>
      </div>

      {/* Player Hints */}
      <div className="rounded-xl p-4 mb-5" style={{ background: 'rgba(59,130,246,0.03)', border: '1px solid rgba(59,130,246,0.12)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SectionHeader icon={<Lightbulb size={14} />} title="Indices recus" t={t} />
            <span
              className="px-1.5 py-0.5 rounded-full"
              style={{
                background: 'rgba(59,130,246,0.12)',
                color: '#60a5fa',
                fontSize: '0.55rem',
                fontWeight: 700,
                fontFamily: '"Cinzel", serif',
              }}
            >
              {playerHintEntries.length}
            </span>
          </div>
          <button
            onClick={handleGrantHint}
            disabled={grantingHint || availableDynamicHintCount === 0}
            className="px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer hover:brightness-110"
            style={{
              background: availableDynamicHintCount > 0 && !grantingHint
                ? 'rgba(59,130,246,0.1)'
                : 'rgba(128,128,128,0.06)',
              border: `1px solid ${availableDynamicHintCount > 0 && !grantingHint
                ? 'rgba(59,130,246,0.3)'
                : 'rgba(128,128,128,0.15)'}`,
              color: availableDynamicHintCount > 0 && !grantingHint ? '#60a5fa' : '#4a5568',
              fontSize: '0.65rem',
              fontFamily: '"Cinzel", serif',
              opacity: availableDynamicHintCount === 0 || grantingHint ? 0.5 : 1,
            }}
          >
            {grantingHint ? (
              <><div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /> Distribution...</>
            ) : grantHintResult === 'success' ? (
              <><Check size={12} /> Distribue !</>
            ) : (
              <><Send size={12} /> Distribuer un indice</>
            )}
          </button>
        </div>

        {grantHintResult === 'empty' && (
          <div className="mt-2 px-3 py-1.5 rounded-lg flex items-center gap-1.5" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <span style={{ color: '#ef4444', fontSize: '0.6rem' }}>Aucun indice dynamique disponible pour ce joueur.</span>
          </div>
        )}

        <div className="space-y-2 mt-3">
          {playerHintEntries.length === 0 ? (
            <div className="py-3 text-center">
              <p style={{ color: '#4a5568', fontSize: '0.7rem' }}>Aucun indice recu</p>
            </div>
          ) : (
            playerHintEntries.map((entry) => {
              const { hint } = entry;
              const timeStr = hint.createdAt
                ? new Date(hint.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                : '';
              return (
                <div
                  key={`${hint.id}-${entry.sentAt}`}
                  className="flex items-start gap-3 rounded-lg p-3"
                  style={{
                    background: entry.revealed
                      ? 'rgba(107,142,90,0.04)'
                      : 'rgba(59,130,246,0.04)',
                    border: `1px solid ${entry.revealed
                      ? 'rgba(107,142,90,0.12)'
                      : 'rgba(59,130,246,0.1)'}`,
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{
                      background: entry.revealed
                        ? 'rgba(107,142,90,0.12)'
                        : 'rgba(59,130,246,0.1)',
                    }}
                  >
                    {entry.revealed ? (
                      <Eye size={13} style={{ color: '#6b8e5a' }} />
                    ) : (
                      <Lightbulb size={13} style={{ color: '#60a5fa' }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {hint.text && (
                      <p
                        className="break-words"
                        style={{
                          color: t.text,
                          fontSize: '0.7rem',
                          fontStyle: 'italic',
                          fontFamily: '"IM Fell English", serif',
                          lineHeight: 1.5,
                        }}
                      >
                        &ldquo;{hint.text}&rdquo;
                      </p>
                    )}
                    {hint.imageUrl && (
                      <img
                        src={hint.imageUrl}
                        alt="Indice"
                        className="mt-1.5 rounded-lg max-h-24 object-cover"
                        style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                      />
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span
                        className="px-1.5 py-0.5 rounded-full"
                        style={{
                          background: entry.revealed ? 'rgba(107,142,90,0.1)' : 'rgba(255,255,255,0.04)',
                          color: entry.revealed ? '#6b8e5a' : t.textDim,
                          fontSize: '0.5rem',
                          fontWeight: 600,
                        }}
                      >
                        {entry.revealed ? 'Lu' : 'Non lu'}
                      </span>
                      {timeStr && (
                        <span style={{ color: t.textDim, fontSize: '0.5rem' }}>{timeStr}</span>
                      )}
                      {hint.fromDynamic && (
                        <span
                          className="px-1.5 py-0.5 rounded-full"
                          style={{
                            background: 'rgba(168,85,247,0.08)',
                            color: '#a78bfa',
                            fontSize: '0.45rem',
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
            })
          )}
        </div>
        {availableDynamicHintCount > 0 && (
          <p className="mt-2" style={{ color: t.textDim, fontSize: '0.55rem', textAlign: 'right' }}>
            {availableDynamicHintCount} indice{availableDynamicHintCount > 1 ? 's' : ''} dynamique{availableDynamicHintCount > 1 ? 's' : ''} disponible{availableDynamicHintCount > 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* ── Away toggle ── */}
      {selectedPlayerData.alive && (() => {
        const presentIds = state.villagePresentIds || state.players.filter((p: Player) => p.alive).map((p: Player) => p.id);
        const isAway = !presentIds.includes(selectedPlayerData.id);
        return (
          <div className="rounded-xl p-4 mb-5" style={{ background: isAway ? 'rgba(245,158,11,0.05)' : 'rgba(255,255,255,0.02)', border: `1px solid ${isAway ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)'}` }}>
            <button
              onClick={() => {
                updateState((s) => {
                  const current = s.villagePresentIds || s.players.filter((p: Player) => p.alive).map((p: Player) => p.id);
                  const away = !current.includes(selectedPlayerData.id);
                  return {
                    ...s,
                    villagePresentIds: away
                      ? [...current, selectedPlayerData.id]
                      : current.filter((id: number) => id !== selectedPlayerData.id),
                  };
                });
              }}
              className="w-full flex items-center justify-between gap-3 group cursor-pointer"
            >
              <div className="flex items-center gap-2">
                {isAway ? <UserX size={14} style={{ color: '#f59e0b' }} /> : <UserCheck size={14} style={{ color: '#6b8e5a' }} />}
                <span style={{ fontFamily: '"Cinzel", serif', color: isAway ? '#f59e0b' : t.text, fontSize: '0.75rem', fontWeight: 600 }}>
                  {isAway ? 'Absent' : 'Présent'}
                </span>
              </div>
              <div
                className="w-10 h-5 rounded-full relative transition-colors"
                style={{ background: isAway ? 'rgba(245,158,11,0.3)' : 'rgba(107,142,90,0.3)' }}
              >
                <div
                  className="w-4 h-4 rounded-full absolute top-0.5 transition-all"
                  style={{
                    background: isAway ? '#f59e0b' : '#6b8e5a',
                    left: isAway ? '2px' : '22px',
                  }}
                />
              </div>
            </button>
            <p style={{ color: t.textMuted, fontSize: '0.6rem', marginTop: '0.5rem' }}>
              {isAway ? 'Ce joueur est marqué comme absent du village.' : 'Ce joueur est présent au village.'}
            </p>
          </div>
        );
      })()}

      {/* Avatar Gallery Modal */}
      <AvatarGalleryModal
        open={showAvatarGallery}
        onClose={() => setShowAvatarGallery(false)}
        onSelect={handleGallerySelect}
        currentAvatarUrl={selectedPlayerData.avatarUrl}
        playerName={selectedPlayerData.name}
      />
    </div>
  );
}