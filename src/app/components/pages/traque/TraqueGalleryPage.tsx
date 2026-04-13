import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Loader2 } from 'lucide-react';
import { AVATAR_GALLERY } from '../../../data/avatarGallery';
import { AVATAR_DEFAULT_TAGS } from '../../../data/avatarDefaultTags';
import { API_BASE, jsonAuthHeaders } from '../../../context/apiConfig';
import type { GameState, DynamicHint, TraqueProgress } from '../../../context/gameTypes';
import type { GalleryHintsMap, GalleryRolesMap } from '../gm/GMPlayerGalleryPanel';
import { loadTraque, saveTraque, clearTraque, saveFirstTagScore } from '../player/traque/traqueStorage';
import { TraqueSelfPicker } from '../player/traque/TraqueSelfPicker';
import { TraqueDifficultyPicker } from '../player/traque/TraqueDifficultyPicker';
import { TraqueRoundScreen } from '../player/traque/TraqueRoundScreen';
import { TraqueScoreboard } from '../player/traque/TraqueScoreboard';

const GALLERY_GAME_ID = 'gallery';

/** Identifiant de partie galerie pour un tag donné */
function galleryGameId(tag: string): string {
  return `gallery-${tag}`;
}

/** Construit un GameState synthétique à partir des données de la galerie */
function buildMockState(
  galleryHints: GalleryHintsMap,
  galleryRoles: GalleryRolesMap,
  deletedIds: number[],
): GameState {
  // Tous les avatars non supprimés (pour le picker + le dropdown de devinette)
  const avatars = AVATAR_GALLERY.filter((ga) => !deletedIds.includes(ga.id));

  const players = avatars.map((ga) => ({
    id: ga.id,
    shortCode: String(ga.id),
    name: ga.name,
    role: galleryRoles[ga.id] ?? '',
    alive: true,
    avatar: '',
    avatarUrl: ga.url,
    votesReceived: 0,
  }));

  const playerTags: Record<number, string[]> = {};
  players.forEach((p) => {
    const tags = AVATAR_DEFAULT_TAGS[p.name];
    if (tags && tags.length > 0) playerTags[p.id] = tags;
  });

  const dynamicHints: DynamicHint[] = [];
  players.forEach((p) => {
    const hints = galleryHints[p.id] ?? [];
    hints.forEach((h) => {
      dynamicHints.push({
        id: h.id,
        targetPlayerId: p.id,
        text: h.text,
        imageUrl: h.imageUrl,
        priority: h.priority,
        revealed: true,
        createdAt: '',
      });
    });
  });

  // GameState minimal requis par les composants Traque
  return {
    gameId: GALLERY_GAME_ID,
    players,
    playerTags,
    dynamicHints,
    availableTags: [...new Set(Object.values(AVATAR_DEFAULT_TAGS).flat())],
    // Champs requis par le type mais non utilisés par Traque :
    screen: 'end',
    roleConfig: {},
    phase: 'day',
    nightStep: 'werewolves',
    dayStep: 'discussion',
    turn: 0,
    events: [],
    timer: 0,
    timerRunning: false,
    winner: null,
    werewolfTarget: null,
    werewolfVotes: {},
    werewolfTargets: [],
    wolfKillsPerNight: 1,
    seerTargets: {},
    seerResults: {},
    witchHealUsedBy: [],
    witchKillUsedBy: [],
    witchHealTarget: null,
    witchKillTargets: {},
    witchHealedThisNight: {},
    votes: {},
    voteResult: null,
    voteResults: [],
    dayEliminationsCount: 1,
    loverPairs: [],
    cupidLinkedBy: [],
    hunterPending: false,
    hunterShooterId: null,
    hunterPreTargets: {},
    hypotheses: {},
    voteHistory: [],
    roleRevealDone: true,
    roleRevealedBy: [],
    guardTargets: {},
    guardLastTargets: {},
    corbeauTargets: {},
    corbeauMessages: {},
    corbeauLastTargets: {},
    earlyVotes: {},
    foxTargets: {},
    foxResults: {},
    hints: [],
    playerHints: [],
    phaseTimerDuration: 0,
    phaseTimerEndAt: null,
    phaseTimerDayDuration: 0,
    phaseTimerNightDuration: 0,
    phaseTimerMaireDuration: 0,
    maireId: null,
    maireElectionDone: false,
    maireVotes: {},
    maireCandidates: [],
    maireCampaignMessages: {},
    maireSuccessionPending: false,
    maireSuccessionFromId: null,
    maireSuccessionPhase: null,
    conciergeTargets: {},
    oracleUsed: {},
    oracleResults: {},
    empoisonneurTargets: {},
    poisonedPlayers: {},
    wolfMissedVotes: {},
    wolfInactivityThreshold: 0,
    villagerMissedVotes: {},
    villagerInactivityThreshold: 0,
    randomVoteIfInactive: false,
    nominations: {},
    quests: [],
    questAssignments: {},
    questsPerPhase: 0,
    questCompletionsThisPhase: {},
    suspectLists: {},
    gameMode: 'classic',
    werewolfVoteMessages: {},
    wolfPreTargets: {},
  } as unknown as GameState;
}

