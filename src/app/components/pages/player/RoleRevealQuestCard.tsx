import React, { useState, useCallback } from 'react';
import {
  CheckCircle, XCircle, Swords, Lightbulb, Send, ImageIcon, ZoomIn,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { RoleRevealQuestConfig } from '../../../context/gameTypes';
import type { GameThemeTokens } from '../../../context/gameTheme';
import { HintFullscreenLightbox } from '../../HintComponents';

/* ================================================================
   RoleRevealQuestCard — onboarding quest shown to ALL players
   during the Role Revelation phase. Uses same visual design as
   regular quest cards (CardPalette, status icon/badge, same structure).
   ================================================================ */

// ── Minimal CardPalette (mirrors PlayerQuestsPanel) ──
type CardPalette = {
  bg: string;
  bgOverlay: string;
  headerBg: string;
  border: string;
  borderLight: string;
  title: string;
  text: string;
  textDim: string;
  divider: string;
  decorLine: string;
  cardShadow: string;
};

const DAY_PALETTE: CardPalette = {
  bg: '#f5eed9',
  bgOverlay: 'none',
  headerBg: '#c9b48a',
  border: '#d8ccac',
  borderLight: '#c8b890',
  title: '#2a2010',
  text: '#4a3f30',
  textDim: '#8a7e65',
  divider: 'rgba(180,155,85,0.35)',
  decorLine: 'linear-gradient(90deg, transparent, rgba(180,150,70,0.5), transparent)',
  cardShadow: '0 2px 10px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)',
};

const NIGHT_PALETTE: CardPalette = {
  bg: 'linear-gradient(165deg, #222640 0%, #1c2038 30%, #171a32 70%, #11132a 100%)',
  bgOverlay: 'linear-gradient(180deg, rgba(140,160,220,0.05) 0%, rgba(100,120,200,0.01) 100%)',
  headerBg: 'rgba(14,16,32,0.65)',
  border: '#4a5280',
  borderLight: '#5a6498',
  title: '#d0daf5',
  text: '#b0bdd8',
  textDim: '#7a88b5',
  divider: 'rgba(140,160,220,0.12)',
  decorLine: 'linear-gradient(90deg, transparent, rgba(140,160,220,0.2), transparent)',
  cardShadow: 'inset 0 1px 0 rgba(140,160,220,0.06), 0 4px 14px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.3)',
};

function getCardPalette(phase: string): CardPalette {
  return phase === 'night' ? NIGHT_PALETTE : DAY_PALETTE;
}

// ── Status icon (mirrors PlayerQuestsPanel) ──
function StatusIcon({ status, phase }: { status: 'active' | 'success' | 'fail'; phase: string }) {
  const isNight = phase === 'night';
  if (status === 'success') return <CheckCircle size={18} style={{ color: isNight ? '#90E070' : '#709560' }} />;
  if (status === 'fail') return <XCircle size={18} style={{ color: '#c44' }} />;
  return <Swords size={18} style={{ color: isNight ? '#d4a843' : '#836825' }} />;
}

// ── Status badge (mirrors PlayerQuestsPanel) ──
function StatusBadge({ status }: { status: 'active' | 'success' | 'fail' }) {
  const cfg = {
    active: { icon: <Swords size={11} />, label: 'En cours', bg: 'rgba(30,60,110,0.85)', border: 'rgba(90,150,220,0.5)', color: '#a8d4ff' },
    success: { icon: <CheckCircle size={11} />, label: 'Réussie', bg: 'rgba(30,80,25,0.85)', border: 'rgba(90,170,70,0.5)', color: '#90e070' },
    fail: { icon: <XCircle size={11} />, label: 'Échouée', bg: 'rgba(100,25,25,0.85)', border: 'rgba(220,70,70,0.5)', color: '#ff8a8a' },
  }[status];
  return (
    <div
      className="flex items-center gap-1 px-2 py-0.5 rounded-md"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, backdropFilter: 'blur(4px)' }}
    >
      {cfg.icon}
      <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>{cfg.label}</span>
    </div>
  );
}

interface Props {
  config: RoleRevealQuestConfig;
  playerId: number;
  onAnswer: (answer: string) => void;
  phase?: string;
  t: GameThemeTokens;
}

