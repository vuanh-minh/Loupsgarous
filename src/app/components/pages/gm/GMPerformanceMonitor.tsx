/**
 * GMPerformanceMonitor.tsx — Real-time performance monitoring widget for the GM.
 * Shows broadcast metrics, polling stats, and connection health.
 * Collapsed by default, toggleable via a small floating button.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, X, ChevronDown, ChevronUp, Zap, Wifi, WifiOff, Heart } from 'lucide-react';
import { getBroadcastMetrics, resetBroadcastMetrics, type BroadcastMetrics } from '../../../context/useRealtimeSync';
import type { RealtimeStatus } from '../../../context/useRealtimeSync';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

interface GMPerformanceMonitorProps {
  realtimeStatus: RealtimeStatus;
  playerCount: number;
  aliveCount: number;
  playerHeartbeats?: Record<string, number>;
  playerNames?: Record<string, string>; // shortCode -> name for display
}

const GMPerformanceMonitor = React.memo(function GMPerformanceMonitor({
  realtimeStatus,
  playerCount,
  aliveCount,
  playerHeartbeats = {},
  playerNames = {},
}: GMPerformanceMonitorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [metrics, setMetrics] = useState<BroadcastMetrics>(getBroadcastMetrics());
  const [expanded, setExpanded] = useState(false);

  // Refresh metrics every 2s when panel is open
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setMetrics(getBroadcastMetrics());
    }, 2000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const handleReset = useCallback(() => {
    resetBroadcastMetrics();
    setMetrics(getBroadcastMetrics());
  }, []);

  const deltaRatio = metrics.totalBroadcasts > 0
    ? Math.round((metrics.deltaBroadcasts / metrics.totalBroadcasts) * 100)
    : 0;

  const statusColor = realtimeStatus === 'connected'
    ? 'text-emerald-400'
    : realtimeStatus === 'connecting'
      ? 'text-amber-400'
      : 'text-red-400';

  const StatusIcon = realtimeStatus === 'connected' ? Wifi : WifiOff;

  // Compute heartbeat stats
  const now = Date.now();
  const heartbeatEntries = Object.entries(playerHeartbeats);
  const connectedCount = heartbeatEntries.filter(([, ts]) => now - ts < 30000).length;
  const staleCount = heartbeatEntries.filter(([, ts]) => now - ts >= 30000 && now - ts < 120000).length;
  const offlineCount = heartbeatEntries.filter(([, ts]) => now - ts >= 120000).length;

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-4 right-4 z-[9999] w-10 h-10 rounded-full bg-gray-900/80 border border-gray-700 flex items-center justify-center hover:bg-gray-800 transition-colors shadow-lg"
        title="Performance Monitor"
      >
        <Activity className="w-4 h-4 text-emerald-400" />
      </button>

      {/* Monitor panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-16 right-4 z-[9999] w-72 bg-gray-900/95 backdrop-blur-md border border-gray-700 rounded-xl shadow-2xl text-xs text-gray-300 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700/50 bg-gray-800/50">
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-semibold text-gray-100 text-[11px] tracking-wide uppercase">Perf Monitor</span>
              </div>
              <div className="flex items-center gap-1">
                <StatusIcon className={`w-3.5 h-3.5 ${statusColor}`} />
                <button onClick={() => setIsOpen(false)} className="p-0.5 hover:bg-gray-700 rounded">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Connection status */}
            <div className="px-3 py-2 border-b border-gray-800/50">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Realtime</span>
                <span className={`font-medium ${statusColor}`}>{realtimeStatus}</span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-gray-400">Joueurs</span>
                <span className="text-gray-200">{aliveCount}/{playerCount} vivants</span>
              </div>
              {heartbeatEntries.length > 0 && (
                <div className="flex justify-between items-center mt-1">
                  <span className="text-gray-400 flex items-center gap-1">
                    <Heart className="w-3 h-3" /> Heartbeats
                  </span>
                  <span className="text-gray-200">
                    <span className="text-emerald-400">{connectedCount}</span>
                    {staleCount > 0 && <span className="text-amber-400 ml-1">/ {staleCount} lent</span>}
                    {offlineCount > 0 && <span className="text-red-400 ml-1">/ {offlineCount} off</span>}
                  </span>
                </div>
              )}
            </div>

            {/* Broadcast metrics */}
            <div className="px-3 py-2 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-gray-400">Broadcasts</span>
                <span className="text-gray-200">{metrics.totalBroadcasts}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Deltas / Full</span>
                <span className="text-gray-200">
                  {metrics.deltaBroadcasts} / {metrics.fullBroadcasts}
                  <span className="text-emerald-400 ml-1">({deltaRatio}% delta)</span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Dernier envoi</span>
                <span className="text-gray-200">{formatBytes(metrics.lastBroadcastSize)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total envoy&eacute;</span>
                <span className="text-gray-200">{formatBytes(metrics.totalBytesSent)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-400/80">Bande passante &eacute;conomis&eacute;e</span>
                <span className="text-emerald-400 font-semibold">{formatBytes(metrics.savedBytes)}</span>
              </div>

              {/* Expandable details */}
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 text-gray-500 hover:text-gray-300 mt-1"
              >
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                <span>D&eacute;tails</span>
              </button>

              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-1"
                  >
                    <div className="flex justify-between">
                      <span className="text-gray-400">Taille moy. delta</span>
                      <span className="text-gray-200">{formatBytes(metrics.avgDeltaSize)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Taille moy. full</span>
                      <span className="text-gray-200">{formatBytes(metrics.avgFullSize)}</span>
                    </div>
                    {metrics.avgFullSize > 0 && metrics.avgDeltaSize > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Ratio compression</span>
                        <span className="text-emerald-400 font-semibold">
                          {Math.round((1 - metrics.avgDeltaSize / metrics.avgFullSize) * 100)}%
                        </span>
                      </div>
                    )}
                    {/* Per-player heartbeat details */}
                    {heartbeatEntries.length > 0 && (
                      <div className="mt-2 pt-1.5 border-t border-gray-800/50">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Heart className="w-2.5 h-2.5" /> Connexions joueurs
                        </div>
                        <div className="max-h-32 overflow-y-auto space-y-0.5">
                          {heartbeatEntries
                            .sort(([, a], [, b]) => b - a) // most recent first
                            .map(([sc, ts]) => {
                              const age = Math.round((now - ts) / 1000);
                              const label = playerNames[sc] || sc;
                              const ageColor = age < 30 ? 'text-emerald-400' : age < 120 ? 'text-amber-400' : 'text-red-400';
                              const ageText = age < 60 ? `${age}s` : `${Math.floor(age / 60)}m${age % 60}s`;
                              return (
                                <div key={sc} className="flex justify-between items-center">
                                  <span className="text-gray-400 truncate max-w-[120px]">{label}</span>
                                  <span className={`${ageColor} font-mono text-[10px]`}>{ageText}</span>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Actions */}
            <div className="px-3 py-2 border-t border-gray-800/50">
              <button
                onClick={handleReset}
                className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
              >
                Reset compteurs
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

export { GMPerformanceMonitor };