export function TraqueGalleryPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mockState, setMockState] = useState<GameState | null>(null);
  const [progress, setProgress] = useState<TraqueProgress | null>(null);
  /** Joueur sélectionné en attente du choix de difficulté */
  const [pendingSelfId, setPendingSelfId] = useState<number | null>(null);

  // Charger les données de la galerie
  useEffect(() => {
    let cancelled = false;
    async function fetchGallery() {
      try {
        const [hintsRes, rolesRes, deletedRes] = await Promise.all([
          fetch(`${API_BASE}/gallery/hints`, { headers: jsonAuthHeaders() }),
          fetch(`${API_BASE}/gallery/roles`, { headers: jsonAuthHeaders() }),
          fetch(`${API_BASE}/gallery/deleted`, { headers: jsonAuthHeaders() }),
        ]);

        const hintsJson = hintsRes.ok ? await hintsRes.json() : {};
        const rolesJson = rolesRes.ok ? await rolesRes.json() : {};
        const deletedJson = deletedRes.ok ? await deletedRes.json() : {};

        const hintsData: GalleryHintsMap = hintsJson.hints ?? hintsJson;
        const rolesData: GalleryRolesMap = rolesJson.roles ?? rolesJson;
        const deletedData: number[] = deletedJson.deleted ?? deletedJson ?? [];

        if (cancelled) return;
        const state = buildMockState(hintsData, rolesData, deletedData);
        setMockState(state);
      } catch {
        if (!cancelled) setError('Impossible de charger la galerie. Vérifie ta connexion.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchGallery();
    return () => { cancelled = true; };
  }, []);

  // Seuls les joueurs avec un rôle explicitement assigné deviennent des cibles de manche
  const eligiblePlayerIds = useMemo(
    () => mockState?.players.filter((p) => p.role !== '').map((p) => p.id) ?? [],
    [mockState],
  );

  // ─── Callbacks ───────────────────────────────────────────────────

  const handleSelectSelf = useCallback(
    (selfPlayerId: number) => {
      setPendingSelfId(selfPlayerId);
    },
    [],
  );

  const handleSelectTags = useCallback(
    (tags: string[]) => {
      if (!mockState || pendingSelfId === null) return;
      const tag = tags[0];
      const gameId = galleryGameId(tag);

      // Reprendre une partie en cours si elle existe
      const existing = loadTraque(gameId, pendingSelfId);
      if (existing && existing.currentIndex < existing.roleOrder.length) {
        // Nettoyage défensif : s'assurer que selfPlayerId n'est pas dans roleOrder
        const safeOrder = existing.roleOrder.filter((id) => id !== pendingSelfId);
        const safeProgress = safeOrder.length !== existing.roleOrder.length
          ? { ...existing, roleOrder: safeOrder }
          : existing;
        setProgress(safeProgress);
        setPendingSelfId(null);
        return;
      }

      // Nouvelle partie : filtre les joueurs éligibles selon le tag
      let pool = eligiblePlayerIds.filter((id) => {
        if (id === pendingSelfId) return false;
        const pTags = mockState.playerTags[id] ?? [];
        return pTags.some((t) => tags.includes(t));
      });

      // Shuffle
      let seed = Date.now() & 0xffff;
      for (let i = pool.length - 1; i > 0; i--) {
        seed = (seed * 1664525 + 1013904223) & 0xffffffff;
        const j = Math.abs(seed) % (i + 1);
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }

      const newProgress: TraqueProgress = {
        gameId,
        selfPlayerId: pendingSelfId,
        selectedTags: tags,
        roleOrder: pool,
        currentIndex: 0,
        answers: {},
        startedAt: new Date().toISOString(),
      };
      saveTraque(newProgress);
      setProgress(newProgress);
      setPendingSelfId(null);
    },
    [mockState, pendingSelfId, eligiblePlayerIds],
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
          [targetPlayerId]: { guessedPlayerId, correct, status },
        },
      };
      saveTraque(updated);

      // Dernière manche : sauvegarder le score de la première tentative
      if (updated.currentIndex >= updated.roleOrder.length) {
        const totalCorrect = Object.values(updated.answers).filter((a) => a.correct).length;
        const total = updated.roleOrder.length;
        const tag = updated.selectedTags[0];
        const isFirst = saveFirstTagScore(updated.selfPlayerId, tag, totalCorrect, total);
        // Envoyer au serveur seulement si c'est la première tentative
        if (isFirst) {
          fetch(`${API_BASE}/gallery/scores`, {
            method: 'POST',
            headers: jsonAuthHeaders(),
            body: JSON.stringify({ selfPlayerId: updated.selfPlayerId, tag, correct: totalCorrect, total }),
          }).catch(() => {});
        }
      }

      setProgress(updated);
    },
    [progress],
  );

  const handleRestart = useCallback(() => {
    if (!progress) return;
    clearTraque(progress.gameId, progress.selfPlayerId);
    setProgress(null);
    // Remettre sur le sélecteur de tag (garde le selfPlayerId)
    setPendingSelfId(progress.selfPlayerId);
  }, [progress]);

  const handleHome = useCallback(() => navigate('/'), [navigate]);

  // ─── Rendu ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4"
        style={{ background: 'linear-gradient(180deg, #070b1a 0%, #0f1629 100%)' }}
      >
        <Loader2 size={28} className="animate-spin" style={{ color: '#d4a843' }} />
        <p style={{ color: '#6b7b9b', fontFamily: '"Cinzel", serif', fontSize: '0.8rem' }}>
          Chargement de la galerie…
        </p>
      </div>
    );
  }

  if (error || !mockState || mockState.players.length < 2) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4 px-6"
        style={{ background: 'linear-gradient(180deg, #070b1a 0%, #0f1629 100%)' }}
      >
        <span className="text-4xl">🐺</span>
        <p style={{ color: '#c41e3a', fontFamily: '"Cinzel", serif', fontSize: '0.85rem', textAlign: 'center' }}>
          {error ?? 'La galerie ne contient pas encore assez de joueurs avec un rôle assigné.'}
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-2 px-6 py-2.5 rounded-xl active:scale-95 transition-transform"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#8090b0',
            fontFamily: '"Cinzel", serif',
            fontSize: '0.78rem',
          }}
        >
          Retour
        </button>
      </div>
    );
  }

  // Étape 1 : sélectionner qui on est
  if (!progress && pendingSelfId === null) {
    return <TraqueSelfPicker state={mockState} onSelect={handleSelectSelf} />;
  }

  // Étape 2 : choisir les tags
  if (!progress && pendingSelfId !== null) {
    return (
      <TraqueDifficultyPicker
        state={mockState}
        selfPlayerId={pendingSelfId}
        onSelect={handleSelectTags}
        onBack={() => setPendingSelfId(null)}
      />
    );
  }

  // Scoreboard final
  if (progress.currentIndex >= progress.roleOrder.length) {
    return (
      <TraqueScoreboard
        state={mockState}
        progress={progress}
        onRestart={handleRestart}
        onHome={handleHome}
      />
    );
  }

  // Manche en cours
  return (
    <TraqueRoundScreen
      state={mockState}
      progress={progress}
      onAnswer={handleAnswer}
    />
  );
}
