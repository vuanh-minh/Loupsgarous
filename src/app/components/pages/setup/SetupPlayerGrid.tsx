import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Camera, ClipboardPaste, Edit3, Check, X, Trash2 } from 'lucide-react';
import { GMAvatar } from '../gm/GMAvatar';
import { type GameThemeTokens } from '../../../context/gameTheme';
import { type PlayerEntry } from './setupConstants';

const MIN_PLAYERS = 6;

export function SetupPlayerGrid({
  playerEntries,
  setPlayerEntries,
  onUploadAvatar,
  uploadingPlayerId,
  pasteTargetId,
  selectPasteTarget,
  isMobile,
  t,
}: {
  playerEntries: PlayerEntry[];
  setPlayerEntries: (entries: PlayerEntry[] | ((prev: PlayerEntry[]) => PlayerEntry[])) => void;
  onUploadAvatar: (file: File, playerId: number, isPreGame: boolean) => void;
  uploadingPlayerId: number | null;
  pasteTargetId: number | null;
  selectPasteTarget: (id: number, isPreGame: boolean) => void;
  isMobile: boolean;
  t: GameThemeTokens;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const startEditing = (entry: PlayerEntry) => {
    setEditingId(entry.id);
    setEditName(entry.name);
  };

  const confirmEdit = () => {
    if (editingId === null) return;
    const trimmed = editName.trim();
    if (trimmed) {
      setPlayerEntries((prev) =>
        prev.map((p) => (p.id === editingId ? { ...p, name: trimmed } : p))
      );
    }
    setEditingId(null);
    setEditName('');
  };

  const removePlayer = (id: number) => {
    if (playerEntries.length <= MIN_PLAYERS) return;
    setPlayerEntries((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className={`grid gap-1.5 mt-2 ${isMobile ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3'}`}>
      {playerEntries.map((entry, idx) => (
        <motion.div
          key={entry.id}
          layout
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15, delay: Math.min(idx * 0.02, 0.3) }}
          className="rounded-xl px-2.5 py-2 flex items-center gap-2.5"
          style={{
            background: `rgba(${t.overlayChannel}, 0.02)`,
            border: `1px solid rgba(${t.overlayChannel}, 0.06)`,
          }}
        >
          {/* Avatar */}
          <div className="relative shrink-0 group/avatar">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden transition-all"
              style={{
                background: 'rgba(212,168,67,0.08)',
                border: pasteTargetId === entry.id ? '2px solid #d4a843' : '1px solid rgba(212,168,67,0.15)',
                boxShadow: pasteTargetId === entry.id ? '0 0 8px rgba(212,168,67,0.4)' : 'none',
              }}
            >
              {uploadingPlayerId === entry.id ? (
                <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <GMAvatar player={entry} size="text-base" />
              )}
            </div>
            {/* Desktop hover overlay */}
            <label className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer max-md:hidden" style={{ background: 'rgba(0,0,0,0.55)' }}>
              <Camera size={12} style={{ color: '#d4a843' }} />
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { onUploadAvatar(f, entry.id, true); selectPasteTarget(entry.id, true); } e.target.value = ''; }} />
            </label>
            {/* Mobile tap badge */}
            <label
              className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center cursor-pointer md:hidden"
              style={{ background: 'rgba(212,168,67,0.9)', border: '2px solid #0a1020', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }}
            >
              <Camera size={9} style={{ color: '#0a1020' }} />
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { onUploadAvatar(f, entry.id, true); selectPasteTarget(entry.id, true); } e.target.value = ''; }} />
            </label>
            {pasteTargetId === entry.id && (
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 rounded text-center flex items-center gap-1" style={{ background: 'rgba(212,168,67,0.2)', border: '1px solid rgba(212,168,67,0.3)', fontSize: '0.45rem', color: '#d4a843', zIndex: 10 }}>
                <ClipboardPaste size={8} />
                {navigator.platform?.includes('Mac') ? '\u2318' : 'Ctrl'}+V
              </div>
            )}
          </div>

          {/* Name */}
          <div className="flex-1 min-w-0">
            {editingId === entry.id ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') confirmEdit(); if (e.key === 'Escape') setEditingId(null); }}
                  className="flex-1 bg-transparent border-none outline-none"
                  style={{ color: t.inputText, fontSize: '0.75rem', borderBottom: `1px solid ${t.goldBorder}`, paddingBottom: '1px' }}
                />
                <button onClick={confirmEdit} className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5 transition-colors">
                  <Check size={11} style={{ color: '#6b8e5a' }} />
                </button>
                <button onClick={() => setEditingId(null)} className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5 transition-colors">
                  <X size={11} style={{ color: '#c41e3a' }} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="truncate" style={{ color: t.text, fontSize: '0.75rem' }}>{entry.name}</span>
                <button onClick={() => startEditing(entry)} className="w-5 h-5 rounded-full flex items-center justify-center transition-colors shrink-0 opacity-40 hover:opacity-100">
                  <Edit3 size={9} style={{ color: t.textMuted }} />
                </button>
              </div>
            )}
          </div>

          {/* Delete */}
          <button
            onClick={() => removePlayer(entry.id)}
            disabled={playerEntries.length <= MIN_PLAYERS}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors shrink-0"
            style={{ opacity: playerEntries.length <= MIN_PLAYERS ? 0.15 : 0.4 }}
          >
            <Trash2 size={12} style={{ color: '#c41e3a' }} />
          </button>
        </motion.div>
      ))}
    </div>
  );
}