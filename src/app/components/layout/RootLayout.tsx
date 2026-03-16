import { createContext, useContext, useEffect, useState, Suspense } from 'react';
import { Outlet } from 'react-router';
import { Toaster } from 'sonner';
import { GameProvider, useGame } from '../../context/GameContext';
import { usePWA, type PWAState } from '../../context/usePWA';
import { ErrorBoundary } from '../ErrorBoundary';

/** Sets data-phase on <html> so CSS variables switch for day/night */
function PhaseSync() {
  const { state } = useGame();
  useEffect(() => {
    const phase = state.screen === 'game' || state.screen === 'end' ? state.phase : 'night';
    document.documentElement.setAttribute('data-phase', phase);
    return () => document.documentElement.removeAttribute('data-phase');
  }, [state.phase, state.screen]);
  return null;
}

/** Local mode floating icon — shown when server is unreachable */
function LocalModeIndicator() {
  const { localMode } = useGame();
  const [expanded, setExpanded] = useState(false);
  if (!localMode) return null;
  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex items-center gap-0 cursor-pointer select-none"
      onClick={() => setExpanded((v) => !v)}
      title="Mode local — serveur indisponible"
    >
      {/* Tooltip label */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxWidth: expanded ? '220px' : '0px',
          opacity: expanded ? 1 : 0,
        }}
      >
        <span
          className="whitespace-nowrap rounded-l-full py-2 pl-3.5 pr-2 block"
          style={{
            background: 'linear-gradient(135deg, rgba(217,119,6,0.92), rgba(180,83,9,0.92))',
            backdropFilter: 'blur(8px)',
            fontSize: '0.65rem',
            color: 'white',
            fontFamily: '"Cinzel", serif',
            letterSpacing: '0.04em',
          }}
        >
          Mode local
        </span>
      </div>

      {/* Floating icon pill */}
      <div
        className="w-9 h-9 flex items-center justify-center shadow-lg"
        style={{
          borderRadius: expanded ? '0 9999px 9999px 0' : '9999px',
          background: 'linear-gradient(135deg, rgba(217,119,6,0.95), rgba(180,83,9,0.95))',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 2px 12px rgba(180,83,9,0.45)',
          transition: 'border-radius 0.3s ease',
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12.55a11 11 0 0 1 14.08 0" />
          <path d="M1.42 9a16 16 0 0 1 21.16 0" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
          {/* Strike-through diagonal line */}
          <line x1="2" y1="2" x2="22" y2="22" strokeWidth="2.4" />
        </svg>
      </div>
    </div>
  );
}

/** PWA context so any page can access install state */
const PWAContext = createContext<PWAState>({
  isStandalone: false,
  canInstall: false,
  isIOS: false,
  promptInstall: async () => false,
});

export function usePWAContext() {
  return useContext(PWAContext);
}

export function RootLayout() {
  const pwa = usePWA();

  return (
    <ErrorBoundary>
      <PWAContext.Provider value={pwa}>
        <GameProvider>
          <PhaseSync />
          <LocalModeIndicator />
          <Toaster
            position="top-center"
            theme="dark"
            toastOptions={{
              style: {
                background: 'linear-gradient(135deg, #12111f, #0a0e1a)',
                border: '1px solid rgba(139,92,246,0.25)',
                color: '#e2e8f0',
                fontFamily: '"Cinzel", serif',
                fontSize: '0.7rem',
              },
            }}
          />
          <Suspense
            fallback={
              <div
                className="min-h-screen flex flex-col items-center justify-center"
                style={{
                  background: 'linear-gradient(180deg, #070b1a 0%, #0f1629 100%)',
                }}
              >
                <span className="text-5xl block mb-4 animate-pulse">🐺</span>
                <p
                  style={{
                    fontFamily: '"Cinzel", serif',
                    color: '#d4a843',
                    fontSize: '0.85rem',
                    opacity: 0.7,
                  }}
                >
                  Chargement...
                </p>
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </GameProvider>
      </PWAContext.Provider>
    </ErrorBoundary>
  );
}