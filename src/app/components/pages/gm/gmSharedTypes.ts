export type { GameThemeTokens } from '../../../context/gameTheme';
export type { HeartbeatMap } from '../../../context/useRealtimeSync';

export interface GameListEntry {
  id: string;
  name: string;
  createdAt: string;
  playerCount: number;
  aliveCount: number;
  phase: string;
  turn: number;
  screen: string;
}

export type MobileGameView = 'controls' | 'players' | 'journal';

export interface QuestData {
  id: string;
  emoji: string;
  color: string;
  title: string;
  description: string;
  progress: number;
  detail: string;
}
