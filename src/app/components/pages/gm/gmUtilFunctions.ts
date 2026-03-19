import { type Player, type GameState, type GameEvent } from '../../../context/gameTypes';
import { type RoleDefinition, getRoleById } from '../../../data/roles';
import { type HeartbeatMap } from '../../../context/useRealtimeSync';
import { type QuestData } from './gmSharedTypes';

/* ================================================================
   getConnectionStatus
   ================================================================ */
export function getConnectionStatus(shortCode: string | undefined, heartbeats: HeartbeatMap) {
  if (!shortCode || !heartbeats[shortCode]) {
    return { color: '#4a5568', bg: 'rgba(74,85,104,0.15)', label: 'Jamais connecte', dot: '⚫' };
  }
  const elapsed = Date.now() - heartbeats[shortCode];
  const seconds = Math.floor(elapsed / 1000);
  if (seconds < 20) {
    return { color: '#6b8e5a', bg: 'rgba(107,142,90,0.15)', label: 'En ligne', dot: '🟢' };
  }
  if (seconds < 60) {
    return { color: '#d4a843', bg: 'rgba(212,168,67,0.15)', label: `il y a ${seconds}s`, dot: '🟡' };
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return { color: '#c05030', bg: 'rgba(192,80,48,0.15)', label: `il y a ${minutes}min`, dot: '🔴' };
  }
  const hours = Math.floor(minutes / 60);
  return { color: '#4a5568', bg: 'rgba(74,85,104,0.15)', label: `il y a ${hours}h`, dot: '🔴' };
}

/* ================================================================
   buildQuests — compute quest data for a given player
   ================================================================ */
