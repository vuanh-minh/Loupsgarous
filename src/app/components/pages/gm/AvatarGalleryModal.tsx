import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, Check } from 'lucide-react';
import { AVATAR_GALLERY, type GalleryAvatar } from '../../../data/avatarGallery';
import { galleryRef, getGalleryId } from '../../../data/avatarResolver';

interface AvatarGalleryModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (avatarUrl: string) => void;
  currentAvatarUrl?: string;
  playerName?: string;
}

export const AvatarGalleryModal = React.memo(function AvatarGalleryModal({
  open,
  onClose,
  onSelect,
  currentAvatarUrl,
  playerName,
}: AvatarGalleryModalProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setSearch('');
      setSelected(null);
      // Focus search after animation
      setTimeout(() => searchRef.current?.focus(), 200);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const filtered = search
    ? AVATAR_GALLERY.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
    : AVATAR_GALLERY;

  const handleConfirm = useCallback(() => {
    if (selected !== null) {
      onSelect(galleryRef(selected));
      onClose();
    }
  }, [selected, onSelect, onClose]);

  // Resolve current avatar to gallery ID for comparison
  const currentGalleryId = getGalleryId(currentAvatarUrl);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(14,17,36,0.98), rgba(20,24,48,0.98))',
              border: '1px solid rgba(212,168,67,0.2)',
              boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 40px rgba(212,168,67,0.06)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <h3 style={{ color: '#e8dcc8', fontSize: '1rem', fontFamily: '"Cinzel", serif', fontWeight: 600 }}>
                  Galerie d'avatars
                </h3>
                {playerName && (
                  <p style={{ color: '#7c8db5', fontSize: '0.7rem', marginTop: '0.15rem' }}>
                    Assigner a <span style={{ color: '#d4a843' }}>{playerName}</span>
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors"
                style={{ border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <X size={16} style={{ color: '#7c8db5' }} />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 py-3 shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#7c8db5' }} />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Rechercher un avatar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg text-sm outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${search ? 'rgba(212,168,67,0.3)' : 'rgba(255,255,255,0.06)'}`,
                    color: '#e8dcc8',
                    fontSize: '0.75rem',
                    fontFamily: '"Cinzel", serif',
                  }}
                />
              </div>
            </div>

            {/* Avatar Grid */}
            <div className="flex-1 overflow-y-auto px-5 pb-4 min-h-0">
              <div className="grid grid-cols-5 sm:grid-cols-7 gap-2.5">
                {filtered.map((avatar) => {
                  const isCurrentAvatar = currentGalleryId === avatar.id;
                  const isSelected = selected === avatar.id;
                  return (
                    <button
                      key={avatar.id}
                      onClick={() => setSelected(avatar.id)}
                      className="flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all group/item"
                      style={{
                        background: isSelected
                          ? 'rgba(212,168,67,0.15)'
                          : isCurrentAvatar
                            ? 'rgba(107,142,90,0.1)'
                            : 'transparent',
                        border: isSelected
                          ? '2px solid rgba(212,168,67,0.5)'
                          : isCurrentAvatar
                            ? '2px solid rgba(107,142,90,0.3)'
                            : '2px solid transparent',
                      }}
                    >
                      <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden shrink-0"
                        style={{
                          background: 'linear-gradient(to bottom, #070b1a, #0f1629)',
                        }}
                      >
                        <img
                          src={avatar.url}
                          alt={avatar.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        {/* Selection check overlay */}
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute inset-0 flex items-center justify-center"
                            style={{ background: 'rgba(212,168,67,0.3)' }}
                          >
                            <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: '#d4a843' }}>
                              <Check size={14} style={{ color: '#0a0e1a' }} />
                            </div>
                          </motion.div>
                        )}
                        {/* Current avatar indicator */}
                        {isCurrentAvatar && !isSelected && (
                          <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: '#6b8e5a', border: '2px solid #0a1020' }}>
                            <Check size={8} style={{ color: 'white' }} />
                          </div>
                        )}
                      </div>
                      <span
                        className="text-center truncate w-full"
                        style={{
                          color: isSelected ? '#d4a843' : '#7c8db5',
                          fontSize: '0.5rem',
                          fontFamily: '"Cinzel", serif',
                          lineHeight: 1.2,
                        }}
                      >
                        {avatar.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10">
                  <p style={{ color: '#4a5568', fontSize: '0.8rem', fontFamily: '"Cinzel", serif' }}>
                    Aucun avatar trouve
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 flex items-center justify-between shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ color: '#4a5568', fontSize: '0.65rem' }}>
                {AVATAR_GALLERY.length} avatars disponibles
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 rounded-lg transition-colors hover:bg-white/5"
                  style={{
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#7c8db5',
                    fontSize: '0.75rem',
                    fontFamily: '"Cinzel", serif',
                  }}
                >
                  Annuler
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={selected === null}
                  className="px-4 py-1.5 rounded-lg transition-all"
                  style={{
                    background: selected !== null ? 'rgba(212,168,67,0.2)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${selected !== null ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.06)'}`,
                    color: selected !== null ? '#d4a843' : '#4a5568',
                    fontSize: '0.75rem',
                    fontFamily: '"Cinzel", serif',
                    cursor: selected !== null ? 'pointer' : 'not-allowed',
                  }}
                >
                  Confirmer
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});