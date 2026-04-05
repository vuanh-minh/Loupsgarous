/**
 * PWAInstallBanner — A subtle, themed banner prompting users to install the app.
 *
 * Shows on ALL platforms when not running in standalone/PWA mode:
 * - Android/Chrome with beforeinstallprompt: triggers native install prompt
 * - iOS Safari: shows step-by-step "Add to Home Screen" guide
 * - Desktop/other: shows browser-specific "Install" instructions
 *
 * Dismissable + remembers dismissal in localStorage for 7 days.
 */
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Share, Plus, Smartphone, MoreVertical, Monitor } from 'lucide-react';
import type { PWAState } from '../context/usePWA';

const DISMISS_KEY = 'loup-garou-pwa-dismiss';
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

type Platform = 'ios' | 'android' | 'desktop';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return 'ios';
  }
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

interface PWAInstallBannerProps {
  pwa: PWAState;
  /** Optional: game phase for theming — defaults to dark */
  variant?: 'dark' | 'light';
}

export function PWAInstallBanner({ pwa, variant = 'dark' }: PWAInstallBannerProps) {
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash
  const [showGuide, setShowGuide] = useState(false);
  const platform = useMemo(detectPlatform, []);

  // Check dismissal state from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DISMISS_KEY);
      if (stored) {
        const ts = parseInt(stored, 10);
        if (Date.now() - ts < DISMISS_DURATION) {
          setDismissed(true);
          return;
        }
      }
      setDismissed(false);
    } catch {
      setDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // localStorage unavailable
    }
  };

  // Don't show if already running as installed PWA
  if (pwa.isStandalone) return null;
  if (dismissed) return null;

  const isDark = variant === 'dark';
  const bg = isDark
    ? 'linear-gradient(135deg, rgba(15,22,41,0.97) 0%, rgba(26,16,64,0.97) 100%)'
    : 'linear-gradient(135deg, rgba(255,255,255,0.97) 0%, rgba(245,240,230,0.97) 100%)';
  const borderColor = isDark ? 'rgba(212,168,67,0.25)' : 'rgba(212,168,67,0.4)';
  const textColor = isDark ? '#c0c8d8' : '#3a3530';
  const subtitleColor = isDark ? '#6b7b9b' : '#8a7e70';
  const gold = '#d4a843';

  const handleInstallClick = async () => {
    if (pwa.canInstall) {
      // Native prompt available (Android Chrome / desktop Chrome)
      const accepted = await pwa.promptInstall();
      if (accepted) handleDismiss();
    } else {
      // Show platform-specific guide
      setShowGuide(true);
    }
  };

  return (
    <>
      <AnimatePresence>
        {!showGuide && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-20 left-3 right-3 max-w-md mx-auto z-[9999] rounded-2xl overflow-hidden"
            style={{
              background: bg,
              border: `1px solid ${borderColor}`,
              boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(20px)',
            }}
          >
            {/* Dismiss button */}
            <button
              onClick={handleDismiss}
              className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
              style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
              aria-label="Fermer"
            >
              <X size={14} style={{ color: subtitleColor }} />
            </button>

            <div className="px-4 py-3.5 flex items-center gap-3">
              {/* Icon */}
              <div
                className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
                style={{
                  background: 'radial-gradient(circle, rgba(212,168,67,0.15) 0%, transparent 70%)',
                  border: '1.5px solid rgba(212,168,67,0.25)',
                }}
              >
                <Smartphone size={20} style={{ color: gold }} />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0 pr-6">
                <p
                  className="text-sm font-semibold leading-tight"
                  style={{ color: textColor, fontFamily: '"Cinzel", serif', fontSize: '0.8rem' }}
                >
                  Installer l'application
                </p>
                <p
                  className="mt-0.5 leading-snug"
                  style={{ color: subtitleColor, fontSize: '0.7rem' }}
                >
                  {platform === 'desktop'
                    ? 'Jouez sans barres de navigateur'
                    : 'Plein ecran, sans barre de navigation'}
                </p>
              </div>

              {/* Install button */}
              <button
                onClick={handleInstallClick}
                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #b8860b 0%, #d4a843 50%, #b8860b 100%)',
                  color: '#0a0e1a',
                  fontFamily: '"Cinzel", serif',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  boxShadow: '0 2px 12px rgba(212,168,67,0.3)',
                }}
              >
                <Download size={14} />
                Installer
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Platform-specific install guide overlay */}
      <AnimatePresence>
        {showGuide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] flex items-end justify-center"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
            onClick={() => setShowGuide(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="w-full max-w-md rounded-t-3xl overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, #0f1629 0%, #1a1040 100%)',
                border: '1px solid rgba(212,168,67,0.2)',
                borderBottomWidth: 0,
                paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <h3
                  className="text-base"
                  style={{ fontFamily: '"Cinzel", serif', color: gold }}
                >
                  {platform === 'ios'
                    ? 'Installer sur iPhone'
                    : platform === 'android'
                      ? 'Installer sur Android'
                      : 'Installer sur ordinateur'}
                </h3>
                <button
                  onClick={() => setShowGuide(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  <X size={16} style={{ color: '#6b7b9b' }} />
                </button>
              </div>

              {/* Divider */}
              <div className="mx-5 h-px" style={{ background: 'rgba(212,168,67,0.1)' }} />

              {/* Steps — platform-specific */}
              <div className="px-5 py-4 flex flex-col gap-5">
                {platform === 'ios' && <IOSSteps gold={gold} />}
                {platform === 'android' && <AndroidSteps gold={gold} />}
                {platform === 'desktop' && <DesktopSteps gold={gold} />}
              </div>

              {/* Bottom action */}
              <div className="px-5 pb-2">
                <button
                  onClick={() => {
                    setShowGuide(false);
                    handleDismiss();
                  }}
                  className="w-full py-3 rounded-xl transition-all active:scale-95"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#6b7b9b',
                    fontSize: '0.8rem',
                    fontFamily: '"Cinzel", serif',
                  }}
                >
                  J'ai compris
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ── Step components ── */

export function detectPlatformPublic() { return detectPlatform(); }

export function StepRow({ icon, title, description }: { icon: React.ReactNode; title: string; description: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <div
        className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.2)' }}
      >
        {icon}
      </div>
      <div>
        <p
          className="font-semibold"
          style={{ color: '#c0c8d8', fontSize: '0.85rem', fontFamily: '"Cinzel", serif' }}
        >
          {title}
        </p>
        <p style={{ color: '#6b7b9b', fontSize: '0.75rem', marginTop: '2px' }}>
          {description}
        </p>
      </div>
    </div>
  );
}

export function IOSSteps({ gold }: { gold: string }) {
  return (
    <>
      <StepRow
        icon={<Share size={18} style={{ color: gold }} />}
        title="1. Partager"
        description={
          <>Appuyez sur le bouton <Share size={12} className="inline-block mx-0.5" style={{ color: gold, verticalAlign: '-2px' }} /> en bas de Safari</>
        }
      />
      <StepRow
        icon={<Plus size={18} style={{ color: gold }} />}
        title="2. Sur l'ecran d'accueil"
        description="Faites defiler et appuyez sur « Sur l'ecran d'accueil »"
      />
      <StepRow
        icon={<span className="text-lg">🐺</span>}
        title="3. C'est pret !"
        description="L'app s'ouvrira en plein ecran, sans barres de navigation"
      />
    </>
  );
}

export function AndroidSteps({ gold }: { gold: string }) {
  return (
    <>
      <StepRow
        icon={<MoreVertical size={18} style={{ color: gold }} />}
        title="1. Menu du navigateur"
        description={
          <>Appuyez sur <MoreVertical size={12} className="inline-block mx-0.5" style={{ color: gold, verticalAlign: '-2px' }} /> en haut a droite de Chrome</>
        }
      />
      <StepRow
        icon={<Plus size={18} style={{ color: gold }} />}
        title="2. Ajouter a l'ecran d'accueil"
        description="Appuyez sur « Ajouter a l'ecran d'accueil » ou « Installer l'application »"
      />
      <StepRow
        icon={<span className="text-lg">🐺</span>}
        title="3. C'est pret !"
        description="L'app s'ouvrira en plein ecran, sans barres de navigation"
      />
    </>
  );
}

export function DesktopSteps({ gold }: { gold: string }) {
  return (
    <>
      <StepRow
        icon={<Monitor size={18} style={{ color: gold }} />}
        title="1. Barre d'adresse"
        description={
          <>Cherchez l'icone <Download size={12} className="inline-block mx-0.5" style={{ color: gold, verticalAlign: '-2px' }} /> dans la barre d'adresse de Chrome (a droite)</>
        }
      />
      <StepRow
        icon={<Download size={18} style={{ color: gold }} />}
        title="2. Installer"
        description="Cliquez sur « Installer » dans la boite de dialogue"
      />
      <StepRow
        icon={<span className="text-lg">🐺</span>}
        title="3. C'est pret !"
        description="L'app s'ouvrira dans sa propre fenetre, sans barres de navigateur"
      />
    </>
  );
}