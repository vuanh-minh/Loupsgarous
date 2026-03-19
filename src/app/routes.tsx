import { createBrowserRouter } from 'react-router';
import { RootLayout } from './components/layout/RootLayout';
import { HomePage } from './components/pages/HomePage';
import { RulesPage } from './components/pages/RulesPage';
import { GameMasterPage } from './components/pages/GameMasterPage';
import { PlayerPage } from './components/pages/PlayerPage';
import { JoinLobbyPage } from './components/pages/JoinLobbyPage';
import { SpectatorPage } from './components/pages/SpectatorPage';
import { DemoPage } from './components/pages/DemoPage';

/** Inline error fallback for route-level failures */
function RouteErrorFallback() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(180deg, #070b1a 0%, #0f1629 100%)',
        padding: '2rem',
      }}
    >
      <div style={{ maxWidth: '440px', width: '100%', textAlign: 'center' }}>
        <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🐺💥</span>
        <h1
          style={{
            fontFamily: '"Cinzel", serif',
            color: '#d4a843',
            fontSize: '1.2rem',
            marginBottom: '0.75rem',
          }}
        >
          Erreur de chargement
        </h1>
        <p style={{ color: '#6b7b9b', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
          La page n'a pas pu être chargée. Cela peut arriver après une mise à jour.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: 'linear-gradient(135deg, #b8860b, #d4a843)',
            color: '#0a0e1a',
            fontFamily: '"Cinzel", serif',
            fontSize: '0.85rem',
            fontWeight: 700,
            border: 'none',
            borderRadius: '12px',
            padding: '0.75rem 2rem',
            cursor: 'pointer',
          }}
        >
          Recharger la page
        </button>
      </div>
    </div>
  );
}

/* ── Routes — static imports to avoid dynamic-import failures in sandbox ──
   (cache-bust: v10)
*/
export const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    errorElement: <RouteErrorFallback />,
    children: [
      {
        index: true,
        errorElement: <RouteErrorFallback />,
        Component: HomePage,
      },
      {
        path: 'rules',
        errorElement: <RouteErrorFallback />,
        Component: RulesPage,
      },
      {
        path: 'master',
        errorElement: <RouteErrorFallback />,
        Component: GameMasterPage,
      },
      {
        path: 'player/:shortCode',
        errorElement: <RouteErrorFallback />,
        Component: PlayerPage,
      },
      {
        path: 'join/:gameId',
        errorElement: <RouteErrorFallback />,
        Component: JoinLobbyPage,
      },
      {
        path: 'spectator',
        errorElement: <RouteErrorFallback />,
        Component: SpectatorPage,
      },
      {
        path: 'spectator/:gameId',
        errorElement: <RouteErrorFallback />,
        Component: SpectatorPage,
      },
      {
        path: 'demo',
        errorElement: <RouteErrorFallback />,
        Component: DemoPage,
      },
      {
        path: '*',
        Component: () => (
          <div
            className="min-h-screen flex items-center justify-center"
            style={{
              background:
                'linear-gradient(180deg, #070b1a 0%, #0f1629 100%)',
              paddingBottom:
                'calc(env(safe-area-inset-bottom, 0px) + 12px)',
            }}
          >
            <div className="text-center">
              <span className="text-5xl block mb-4">🐺</span>
              <h1
                style={{
                  fontFamily: '"Cinzel", serif',
                  color: '#d4a843',
                  fontSize: '1.5rem',
                }}
              >
                Page introuvable
              </h1>
              <p
                style={{
                  color: '#6b7b9b',
                  fontSize: '0.85rem',
                  marginTop: '0.5rem',
                }}
              >
                Ce chemin ne mene nulle part dans le village...
              </p>
              <a
                href="/"
                className="inline-block mt-6 px-6 py-3 rounded-xl"
                style={{
                  background: 'linear-gradient(135deg, #b8860b, #d4a843)',
                  color: '#0a0e1a',
                  fontFamily: '"Cinzel", serif',
                  textDecoration: 'none',
                }}
              >
                Retour au village
              </a>
            </div>
          </div>
        ),
      },
    ],
  },
]);