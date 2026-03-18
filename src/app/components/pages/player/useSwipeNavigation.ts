import { useRef, useState, useCallback, useEffect } from 'react';

export type PanelId = 'game' | 'village' | 'quests';

interface SwipeNavigationOptions {
  panels: PanelId[];
  activePanel: PanelId;
  setActivePanel: (p: PanelId) => void;
  isFlipped: boolean;
  /** Re-attach listeners when these values change */
  deps?: unknown[];
}

export function useSwipeNavigation({
  panels,
  activePanel,
  setActivePanel,
  isFlipped,
  deps = [],
}: SwipeNavigationOptions) {
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchDeltaX = useRef(0);
  const swipeDirection = useRef<'none' | 'horizontal' | 'vertical'>('none');
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  // Keep refs in sync so stable callbacks always read the latest values
  const activePanelRef = useRef(activePanel);
  activePanelRef.current = activePanel;
  const panelsRef = useRef(panels);
  panelsRef.current = panels;
  const isFlippedRef = useRef(isFlipped);
  isFlippedRef.current = isFlipped;

  // Measure container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0) setContainerWidth(rect.width);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      if (w > 0) setContainerWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // Fallback: if containerWidth is still 0 after mount, retry measurement on every render
  useEffect(() => {
    if (containerWidth > 0) return;
    const el = containerRef.current;
    if (!el) return;
    // Use rAF to ensure layout is complete
    const raf = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0) setContainerWidth(rect.width);
    });
    return () => cancelAnimationFrame(raf);
  });

  // ---- Touch handlers ----
  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchDeltaX.current = 0;
    swipeDirection.current = 'none';
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (isFlippedRef.current && activePanelRef.current === 'game') return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (swipeDirection.current === 'none') {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        swipeDirection.current = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
        if (swipeDirection.current === 'horizontal') setIsDragging(true);
      }
      return;
    }
    if (swipeDirection.current !== 'horizontal') return;
    // No e.preventDefault() needed — touch-action: pan-y on the container
    // already prevents native horizontal panning while allowing vertical scroll.
    touchDeltaX.current = dx;
    const p = panelsRef.current;
    const idx = p.indexOf(activePanelRef.current);
    if ((idx === 0 && dx > 0) || (idx === p.length - 1 && dx < 0)) {
      setDragOffset(dx * 0.2);
    } else {
      setDragOffset(dx);
    }
  }, []);

  const commitSwipe = useCallback(() => {
    if (swipeDirection.current === 'horizontal') {
      const threshold = 60;
      const p = panelsRef.current;
      const idx = p.indexOf(activePanelRef.current);
      if (touchDeltaX.current < -threshold && idx < p.length - 1) {
        setActivePanel(p[idx + 1]);
      } else if (touchDeltaX.current > threshold && idx > 0) {
        setActivePanel(p[idx - 1]);
      }
    }
    setIsDragging(false);
    setDragOffset(0);
    swipeDirection.current = 'none';
  }, [setActivePanel]);

  const handleTouchEnd = useCallback(() => commitSwipe(), [commitSwipe]);

  // ---- Mouse drag (desktop testing) ----
  const isMouseDown = useRef(false);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    isMouseDown.current = true;
    touchStartX.current = e.clientX;
    touchStartY.current = e.clientY;
    touchDeltaX.current = 0;
    swipeDirection.current = 'none';
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isMouseDown.current) return;
    if (isFlippedRef.current && activePanelRef.current === 'game') return;
    const dx = e.clientX - touchStartX.current;
    const dy = e.clientY - touchStartY.current;
    if (swipeDirection.current === 'none') {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        swipeDirection.current = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
        if (swipeDirection.current === 'horizontal') setIsDragging(true);
      }
      return;
    }
    if (swipeDirection.current !== 'horizontal') return;
    e.preventDefault();
    touchDeltaX.current = dx;
    const p = panelsRef.current;
    const idx = p.indexOf(activePanelRef.current);
    if ((idx === 0 && dx > 0) || (idx === p.length - 1 && dx < 0)) {
      setDragOffset(dx * 0.2);
    } else {
      setDragOffset(dx);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!isMouseDown.current) return;
    isMouseDown.current = false;
    commitSwipe();
  }, [commitSwipe]);

  // Attach native listeners
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    el.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
      el.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      setIsDragging(false);
      setDragOffset(0);
      swipeDirection.current = 'none';
      isMouseDown.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, handleMouseDown, handleMouseMove, handleMouseUp, ...deps]);

  return {
    containerRef,
    isDragging,
    dragOffset,
    containerWidth,
  };
}