import { type Player, type GameState } from '../../../../context/GameContext';
import { type GameThemeTokens } from '../../../../context/gameTheme';

/** Props shared by every role action component */
export interface RoleActionBaseProps {
  state: GameState;
  alivePlayers: Player[];
  currentPlayer: Player;
  allPlayers: Player[];
  onFlipBack?: () => void;
  practiceMode?: boolean;
  t: GameThemeTokens;
}