export function buildQuests(p: Player, r: RoleDefinition, state: GameState, alivePlayers: Player[]): QuestData[] {
  const quests: QuestData[] = [];
  const totalWolves = state.players.filter((pl: Player) => pl.role === 'loup-garou').length;
  const aliveWolves = alivePlayers.filter((pl) => pl.role === 'loup-garou');
  const aliveVillagers = alivePlayers.filter((pl) => pl.role !== 'loup-garou');

  // Team quest
  if (r.team === 'werewolf') {
    quests.push({
      id: 'team', emoji: '🐺', color: '#c41e3a',
      title: 'Dominer le village',
      description: 'Etre aussi nombreux que les villageois.',
      progress: aliveVillagers.length > 0 ? Math.min((aliveWolves.length / aliveVillagers.length) * 100, 100) : 100,
      detail: `${aliveWolves.length} vs ${aliveVillagers.length}`,
    });
  } else {
    quests.push({
      id: 'team', emoji: '🛡️', color: '#6b8e5a',
      title: 'Proteger le village',
      description: 'Eliminer tous les loups.',
      progress: totalWolves > 0 ? ((totalWolves - aliveWolves.length) / totalWolves) * 100 : 0,
      detail: `${totalWolves - aliveWolves.length}/${totalWolves} loup(s) elimine(s)`,
    });
  }

  // Survival
  quests.push({
    id: 'survival', emoji: '❤️', color: p.alive ? '#d4a843' : '#c41e3a',
    title: 'Survivre',
    description: p.alive ? `En vie — Tour ${state.turn}` : 'Elimine',
    progress: p.alive ? 100 : 0,
    detail: p.alive ? 'En vie' : 'Mort',
  });

  // Role-specific
  if (p.role === 'voyante') {
    const reveals = state.events.filter((e: GameEvent) => e.message.includes('Voyante a sonde')).length;
    quests.push({
      id: 'seer', emoji: '🔮', color: '#8b5cf6',
      title: 'Vision nocturne',
      description: `${reveals}/3 joueur(s) sonde(s)`,
      progress: Math.min(reveals * 33.3, 100),
      detail: `${reveals}/3`,
    });
  }

  if (p.role === 'sorciere') {
    const potions = ((state.witchHealUsedBy || []).includes(p.id) ? 1 : 0) + ((state.witchKillUsedBy || []).includes(p.id) ? 1 : 0);
    quests.push({
      id: 'witch', emoji: '🧪', color: '#10b981',
      title: 'Potions',
      description: `${potions}/2 utilisee(s)`,
      progress: potions * 50,
      detail: `${potions}/2`,
    });
  }

  if (p.role === 'loup-garou') {
    const kills = state.events.filter((e: GameEvent) => e.message.includes('devore')).length;
    quests.push({
      id: 'wolf-kills', emoji: '🩸', color: '#c41e3a',
      title: 'Victimes',
      description: `${kills} victime(s)`,
      progress: Math.min(kills * 25, 100),
      detail: `${kills}`,
    });
  }

  // ── Quest system tracking ──
  const allQuests = state.quests || [];
  const myAssignedIds = (state.questAssignments || {})[p.id] || [];
  const myAssignedQuests = allQuests.filter((q) => myAssignedIds.includes(q.id));

  if (r.team === 'werewolf') {
    // Werewolves: count total "fail" statuses across ALL quests for ALL players, excluding own quests
    let totalSabotaged = 0;
    for (const q of allQuests) {
      if (myAssignedIds.includes(q.id)) continue; // exclude own quests
      const statuses = q.playerStatuses || {};
      for (const status of Object.values(statuses)) {
        if (status === 'fail') totalSabotaged++;
      }
    }
    quests.push({
      id: 'quest-sabotage', emoji: '💀', color: '#c41e3a',
      title: 'Quêtes sabotées',
      description: 'Saboter un maximum de quêtes',
      progress: totalSabotaged > 0 ? Math.min(totalSabotaged * 20, 100) : 0,
      detail: `${totalSabotaged} sabotée(s)`,
    });
  } else {
    // Village: count own quests with status "success"
    const mySuccessCount = myAssignedQuests.filter(
      (q) => (q.playerStatuses?.[p.id] || 'active') === 'success'
    ).length;
    const totalMyQuests = myAssignedQuests.length;
    quests.push({
      id: 'quest-completion', emoji: '📜', color: '#d4a843',
      title: 'Quêtes',
      description: 'Compléter les quêtes',
      progress: totalMyQuests > 0 ? (mySuccessCount / totalMyQuests) * 100 : 0,
      detail: `${mySuccessCount}/${totalMyQuests}`,
    });
  }

  // ── Enquête (hypothesis accuracy) ──
  const myHypotheses = (state.hypotheses || {})[p.id] || {};
  const hypothesisEntries = Object.entries(myHypotheses).filter(([, roleId]) => roleId);

  if (r.team === 'werewolf') {
    // Wolves: "Enquêter sur les pouvoirs" — correct role guesses / total special village roles in game
    // Special village roles = village team but NOT 'villageois'
    const totalSpecialRoles = state.players.filter((pl) => {
      const plRole = getRoleById(pl.role);
      return plRole && plRole.team === 'village' && plRole.id !== 'villageois';
    }).length;
    const correctSpecial = hypothesisEntries.filter(([targetIdStr, roleId]) => {
      const target = state.players.find((pl) => pl.id === parseInt(targetIdStr));
      if (!target) return false;
      const targetRole = getRoleById(target.role);
      return target.role === roleId && targetRole && targetRole.team === 'village' && targetRole.id !== 'villageois';
    }).length;
    quests.push({
      id: 'investigation', emoji: '🔍', color: '#c41e3a',
      title: 'Enquête',
      description: 'Enquêter sur les pouvoirs',
      progress: totalSpecialRoles > 0 ? (correctSpecial / totalSpecialRoles) * 100 : 0,
      detail: `${correctSpecial}/${totalSpecialRoles}`,
    });
  } else {
    // Village: "Enquêter sur les rôles" — correct guesses / total guesses
    const correctCount = hypothesisEntries.filter(([targetIdStr, roleId]) => {
      const target = state.players.find((pl) => pl.id === parseInt(targetIdStr));
      return target && target.role === roleId;
    }).length;
    const totalCount = hypothesisEntries.length;
    quests.push({
      id: 'investigation', emoji: '🔍', color: '#8b5cf6',
      title: 'Enquête',
      description: 'Enquêter sur les rôles',
      progress: totalCount > 0 ? (correctCount / totalCount) * 100 : 0,
      detail: `${correctCount}/${totalCount}`,
    });
  }

  return quests;
}