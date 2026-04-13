import React, { useCallback, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useGame } from '../../../../context/GameContext';
import type { TraqueProgress } from '../../../../context/gameTypes';
import { loadTraque, saveTraque, clearTraque } from './traqueStorage';
import { TraqueSelfPicker } from './TraqueSelfPicker';
import { TraqueDifficultyPicker } from './TraqueDifficultyPicker';
import { TraqueRoundScreen } from './TraqueRoundScreen';
import { TraqueScoreboard } from './TraqueScoreboard';

export function TraquePage() {
  const { shortCode } = useParams<{ shortCode: string }>();
  const navigate = useNavigate();
  const { state } = useGame();

  // Résoudre le joueur courant via shortCode
  const currentPlayer = useMemo(
    () => state.players.find((p) => p.shortCode === shortCode) ?? null,
    [state.players, shortCode],
  );

  // Charger la progression persistée
  const progress: TraqueProgress | null = useMemo(() => {
    if (!currentPlayer) return null;
    return loadTraque(state.gameId, currentPlayer.id);
  }, [state.gameId, currentPlayer]);

  // Joueurs éligibles (ont un rôle, ne sont pas le joueur courant)
  const eligiblePlayers = useMemo(
    () => state.players.filter((p) => p.role && p.id !== currentPlayer?.id),
    [state.players, currentPlayer],
  );

  // --- Callbacks ---

  const [pendingSelfId, setPendingSelfId] = useState<number | null>(null);

  const handleSelectSelf = useCallback(
    (selfPlayerId: number) => {
      setPendingSelfId(selfPlayerId);
    },
    [],
  );

  const handleSelectTags = useCallback(
    (tags: string[]) => {
      if (pendingSelfId === null) return;
      const pool = eligiblePlayers
        .filter((p) => {
          const pTags = state.playerTags[p.id] ?? [];
          return pTags.some((t) => tags.includes(t));
        })
        .map((p) => p.id);
      let seed = Date.now() & 0xffff;
      for (let i = pool.length - 1; i > 0; i--) {
        seed = (seed * 1664525 + 1013904223) & 0xffffffff;
        const j = Math.abs(seed) % (i + 1);
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const newProgress: TraqueProgress = {
        gameId: state.gameId,
        selfPlayerId: pendingSelfId,
        selectedTags: tags,
        roleOrder: pool,
        currentIndex: 0,
        answers: {},
        startedAt: new Date().toISOString(),
      };
      saveTraque(newProgress);
      navigate(0);
    },
    [pendingSelfId, eligiblePlayers, state.gameId, state.playerTags, navigate],
  );

  const handleAnswer = useCallback(
    (targetPlayerId: number, guessedPlayerId: number | null) => {
      if (!progress) return;
      const correct = guessedPlayerId !== null && guessedPlayerId === targetPlayerId;
      const status: 'correct' | 'wrong' | 'skipped' =
        guessedPlayerId === null ? 'skipped' : correct ? 'correct' : 'wrong';

      const updated: TraqueProgress = {
        ...progress,
        currentIndex: progress.currentIndex + 1,
        answers: {
          ...progress.answers,
          [targetPlayerId]: {
            guessedPlayerId,
            correct,
            status,
          },
        },
      };
      saveTraque(updated);
      navigate(0);
    },
    [progress, navigate],
  );

  const handleRestart = useCallback(() => {
    if (!currentPlayer) return;
    clearTraque(state.gameId, currentPlayer.id);
    navigate(0);
  }, [state.gameId, currentPlayer, navigate]);

  const handleHome = useCallback(() => {
    navigate(`/player/${shortCode}`);
  }, [navigate, shortCode]);

  // --- Rendu ---

  if (!state.gameId || state.players.length === 0) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(180deg, #070b1a 0%, #0f1629 100%)' }}
      >
        <p style={{ color: '#6b7b9b', fontFamily: '"Cinzel", serif' }}>
          Aucune partie en cours.
        </p>
      </div>
    );
  }

  // Étape 1 : choisir qui on est
  if (!progress && pendingSelfId === null) {
    return (
      <TraqueSelfPicker
        state={state}
        onSelect={handleSelectSelf}
      />
    );
  }

  // Étape 2 : choisir les tags
  if (!progress && pendingSelfId !== null) {
    return (
      <TraqueDifficultyPicker
        state={state}
        selfPlayerId={pendingSelfId}
        onSelect={handleSelectTags}
      />
    );
  }

  // Étape 3 : scoreboard final
  if (progress.currentIndex >= progress.roleOrder.length) {
    return (
      <TraqueScoreboard
        state={state}
        progress={progress}
        onRestart={handleRestart}
        onHome={handleHome}
      />
    );
  }

  // Étape 2 : manches
  return (
    <TraqueRoundScreen
      state={state}
      progress={progress}
      onAnswer={handleAnswer}
    />
  );
}
