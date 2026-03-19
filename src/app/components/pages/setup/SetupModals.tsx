import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, ClipboardPaste, Check } from 'lucide-react';
import { type GameThemeTokens } from '../../../context/gameTheme';

const MIN_PLAYERS = 6;
const MAX_PLAYERS = 60;

/* ── Reduce Confirmation Modal ── */
export function ReduceConfirmModal({
  show,
  pendingCount,
  playerCount,
  onConfirm,
  onCancel,
  t,
}: {
  show: boolean;
  pendingCount: number | null;
  playerCount: number;
  onConfirm: () => void;
  onCancel: () => void;
  t: GameThemeTokens;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: t.overlayBg }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="rounded-2xl p-5 max-w-sm mx-4"
            style={{ background: t.modalBg, border: `1px solid ${t.modalBorder}` }}
          >
            <div className="flex items-center gap-2.5 mb-3">
              <AlertCircle size={18} style={{ color: '#c41e3a' }} />
              <h3 style={{ fontFamily: '"Cinzel", serif', color: t.text, fontSize: '0.85rem' }}>Supprimer des joueurs ?</h3>
            </div>
            <p style={{ color: t.textSecondary, fontSize: '0.75rem', marginBottom: '1rem', lineHeight: 1.5 }}>
              {playerCount - (pendingCount || playerCount)} joueur{(playerCount - (pendingCount || playerCount)) > 1 ? 's' : ''} sera{(playerCount - (pendingCount || playerCount)) > 1 ? 'ont' : ''} supprime{(playerCount - (pendingCount || playerCount)) > 1 ? 's' : ''}. Les donnees personnalisees (noms, avatars) seront perdues.
            </p>
            <div className="flex items-center gap-2 justify-end">
              <button onClick={onCancel} className="px-4 py-2 rounded-lg transition-colors" style={{ background: `rgba(${t.overlayChannel}, 0.05)`, border: `1px solid rgba(${t.overlayChannel}, 0.1)`, color: t.textSecondary, fontFamily: '"Cinzel", serif', fontSize: '0.7rem' }}>
                Annuler
              </button>
              <button onClick={onConfirm} className="px-4 py-2 rounded-lg transition-colors" style={{ background: 'rgba(196,30,58,0.15)', border: '1px solid rgba(196,30,58,0.3)', color: '#c41e3a', fontFamily: '"Cinzel", serif', fontSize: '0.7rem' }}>
                Supprimer
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Bulk Import Modal ── */
export function BulkImportModal({
  show,
  bulkText,
  setBulkText,
  onImport,
  onClose,
  t,
}: {
  show: boolean;
  bulkText: string;
  setBulkText: (v: string) => void;
  onImport: () => void;
  onClose: () => void;
  t: GameThemeTokens;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: t.overlayBg }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="rounded-2xl p-5 w-full max-w-md mx-4"
            style={{ background: t.modalBg, border: `1px solid ${t.modalBorder}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 mb-3">
              <ClipboardPaste size={18} style={{ color: t.gold }} />
              <h3 style={{ fontFamily: '"Cinzel", serif', color: t.text, fontSize: '0.85rem' }}>Importer des joueurs</h3>
            </div>
            <p style={{ color: t.textSecondary, fontSize: '0.7rem', marginBottom: '0.75rem', lineHeight: 1.5 }}>
              Collez une liste de noms, un par ligne. Les joueurs actuels seront remplaces.
            </p>
            <textarea
              autoFocus
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"Alice\nBob\nCharlie\nDavid\nEmma\nFiona"}
              rows={8}
              className="w-full rounded-xl px-3 py-2.5 outline-none resize-none"
              style={{
                background: `rgba(${t.overlayChannel}, 0.04)`,
                border: `1px solid rgba(${t.overlayChannel}, 0.12)`,
                color: t.text,
                fontSize: '0.8rem',
                lineHeight: 1.6,
                fontFamily: 'inherit',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  onImport();
                }
              }}
            />
            {(() => {
              const parsedNames = bulkText.split('\n').map(n => n.trim()).filter(n => n.length > 0);
              const count = parsedNames.length;
              const clamped = Math.min(count, MAX_PLAYERS);
              return count > 0 ? (
                <p style={{ color: t.textMuted, fontSize: '0.6rem', marginTop: '0.5rem', fontFamily: '"Cinzel", serif' }}>
                  {clamped} joueur{clamped > 1 ? 's' : ''}
                  {count < MIN_PLAYERS && <span style={{ color: '#d4a843' }}> (complete a {MIN_PLAYERS} minimum)</span>}
                  {count > MAX_PLAYERS && <span style={{ color: '#c41e3a' }}> (limite a {MAX_PLAYERS})</span>}
                </p>
              ) : null;
            })()}
            <div className="flex items-center gap-2 justify-end mt-4">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg transition-colors"
                style={{ background: `rgba(${t.overlayChannel}, 0.05)`, border: `1px solid rgba(${t.overlayChannel}, 0.1)`, color: t.textSecondary, fontFamily: '"Cinzel", serif', fontSize: '0.7rem' }}
              >
                Annuler
              </button>
              <button
                onClick={onImport}
                disabled={bulkText.split('\n').map(n => n.trim()).filter(n => n.length > 0).length === 0}
                className="px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
                style={{
                  background: bulkText.trim() ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${bulkText.trim() ? 'rgba(212,168,67,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  color: bulkText.trim() ? '#d4a843' : '#4a5568',
                  fontFamily: '"Cinzel", serif',
                  fontSize: '0.7rem',
                  cursor: bulkText.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                <Check size={13} /> Importer
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
