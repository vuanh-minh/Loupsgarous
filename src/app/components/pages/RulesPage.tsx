import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Moon, Sun, Skull, Users, Shield, ChevronDown,
  ChevronUp, Swords, Heart, Eye, Sparkles, BookOpen, HelpCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { ROLES, type RoleDefinition } from '../../data/roles';

/* ── Team metadata ── */
const TEAM_META: Record<string, { label: string; color: string; bgColor: string; borderColor: string; icon: typeof Users }> = {
  village: { label: 'Village', color: '#6b8e5a', bgColor: 'rgba(107,142,90,0.1)', borderColor: 'rgba(107,142,90,0.25)', icon: Users },
  werewolf: { label: 'Loups-Garous', color: '#c41e3a', bgColor: 'rgba(196,30,58,0.1)', borderColor: 'rgba(196,30,58,0.25)', icon: Skull },
  solo: { label: 'Solitaire', color: '#d4a843', bgColor: 'rgba(212,168,67,0.1)', borderColor: 'rgba(212,168,67,0.25)', icon: Eye },
};

/* ── Role Card ── */
function RoleCard({ role, index }: { role: RoleDefinition; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const team = TEAM_META[role.team] || TEAM_META.village;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * Math.min(index, 12), duration: 0.35 }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left rounded-xl transition-all"
        style={{
          background: expanded
            ? `linear-gradient(135deg, ${role.color}12, ${role.color}06)`
            : 'rgba(255,255,255,0.03)',
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: expanded ? `${role.color}40` : 'rgba(255,255,255,0.06)',
        }}
      >
        {/* Header row */}
        <div className="flex items-center gap-3 px-4 py-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{
              background: `${role.color}20`,
              borderWidth: 2,
              borderStyle: 'solid',
              borderColor: `${role.color}50`,
            }}
          >
            <span className="text-xl leading-none">{role.emoji}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="truncate"
              style={{
                fontFamily: '"Cinzel", serif',
                color: expanded ? role.color : '#c0c8d8',
                fontSize: '0.85rem',
                fontWeight: 700,
              }}
            >
              {role.name}
            </p>
            <span
              className="inline-block px-2 py-0.5 rounded-full mt-0.5"
              style={{
                fontSize: '0.5rem',
                fontFamily: '"Cinzel", serif',
                fontWeight: 600,
                background: team.bgColor,
                color: team.color,
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: team.borderColor,
              }}
            >
              {team.label}
            </span>
          </div>
          {expanded ? (
            <ChevronUp size={16} style={{ color: role.color, flexShrink: 0 }} />
          ) : (
            <ChevronDown size={16} style={{ color: 'rgba(192,200,216,0.4)', flexShrink: 0 }} />
          )}
        </div>

        {/* Expanded content */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div
                className="px-4 pb-4 pt-0"
                style={{ borderTop: `1px solid ${role.color}20` }}
              >
                <p
                  className="mt-3"
                  style={{ color: 'rgba(192,200,216,0.7)', fontSize: '0.72rem', lineHeight: 1.6 }}
                >
                  {role.description}
                </p>
                <div
                  className="mt-3 rounded-lg px-3 py-2.5"
                  style={{
                    background: `${role.color}0a`,
                    borderWidth: 1,
                    borderStyle: 'solid',
                    borderColor: `${role.color}20`,
                  }}
                >
                  <div className="flex items-start gap-2">
                    <Sparkles size={13} style={{ color: role.color, marginTop: 2, flexShrink: 0 }} />
                    <p style={{ color: '#e8dcc8', fontSize: '0.68rem', lineHeight: 1.6 }}>
                      {role.power}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    </motion.div>
  );
}

