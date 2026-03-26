import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, ArrowLeft, Eye, Search, Send, Target } from 'lucide-react';
import { PAvatar } from '../PAvatar';
import { type RoleActionBaseProps } from './roleActionTypes';
import { ROLES } from '../../../../data/roles';

interface Props extends RoleActionBaseProps {
  onCorbeauTarget: (targetId: number, message: string, imageUrl?: string) => void;
}

/**
 * Replace all role mentions ({role} and {durole}) with "le Loup-Garou" / "du Loup-Garou".
 * Also replaces any *resolved* role name (e.g. "la Voyante", "le Chasseur") in the text
 * with "le Loup-Garou" / "du Loup-Garou".
 */
function corruptRoleInText(text: string): string {
  // 1. Replace {role} → le Loup-Garou (auto-cap at start)
  let result = text.replace(/\{role\}/gi, (_m: string, offset: number) => {
    return offset === 0 ? 'Le Loup-Garou' : 'le Loup-Garou';
  });
  // 2. Replace {durole} → du Loup-Garou (auto-cap at start)
  result = result.replace(/\{durole\}/gi, (_m: string, offset: number) => {
    return offset === 0 ? 'Du Loup-Garou' : 'du Loup-Garou';
  });
  // 3. Replace any already-resolved role name in the text
  for (const role of ROLES) {
    if (role.id === 'loup-garou') continue;
    // "du/de la/d'un/de l' <Name>"
    let duPattern: RegExp;
    if (role.article === "l'") {
      duPattern = new RegExp(`[Dd]e\\s+l'${escapeRegex(role.name)}`, 'g');
    } else if (role.article === 'un') {
      duPattern = new RegExp(`[Dd]'un\\s+${escapeRegex(role.name)}\\b`, 'g');
    } else if (role.article === 'le') {
      duPattern = new RegExp(`\\b[Dd]u\\s+${escapeRegex(role.name)}\\b`, 'g');
    } else {
      duPattern = new RegExp(`\\b[Dd]e\\s+la\\s+${escapeRegex(role.name)}\\b`, 'g');
    }
    result = result.replace(duPattern, (m) => {
      return m.charAt(0) === m.charAt(0).toUpperCase() ? 'Du Loup-Garou' : 'du Loup-Garou';
    });
    // "le/la/un/l' <Name>"
    let artPattern: RegExp;
    if (role.article === "l'") {
      artPattern = new RegExp(`[Ll]'${escapeRegex(role.name)}`, 'g');
    } else if (role.article === 'un') {
      artPattern = new RegExp(`\\b[Uu]n\\s+${escapeRegex(role.name)}\\b`, 'g');
    } else {
      artPattern = new RegExp(
        `\\b${escapeRegex(role.article.charAt(0).toUpperCase() + role.article.slice(1))}\\s+${escapeRegex(role.name)}\\b|\\b${escapeRegex(role.article)}\\s+${escapeRegex(role.name)}\\b`,
        'g',
      );
    }
    result = result.replace(artPattern, (m) => {
      return m.charAt(0) === m.charAt(0).toUpperCase() ? 'Le Loup-Garou' : 'le Loup-Garou';
    });
  }
  return result;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generate a corrupted dynamic hint for the Corbeau.
 * Picks one random unrevealed dynamic hint, replaces any role mention
 * with "le Loup-Garou" / "du Loup-Garou". Preserves imageUrl if present.
 */
function generateCorruptedHint(
  state: RoleActionBaseProps['state'],
  corbeauPlayerId: number,
): { corruptedText: string; originalHintId: number; imageUrl?: string } | null {
  const dynamicHints = state.dynamicHints ?? [];

  const candidates = dynamicHints.filter(
    (dh) => !dh.revealed && dh.text,
  );

  if (candidates.length === 0) {
    const templates = [
      `Le Loup-Garou cache quelque chose.`,
      `Le Loup-Garou est suspect.`,
      `Le Loup-Garou a ete vu cette nuit.`,
      `Mefie-toi du Loup-Garou.`,
    ];
    const template = templates[Math.floor(Math.random() * templates.length)];
    return { corruptedText: template, originalHintId: -1 };
  }

  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  const corruptedText = corruptRoleInText(picked.text);

  return {
    corruptedText,
    originalHintId: picked.id,
    imageUrl: picked.imageUrl,
  };
}

export function CorbeauAction({ state, alivePlayers, currentPlayer, allPlayers, onFlipBack, onCorbeauTarget, practiceMode, t }: Props) {
  const [corbeauSearch, setCorbeauSearch] = useState('');
  const [corbeauStep, setCorbeauStep] = useState<'hint' | 'target' | 'confirm'>('hint');
  const [pendingCorbeauTarget, setPendingCorbeauTarget] = useState<number | null>(null);

  const hasChosen = (state.corbeauTargets ?? {})[currentPlayer.id] !== undefined;
  const lastTargetId = (state.corbeauLastTargets ?? {})[currentPlayer.id] ?? null;
  const targets = alivePlayers.filter((p) => p.id !== currentPlayer.id && p.id !== lastTargetId);
  const pendingPlayer = pendingCorbeauTarget !== null ? allPlayers.find((p) => p.id === pendingCorbeauTarget) ?? null : null;
  const chosenPlayer = hasChosen ? allPlayers.find((p) => p.id === (state.corbeauTargets ?? {})[currentPlayer.id]) ?? null : null;
  const lastTargetPlayer = lastTargetId !== null ? allPlayers.find((p) => p.id === lastTargetId) ?? null : null;

  // Generate the corrupted hint once per turn (stable via ref)
  const turnRef = useRef<number>(-1);
  const hintRef = useRef<{ corruptedText: string; originalHintId: number; imageUrl?: string } | null>(null);
  if (turnRef.current !== state.turn) {
    turnRef.current = state.turn;
    hintRef.current = generateCorruptedHint(state, currentPlayer.id);
  }
  const corruptedHint = hintRef.current;

  const filteredTargets = corbeauSearch.trim()
    ? targets.filter((p) => p.name.toLowerCase().includes(corbeauSearch.toLowerCase()))
    : targets;

  return (
    <div className="rounded-xl p-5 mb-5"
      style={{ background: 'linear-gradient(135deg, rgba(74,54,96,0.08), rgba(74,54,96,0.03))', border: '1px solid rgba(74,54,96,0.2)' }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm">🐦‍⬛</span>
        <span style={{ fontFamily: '"Cinzel", serif', color: '#4a3660', fontSize: '0.8rem' }}>Indice corrompu</span>
      </div>
      <p style={{ color: t.textMuted, fontSize: '0.6rem', marginBottom: '0.75rem' }}>
        Tu as intercepte un indice. Le role mentionne a ete modifie. Choisis a qui l'envoyer.
      </p>

      {!hasChosen && !practiceMode ? (
        <div>
          {/* Step 1: Show the corrupted hint */}
          {corbeauStep === 'hint' && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              {corruptedHint ? (
                <>
                  <div className="rounded-lg p-4 mb-3" style={{
                    background: 'rgba(74,54,96,0.08)',
                    border: '1px solid rgba(74,54,96,0.25)',
                  }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Eye size={12} style={{ color: '#4a3660' }} />
                      <span style={{ color: '#4a3660', fontSize: '0.55rem', fontFamily: '"Cinzel", serif', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        Indice intercepte
                      </span>
                    </div>
                    <p style={{
                      color: t.text,
                      fontSize: '0.75rem',
                      fontStyle: 'italic',
                      fontFamily: '"IM Fell English", "Cinzel", serif',
                      lineHeight: 1.5,
                    }}>
                      "{corruptedHint.corruptedText}"
                    </p>
                    {corruptedHint.imageUrl && (
                      <img src={corruptedHint.imageUrl} alt="" className="w-full rounded-lg mt-2" style={{ maxHeight: '160px', objectFit: 'cover' }} />
                    )}
                  </div>
                  <div className="rounded-lg p-2.5 mb-3" style={{ background: `rgba(${t.overlayChannel}, 0.03)`, border: `1px solid rgba(${t.overlayChannel}, 0.06)` }}>
                    <p style={{ color: t.textDim, fontSize: '0.55rem', lineHeight: 1.6 }}>
                      <strong style={{ color: '#4a3660' }}>⚠️ Attention :</strong> Le role mentionne dans cet indice a ete remplace. L'information est trompeuse.
                    </p>
                  </div>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => setCorbeauStep('target')}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all"
                    style={{ background: '#4a3660', color: '#f0e6ff', fontSize: '0.65rem', fontFamily: '"Cinzel", serif' }}>
                    <Target size={13} /> Choisir une cible
                  </motion.button>
                </>
              ) : (
                <div className="rounded-lg p-4 text-center" style={{
                  background: `rgba(${t.overlayChannel}, 0.03)`,
                  border: `1px dashed rgba(${t.overlayChannel}, 0.1)`,
                }}>
                  <p style={{ color: t.textMuted, fontSize: '0.65rem', fontFamily: '"Cinzel", serif' }}>
                    Aucun indice disponible cette nuit.
                  </p>
                  <p style={{ color: t.textDim, fontSize: '0.55rem', marginTop: '0.25rem' }}>
                    Le maitre du jeu n'a pas encore cree d'indices dynamiques.
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* Step 2: Pick a target */}
          {corbeauStep === 'target' && corruptedHint && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              {/* Show the hint being sent */}
              <div className="rounded-lg p-2.5 mb-3 flex items-center gap-2" style={{ background: 'rgba(74,54,96,0.06)', border: '1px solid rgba(74,54,96,0.15)' }}>
                <Eye size={10} style={{ color: '#4a3660' }} />
                <div className="flex-1 min-w-0">
                  <p className="truncate" style={{ color: '#4a3660', fontSize: '0.6rem', fontStyle: 'italic', fontFamily: '"IM Fell English", serif' }}>
                    "{corruptedHint.corruptedText}"
                  </p>
                  {corruptedHint.imageUrl && (
                    <img src={corruptedHint.imageUrl} alt="" className="w-full rounded mt-1" style={{ maxHeight: '80px', objectFit: 'cover' }} />
                  )}
                </div>
              </div>
              {lastTargetPlayer && (
                <div className="flex items-center gap-1.5 mb-2 px-1">
                  <AlertCircle size={9} style={{ color: '#ef4444' }} />
                  <span style={{ color: '#ef4444', fontSize: '0.6rem' }}>Interdit : {lastTargetPlayer.name} (nuit precedente)</span>
                </div>
              )}
              {targets.length > 5 && (
                <div className="relative mb-3">
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.textDim }} />
                  <input type="text" value={corbeauSearch} onChange={(e) => setCorbeauSearch(e.target.value)} placeholder="Rechercher..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs"
                    style={{ background: `rgba(${t.overlayChannel}, 0.04)`, border: `1px solid rgba(${t.overlayChannel}, 0.1)`, color: t.text, fontSize: '0.6rem' }} />
                </div>
              )}
              <div className="grid grid-cols-4 gap-2 max-h-[200px] overflow-y-auto">
                {filteredTargets.map((target) => (
                  <motion.button key={target.id} whileTap={{ scale: 0.9 }}
                    onClick={() => { setPendingCorbeauTarget(target.id); setCorbeauStep('confirm'); }}
                    className="flex flex-col items-center gap-1 p-2 rounded-lg transition-colors"
                    style={{ background: `rgba(${t.overlayChannel}, 0.03)`, border: `1px solid rgba(${t.overlayChannel}, 0.08)` }}>
                    <div className="w-8 h-8 rounded-full overflow-hidden mx-auto"><PAvatar player={target} size="text-xl" /></div>
                    <span style={{ color: t.textSecondary, fontSize: '0.5rem' }} className="w-full text-center line-clamp-2 break-words">{target.name}</span>
                  </motion.button>
                ))}
              </div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setCorbeauStep('hint')}
                className="w-full flex items-center justify-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg"
                style={{ background: `rgba(${t.overlayChannel}, 0.04)`, color: t.textSecondary, fontSize: '0.55rem', fontFamily: '"Cinzel", serif' }}>
                <ArrowLeft size={11} /> Revoir l'indice
              </motion.button>
            </motion.div>
          )}

          {/* Step 3: Confirm */}
          {corbeauStep === 'confirm' && pendingPlayer && corruptedHint && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="rounded-lg p-4 text-center" style={{ background: 'rgba(74,54,96,0.08)', border: '1px solid rgba(74,54,96,0.2)' }}>
              <p style={{ color: '#4a3660', fontSize: '0.55rem', fontFamily: '"Cinzel", serif', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                Envoyer cet indice a :
              </p>
              <div className="w-12 h-12 shrink-0 rounded-full overflow-hidden mx-auto mb-2">
                <PAvatar player={pendingPlayer} size="text-2xl" />
              </div>
              <p style={{ color: t.text, fontSize: '0.8rem', fontFamily: '"Cinzel", serif', marginBottom: '0.5rem' }}>{pendingPlayer.name}</p>
              <div className="rounded-lg p-2 mb-3 mx-auto" style={{ background: 'rgba(74,54,96,0.06)', border: '1px dashed rgba(74,54,96,0.2)', maxWidth: '85%' }}>
                <p style={{ color: '#4a3660', fontSize: '0.6rem', fontStyle: 'italic', fontFamily: '"IM Fell English", serif' }}>
                  "{corruptedHint.corruptedText}"
                </p>
                {corruptedHint.imageUrl && (
                  <img src={corruptedHint.imageUrl} alt="" className="w-full rounded mt-1.5" style={{ maxHeight: '120px', objectFit: 'cover' }} />
                )}
              </div>
              <div className="flex flex-col gap-2 w-full">
                <motion.button whileTap={{ scale: 0.95 }}
                  onClick={() => { onCorbeauTarget(pendingCorbeauTarget!, corruptedHint.corruptedText, corruptedHint.imageUrl); setPendingCorbeauTarget(null); }}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg"
                  style={{ background: '#4a3660', color: '#f0e6ff', fontSize: '0.6rem', fontFamily: '"Cinzel", serif' }}>
                  <Send size={11} /> Envoyer
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }}
                  onClick={() => { setPendingCorbeauTarget(null); setCorbeauStep('target'); }}
                  className="w-full px-4 py-1.5 rounded-lg"
                  style={{ background: `rgba(${t.overlayChannel}, 0.06)`, color: t.textSecondary, fontSize: '0.6rem', fontFamily: '"Cinzel", serif' }}>
                  Retour
                </motion.button>
              </div>
            </motion.div>
          )}
        </div>
      ) : hasChosen && chosenPlayer ? (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="rounded-lg p-5 text-center" style={{ background: 'rgba(74,54,96,0.08)', border: '1px solid rgba(74,54,96,0.25)' }}>
          <p style={{ color: '#4a3660', fontSize: '0.55rem', fontFamily: '"Cinzel", serif', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Indice envoye</p>
          <div className="w-12 h-12 shrink-0 rounded-full overflow-hidden mx-auto mb-2">
            <PAvatar player={chosenPlayer} size="text-2xl" />
          </div>
          <p style={{ color: t.text, fontSize: '0.8rem', fontFamily: '"Cinzel", serif' }}>{chosenPlayer.name}</p>
          <div className="rounded-lg p-2 mt-2 mx-auto" style={{ background: 'rgba(74,54,96,0.06)', border: '1px dashed rgba(74,54,96,0.2)', maxWidth: '85%' }}>
            <p style={{ color: '#4a3660', fontSize: '0.55rem', fontStyle: 'italic', fontFamily: '"IM Fell English", serif' }}>
              "{(state.corbeauMessages ?? {})[currentPlayer.id] || corruptedHint?.corruptedText || '...'}"
            </p>
          </div>
        </motion.div>
      ) : practiceMode ? (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          {corruptedHint ? (
            <div className="rounded-lg p-4 mb-3" style={{
              background: 'rgba(74,54,96,0.06)',
              border: '1px dashed rgba(74,54,96,0.15)',
            }}>
              <div className="flex items-center gap-2 mb-2">
                <Eye size={12} style={{ color: '#4a3660' }} />
                <span style={{ color: '#4a3660', fontSize: '0.55rem', fontFamily: '"Cinzel", serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Apercu — Indice corrompu</span>
              </div>
              <p style={{ color: t.textDim, fontSize: '0.7rem', fontStyle: 'italic', fontFamily: '"IM Fell English", serif' }}>
                "{corruptedHint.corruptedText}"
              </p>
              {corruptedHint.imageUrl && (
                <img src={corruptedHint.imageUrl} alt="" className="w-full rounded-lg mt-2" style={{ maxHeight: '160px', objectFit: 'cover' }} />
              )}
            </div>
          ) : (
            <p style={{ color: t.textDim, fontSize: '0.6rem', fontStyle: 'italic' }}>Aucun indice disponible.</p>
          )}
          <div className="space-y-1.5 max-h-[140px] overflow-y-auto mt-3">
            {targets.slice(0, 3).map((target) => (
              <div key={target.id} className="flex items-center gap-3 p-2.5 rounded-lg"
                style={{ background: `rgba(${t.overlayChannel}, 0.03)`, border: `1px solid rgba(${t.overlayChannel}, 0.08)` }}>
                <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0"><PAvatar player={target} size="text-lg" /></div>
                <span style={{ color: t.text, fontSize: '0.7rem', fontFamily: '"Cinzel", serif' }}>{target.name}</span>
              </div>
            ))}
            {targets.length > 3 && (
              <p style={{ color: t.textDim, fontSize: '0.6rem', textAlign: 'center', marginTop: '0.5rem' }}>+{targets.length - 3} autres joueurs...</p>
            )}
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}