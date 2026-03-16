import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, CheckCircle, XCircle, Clock, Users,
  Handshake, ThumbsUp, ThumbsDown, Eye, Lightbulb,
  ShieldAlert, Hourglass, X as XIcon, Shield, HelpCircle,
} from 'lucide-react';
import type { GameState, Quest, QuestStatus } from '../../../context/gameTypes';
import type { GameThemeTokens } from '../../../context/gameTheme';
import { PAvatar } from './PAvatar';

interface PlayerCollabQuestPageProps {
  quest: Quest;
  state: GameState;
  currentPlayerId: number;
  onBack: () => void;
  onCollabVote: (questId: number, vote: boolean) => void;
  onCancelCollabVote: (questId: number) => void;
  onNavigateToPlayer?: (playerId: number) => void;
  t: GameThemeTokens;
}

// ── Palettes (same as PlayerQuestsPanel / PlayerQuestTasksPage) ──
type CardPalette = {
  bg: string; bgOverlay: string; headerBg: string; border: string; borderLight: string; borderDark: string;
  title: string; text: string; textDim: string; divider: string; insetBg: string; insetBorder: string;
  accent: string; accentBg: string; accentBorder: string; accentDark: string;
  decorLine: string; cardShadow: string;
  collabBg: string; collabBorder: string; collabText: string;
};

const DAY_PALETTE: CardPalette = {
  bg: '#f5eed9', bgOverlay: 'none', headerBg: '#c9b48a',
  border: '#d8ccac', borderLight: '#c8b890', borderDark: '#b8a880',
  title: '#2a2010', text: '#4a3f30', textDim: '#8a7e65',
  divider: 'rgba(180,155,85,0.35)', insetBg: 'rgba(0,0,0,0.025)', insetBorder: 'rgba(160,140,90,0.18)',
  accent: '#9a8045', accentBg: 'rgba(154,128,69,0.1)', accentBorder: 'rgba(154,128,69,0.4)', accentDark: '#2a2010',
  decorLine: 'linear-gradient(90deg, transparent, rgba(180,150,70,0.5), transparent)',
  cardShadow: '0 2px 10px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)',
  collabBg: 'rgba(80,105,155,0.08)', collabBorder: 'rgba(80,105,155,0.2)', collabText: '#556a90',
};

const NIGHT_PALETTE: CardPalette = {
  bg: 'linear-gradient(165deg, #222640 0%, #1c2038 30%, #171a32 70%, #11132a 100%)',
  bgOverlay: 'linear-gradient(180deg, rgba(140,160,220,0.05) 0%, rgba(100,120,200,0.01) 100%)',
  headerBg: 'rgba(14,16,32,0.65)',
  border: '#4a5280', borderLight: '#5a6498', borderDark: '#14162a',
  title: '#d0daf5', text: '#b0bdd8', textDim: '#7a88b5',
  divider: 'rgba(140,160,220,0.12)', insetBg: 'rgba(10,12,30,0.35)', insetBorder: 'rgba(140,160,220,0.08)',
  accent: '#8aa4d8', accentBg: 'rgba(138,164,216,0.12)', accentBorder: 'rgba(138,164,216,0.25)', accentDark: '#0e1020',
  decorLine: 'linear-gradient(90deg, transparent, rgba(140,160,220,0.2), transparent)',
  cardShadow: 'inset 0 1px 0 rgba(140,160,220,0.06), 0 4px 14px rgba(0,0,0,0.45), 0 0 20px rgba(80,100,180,0.06), 0 1px 3px rgba(0,0,0,0.3)',
  collabBg: 'rgba(120,140,200,0.15)', collabBorder: 'rgba(120,140,200,0.3)', collabText: '#a8b8e0',
};

function getCardPalette(phase: string): CardPalette {
  return phase === 'night' ? NIGHT_PALETTE : DAY_PALETTE;
}

