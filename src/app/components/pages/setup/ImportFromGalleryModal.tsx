import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, Check, Users, UserPlus } from 'lucide-react';
import { AVATAR_GALLERY, type GalleryAvatar } from '../../../data/avatarGallery';
import { galleryRef, getGalleryId } from '../../../data/avatarResolver';
import { type GameThemeTokens } from '../../../context/gameTheme';
import { type PlayerEntry } from './setupConstants';
import { API_BASE, jsonAuthHeaders } from '../../../context/apiConfig';

interface ImportFromGalleryModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (entries: Array<{ name: string; avatarUrl: string; assignedRole?: string }>) => void;
  existingEntries: PlayerEntry[];
  t: GameThemeTokens;
}

export const ImportFromGalleryModal = React.memo(function ImportFromGalleryModal({
  open,
  onClose,
  onImport,
  existingEntries,
  t,
}: ImportFromGalleryModalProps) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [galleryRoles, setGalleryRoles] = useState<Record<number, string>>({});
  const [deletedAvatarIds, setDeletedAvatarIds] = useState<Set<number>>(() => {
    try {
      const stored = localStorage.getItem('gallery:deleted-ids');
      if (stored) return new Set(JSON.parse(stored) as number[]);
    } catch { /* ignore */ }
    return new Set();
  });
  const searchRef = useRef<HTMLInputElement>(null);

  // Track which gallery avatar IDs are already used by existing players
  const usedGalleryIds = useMemo(() => {
    const ids = new Set<number>();
    existingEntries.forEach((e) => {
      const gid = getGalleryId(e.avatarUrl);
      if (gid !== null) ids.add(gid);
    });
    return ids;
  }, [existingEntries]);

  // Reset on open + charger les IDs supprimés
  useEffect(() => {
    if (open) {
      setSearch('');
      setSelectedIds(new Set());
      setTimeout(() => searchRef.current?.focus(), 200);
      // Lecture locale immédiate
      try {
        const stored = localStorage.getItem('gallery:deleted-ids');
        if (stored) setDeletedAvatarIds(new Set(JSON.parse(stored) as number[]));
      } catch { /* ignore */ }
      // Refresh serveur (met aussi à jour le localStorage pour les prochaines sessions)
      (async () => {
        try {
          const res = await fetch(`${API_BASE}/gallery/deleted`, { headers: jsonAuthHeaders() });
          const data = await res.json();
          if (data.deleted && Array.isArray(data.deleted)) {
            setDeletedAvatarIds(new Set(data.deleted));
            localStorage.setItem('gallery:deleted-ids', JSON.stringify(data.deleted));
          }
        } catch { /* ignore */ }
      })();
    }
  }, [open]);

  // Charger les rôles par défaut de la galerie
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/gallery/roles`, { headers: jsonAuthHeaders() });
        const data = await res.json();
        if (data.roles) setGalleryRoles(data.roles);
      } catch { /* ignore */ }
    })();
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

  const filtered = AVATAR_GALLERY
    .filter((a) => !deletedAvatarIds.has(a.id))
    .filter((a) => !search || a.name.toLowerCase().includes(search.toLowerCase()));

  const toggleAvatar = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const allFilteredIds = filtered.filter((a) => !usedGalleryIds.has(a.id)).map((a) => a.id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = allFilteredIds.every((id) => next.has(id));
      if (allSelected) {
        // Deselect all filtered
        allFilteredIds.forEach((id) => next.delete(id));
      } else {
        // Select all filtered
        allFilteredIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [filtered, usedGalleryIds]);

  const handleConfirm = useCallback(() => {
    if (selectedIds.size === 0) return;
    const entries = AVATAR_GALLERY
      .filter((a) => selectedIds.has(a.id))
      .map((a) => ({ name: a.name, avatarUrl: galleryRef(a.id), assignedRole: galleryRoles[a.id] }));
    onImport(entries);
    onClose();
  }, [selectedIds, galleryRoles, onImport, onClose]);

  const availableFiltered = filtered.filter((a) => !usedGalleryIds.has(a.id));
  const allFilteredSelected = availableFiltered.length > 0 && availableFiltered.every((a) => selectedIds.has(a.id));

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
              background: t.modalBg || 'linear-gradient(135deg, rgba(14,17,36,0.98), rgba(20,24,48,0.98))',
              border: `1px solid ${t.modalBorder || 'rgba(212,168,67,0.2)'}`,
              boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 40px rgba(212,168,67,0.06)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <h3 style={{ color: t.text, fontSize: '1rem', fontFamily: '"Cinzel", serif', fontWeight: 600 }}>
                  <UserPlus size={16} className="inline mr-2" style={{ color: t.gold }} />
                  Importer depuis la galerie
                </h3>
                <p style={{ color: t.textMuted || '#7c8db5', fontSize: '0.65rem', marginTop: '0.15rem' }}>
                  Selectionnez les joueurs a ajouter avec leur avatar
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors"
                style={{ border: `1px solid rgba(${t.overlayChannel}, 0.08)` }}
              >
                <X size={16} style={{ color: t.textMuted || '#7c8db5' }} />
              </button>
            </div>

            {/* Search + Select All */}
            <div className="px-5 py-3 shrink-0 flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: t.textMuted || '#7c8db5' }} />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Rechercher..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg text-sm outline-none"
                  style={{
                    background: `rgba(${t.overlayChannel}, 0.04)`,
                    border: `1px solid ${search ? 'rgba(212,168,67,0.3)' : `rgba(${t.overlayChannel}, 0.06)`}`,
                    color: t.text,
                    fontSize: '0.75rem',
                    fontFamily: '"Cinzel", serif',
                  }}
                />
              </div>
              <button
                onClick={selectAll}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all shrink-0"
                style={{
                  background: allFilteredSelected ? 'rgba(212,168,67,0.15)' : `rgba(${t.overlayChannel}, 0.04)`,
                  border: `1px solid ${allFilteredSelected ? 'rgba(212,168,67,0.3)' : `rgba(${t.overlayChannel}, 0.08)`}`,
                  color: allFilteredSelected ? t.gold : (t.textMuted || '#7c8db5'),
                  fontSize: '0.65rem',
                  fontFamily: '"Cinzel", serif',
                }}
              >
                <Users size={12} />
                {allFilteredSelected ? 'Deselecter' : 'Tout'}
              </button>
            </div>

            {/* Selection count badge */}
            {selectedIds.size > 0 && (
              <div className="px-5 pb-2 shrink-0">
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full"
                  style={{
                    background: 'rgba(212,168,67,0.1)',
                    border: '1px solid rgba(212,168,67,0.2)',
                  }}
                >
                  <UserPlus size={11} style={{ color: t.gold }} />
                  <span style={{ color: t.gold, fontSize: '0.6rem', fontFamily: '"Cinzel", serif', fontWeight: 600 }}>
                    {selectedIds.size} joueur{selectedIds.size > 1 ? 's' : ''} selectionne{selectedIds.size > 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            )}

            {/* Avatar Grid */}
            <div className="flex-1 overflow-y-auto px-5 pb-4 min-h-0">
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {filtered.map((avatar) => {
                  const isUsed = usedGalleryIds.has(avatar.id);
                  const isSelected = selectedIds.has(avatar.id);
                  return (
                    <button
                      key={avatar.id}
                      onClick={() => { if (!isUsed) toggleAvatar(avatar.id); }}
                      disabled={isUsed}
                      className="flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all group/item"
                      style={{
                        background: isSelected
                          ? 'rgba(212,168,67,0.15)'
                          : isUsed
                            ? `rgba(${t.overlayChannel}, 0.02)`
                            : 'transparent',
                        border: isSelected
                          ? '2px solid rgba(212,168,67,0.5)'
                          : isUsed
                            ? '2px solid rgba(255,255,255,0.04)'
                            : '2px solid transparent',
                        opacity: isUsed ? 0.35 : 1,
                        cursor: isUsed ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <div
                        className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden shrink-0"
                        style={{ background: 'linear-gradient(to bottom, #070b1a, #0f1629)' }}
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
                        {/* Already used indicator */}
                        {isUsed && (
                          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
                            <span style={{ fontSize: '0.5rem', color: '#6b7b9b', fontFamily: '"Cinzel", serif' }}>
                              Deja utilise
                            </span>
                          </div>
                        )}
                      </div>
                      <span
                        className="text-center truncate w-full"
                        style={{
                          color: isSelected ? t.gold : (isUsed ? '#4a5568' : (t.textMuted || '#7c8db5')),
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
              <span style={{ color: '#4a5568', fontSize: '0.6rem' }}>
                {AVATAR_GALLERY.filter(a => !deletedAvatarIds.has(a.id)).length - usedGalleryIds.size} disponible{AVATAR_GALLERY.filter(a => !deletedAvatarIds.has(a.id)).length - usedGalleryIds.size > 1 ? 's' : ''} sur {AVATAR_GALLERY.filter(a => !deletedAvatarIds.has(a.id)).length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 rounded-lg transition-colors hover:bg-white/5"
                  style={{
                    border: `1px solid rgba(${t.overlayChannel}, 0.08)`,
                    color: t.textMuted || '#7c8db5',
                    fontSize: '0.75rem',
                    fontFamily: '"Cinzel", serif',
                  }}
                >
                  Annuler
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={selectedIds.size === 0}
                  className="px-4 py-1.5 rounded-lg transition-all flex items-center gap-1.5"
                  style={{
                    background: selectedIds.size > 0 ? 'rgba(212,168,67,0.2)' : `rgba(${t.overlayChannel}, 0.03)`,
                    border: `1px solid ${selectedIds.size > 0 ? 'rgba(212,168,67,0.4)' : `rgba(${t.overlayChannel}, 0.06)`}`,
                    color: selectedIds.size > 0 ? t.gold : '#4a5568',
                    fontSize: '0.75rem',
                    fontFamily: '"Cinzel", serif',
                    cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed',
                  }}
                >
                  <UserPlus size={13} />
                  Importer {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});