/* ── Collapsible Section ── */
function RuleSection({
  icon: Icon,
  title,
  children,
  defaultOpen = false,
  accentColor = '#d4a843',
}: {
  icon: typeof Moon;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  accentColor?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: open ? 'rgba(255,255,255,0.02)' : 'transparent',
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: open ? 'rgba(255,255,255,0.06)' : 'transparent',
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
      >
        <Icon size={18} style={{ color: accentColor, flexShrink: 0 }} />
        <h3
          className="flex-1"
          style={{
            fontFamily: '"Cinzel", serif',
            color: '#c0c8d8',
            fontSize: '0.9rem',
            fontWeight: 700,
          }}
        >
          {title}
        </h3>
        {open ? (
          <ChevronUp size={16} style={{ color: 'rgba(192,200,216,0.4)' }} />
        ) : (
          <ChevronDown size={16} style={{ color: 'rgba(192,200,216,0.4)' }} />
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Main Page ── */
export function RulesPage() {
  const navigate = useNavigate();
  const [teamFilter, setTeamFilter] = useState<'all' | 'village' | 'werewolf' | 'solo'>('all');

  const filteredRoles = useMemo(
    () => (teamFilter === 'all' ? ROLES : ROLES.filter((r) => r.team === teamFilter)),
    [teamFilter],
  );

  const teamCounts = useMemo(() => ({
    all: ROLES.length,
    village: ROLES.filter((r) => r.team === 'village').length,
    werewolf: ROLES.filter((r) => r.team === 'werewolf').length,
    solo: ROLES.filter((r) => r.team === 'solo').length,
  }), []);

  const filters: { key: typeof teamFilter; label: string; color: string }[] = [
    { key: 'all', label: 'Tous', color: '#d4a843' },
    { key: 'village', label: 'Village', color: '#6b8e5a' },
    { key: 'werewolf', label: 'Loups', color: '#c41e3a' },
    { key: 'solo', label: 'Solo', color: '#d4a843' },
  ];

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'linear-gradient(180deg, #070b1a 0%, #0f1629 30%, #0d0f20 100%)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)',
      }}
    >
      {/* ── Header ── */}
      <div
        className="sticky top-0 z-30"
        style={{
          background: 'rgba(7,11,26,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(212,168,67,0.12)',
        }}
      >
        <div className="max-w-lg mx-auto flex items-center gap-3 px-4 py-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/')}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <ArrowLeft size={16} style={{ color: '#c0c8d8' }} />
          </motion.button>
          <div className="flex-1">
            <h1
              style={{
                fontFamily: '"Cinzel", serif',
                color: '#d4a843',
                fontSize: '1.1rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
              }}
            >
              Regles du jeu
            </h1>
            <p style={{ color: '#6b7b9b', fontSize: '0.6rem', marginTop: 1 }}>
              Loup-Garou &mdash; Guide complet
            </p>
          </div>
          <BookOpen size={20} style={{ color: 'rgba(212,168,67,0.4)' }} />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-4">
        {/* ── Hero ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center py-6"
        >
          <span className="text-5xl block mb-3">🐺</span>
          <h2
            style={{
              fontFamily: '"Cinzel", serif',
              color: '#d4a843',
              fontSize: '1.4rem',
              fontWeight: 700,
              letterSpacing: '0.05em',
            }}
          >
            Les Loups-Garous
          </h2>
          <p
            style={{
              color: '#8090b0',
              fontSize: '0.75rem',
              marginTop: '0.5rem',
              maxWidth: '320px',
              marginLeft: 'auto',
              marginRight: 'auto',
              lineHeight: 1.6,
            }}
          >
            Un jeu de deduction sociale ou les villageois tentent de demasquer les loups-garous
            qui les devorent chaque nuit.
          </p>
        </motion.div>

        {/* ── Game Overview ── */}
        <RuleSection icon={HelpCircle} title="Comment jouer ?" defaultOpen accentColor="#d4a843">
          <div className="flex flex-col gap-3">
            <p style={{ color: 'rgba(192,200,216,0.7)', fontSize: '0.72rem', lineHeight: 1.7 }}>
              Le Loup-Garou est un jeu en deux equipes : le <strong style={{ color: '#6b8e5a' }}>Village</strong> et
              les <strong style={{ color: '#c41e3a' }}>Loups-Garous</strong>. Le jeu alterne entre phases de{' '}
              <strong style={{ color: '#7c8db5' }}>Nuit</strong> et de{' '}
              <strong style={{ color: '#f0c55b' }}>Jour</strong>.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <div
                className="rounded-lg px-3 py-3 flex flex-col items-center text-center gap-1.5"
                style={{
                  background: 'rgba(124,141,181,0.08)',
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: 'rgba(124,141,181,0.2)',
                }}
              >
                <Moon size={20} style={{ color: '#7c8db5' }} />
                <p style={{ fontFamily: '"Cinzel", serif', color: '#7c8db5', fontSize: '0.7rem', fontWeight: 700 }}>
                  Nuit
                </p>
                <p style={{ color: 'rgba(192,200,216,0.55)', fontSize: '0.6rem', lineHeight: 1.5 }}>
                  Les loups choisissent une victime. Les roles speciaux agissent.
                </p>
              </div>
              <div
                className="rounded-lg px-3 py-3 flex flex-col items-center text-center gap-1.5"
                style={{
                  background: 'rgba(240,197,91,0.06)',
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: 'rgba(240,197,91,0.15)',
                }}
              >
                <Sun size={20} style={{ color: '#f0c55b' }} />
                <p style={{ fontFamily: '"Cinzel", serif', color: '#f0c55b', fontSize: '0.7rem', fontWeight: 700 }}>
                  Jour
                </p>
                <p style={{ color: 'rgba(192,200,216,0.55)', fontSize: '0.6rem', lineHeight: 1.5 }}>
                  Le village debat et vote pour eliminer un suspect.
                </p>
              </div>
            </div>
          </div>
        </RuleSection>

        {/* ── Victory Conditions ── */}
        <RuleSection icon={Swords} title="Conditions de victoire" accentColor="#c41e3a">
          <div className="flex flex-col gap-3">
            <div
              className="flex items-start gap-3 rounded-lg px-3 py-2.5"
              style={{
                background: 'rgba(107,142,90,0.08)',
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: 'rgba(107,142,90,0.2)',
              }}
            >
              <Users size={16} style={{ color: '#6b8e5a', marginTop: 2, flexShrink: 0 }} />
              <div>
                <p style={{ fontFamily: '"Cinzel", serif', color: '#6b8e5a', fontSize: '0.72rem', fontWeight: 700 }}>
                  Victoire du Village
                </p>
                <p style={{ color: 'rgba(192,200,216,0.6)', fontSize: '0.65rem', lineHeight: 1.6, marginTop: 2 }}>
                  Tous les Loups-Garous sont elimines.
                </p>
              </div>
            </div>
            <div
              className="flex items-start gap-3 rounded-lg px-3 py-2.5"
              style={{
                background: 'rgba(196,30,58,0.08)',
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: 'rgba(196,30,58,0.2)',
              }}
            >
              <Skull size={16} style={{ color: '#c41e3a', marginTop: 2, flexShrink: 0 }} />
              <div>
                <p style={{ fontFamily: '"Cinzel", serif', color: '#c41e3a', fontSize: '0.72rem', fontWeight: 700 }}>
                  Victoire des Loups
                </p>
                <p style={{ color: 'rgba(192,200,216,0.6)', fontSize: '0.65rem', lineHeight: 1.6, marginTop: 2 }}>
                  Les Loups-Garous egalent ou surpassent le nombre de villageois.
                </p>
              </div>
            </div>
            <div
              className="flex items-start gap-3 rounded-lg px-3 py-2.5"
              style={{
                background: 'rgba(236,72,153,0.06)',
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: 'rgba(236,72,153,0.15)',
              }}
            >
              <Heart size={16} style={{ color: '#ec4899', marginTop: 2, flexShrink: 0 }} />
              <div>
                <p style={{ fontFamily: '"Cinzel", serif', color: '#ec4899', fontSize: '0.72rem', fontWeight: 700 }}>
                  Victoire des Amoureux
                </p>
                <p style={{ color: 'rgba(192,200,216,0.6)', fontSize: '0.65rem', lineHeight: 1.6, marginTop: 2 }}>
                  Si Cupidon a lie un Villageois et un Loup-Garou, les Amoureux gagnent s'ils sont
                  les deux derniers survivants.
                </p>
              </div>
            </div>
          </div>
        </RuleSection>

        {/* ── Night Phase Detail ── */}
        <RuleSection icon={Moon} title="Deroulement de la nuit" accentColor="#7c8db5">
          <div className="flex flex-col gap-2">
            {[
              { step: '1', title: 'Le village s\'endort', desc: 'Tous les joueurs ferment les yeux. Le Maitre du jeu orchestre la nuit.', emoji: '😴' },
              { step: '2', title: 'Cupidon se reveille', desc: '(1ère nuit uniquement) Il designe deux joueurs qui deviennent Amoureux pour toute la partie.', emoji: '💘' },
              { step: '3', title: 'La Voyante se reveille', desc: 'Elle designe un joueur pour decouvrir son role.', emoji: '🔮' },
              { step: '4', title: 'Le Garde se reveille', desc: 'Il choisit un joueur a proteger contre les loups cette nuit.', emoji: '🛡️' },
              { step: '5', title: 'Les Loups-Garous se reveillent', desc: 'Ils choisissent ensemble une victime a devorer.', emoji: '🐺' },
              { step: '6', title: 'Le Corbeau se reveille', desc: 'Il intercepte un indice et le falsifie, puis choisit un joueur a qui envoyer cette fausse piste.', emoji: '🐦‍⬛' },
              { step: '7', title: 'L\'Empoisonneur agit', desc: 'Il cible un joueur dont la prochaine quete sera automatiquement sabotee.', emoji: '🧪' },
              { step: '8', title: 'La Sorciere se reveille', desc: 'Elle peut sauver la victime des loups ou empoisonner un autre joueur.', emoji: '🧙‍♀️' },
              { step: '9', title: 'Le Renard enquete', desc: 'Il designe 3 joueurs et apprend si au moins un Loup-Garou se cache parmi eux.', emoji: '🦊' },
              { step: '10', title: 'Le Concierge observe', desc: 'Il choisit un joueur et decouvre s\'il est sorti de chez lui et qui il a visite.', emoji: '🔑' },
              { step: '11', title: 'L\'Oracle consulte les etoiles', desc: 'Il decouvre ce qui s\'est passe cette nuit : qui est devore, sauve ou empoisonne.', emoji: '🌙' },
              { step: '12', title: 'Le village se reveille', desc: 'Le MJ annonce les victimes de la nuit. La phase de jour commence.', emoji: '☀️' },
            ].map((item) => (
              <div
                key={item.step}
                className="flex items-start gap-3 px-3 py-2 rounded-lg"
                style={{
                  background: 'rgba(124,141,181,0.04)',
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: 'rgba(124,141,181,0.08)',
                }}
              >
                <div className="flex-1 min-w-0">
                  <p style={{ color: '#c0c8d8', fontSize: '0.72rem', fontWeight: 600 }}>
                    {item.emoji} {item.title}
                  </p>
                  <p style={{ color: 'rgba(192,200,216,0.5)', fontSize: '0.6rem', lineHeight: 1.5, marginTop: 2 }}>
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </RuleSection>

        {/* ── Day Phase Detail ── */}
        <RuleSection icon={Sun} title="Deroulement du jour" accentColor="#f0c55b">
          <div className="flex flex-col gap-2">
            {[
              { step: '1', title: 'Annonce des victimes', desc: 'Le MJ revele qui est mort pendant la nuit et leur role est devoile.', emoji: '💀' },
              { step: '2', title: 'Debat', desc: 'Les joueurs vivants debattent, accusent et defendent. Les loups doivent se fondre dans la masse.', emoji: '🗣️' },
              { step: '3', title: 'Vote', desc: 'Chaque joueur vivant vote pour eliminer un suspect. Le joueur avec le plus de votes est elimine.', emoji: '🗳️' },
              { step: '4', title: 'Elimination', desc: 'Le joueur elu est elimine et son role est revele. En cas d\'egalite, le Maire tranche.', emoji: '⚖️' },
            ].map((item) => (
              <div
                key={item.step}
                className="flex items-start gap-3 px-3 py-2 rounded-lg"
                style={{
                  background: 'rgba(240,197,91,0.04)',
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: 'rgba(240,197,91,0.08)',
                }}
              >
                <span
                  className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{
                    background: 'rgba(240,197,91,0.12)',
                    color: '#f0c55b',
                    fontSize: '0.6rem',
                    fontFamily: '"Cinzel", serif',
                    fontWeight: 700,
                  }}
                >
                  {item.step}
                </span>
                <div className="flex-1 min-w-0">
                  <p style={{ color: '#c0c8d8', fontSize: '0.72rem', fontWeight: 600 }}>
                    {item.emoji} {item.title}
                  </p>
                  <p style={{ color: 'rgba(192,200,216,0.5)', fontSize: '0.6rem', lineHeight: 1.5, marginTop: 2 }}>
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </RuleSection>

        {/* ── Special Rules ── */}
        <RuleSection icon={Shield} title="Regles speciales" accentColor="#3b82f6">
          <div className="flex flex-col gap-3">
            <p style={{ color: 'rgba(192,200,216,0.65)', fontSize: '0.72rem', lineHeight: 1.7 }}>
              <strong style={{ color: '#d4a843' }}>Le Maire</strong> &mdash; Elu par le village au debut ou en cours de partie.
              Son vote compte double lors des eliminations. En cas d'egalite, c'est lui qui tranche.
            </p>
            <p style={{ color: 'rgba(192,200,216,0.65)', fontSize: '0.72rem', lineHeight: 1.7 }}>
              <strong style={{ color: '#ec4899' }}>Les Amoureux</strong> &mdash; Designes par Cupidon, ils sont lies par le destin.
              Si l'un meurt, l'autre meurt de chagrin. Si les amoureux sont un villageois et un loup-garou,
              ils forment une equipe independante.
            </p>
            <p style={{ color: 'rgba(192,200,216,0.65)', fontSize: '0.72rem', lineHeight: 1.7 }}>
              <strong style={{ color: '#d97706' }}>Le Chasseur</strong> &mdash; A sa mort, il peut emmener un joueur avec lui
              en tirant sur la personne de son choix.
            </p>
            <p style={{ color: 'rgba(192,200,216,0.65)', fontSize: '0.72rem', lineHeight: 1.7 }}>
              <strong style={{ color: '#3b82f6' }}>Le Garde</strong> &mdash; Ne peut pas proteger le meme joueur deux nuits
              de suite, ni se proteger lui-meme.
            </p>
          </div>
        </RuleSection>

        {/* ── Roles Catalog ── */}
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Sparkles size={18} style={{ color: '#d4a843' }} />
            <h2
              style={{
                fontFamily: '"Cinzel", serif',
                color: '#d4a843',
                fontSize: '1.05rem',
                fontWeight: 700,
                flex: 1,
              }}
            >
              Catalogue des roles
            </h2>
            <span
              className="px-2 py-0.5 rounded-full"
              style={{
                fontSize: '0.55rem',
                fontFamily: '"Cinzel", serif',
                fontWeight: 600,
                background: 'rgba(212,168,67,0.1)',
                color: '#d4a843',
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: 'rgba(212,168,67,0.2)',
              }}
            >
              {ROLES.length} roles
            </span>
          </div>

          {/* Team filter tabs */}
          <div className="flex gap-1.5 mb-4 px-1 overflow-x-auto pb-1">
            {filters.map((f) => {
              const isActive = teamFilter === f.key;
              const count = teamCounts[f.key];
              return (
                <button
                  key={f.key}
                  onClick={() => setTeamFilter(f.key)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all"
                  style={{
                    background: isActive ? `${f.color}1a` : 'rgba(255,255,255,0.03)',
                    borderWidth: 1,
                    borderStyle: 'solid',
                    borderColor: isActive ? `${f.color}40` : 'rgba(255,255,255,0.06)',
                    color: isActive ? f.color : '#6b7b9b',
                    fontSize: '0.65rem',
                    fontFamily: '"Cinzel", serif',
                    fontWeight: isActive ? 700 : 500,
                  }}
                >
                  {f.label}
                  {count > 0 && (
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center"
                      style={{
                        background: isActive ? `${f.color}30` : 'rgba(255,255,255,0.06)',
                        fontSize: '0.5rem',
                        fontWeight: 700,
                      }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Role cards */}
          <div className="flex flex-col gap-2">
            {filteredRoles.map((role, i) => (
              <RoleCard key={role.id} role={role} index={i} />
            ))}
          </div>


        </div>

        {/* ── Back CTA ── */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => navigate('/')}
          className="w-full mt-4 py-3.5 rounded-xl flex items-center justify-center gap-2"
          style={{
            background: 'linear-gradient(135deg, rgba(212,168,67,0.12), rgba(212,168,67,0.06))',
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: 'rgba(212,168,67,0.2)',
            color: '#d4a843',
            fontFamily: '"Cinzel", serif',
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
          }}
        >
          <ArrowLeft size={15} />
          Retour a l'accueil
        </motion.button>
      </div>
    </div>
  );
}
