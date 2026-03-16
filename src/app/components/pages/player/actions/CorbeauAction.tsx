import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, ArrowLeft, Eye, Search, Send, Target } from 'lucide-react';
import { PAvatar } from '../PAvatar';
import { type RoleActionBaseProps } from './roleActionTypes';
import { ROLES, getRoleById } from '../../../../data/roles';

interface Props extends RoleActionBaseProps {
  onCorbeauTarget: (targetId: number, message: string) => void;
}

/**
 * Generate a corrupted dynamic hint for the Corbeau.
 * Picks one random unrevealed dynamic hint containing {role},
 * resolves {role} with a WRONG role (random among active roles in the game).
 * Returns { originalHintId, corruptedText } or null if nothing available.
 */
function generateCorruptedHint(
  state: RoleActionBaseProps['state'],
  corbeauPlayerId: number,
): { corruptedText: string; originalHintId: number } | null {
  const dynamicHints = state.dynamicHints ?? [];
  const players = state.players ?? [];

  // Find hints that contain {role} and are not yet revealed
  const candidates = dynamicHints.filter(
    (dh) => !dh.revealed && dh.text && /\{role\}/i.test(dh.text),
  );

  if (candidates.length === 0) {
    // Fallback: generate a generic hint if no dynamic hints with {role} exist
    // Pick a random alive non-corbeau player to make a fake hint about
    const activeRoleIds = Object.entries(state.roleConfig || {})
      .filter(([, count]) => count > 0)
      .map(([id]) => id);
    if (activeRoleIds.length === 0) return null;
    const fakeRoleId = activeRoleIds[Math.floor(Math.random() * activeRoleIds.length)];
    const fakeRole = getRoleById(fakeRoleId);
    if (!fakeRole) return null;
    const templates = [
      `{role} cache quelque chose.`,
      `{role} est suspect.`,
      `{role} a ete vu cette nuit.`,
      `Mefie-toi de {role}.`,
    ];
    const template = templates[Math.floor(Math.random() * templates.length)];
    const resolved = template.replace(/\{role\}/gi, (_m, offset: number) => {
      const art = offset === 0
        ? fakeRole.article.charAt(0).toUpperCase() + fakeRole.article.slice(1)
        : fakeRole.article;
      return `${art} ${fakeRole.name}`;
    });
    return { corruptedText: resolved, originalHintId: -1 };
  }

  // Pick a random candidate
  const picked = candidates[Math.floor(Math.random() * candidates.length)];

  // Find the actual role of the target player
  const targetPlayer = players.find((p) => p.id === picked.targetPlayerId);
  const actualRoleId = targetPlayer?.role || 'villageois';

  // Pick a DIFFERENT role from the roles active in the game
  const activeRoleIds = Object.entries(state.roleConfig || {})
    .filter(([, count]) => count > 0)
    .map(([id]) => id)
    .filter((id) => id !== actualRoleId);

  if (activeRoleIds.length === 0) {
    // All roles are the same — just use any different role from ROLES
    const otherRoles = ROLES.filter((r) => r.id !== actualRoleId);
    if (otherRoles.length === 0) return null;
    const fakeRole = otherRoles[Math.floor(Math.random() * otherRoles.length)];
    const resolved = picked.text.replace(/\{role\}/gi, (_m: string, offset: number) => {
      const art = offset === 0
        ? fakeRole.article.charAt(0).toUpperCase() + fakeRole.article.slice(1)
        : fakeRole.article;
      return `${art} ${fakeRole.name}`;
    });
    return { corruptedText: resolved, originalHintId: picked.id };
  }

  const fakeRoleId = activeRoleIds[Math.floor(Math.random() * activeRoleIds.length)];
  const fakeRole = getRoleById(fakeRoleId);
  if (!fakeRole) return null;

  const corruptedText = picked.text.replace(/\{role\}/gi, (_m: string, offset: number) => {
    const art = offset === 0
      ? fakeRole.article.charAt(0).toUpperCase() + fakeRole.article.slice(1)
      : fakeRole.article;
    return `${art} ${fakeRole.name}`;
  });

  return { corruptedText, originalHintId: picked.id };
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
  const hintRef = useRef<{ corruptedText: string; originalHintId: number } | null>(null);
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
                <p className="flex-1 truncate" style={{ color: '#4a3660', fontSize: '0.6rem', fontStyle: 'italic', fontFamily: '"IM Fell English", serif' }}>
                  "{corruptedHint.corruptedText}"
                </p>
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
              </div>
              <div className="flex flex-col gap-2 w-full">
                <motion.button whileTap={{ scale: 0.95 }}
                  onClick={() => { onCorbeauTarget(pendingCorbeauTarget!, corruptedHint.corruptedText); setPendingCorbeauTarget(null); }}
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