function playerQuestStatus(quest: Quest, playerId: number): QuestStatus {
  return quest.playerStatuses?.[playerId] || 'active';
}

// ── GroupMemberChip ──
const GroupMemberChip = React.memo(({
  player,
  hasVoted,
  isMe,
  isNight,
  cp,
  isSabotaged,
  onNavigate,
}: {
  player: GameState['players'][0];
  hasVoted: boolean;
  isMe: boolean;
  isNight: boolean;
  cp: CardPalette;
  isSabotaged?: boolean;
  onNavigate?: () => void;
}) => (
  <motion.div
    whileTap={onNavigate ? { scale: 0.95 } : undefined}
    onClick={onNavigate}
    className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
    style={{
      background: isSabotaged
        ? isNight ? 'rgba(120,120,130,0.1)' : 'rgba(120,120,130,0.06)'
        : hasVoted
          ? isNight ? 'rgba(90,150,70,0.1)' : 'rgba(90,150,70,0.08)'
          : isNight ? 'rgba(106,122,176,0.1)' : 'rgba(80,105,155,0.06)',
      border: `1px solid ${isSabotaged
        ? isNight ? 'rgba(120,120,130,0.2)' : 'rgba(120,120,130,0.2)'
        : hasVoted
          ? isNight ? 'rgba(90,150,70,0.2)' : 'rgba(90,150,70,0.25)'
          : isNight ? 'rgba(106,122,176,0.15)' : 'rgba(80,105,155,0.15)'
      }`,
      cursor: onNavigate ? 'pointer' : 'default',
    }}
  >
    {/* Avatar */}
    <div className="w-7 h-7 shrink-0 rounded-full overflow-hidden" style={isSabotaged ? { opacity: 0.5, filter: 'grayscale(0.7)' } : undefined}>
      <PAvatar player={player} size="text-sm" />
    </div>

    {/* Name */}
    <div className="flex-1 min-w-0">
      <p
        className="truncate"
        style={{
          color: isSabotaged ? (isNight ? '#8a8a95' : '#8a8a90') : cp.title,
          fontSize: '0.82rem',
          fontWeight: 600,
        }}
      >
        {player.name}{isMe ? ' (toi)' : ''}
      </p>
      <p style={{
        color: isSabotaged
          ? isNight ? '#6a6a75' : '#9a9a9a'
          : hasVoted
            ? isNight ? '#7ac462' : '#5a8a46'
            : isNight ? '#9aabda' : '#7085b0',
        fontSize: '0.62rem',
        fontWeight: 500,
        marginTop: '1px',
      }}>
        {isSabotaged ? 'Vote inconnu' : hasVoted ? 'A voté' : 'En attente...'}
      </p>
    </div>

    {/* Status icon */}
    <div
      className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
      style={{
        background: isSabotaged
          ? isNight ? 'rgba(120,120,130,0.15)' : 'rgba(120,120,130,0.1)'
          : hasVoted
            ? isNight ? 'rgba(90,150,70,0.15)' : 'rgba(90,150,70,0.12)'
            : isNight ? 'rgba(106,122,176,0.12)' : 'rgba(80,105,155,0.08)',
        border: `1px solid ${isSabotaged
          ? isNight ? 'rgba(120,120,130,0.25)' : 'rgba(120,120,130,0.2)'
          : hasVoted
            ? isNight ? 'rgba(90,150,70,0.25)' : 'rgba(90,150,70,0.3)'
            : isNight ? 'rgba(106,122,176,0.2)' : 'rgba(80,105,155,0.18)'
        }`,
      }}
    >
      {isSabotaged ? (
        <HelpCircle size={14} style={{ color: isNight ? '#7a7a85' : '#9a9a9a' }} />
      ) : hasVoted ? (
        <CheckCircle size={14} style={{ color: isNight ? '#7ac462' : '#5a8a46' }} />
      ) : (
        <Hourglass size={13} style={{ color: isNight ? '#9aabda' : '#7085b0', opacity: 0.7 }} />
      )}
    </div>
  </motion.div>
));
GroupMemberChip.displayName = 'GroupMemberChip';

