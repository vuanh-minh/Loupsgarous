import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, Sparkles } from 'lucide-react';
import type { Player } from '../../../context/GameContext';
import { getRoleById } from '../../../data/roles';
import type { GameThemeTokens } from '../../../context/gameTheme';
import { PAvatar } from './PAvatar';

interface RevivedScreenProps {
  currentPlayer: Player;
  revivedAnimStep: 'waiting' | 'flipping' | 'done';
  onStartFlip: () => void;
  onDismiss: () => void;
  particlePositions: { left: number; top: number; duration: number; delay: number }[];
  t: GameThemeTokens;
  gmBackButton: React.ReactNode;
}

export function RevivedScreen({
  currentPlayer,
  revivedAnimStep,
  onStartFlip,
  onDismiss,
  particlePositions,
  t,
  gmBackButton,
}: RevivedScreenProps) {
  const revivedRole = getRoleById(currentPlayer.role);
  const revivedTeamColor = revivedRole?.team === 'werewolf' ? '#c41e3a' : revivedRole?.team === 'village' ? '#6b8e5a' : t.gold;
  const revivedTeamLabel = revivedRole?.team === 'werewolf' ? 'Loups-Garous' : revivedRole?.team === 'village' ? 'Village' : 'Solitaire';

  return (
    <div
      className="h-dvh max-w-md mx-auto flex flex-col items-center justify-center overflow-hidden relative"
      style={{
        background: 'linear-gradient(180deg, #050810 0%, #081218 50%, #0a1a12 100%)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {gmBackButton}
      {/* Floating particles background (green-tinted) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
        {particlePositions.map((pp, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full pointer-events-none"
            style={{
              background: i % 2 === 0 ? 'rgba(107,142,90,0.3)' : `${t.gold}30`,
              left: `${pp.left}%`,
              top: `${pp.top}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.2, 0.7, 0.2],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: pp.duration,
              repeat: Infinity,
              delay: pp.delay,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* Player identity */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col items-center gap-1.5 mb-6 px-5 py-3 rounded-2xl relative z-10"
        style={{
          background: 'rgba(107,142,90,0.08)',
          border: '1px solid rgba(107,142,90,0.25)',
        }}
      >
        <div className="w-12 h-12 shrink-0 rounded-full overflow-hidden">
          <PAvatar player={currentPlayer} size="text-2xl" />
        </div>
        <span style={{ color: '#6b8e5a', fontSize: '0.8rem', fontFamily: '"Cinzel", serif' }}>
          {currentPlayer.name}
        </span>
      </motion.div>

      {/* Revived announcement (before card flip) */}
      <AnimatePresence mode="wait">
        {revivedAnimStep === 'waiting' && (
          <motion.div
            key="revived-announcement"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex flex-col items-center gap-5 px-6 relative z-10"
          >
            {/* Pulsing heart icon */}
            <motion.div
              className="w-28 h-28 rounded-full flex items-center justify-center relative"
              style={{
                background: 'radial-gradient(circle, rgba(107,142,90,0.15) 0%, transparent 70%)',
              }}
            >
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{ border: '2px solid rgba(107,142,90,0.15)' }}
                animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div
                className="absolute inset-2 rounded-full"
                style={{ border: '1px solid rgba(107,142,90,0.1)' }}
                animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0, 0.2] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
              />
              <motion.span
                className="text-6xl"
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                💚
              </motion.span>
            </motion.div>

            <div className="text-center">
              <h1
                style={{
                  fontFamily: '"Cinzel Decorative", "Cinzel", serif',
                  color: '#6b8e5a',
                  fontSize: '1.3rem',
                  marginBottom: '0.5rem',
                }}
              >
                Tu as ete ressuscite !
              </h1>
              <p style={{ color: t.textMuted, fontSize: '0.75rem', lineHeight: 1.6, maxWidth: '280px' }}>
                Le destin t'offre une seconde chance. Tu reviens parmi les vivants du village.
              </p>
            </div>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onStartFlip}
              className="flex items-center justify-center gap-3 py-4 px-10 rounded-xl mt-2"
              style={{
                background: 'linear-gradient(135deg, #6b8e5a, #4a6b3a)',
                color: '#ffffff',
                fontFamily: '"Cinzel", serif',
                fontSize: '0.95rem',
                fontWeight: 600,
                boxShadow: '0 4px 20px rgba(107,142,90,0.3)',
              }}
            >
              <Eye size={18} />
              Decouvrir mon role
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Role reveal card (flip animation) */}
      {revivedAnimStep !== 'waiting' && (
        <div style={{ perspective: '1200px', width: '280px', height: '380px' }} className="relative z-10 mb-8">
          <motion.div
            className="w-full h-full relative"
            style={{ transformStyle: 'preserve-3d' }}
            initial={{ rotateY: 0 }}
            animate={{ rotateY: revivedAnimStep === 'flipping' || revivedAnimStep === 'done' ? 180 : 0 }}
            transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* Front of card — sealed */}
            <div
              className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center overflow-hidden"
              style={{
                backfaceVisibility: 'hidden',
                background: 'linear-gradient(135deg, #0d2818 0%, #0a1a12 50%, #0d2818 100%)',
                border: '2px solid rgba(107,142,90,0.3)',
                boxShadow: '0 0 40px rgba(107,142,90,0.1), inset 0 0 60px rgba(10,26,18,0.5)',
              }}
            >
              <div
                className="absolute inset-3 rounded-xl pointer-events-none"
                style={{ border: '1px solid rgba(107,142,90,0.15)' }}
              />
              <motion.span
                className="text-7xl block mb-6"
                animate={{ rotateY: [0, 10, -10, 0], scale: [1, 1.05, 1] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              >
                🃏
              </motion.span>
              <h2
                style={{
                  fontFamily: '"Cinzel Decorative", "Cinzel", serif',
                  color: '#6b8e5a',
                  fontSize: '1rem',
                  textAlign: 'center',
                  marginBottom: '0.5rem',
                }}
              >
                Nouveau destin
              </h2>
              <p style={{ color: t.textMuted, fontSize: '0.7rem', textAlign: 'center', padding: '0 2rem' }}>
                Votre role vous est revele...
              </p>
              <motion.div
                className="absolute bottom-0 left-0 right-0 h-1"
                style={{ background: 'linear-gradient(90deg, transparent, #6b8e5a, transparent)' }}
                animate={{ opacity: [0.3, 0.8, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>

            {/* Back of card — role revealed */}
            <div
              className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center overflow-hidden"
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                background: `linear-gradient(135deg, ${revivedRole?.color || '#6b8e5a'}15 0%, #0d1025 50%, ${revivedRole?.color || '#6b8e5a'}10 100%)`,
                border: `2px solid ${revivedRole?.color || '#6b8e5a'}50`,
                boxShadow: `0 0 40px ${revivedRole?.color || '#6b8e5a'}20, inset 0 0 60px rgba(15,10,40,0.5)`,
              }}
            >
              <div
                className="absolute inset-3 rounded-xl pointer-events-none"
                style={{ border: `1px solid ${revivedRole?.color || '#6b8e5a'}20` }}
              />

              {revivedAnimStep === 'done' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.1, type: 'spring', stiffness: 200 }}
                  className="flex flex-col items-center gap-3 px-6"
                >
                  {/* Team badge */}
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="px-3 py-1 rounded-full"
                    style={{
                      background: `${revivedTeamColor}15`,
                      border: `1px solid ${revivedTeamColor}40`,
                    }}
                  >
                    <span style={{ color: revivedTeamColor, fontSize: '0.6rem', fontFamily: '"Cinzel", serif', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      {revivedTeamLabel}
                    </span>
                  </motion.div>

                  {/* Role emoji */}
                  <motion.span
                    className="text-7xl block"
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 15 }}
                  >
                    {revivedRole?.emoji || '❓'}
                  </motion.span>

                  {/* Role name */}
                  <motion.h2
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    style={{
                      fontFamily: '"Cinzel Decorative", "Cinzel", serif',
                      color: revivedRole?.color || '#6b8e5a',
                      fontSize: '1.2rem',
                      textAlign: 'center',
                    }}
                  >
                    {revivedRole?.name || 'Inconnu'}
                  </motion.h2>

                  {/* Role description */}
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    style={{
                      color: t.textMuted,
                      fontSize: '0.65rem',
                      textAlign: 'center',
                      lineHeight: 1.5,
                      maxWidth: '220px',
                    }}
                  >
                    {revivedRole?.description || ''}
                  </motion.p>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Continue button after reveal */}
      {revivedAnimStep === 'done' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col items-center gap-3 mt-2 relative z-10"
        >
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onDismiss}
            className="flex items-center justify-center gap-3 py-3.5 px-8 rounded-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(107,142,90,0.15), rgba(74,107,58,0.10))',
              border: '1px solid rgba(107,142,90,0.35)',
              color: '#6b8e5a',
              fontFamily: '"Cinzel", serif',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            <Sparkles size={16} />
            Reprendre la partie
          </motion.button>
          <p style={{ color: t.textDim, fontSize: '0.55rem' }}>
            Bonne chance pour cette seconde vie !
          </p>
        </motion.div>
      )}
    </div>
  );
}