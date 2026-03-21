import React, { useState, useCallback, useRef } from 'react';
import { Scroll, ChevronDown, Plus, X, ImagePlus } from 'lucide-react';
import { motion } from 'motion/react';
import { type GameState, type RoleRevealQuestConfig, type QuestTaskInputType } from '../../../context/gameTypes';
import { type GameThemeTokens } from '../../../context/gameTheme';

/* ================================================================
   GMRoleRevealQuestSettings — "Quête de Bienvenue" config section.
   Allows the GM to set up an onboarding quest shown to all players
   during the Role Revelation phase.
   ================================================================ */

interface Props {
  state: GameState;
  updateState: (fn: (s: GameState) => GameState) => void;
  t: GameThemeTokens;
  className?: string;
}

const INPUT_TYPES: { value: QuestTaskInputType; label: string }[] = [
  { value: 'text', label: 'Texte libre' },
  { value: 'multiple-choice', label: 'Choix multiples' },
];

const DEFAULT_CONFIG: RoleRevealQuestConfig = {
  enabled: true,
  title: '',
  question: '',
  inputType: 'text',
  choices: [],
  correctAnswer: '',
  hintText: '',
  completedBy: [],
  failedBy: [],
};

export const GMRoleRevealQuestSettings = React.memo(function GMRoleRevealQuestSettings({
  state, updateState, t, className = '',
}: Props) {
  const config = state.roleRevealQuest;
  const isOn = config?.enabled ?? false;
  const [newChoice, setNewChoice] = useState('');
  const hintImageInputRef = useRef<HTMLInputElement>(null);

  const updateConfig = useCallback((patch: Partial<RoleRevealQuestConfig>) => {
    updateState((s) => ({
      ...s,
      roleRevealQuest: { ...(s.roleRevealQuest ?? DEFAULT_CONFIG), ...patch },
    }));
  }, [updateState]);

  const handleHintImageUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      if (url) updateConfig({ hintImageUrl: url });
    };
    reader.readAsDataURL(file);
  }, [updateConfig]);

  const toggle = useCallback(() => {
    if (isOn) {
      updateConfig({ enabled: false });
    } else {
      updateState((s) => ({
        ...s,
        roleRevealQuest: { ...(s.roleRevealQuest ?? DEFAULT_CONFIG), enabled: true },
      }));
    }
  }, [isOn, updateConfig, updateState]);

  const addChoice = useCallback(() => {
    const trimmed = newChoice.trim();
    if (!trimmed) return;
    const current = config?.choices ?? [];
    if (current.includes(trimmed)) return;
    updateConfig({ choices: [...current, trimmed] });
    setNewChoice('');
  }, [newChoice, config?.choices, updateConfig]);

  const removeChoice = useCallback((idx: number) => {
    const current = config?.choices ?? [];
    updateConfig({ choices: current.filter((_, i) => i !== idx) });
  }, [config?.choices, updateConfig]);

  // Game already started — read-only
  const readOnly = state.screen === 'game' || state.screen === 'vote' || state.screen === 'end';

  return (
    <div
      className={`rounded-xl p-4 ${className}`}
      style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)' }}
    >
      {/* Header + toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scroll size={13} style={{ color: t.gold }} />
          <span style={{ fontFamily: '"Cinzel", serif', color: t.gold, fontSize: '0.7rem' }}>
            Quête de bienvenue
          </span>
        </div>
        <button
          onClick={toggle}
          disabled={readOnly}
          className="relative w-10 h-5 rounded-full transition-colors cursor-pointer"
          style={{
            background: isOn ? t.gold : `rgba(${t.overlayChannel}, 0.12)`,
            opacity: readOnly ? 0.5 : 1,
          }}
        >
          <motion.div
            animate={{ x: isOn ? 20 : 2 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="absolute top-0.5 w-4 h-4 rounded-full"
            style={{ background: isOn ? '#1a1a2e' : t.textDim }}
          />
        </button>
      </div>

      {/* Expanded form */}
      {isOn && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          transition={{ type: 'tween', duration: 0.25 }}
          className="mt-3 flex flex-col gap-3"
        >
          {/* Title */}
          <div>
            <label
              style={{ fontFamily: '"Cinzel", serif', color: t.textMuted, fontSize: '0.6rem', fontWeight: 600 }}
            >
              Titre de la quête
            </label>
            <input
              value={config?.title ?? ''}
              onChange={(e) => updateConfig({ title: e.target.value })}
              disabled={readOnly}
              placeholder="Ex: Quête de bienvenue"
              className="w-full mt-1 rounded-lg px-3 py-2"
              style={{
                background: `rgba(${t.overlayChannel}, 0.06)`,
                border: `1px solid rgba(${t.overlayChannel}, 0.12)`,
                color: t.textPrimary,
                fontSize: '0.7rem',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Question */}
          <div>
            <label
              style={{ fontFamily: '"Cinzel", serif', color: t.textMuted, fontSize: '0.6rem', fontWeight: 600 }}
            >
              Question
            </label>
            <textarea
              value={config?.question ?? ''}
              onChange={(e) => updateConfig({ question: e.target.value })}
              disabled={readOnly}
              placeholder="Ex: Quel est le nom du village ?"
              rows={2}
              className="w-full mt-1 rounded-lg px-3 py-2 resize-none"
              style={{
                background: `rgba(${t.overlayChannel}, 0.06)`,
                border: `1px solid rgba(${t.overlayChannel}, 0.12)`,
                color: t.textPrimary,
                fontSize: '0.7rem',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Input type */}
          <div>
            <label
              style={{ fontFamily: '"Cinzel", serif', color: t.textMuted, fontSize: '0.6rem', fontWeight: 600 }}
            >
              Type de réponse
            </label>
            <div className="flex gap-2 mt-1">
              {INPUT_TYPES.map((it) => (
                <button
                  key={it.value}
                  onClick={() => updateConfig({ inputType: it.value })}
                  disabled={readOnly}
                  className="px-3 py-1.5 rounded-lg transition-colors"
                  style={{
                    background: (config?.inputType ?? 'text') === it.value
                      ? `rgba(${t.overlayChannel}, 0.12)`
                      : `rgba(${t.overlayChannel}, 0.04)`,
                    border: `1px solid ${(config?.inputType ?? 'text') === it.value
                      ? t.gold
                      : `rgba(${t.overlayChannel}, 0.1)`}`,
                    color: (config?.inputType ?? 'text') === it.value ? t.gold : t.textMuted,
                    fontSize: '0.6rem',
                    fontFamily: '"Cinzel", serif',
                  }}
                >
                  {it.label}
                </button>
              ))}
            </div>
          </div>

          {/* Choices editor (multiple-choice only) */}
          {(config?.inputType === 'multiple-choice') && (
            <div>
              <label
                style={{ fontFamily: '"Cinzel", serif', color: t.textMuted, fontSize: '0.6rem', fontWeight: 600 }}
              >
                Choix possibles
              </label>
              <div className="flex flex-col gap-1.5 mt-1">
                {(config?.choices ?? []).map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span
                      className="flex-1 px-2 py-1 rounded-md"
                      style={{
                        background: `rgba(${t.overlayChannel}, 0.06)`,
                        border: `1px solid rgba(${t.overlayChannel}, 0.1)`,
                        color: t.textPrimary,
                        fontSize: '0.65rem',
                      }}
                    >
                      {c}
                    </span>
                    {!readOnly && (
                      <button
                        onClick={() => removeChoice(i)}
                        className="w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: 'rgba(229,62,62,0.15)', color: '#e53e3e' }}
                      >
                        <X size={10} />
                      </button>
                    )}
                  </div>
                ))}
                {!readOnly && (
                  <div className="flex items-center gap-2">
                    <input
                      value={newChoice}
                      onChange={(e) => setNewChoice(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChoice(); } }}
                      placeholder="Ajouter un choix..."
                      className="flex-1 px-2 py-1 rounded-md"
                      style={{
                        background: `rgba(${t.overlayChannel}, 0.06)`,
                        border: `1px solid rgba(${t.overlayChannel}, 0.1)`,
                        color: t.textPrimary,
                        fontSize: '0.65rem',
                      }}
                    />
                    <button
                      onClick={addChoice}
                      className="w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: `rgba(${t.overlayChannel}, 0.1)`, color: t.gold }}
                    >
                      <Plus size={10} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Correct answer */}
          <div>
            <label
              style={{ fontFamily: '"Cinzel", serif', color: t.textMuted, fontSize: '0.6rem', fontWeight: 600 }}
            >
              Réponse correcte
            </label>
            <input
              value={config?.correctAnswer ?? ''}
              onChange={(e) => updateConfig({ correctAnswer: e.target.value })}
              disabled={readOnly}
              placeholder="La réponse attendue"
              className="w-full mt-1 rounded-lg px-3 py-2"
              style={{
                background: `rgba(${t.overlayChannel}, 0.06)`,
                border: `1px solid rgba(${t.overlayChannel}, 0.12)`,
                color: t.textPrimary,
                fontSize: '0.7rem',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Hint text + image upload */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                style={{ fontFamily: '"Cinzel", serif', color: t.textMuted, fontSize: '0.6rem', fontWeight: 600 }}
              >
                Indice à débloquer
              </label>
              {!readOnly && (
                <>
                  <input
                    ref={hintImageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleHintImageUpload(file);
                      e.target.value = '';
                    }}
                  />
                  <button
                    onClick={() => hintImageInputRef.current?.click()}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg transition-colors"
                    style={{
                      background: config?.hintImageUrl
                        ? 'rgba(139,92,246,0.15)'
                        : `rgba(${t.overlayChannel}, 0.06)`,
                      border: `1px solid ${config?.hintImageUrl
                        ? 'rgba(139,92,246,0.3)'
                        : `rgba(${t.overlayChannel}, 0.1)`}`,
                      color: config?.hintImageUrl ? '#a78bfa' : t.textMuted,
                      fontSize: '0.6rem',
                      fontFamily: '"Cinzel", serif',
                    }}
                    title="Ajouter une image à l'indice"
                  >
                    <ImagePlus size={11} />
                    {config?.hintImageUrl ? 'Changer' : 'Image'}
                  </button>
                </>
              )}
            </div>
            <textarea
              value={config?.hintText ?? ''}
              onChange={(e) => updateConfig({ hintText: e.target.value })}
              disabled={readOnly}
              placeholder="L'indice révélé en cas de bonne réponse"
              rows={2}
              className="w-full rounded-lg px-3 py-2 resize-none"
              style={{
                background: `rgba(${t.overlayChannel}, 0.06)`,
                border: `1px solid rgba(${t.overlayChannel}, 0.12)`,
                color: t.textPrimary,
                fontSize: '0.7rem',
                fontFamily: 'inherit',
              }}
            />
            {/* Image preview */}
            {config?.hintImageUrl && (
              <div className="flex items-start gap-2 mt-2">
                <img
                  src={config.hintImageUrl}
                  alt="Aperçu indice"
                  className="rounded-lg object-cover"
                  style={{ width: 64, height: 64, border: '1px solid rgba(139,92,246,0.25)', flexShrink: 0 }}
                />
                {!readOnly && (
                  <button
                    onClick={() => updateConfig({ hintImageUrl: undefined })}
                    className="p-1 rounded-md"
                    style={{ background: 'rgba(229,62,62,0.1)', color: '#e53e3e' }}
                    title="Supprimer l'image"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Hint caption */}
          <div>
            <label
              style={{ fontFamily: '"Cinzel", serif', color: t.textMuted, fontSize: '0.6rem', fontWeight: 600 }}
            >
              Légende de l'indice (optionnel)
            </label>
            <input
              value={config?.hintCaption ?? ''}
              onChange={(e) => updateConfig({ hintCaption: e.target.value })}
              disabled={readOnly}
              placeholder="Ex: Regardez attentivement..."
              className="w-full mt-1 rounded-lg px-3 py-2"
              style={{
                background: `rgba(${t.overlayChannel}, 0.06)`,
                border: `1px solid rgba(${t.overlayChannel}, 0.12)`,
                color: t.textPrimary,
                fontSize: '0.7rem',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Progress (read-only, shown during game) */}
          {readOnly && config && config.completedBy.length > 0 && (
            <div
              className="rounded-lg px-3 py-2"
              style={{
                background: 'rgba(74,222,128,0.06)',
                border: '1px solid rgba(74,222,128,0.15)',
              }}
            >
              <span style={{ color: '#4ade80', fontSize: '0.6rem', fontFamily: '"Cinzel", serif' }}>
                {config.completedBy.length} joueur{config.completedBy.length > 1 ? 's' : ''} ont réussi
              </span>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
});