// ── Page ──
export const PlayerCollabQuestPage = React.memo(function PlayerCollabQuestPage({
  quest, state, currentPlayerId, onBack, onCollabVote, onCancelCollabVote, onNavigateToPlayer, t,
}: PlayerCollabQuestPageProps) {
  const pid = currentPlayerId;
  const cp = getCardPalette(state.phase);
  const isNight = state.phase === 'night';
  const myStatus = playerQuestStatus(quest, pid);
  const isResolved = myStatus === 'success' || myStatus === 'fail';
  const hasVoted = quest.collaborativeVotes?.[pid] !== undefined;

  const [confirmFailOpen, setConfirmFailOpen] = useState(false);

  // Group info
  const myGroup = useMemo(() =>
    (quest.collaborativeGroups || []).find(g => g.includes(pid)) || [],
    [quest.collaborativeGroups, pid]
  );
  const groupPlayers = useMemo(() =>
    myGroup.map(id => state.players.find(p => p.id === id)).filter(Boolean) as GameState['players'],
    [myGroup, state.players]
  );
  const votedCount = myGroup.filter(id => quest.collaborativeVotes?.[id] !== undefined).length;
  const totalCount = myGroup.length;

  // Reward hint
  const allHints = state.hints || [];
  const rewardHintId = quest.rewardHintIds?.[pid];
  const rewardHint = rewardHintId != null ? allHints.find(h => h.id === rewardHintId) : null;
  const hasRewardHint = myStatus === 'success' && !!rewardHint;

  // Progress ring values
  const progressPercent = totalCount > 0 ? (votedCount / totalCount) * 100 : 0;
  const circumference = 2 * Math.PI * 28;
  const dashOffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className="flex flex-col h-full relative">
      {/* ── Top bar ── */}
      <div
        className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ borderBottom: `1px solid ${cp.divider}` }}
      >
        <button
          onClick={onBack}
          className="flex items-center justify-center shrink-0 active:scale-95 transition-transform"
          style={{ color: t.gold }}
          aria-label="Retour"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 style={{
            fontFamily: '"Cinzel", serif',
            color: t.gold,
            fontSize: '0.9rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            Mission Collaborative
          </h2>
        </div>
        <div
          className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{
            background: isResolved
              ? (myStatus === 'success' ? 'rgba(90,150,70,0.15)' : 'rgba(200,60,60,0.12)')
              : 'rgba(120,140,200,0.12)',
            border: `1px solid ${isResolved
              ? (myStatus === 'success' ? 'rgba(90,150,70,0.3)' : 'rgba(200,60,60,0.25)')
              : 'rgba(120,140,200,0.25)'}`,
            color: isResolved
              ? (myStatus === 'success' ? '#7ac462' : '#e06060')
              : isNight ? '#a8b8e0' : '#556a90',
            fontSize: '0.65rem',
            fontWeight: 700,
            fontFamily: '"Cinzel", serif',
          }}
        >
          <Handshake size={12} />
          {isResolved
            ? (myStatus === 'success' ? 'Reussie' : 'Echouee')
            : `${votedCount}/${totalCount}`
          }
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-4">

          {/* ── Quest info card ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-xl overflow-hidden relative"
            style={{
              background: isNight
                ? 'linear-gradient(165deg, #222640 0%, #1c2038 60%, #171a32 100%)'
                : '#f5eed9',
              border: `1px solid ${isNight ? '#4a5280' : '#d8ccac'}`,
              boxShadow: cp.cardShadow,
            }}
          >
            {/* Top deco */}
            <div
              className="absolute top-0 left-3 right-3 h-px"
              style={{ background: cp.decorLine }}
            />

            {/* Header */}
            <div
              className="px-4 py-3 flex items-center gap-3"
              style={{ background: cp.headerBg }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: isNight
                    ? 'linear-gradient(135deg, rgba(106,122,176,0.2), rgba(80,100,160,0.1))'
                    : 'linear-gradient(135deg, rgba(80,105,155,0.15), rgba(60,85,140,0.08))',
                  border: `1px solid ${isNight ? 'rgba(106,122,176,0.25)' : 'rgba(80,105,155,0.25)'}`,
                }}
              >
                <Handshake size={20} style={{ color: isNight ? '#9aabda' : '#556a90' }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 style={{
                  fontFamily: '"Cinzel", serif',
                  color: cp.title,
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  lineHeight: 1.3,
                  textShadow: isNight ? '0 1px 2px rgba(0,0,0,0.4)' : 'none',
                }}>
                  {quest.title}
                </h3>
              </div>
            </div>

            {/* Body */}
            <div className="px-4 py-3.5">
              <p style={{
                color: cp.text,
                fontSize: '0.8rem',
                lineHeight: 1.6,
              }}>
                {quest.description}
              </p>
            </div>
          </motion.div>

          {/* ── Result banner ── */}
          {isResolved && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, delay: 0.1 }}
              className="rounded-xl p-4 flex items-center gap-3"
              style={{
                background: myStatus === 'success'
                  ? 'rgba(90,150,70,0.12)'
                  : 'rgba(200,60,60,0.1)',
                border: `1px solid ${myStatus === 'success'
                  ? 'rgba(90,150,70,0.25)'
                  : 'rgba(200,60,60,0.2)'}`,
              }}
            >
              {myStatus === 'success'
                ? <CheckCircle size={22} style={{ color: '#7ac462' }} />
                : <XCircle size={22} style={{ color: '#e06060' }} />
              }
              <div>
                <p style={{
                  fontFamily: '"Cinzel", serif',
                  color: myStatus === 'success' ? '#7ac462' : '#e06060',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                }}>
                  {myStatus === 'success' ? 'Mission Reussie !' : 'Mission Sabotee'}
                </p>
                <p style={{ color: cp.textDim, fontSize: '0.65rem', marginTop: '2px' }}>
                  {myStatus === 'success'
                    ? 'Votre equipe a accompli la mission avec succes.'
                    : 'Un membre de votre groupe a fait echouer la mission.'
                  }
                </p>
              </div>
            </motion.div>
          )}

          {/* ── Reward hint ── */}
          {hasRewardHint && rewardHint && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15 }}
              className="rounded-xl p-3.5 flex items-start gap-2.5"
              style={{
                background: 'rgba(212,168,67,0.08)',
                border: '1px solid rgba(212,168,67,0.2)',
              }}
            >
              <Lightbulb size={18} className="shrink-0 mt-0.5" style={{ color: '#d4a843' }} />
              <div className="flex-1 min-w-0">
                <p style={{
                  fontFamily: '"Cinzel", serif',
                  color: '#d4a843',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  marginBottom: '0.25rem',
                }}>
                  Indice obtenu :
                </p>
                {rewardHint.text && (
                  <p style={{
                    color: cp.title,
                    fontSize: '0.8rem',
                    fontFamily: '"MedievalSharp", serif',
                    fontStyle: 'italic',
                    lineHeight: 1.5,
                  }}>
                    {rewardHint.text}
                  </p>
                )}
                {rewardHint.imageUrl && (
                  <img
                    src={rewardHint.imageUrl}
                    alt="Indice"
                    className="rounded-lg max-h-40 object-contain mt-1"
                    style={{ border: '1px solid rgba(212,168,67,0.2)' }}
                  />
                )}
              </div>
            </motion.div>
          )}

          {/* Sabotaged hint for failed quests */}
          {myStatus === 'fail' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15 }}
              className="rounded-xl p-3.5 flex items-start gap-2.5"
              style={{
                background: 'rgba(180,60,60,0.08)',
                border: '1px solid rgba(180,60,60,0.22)',
              }}
            >
              <span className="shrink-0 text-lg leading-none mt-0.5" aria-hidden="true">🐺</span>
              <div className="flex-1 min-w-0">
                <p style={{
                  fontFamily: '"Cinzel", serif',
                  color: isNight ? '#e08080' : '#9a4040',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  marginBottom: '0.25rem',
                }}>
                  Indice sabote
                </p>
                <p style={{
                  color: cp.textDim,
                  fontSize: '0.75rem',
                  lineHeight: 1.5,
                  fontStyle: 'italic',
                }}>
                  L'indice lie a cette mission a ete perdu a cause du sabotage.
                </p>
              </div>
            </motion.div>
          )}

          {/* ── Group progress section ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.12 }}
            className="rounded-xl overflow-hidden"
            style={{
              background: isNight
                ? 'rgba(18,20,42,0.55)'
                : 'rgba(0,0,0,0.025)',
              border: `1px solid ${cp.insetBorder}`,
            }}
          >
            {/* Section header */}
            <div
              className="flex items-center justify-between px-4 py-2.5"
              style={{ borderBottom: `1px solid ${cp.divider}` }}
            >
              <div className="flex items-center gap-2">
                <Users size={14} style={{ color: isNight ? '#9aabda' : '#7085b0' }} />
                <span style={{
                  fontFamily: '"Cinzel", serif',
                  color: cp.title,
                  fontSize: '0.78rem',
                  fontWeight: 700,
                }}>
                  Ton groupe
                </span>
                <span
                  className="px-1.5 py-0.5 rounded-md"
                  style={{
                    background: isNight ? 'rgba(106,122,176,0.1)' : 'rgba(80,105,155,0.06)',
                    border: `1px solid ${isNight ? 'rgba(106,122,176,0.15)' : 'rgba(80,105,155,0.12)'}`,
                    color: cp.textDim,
                    fontSize: '0.58rem',
                    fontWeight: 600,
                  }}
                >
                  {totalCount} joueurs
                </span>
              </div>

              {/* Mini progress ring */}
              {!isResolved && (
                <div className="relative w-10 h-10 shrink-0">
                  <svg className="w-10 h-10 -rotate-90" viewBox="0 0 64 64">
                    <circle
                      cx="32" cy="32" r="28"
                      fill="none"
                      stroke={isNight ? 'rgba(106,122,176,0.12)' : 'rgba(80,105,155,0.1)'}
                      strokeWidth="4"
                    />
                    <motion.circle
                      cx="32" cy="32" r="28"
                      fill="none"
                      stroke={isNight ? '#7ac462' : '#5a8a46'}
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      initial={{ strokeDashoffset: circumference }}
                      animate={{ strokeDashoffset: dashOffset }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </svg>
                  <span
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                      color: isNight ? '#c5d0ee' : '#4a3f30',
                      fontSize: '0.58rem',
                      fontWeight: 700,
                    }}
                  >
                    {votedCount}/{totalCount}
                  </span>
                </div>
              )}
            </div>

            {/* Member list */}
            <div className="px-3 py-3 flex flex-col gap-2">
              {groupPlayers.map((player, idx) => {
                const mateHasVoted = quest.collaborativeVotes?.[player.id] !== undefined;
                const isMe = player.id === pid;
                return (
                  <motion.div
                    key={player.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, delay: idx * 0.05 }}
                  >
                    <GroupMemberChip
                      player={player}
                      hasVoted={mateHasVoted}
                      isMe={isMe}
                      isNight={isNight}
                      cp={cp}
                      isSabotaged={myStatus === 'fail'}
                      onNavigate={!isMe && onNavigateToPlayer ? () => onNavigateToPlayer(player.id) : undefined}
                    />
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* ── Pending resolution banner ── */}
          {myStatus === 'pending-resolution' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15 }}
              className="rounded-xl p-3.5 flex items-center gap-2.5"
              style={{
                background: 'rgba(245,179,66,0.1)',
                border: '1px solid rgba(245,179,66,0.2)',
              }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="shrink-0"
              >
                <Clock size={16} style={{ color: '#f5b342' }} />
              </motion.div>
              <p style={{ color: '#f5b342', fontSize: '0.75rem', lineHeight: 1.5 }}>
                Resolution en cours par le Maitre du Jeu
                <motion.span
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  ...
                </motion.span>
              </p>
            </motion.div>
          )}

          {/* ── Anonymous info card ── */}
          {!isResolved && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="rounded-xl p-3.5 flex items-start gap-2.5"
              style={{
                background: isNight ? 'rgba(140,160,220,0.06)' : 'rgba(80,105,155,0.04)',
                border: `1px solid ${isNight ? 'rgba(140,160,220,0.1)' : 'rgba(80,105,155,0.1)'}`,
              }}
            >
              <Shield size={15} className="shrink-0 mt-0.5" style={{ color: isNight ? '#9aabda' : '#7085b0' }} />
              <div className="flex-1 min-w-0">
                <p style={{
                  color: isNight ? '#b8c8e8' : '#556a90',
                  fontSize: '0.72rem',
                  lineHeight: 1.6,
                }}>
                  Les votes sont <strong style={{ color: isNight ? '#d0daf5' : '#3a4a60' }}>anonymes</strong>.
                  Un seul vote "echec" suffit pour saboter la mission. Personne ne saura qui a vote quoi.
                </p>
              </div>
            </motion.div>
          )}

          {/* Bottom spacing for vote buttons */}
          {!isResolved && <div className="h-2" />}
        </div>
      </div>

      {/* ── Sticky vote footer ── */}
      {!isResolved && myStatus === 'active' && !hasVoted && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.25 }}
          className="shrink-0 px-4 pb-4 pt-3 flex flex-col gap-2"
          style={{
            borderTop: `1px solid ${cp.divider}`,
            background: isNight
              ? 'linear-gradient(180deg, rgba(5,8,16,0) 0%, rgba(5,8,16,0.95) 30%)'
              : 'linear-gradient(180deg, rgba(245,238,217,0) 0%, rgba(245,238,217,0.95) 30%)',
          }}
        >
          <div className="flex items-center gap-3">
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={() => setConfirmFailOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl"
              style={{
                background: 'linear-gradient(135deg, rgba(140,80,80,0.2), rgba(120,90,90,0.1))',
                border: '1px solid rgba(160,100,100,0.35)',
                color: isNight ? '#c09090' : '#a08080',
                fontSize: '0.8rem',
                fontWeight: 700,
                fontFamily: '"Cinzel", serif',
              }}
            >
              <ThumbsDown size={16} />
              Echec
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={() => onCollabVote(quest.id, true)}
              className="flex-[1.5] flex items-center justify-center gap-2 px-4 py-3 rounded-xl"
              style={{
                background: 'linear-gradient(135deg, #b8860b 0%, #d4a843 60%, #c9a040 100%)',
                boxShadow: '0 3px 12px rgba(184,134,11,0.3), 0 1px 3px rgba(0,0,0,0.2)',
                color: '#1a1207',
                fontSize: '0.8rem',
                fontWeight: 700,
                fontFamily: '"Cinzel", serif',
                letterSpacing: '0.02em',
              }}
            >
              <ThumbsUp size={16} />
              Succes
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* ── Vote sent footer ── */}
      {!isResolved && hasVoted && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="shrink-0 px-4 pb-4 pt-3 flex items-center justify-between gap-3"
          style={{ borderTop: `1px solid ${cp.divider}` }}
        >
          <div
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl flex-1"
            style={{
              background: 'rgba(245,179,66,0.1)',
              border: '1px solid rgba(245,179,66,0.2)',
            }}
          >
            <CheckCircle size={16} style={{ color: '#f5b342' }} />
            <div>
              <p style={{
                color: '#f5b342',
                fontSize: '0.78rem',
                fontWeight: 700,
                fontFamily: '"Cinzel", serif',
              }}>
                Vote envoye
              </p>
              <p style={{
                color: cp.textDim,
                fontSize: '0.6rem',
                marginTop: '1px',
              }}>
                En attente des autres joueurs...
              </p>
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => onCancelCollabVote(quest.id)}
            className="flex items-center justify-center w-10 h-10 rounded-full shrink-0"
            style={{
              background: 'rgba(160,100,100,0.12)',
              border: '1px solid rgba(160,100,100,0.25)',
              color: isNight ? '#c09090' : '#b07070',
            }}
            title="Annuler mon vote"
            aria-label="Annuler mon vote"
          >
            <XIcon size={16} />
          </motion.button>
        </motion.div>
      )}

      {/* ── Confirm Fail Modal (portaled) ── */}
      {createPortal(
        <AnimatePresence>
          {confirmFailOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[200] flex items-center justify-center px-6"
              style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
              onClick={() => setConfirmFailOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 16 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="w-full max-w-sm rounded-2xl overflow-hidden relative"
                style={{
                  background: 'linear-gradient(165deg, #2a1520 0%, #1e1228 50%, #18132a 100%)',
                  border: '1px solid rgba(180,80,80,0.3)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 0 30px rgba(160,80,80,0.1)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Top decorative line */}
                <div
                  className="absolute top-0 left-4 right-4 h-px"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(180,80,80,0.4), transparent)' }}
                />

                <div className="flex flex-col items-center gap-4 px-6 py-6">
                  {/* Icon */}
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, rgba(180,80,80,0.2), rgba(140,60,60,0.1))',
                      border: '1px solid rgba(180,80,80,0.3)',
                    }}
                  >
                    <ShieldAlert size={26} style={{ color: '#c87070' }} />
                  </div>

                  {/* Title */}
                  <h3 style={{
                    fontFamily: '"Cinzel", serif',
                    color: '#e8c0c0',
                    fontSize: '1rem',
                    fontWeight: 700,
                    textAlign: 'center',
                    letterSpacing: '0.02em',
                  }}>
                    Saboter la mission ?
                  </h3>

                  {/* Description */}
                  <p style={{
                    color: '#b0a0a8',
                    fontSize: '0.78rem',
                    textAlign: 'center',
                    lineHeight: 1.6,
                  }}>
                    Tu es sur le point de faire echouer cette mission.
                  </p>

                  {/* Anonymous guarantee */}
                  <div
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg w-full"
                    style={{
                      background: 'rgba(140,160,220,0.08)',
                      border: '1px solid rgba(140,160,220,0.15)',
                    }}
                  >
                    <Eye size={15} style={{ color: '#9aabda', flexShrink: 0 }} />
                    <p style={{
                      color: '#b8c8e8',
                      fontSize: '0.72rem',
                      lineHeight: 1.5,
                      fontStyle: 'italic',
                    }}>
                      Ton choix est <strong style={{ color: '#d0daf5' }}>totalement anonyme</strong>. Personne ne saura que c'est toi qui as fait echouer la mission.
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 w-full mt-1">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setConfirmFailOpen(false)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        color: '#b0a8b0',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        fontFamily: '"Cinzel", serif',
                      }}
                    >
                      Annuler
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        onCollabVote(quest.id, false);
                        setConfirmFailOpen(false);
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg"
                      style={{
                        background: 'linear-gradient(135deg, rgba(180,70,70,0.35), rgba(140,50,50,0.2))',
                        border: '1px solid rgba(180,80,80,0.5)',
                        color: '#e8a0a0',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        fontFamily: '"Cinzel", serif',
                      }}
                    >
                      <ThumbsDown size={14} />
                      Confirmer
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
});