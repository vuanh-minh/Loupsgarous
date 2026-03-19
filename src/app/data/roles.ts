export interface RoleDefinition {
  id: string;
  name: string;
  /** French article: 'le' or 'la' (lowercase) — used by resolveHintText */
  article: 'le' | 'la';
  team: 'village' | 'werewolf' | 'solo';
  emoji: string;
  color: string;
  description: string;
  power: string;
  minCount: number;
  maxCount: number;
  defaultCount: number;
}

export const ROLES: RoleDefinition[] = [
  {
    id: 'villageois',
    name: 'Villageois',
    article: 'le',
    team: 'village',
    emoji: '🧑‍🌾',
    color: '#6b8e5a',
    description: 'Un simple habitant du village, sans pouvoir particulier.',
    power: 'Aucun pouvoir special. Participe aux votes du village pour eliminer les suspects.',
    minCount: 0,
    maxCount: 50,
    defaultCount: 3,
  },
  {
    id: 'loup-garou',
    name: 'Loup-Garou',
    article: 'le',
    team: 'werewolf',
    emoji: '🐺',
    color: '#c41e3a',
    description: 'Un predateur qui se deguise en villageois le jour.',
    power: 'Chaque nuit, les Loups-Garous se reveillent et choisissent ensemble une victime a devorer.',
    minCount: 0,
    maxCount: 15,
    defaultCount: 0,
  },
  {
    id: 'voyante',
    name: 'Voyante',
    article: 'la',
    team: 'village',
    emoji: '🔮',
    color: '#8b5cf6',
    description: 'Une devineresse capable de percer les secrets des villageois.',
    power: 'Chaque nuit, la Voyante peut decouvrir la veritable identite d\'un joueur de son choix.',
    minCount: 0,
    maxCount: 15,
    defaultCount: 1,
  },
  {
    id: 'chasseur',
    name: 'Chasseur',
    article: 'le',
    team: 'village',
    emoji: '🏹',
    color: '#d97706',
    description: 'Un tireur d\'elite qui ne part jamais sans son arme.',
    power: 'Lorsque le Chasseur est elimine, il peut tirer sur un joueur de son choix et l\'eliminer immediatement.',
    minCount: 0,
    maxCount: 15,
    defaultCount: 0,
  },
  {
    id: 'cupidon',
    name: 'Cupidon',
    article: 'le',
    team: 'village',
    emoji: '💘',
    color: '#ec4899',
    description: 'Le dieu de l\'amour qui unit deux ames pour le meilleur et le pire.',
    power: 'Au debut de la partie, Cupidon designe deux joueurs qui deviennent Amoureux. Si l\'un meurt, l\'autre meurt aussi.',
    minCount: 0,
    maxCount: 15,
    defaultCount: 0,
  },
  {
    id: 'sorciere',
    name: 'Sorciere',
    article: 'la',
    team: 'village',
    emoji: '🧙‍♀️',
    color: '#10b981',
    description: 'Une femme aux connaissances ancestrales, maitrisant potions et remedes.',
    power: 'La Sorciere possede 2 potions : une de guerison (ressuscite la victime des loups) et une d\'empoisonnement (tue un joueur).',
    minCount: 0,
    maxCount: 15,
    defaultCount: 1,
  },
  {
    id: 'garde',
    name: 'Garde',
    article: 'le',
    team: 'village',
    emoji: '🛡️',
    color: '#3b82f6',
    description: 'Un protecteur vigilant qui veille sur le village pendant la nuit.',
    power: 'Chaque nuit, le Garde choisit un joueur a proteger. Si ce joueur est cible, l\'elimination echoue. Il ne peut pas proteger le meme joueur deux nuits de suite, ni se proteger lui-meme.',
    minCount: 0,
    maxCount: 15,
    defaultCount: 0,
  },
  {
    id: 'petite-fille',
    name: 'Petite Fille',
    article: 'la',
    team: 'village',
    emoji: '👧',
    color: '#f59e0b',
    description: 'Une fillette curieuse et courageuse, mais imprudente.',
    power: 'La Petite Fille peut espionner les Loups-Garous pendant leur tour, mais risque d\'etre devoree si elle est reperage.',
    minCount: 0,
    maxCount: 15,
    defaultCount: 0,
  },
  {
    id: 'corbeau',
    name: 'Corbeau',
    article: 'le',
    team: 'werewolf',
    emoji: '🐦‍⬛',
    color: '#4a3660',
    description: 'Un messager de l\'ombre qui seme le doute et la suspicion parmi les villageois.',
    power: 'Chaque nuit, le Corbeau intercepte un indice dynamique du jeu. Le role mentionne dans l\'indice est remplace par un autre role, creant une fausse piste. Il choisit ensuite un joueur a qui envoyer cet indice trompeur.',
    minCount: 0,
    maxCount: 15,
    defaultCount: 0,
  },
  {
    id: 'renard',
    name: 'Renard',
    article: 'le',
    team: 'village',
    emoji: '🦊',
    color: '#f97316',
    description: 'Un pisteur ruse qui flaire la presence des loups parmi les villageois.',
    power: 'Chaque nuit, le Renard designe 3 joueurs. Il apprend si au moins un Loup-Garou se cache parmi eux, sans savoir lequel.',
    minCount: 0,
    maxCount: 15,
    defaultCount: 0,
  },
  {
    id: 'concierge',
    name: 'Concierge',
    article: 'le',
    team: 'village',
    emoji: '🔑',
    color: '#0ea5e9',
    description: 'Le gardien de l\'immeuble, observateur discret des allers et venues nocturnes.',
    power: 'Chaque nuit, le Concierge choisit un joueur et decouvre s\'il est sorti de chez lui, et si oui, qui il a visite. Il ne decouvre jamais le role ni la nature de l\'action.',
    minCount: 0,
    maxCount: 15,
    defaultCount: 0,
  },
  {
    id: 'oracle',
    name: 'Oracle',
    article: 'le' as const,
    team: 'village' as const,
    emoji: '🌙',
    color: '#7c3aed',
    description: 'Un mystique capable de percevoir l\'issue de la nuit avant l\'aube.',
    power: 'Chaque nuit, l\'Oracle peut consulter les etoiles pour decouvrir ce qui se passe durant la nuit : qui est devore, sauve ou empoisonne.',
    minCount: 0,
    maxCount: 15,
    defaultCount: 0,
  },
  {
    id: 'empoisonneur',
    name: 'Empoisonneur',
    article: 'le' as const,
    team: 'werewolf' as const,
    emoji: '🧪',
    color: '#65a30d',
    description: 'Un alchimiste malfaisant qui manipule les esprits en semant la confusion.',
    power: 'Chaque nuit, l\'Empoisonneur cible un joueur. La prochaine quete que ce joueur terminera (individuelle ou collaborative) sera automatiquement sabotee. La victime ne sait pas qu\'elle est empoisonnee.',
    minCount: 0,
    maxCount: 15,
    defaultCount: 0,
  },
];

export const getRoleById = (id: string): RoleDefinition | undefined =>
  ROLES.find((r) => r.id === id);

export const getTeamName = (team: string): string => {
  switch (team) {
    case 'village': return 'Village';
    case 'werewolf': return 'Loups-Garous';
    case 'solo': return 'Solitaire';
    default: return team;
  }
};

/**
 * Returns the role name with its French article.
 * e.g. getRoleNameWithArticle('voyante') => 'la Voyante'
 * With capitalize=true: 'La Voyante'
 */
export const getRoleNameWithArticle = (id: string, capitalize = false): string => {
  const role = getRoleById(id);
  if (!role) return id;
  const art = capitalize
    ? role.article.charAt(0).toUpperCase() + role.article.slice(1)
    : role.article;
  return `${art} ${role.name}`;
};