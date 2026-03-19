export const PLAYER_AVATARS = [
  '🧔','👩','👨','👵','🧑','👴','👱‍♀️','👱','🧑‍🦰','👩‍🦱',
  '👨‍🦳','👩‍🦳','🧑‍🦲','👩‍🦲','🧓','👲','🧕','👳‍♀️','👳','🤵',
  '🧑‍🎤','👩‍🎤','👨‍🎤','🧑‍🏫','👩‍🏫','👨‍🏫','🧑‍🍳','👩‍🍳','👨‍🍳','🧑‍🔧',
  '👩‍🔧','👨‍🔧','🧑‍💼','👩‍💼','👨‍💼','🧑‍🔬','👩‍🔬','👨‍🔬','🧑‍💻','👩‍💻',
  '👨‍💻','🧑‍🎨','👩‍🎨','👨‍🎨','🧑‍🚒','👩‍🚒','👨‍🚒','🧑‍✈️','👩‍✈️','👨‍✈️',
  '🧑‍🚀','👩‍🚀','👨‍🚀','🧑‍⚖️','👩‍⚖️','👨‍⚖️','🫅','🥷','🦸','🦹',
];

export interface PlayerEntry {
  id: number;
  name: string;
  avatar: string;
  avatarUrl?: string;
  shortCode?: string;
  /** Pre-assigned role id (set by GM in lobby). Undefined = random. */
  assignedRole?: string;
}