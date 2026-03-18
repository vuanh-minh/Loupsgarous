export interface GamePreset {
  id: string;
  label: string;
  emoji: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  wolfKillsPerNight: number;
  roles: (playerCount: number) => Record<string, number>;
  /** Optional extra settings applied when this preset is selected */
  extraSettings?: {
    dayEliminationsCount?: number;
    wolfInactivityThreshold?: number;
    villagerInactivityThreshold?: number;
    randomVoteIfInactive?: boolean;
  };
}

export const GAME_PRESETS: GamePreset[] = [
  {
    id: 'hameau',
    label: 'Hameau',
    emoji: '\u{1F3D5}\uFE0F',
    description: '6-10 joueurs \u00B7 1 victime/nuit',
    minPlayers: 3,
    maxPlayers: 10,
    wolfKillsPerNight: 1,
    roles: (n) => {
      const wolves = Math.max(1, Math.round(n * 0.2));
      return {
        'loup-garou': wolves,
        'voyante': 1,
        'sorciere': 1,
        'villageois': Math.max(0, n - wolves - 2),
        'chasseur': 0, 'cupidon': 0, 'petite-fille': 0, 'garde': 0, 'renard': 0, 'corbeau': 0, 'concierge': 0,
      };
    },
  },
  {
    id: 'village',
    label: 'Village',
    emoji: '\u{1F3D8}\uFE0F',
    description: '11-20 joueurs \u00B7 1 victime/nuit',
    minPlayers: 11,
    maxPlayers: 20,
    wolfKillsPerNight: 1,
    roles: (n) => {
      const wolves = Math.max(2, Math.round(n * 0.2));
      const specials = 3; // voyante + sorciere + chasseur
      return {
        'loup-garou': wolves,
        'voyante': 1,
        'sorciere': 1,
        'chasseur': 1,
        'villageois': Math.max(0, n - wolves - specials),
        'cupidon': 0, 'petite-fille': 0, 'garde': 0, 'renard': 0, 'corbeau': 0, 'concierge': 0,
      };
    },
  },
  {
    id: 'bourg',
    label: 'Bourg',
    emoji: '\u{1F3F0}',
    description: '21-35 joueurs \u00B7 2 victimes/nuit',
    minPlayers: 21,
    maxPlayers: 35,
    wolfKillsPerNight: 2,
    roles: (n) => {
      const wolves = Math.max(4, Math.round(n * 0.2));
      const specials = 6; // 2 voyantes + sorciere + chasseur + renard + garde
      return {
        'loup-garou': wolves,
        'voyante': 2,
        'sorciere': 1,
        'chasseur': 1,
        'renard': 1,
        'garde': 1,
        'villageois': Math.max(0, n - wolves - specials),
        'cupidon': 0, 'petite-fille': 0, 'corbeau': 0, 'concierge': 0,
      };
    },
  },
  {
    id: 'metropole',
    label: 'Metropole',
    emoji: '\u{1F3D9}\uFE0F',
    description: '36+ joueurs \u00B7 3 victimes/nuit',
    minPlayers: 36,
    maxPlayers: 60,
    wolfKillsPerNight: 3,
    roles: (n) => {
      // 8 Loups + 2 Corbeaux + 2 Empoisonneurs = 12 wolf team
      // 3 Renards + 2 Concierges + 2 Oracles + 3 Gardes + 3 Chasseurs + 2 Voyantes + 2 Cupidon + 3 Sorcieres + 1 Petite Fille = 21 specials
      const wolfPack = 8;
      const corbeaux = 2;
      const empoisonneurs = 2;
      const specials = 21;
      return {
        'loup-garou': wolfPack,
        'corbeau': corbeaux,
        'empoisonneur': empoisonneurs,
        'voyante': 2,
        'renard': 3,
        'concierge': 2,
        'oracle': 2,
        'garde': 3,
        'chasseur': 3,
        'cupidon': 2,
        'sorciere': 3,
        'petite-fille': 1,
        'villageois': Math.max(0, n - wolfPack - corbeaux - empoisonneurs - specials),
      };
    },
    extraSettings: {
      dayEliminationsCount: 1,
      wolfInactivityThreshold: 2,
      villagerInactivityThreshold: 2,
      randomVoteIfInactive: false,
    },
  },
];