export const RoleRevealQuestCard = React.memo(function RoleRevealQuestCard({
  config, playerId, onAnswer, phase = 'night', t,
}: Props) {
  const [answer, setAnswer] = useState('');
  const [showFail, setShowFail] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);

  const completed = config.completedBy.includes(playerId);
  const hasFailed = config.failedBy.includes(playerId);
  const cardStatus: 'active' | 'success' | 'fail' = completed ? 'success' : 'active';

  const isNight = phase === 'night';
  const cp = getCardPalette(phase);

  const borderColor = completed
    ? (isNight ? '#5a8a46' : '#a0b890')
    : cp.border;
  const borderTopColor = completed
    ? (isNight ? '#6ea854' : '#b0c8a0')
    : cp.borderLight;

  const handleSubmit = useCallback(() => {
    if (!answer.trim() || completed) return;
    onAnswer(answer.trim());
    setShowFail(true);
    setTimeout(() => setShowFail(false), 2500);
  }, [answer, onAnswer, completed]);

  const questTitle = config.title?.trim() || 'Quête de bienvenue';

  return (
    <>
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="mb-4"
    >
      <motion.div
        whileTap={completed ? undefined : { scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="rounded-xl overflow-hidden relative"
        style={{
          background: cp.bg,
          border: `${isNight ? '2px' : '1px'} solid ${borderColor}`,
          borderTopColor,
          boxShadow: cp.cardShadow,
        }}
      >
        {/* Parchment overlay */}
        <div className="absolute inset-0 pointer-events-none rounded-lg" style={{ background: cp.bgOverlay }} />

        {/* Top decorative line */}
        <div className="absolute top-0 left-3 right-3 h-px" style={{ background: cp.decorLine }} />

        {/* Header */}
        <div
          className="relative z-10 px-3.5 py-2.5 flex items-start gap-2.5"
          style={{ background: cp.headerBg }}
        >
          <div className="shrink-0 mt-0.5">
            <StatusIcon status={cardStatus} phase={phase} />
          </div>
          <div className="flex-1 min-w-0">
            <h3
              style={{
                fontFamily: '"Cinzel", serif',
                color: cp.title,
                fontSize: '14px',
                fontWeight: 700,
                lineHeight: 1.3,
                textShadow: isNight ? '0 1px 2px rgba(0,0,0,0.4)' : 'none',
                letterSpacing: '0.02em',
              }}
            >
              {questTitle}
            </h3>
          </div>
          <div className="shrink-0 ml-auto">
            <StatusBadge status={cardStatus} />
          </div>
        </div>

        {/* Body */}
        <div className="relative z-10 px-3.5 pt-2.5 pb-2">
          {completed ? (
            /* ── Success: show hint unlock ── */
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* "Indice débloqué" banner */}
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-3"
                style={{
                  background: isNight ? 'rgba(74,222,128,0.08)' : 'rgba(74,222,128,0.12)',
                  border: '1px solid rgba(74,222,128,0.25)',
                }}
              >
                <CheckCircle size={15} style={{ color: '#4ade80', flexShrink: 0 }} />
                <span style={{ fontFamily: '"Cinzel", serif', color: '#4ade80', fontSize: '0.72rem', fontWeight: 700 }}>
                  Indice débloqué !
                </span>
              </div>

              {/* Hint content — clickable to open fullscreen lightbox */}
              {(config.hintText || config.hintImageUrl) && (
                <motion.div
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowLightbox(true)}
                  className="rounded-xl p-3 cursor-pointer relative"
                  style={{
                    background: isNight ? 'rgba(212,168,67,0.07)' : 'rgba(212,168,67,0.1)',
                    border: '1px solid rgba(212,168,67,0.22)',
                  }}
                >
                  <div className="flex items-start gap-2 mb-2">
                    {config.hintImageUrl
                      ? <ImageIcon size={14} className="shrink-0 mt-0.5" style={{ color: '#d4a843' }} />
                      : <Lightbulb size={14} className="shrink-0 mt-0.5" style={{ color: '#d4a843' }} />
                    }
                    <span style={{ fontFamily: '"Cinzel", serif', color: '#d4a843', fontSize: '0.65rem', fontWeight: 600 }}>
                      Votre indice
                    </span>
                    <ZoomIn size={12} className="ml-auto shrink-0 mt-0.5" style={{ color: 'rgba(212,168,67,0.5)' }} />
                  </div>
                  {config.hintText && (
                    <p
                      style={{
                        color: cp.text,
                        fontSize: '0.72rem',
                        lineHeight: 1.55,
                        fontFamily: '"MedievalSharp", serif',
                        fontStyle: 'italic',
                        paddingLeft: '1.5rem',
                      }}
                    >
                      {config.hintText}
                    </p>
                  )}
                  {config.hintImageUrl && (
                    <div style={{ paddingLeft: '1.5rem', marginTop: config.hintText ? '0.5rem' : 0 }}>
                      <img
                        src={config.hintImageUrl}
                        alt="Indice"
                        className="rounded-lg w-full object-contain"
                        style={{ maxHeight: '180px' }}
                      />
                      {config.hintCaption && (
                        <p
                          style={{
                            color: cp.textDim,
                            fontSize: '0.6rem',
                            fontStyle: 'italic',
                            marginTop: '0.35rem',
                            textAlign: 'center',
                          }}
                        >
                          {config.hintCaption}
                        </p>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              <p style={{ color: cp.textDim, fontSize: '0.6rem', marginTop: '0.5rem', paddingLeft: '0.25rem', fontStyle: 'italic' }}>
                Retrouvez cet indice dans l'onglet Jeu
              </p>
            </motion.div>
          ) : (
            /* ── Active: question + input ── */
            <>
              <p
                style={{
                  color: cp.text,
                  fontSize: '0.73rem',
                  lineHeight: 1.55,
                  paddingLeft: '1.75rem',
                  marginBottom: '0.75rem',
                }}
              >
                {config.question}
              </p>

              {/* Wrong answer flash */}
              <AnimatePresence>
                {showFail && hasFailed && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg mb-2"
                    style={{
                      background: 'rgba(180,60,60,0.1)',
                      border: '1px solid rgba(180,60,60,0.25)',
                      marginLeft: '1.75rem',
                    }}
                  >
                    <XCircle size={13} style={{ color: '#e05050', flexShrink: 0 }} />
                    <span style={{ color: '#e05050', fontSize: '0.65rem' }}>Mauvaise réponse, réessayez !</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Input */}
              {config.inputType === 'multiple-choice' && config.choices ? (
                <div className="flex flex-col gap-2" style={{ paddingLeft: '1.75rem' }}>
                  {config.choices.map((choice, i) => (
                    <button
                      key={i}
                      onClick={() => setAnswer(choice)}
                      className="w-full text-left px-3 py-2 rounded-xl transition-colors"
                      style={{
                        background: answer === choice
                          ? (isNight ? 'rgba(138,164,216,0.15)' : 'rgba(154,128,69,0.12)')
                          : (isNight ? 'rgba(14,16,32,0.4)' : 'rgba(0,0,0,0.04)'),
                        border: `1px solid ${answer === choice
                          ? (isNight ? '#8aa4d8' : '#9a8045')
                          : (isNight ? 'rgba(74,82,128,0.4)' : 'rgba(180,155,85,0.25)')}`,
                        color: answer === choice ? cp.title : cp.textDim,
                        fontSize: '0.7rem',
                        fontFamily: 'inherit',
                      }}
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
                  placeholder="Votre réponse..."
                  className="w-full rounded-xl px-3 py-2.5 outline-none"
                  style={{
                    marginLeft: '1.75rem',
                    width: 'calc(100% - 1.75rem)',
                    background: isNight ? 'rgba(14,16,32,0.4)' : 'rgba(0,0,0,0.04)',
                    border: `1px solid ${isNight ? 'rgba(74,82,128,0.4)' : 'rgba(180,155,85,0.25)'}`,
                    color: cp.text,
                    fontSize: '0.7rem',
                    fontFamily: 'inherit',
                  }}
                />
              )}
            </>
          )}
        </div>

        {/* Divider + submit row — only when active */}
        {!completed && (
          <>
            <div className="relative z-10 mx-3" style={{ height: 1, background: cp.divider }} />
            <div className="relative z-10 px-3.5 py-2.5">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleSubmit}
                disabled={!answer.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all"
                style={{
                  background: answer.trim()
                    ? `linear-gradient(135deg, ${isNight ? '#b8960a' : '#9a8045'}, ${isNight ? '#d4a843' : '#c8a050'})`
                    : (isNight ? 'rgba(14,16,32,0.4)' : 'rgba(0,0,0,0.05)'),
                  color: answer.trim() ? (isNight ? '#0a0e1a' : '#2a1a00') : cp.textDim,
                  fontFamily: '"Cinzel", serif',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  opacity: answer.trim() ? 1 : 0.5,
                  border: answer.trim()
                    ? 'none'
                    : `1px solid ${isNight ? 'rgba(74,82,128,0.2)' : 'rgba(180,155,85,0.2)'}`,
                }}
              >
                <Send size={13} />
                Répondre
              </motion.button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>

    {/* Fullscreen hint lightbox */}
    {completed && (config.hintText || config.hintImageUrl) && (
      <HintFullscreenLightbox
        hints={[{ id: -1, text: config.hintText, imageUrl: config.hintImageUrl, createdAt: '' }]}
        revealedHintIds={[-1]}
        fullscreenHintId={showLightbox ? -1 : null}
        setFullscreenHintId={(id) => setShowLightbox(id !== null)}
      />
    )}
  </>
  );
});
