/**
 * useTrimDrag Hook
 * Manages trim drag state, edge detection, and calculations
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Clip } from '../types/session';

const EDGE_HOVER_THRESHOLD = 5; // px from edge to trigger hover
const MIN_DURATION = 0.033; // Minimum 1 frame at 30fps

interface TrimDragState {
  clipId: string;
  instanceId: string;          // Timeline instance ID for per-instance trimming
  edge: 'left' | 'right';
  startX: number;              // Mouse X position at drag start
  startInPoint: number;        // Original inPoint at drag start
  startOutPoint: number;       // Original outPoint at drag start
  startTime: number;           // Start time of clip on timeline (for positioning)
}

interface UseTrimDragResult {
  // State
  hoveredEdge: { clipId: string; edge: 'left' | 'right' } | null;
  dragging: TrimDragState | null;
  tooltipPosition: { x: number; y: number };
  tooltipVisible: boolean;

  // Calculated values during drag
  draggedInPoint: number | null;
  draggedOutPoint: number | null;

  // Methods
  checkEdgeHover: (clipId: string, mouseX: number, clipRect: DOMRect) => 'left' | 'right' | null;
  startDrag: (clipId: string, instanceId: string, edge: 'left' | 'right', e: React.MouseEvent, clip: Clip, startTime: number) => void;
  endDrag: () => void;
}

export function useTrimDrag(
  pixelsPerSecond: number,
  onTrimComplete?: (clipId: string, instanceId: string, inPoint: number, outPoint: number) => void
): UseTrimDragResult {
  const [hoveredEdge, setHoveredEdge] = useState<{ clipId: string; edge: 'left' | 'right' } | null>(null);
  const [dragging, setDragging] = useState<TrimDragState | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [draggedInPoint, setDraggedInPoint] = useState<number | null>(null);
  const [draggedOutPoint, setDraggedOutPoint] = useState<number | null>(null);

  const dragStateRef = useRef<TrimDragState | null>(null);
  const clipDurationRef = useRef<number>(0);

  // Check if mouse is hovering over clip edge
  const checkEdgeHover = useCallback((clipId: string, mouseX: number, clipRect: DOMRect): 'left' | 'right' | null => {
    const relativeX = mouseX - clipRect.left;

    // Check left edge
    if (relativeX <= EDGE_HOVER_THRESHOLD) {
      return 'left';
    }

    // Check right edge
    if (relativeX >= clipRect.width - EDGE_HOVER_THRESHOLD) {
      return 'right';
    }

    return null;
  }, []);

  // Start drag operation
  const startDrag = useCallback((
    clipId: string,
    instanceId: string,
    edge: 'left' | 'right',
    e: React.MouseEvent,
    clip: Clip,
    startTime: number
  ) => {
    console.log('[useTrimDrag] Starting drag:', { clipId: clipId.substring(0, 8), instanceId: instanceId.substring(0, 8), edge, clipDuration: clip.duration });

    const dragState: TrimDragState = {
      clipId,
      instanceId,
      edge,
      startX: e.clientX,
      startInPoint: clip.inPoint,
      startOutPoint: clip.outPoint,
      startTime,
    };

    setDragging(dragState);
    dragStateRef.current = dragState;
    clipDurationRef.current = clip.duration; // Store clip duration for validation
    setTooltipPosition({ x: e.clientX, y: e.clientY });
    setDraggedInPoint(clip.inPoint);
    setDraggedOutPoint(clip.outPoint);
  }, []);

  // End drag operation
  const endDrag = useCallback(() => {
    if (dragStateRef.current && onTrimComplete && (draggedInPoint !== null && draggedOutPoint !== null)) {
      const { clipId, instanceId } = dragStateRef.current;

      console.log('[useTrimDrag] Ending drag, calling onTrimComplete:', {
        clipId: clipId.substring(0, 8),
        instanceId: instanceId.substring(0, 8),
        inPoint: draggedInPoint,
        outPoint: draggedOutPoint,
      });

      onTrimComplete(clipId, instanceId, draggedInPoint, draggedOutPoint);
    }

    setDragging(null);
    dragStateRef.current = null;
    setDraggedInPoint(null);
    setDraggedOutPoint(null);
  }, [draggedInPoint, draggedOutPoint, onTrimComplete]);

  // Handle mouse move during drag
  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const { startX, edge, startInPoint, startOutPoint } = dragging;

      // Calculate pixel delta
      const deltaX = e.clientX - startX;

      // Convert to time delta
      const timeDelta = deltaX / pixelsPerSecond;

      console.log('[useTrimDrag] Mouse move:', {
        edge,
        deltaX,
        timeDelta,
        startInPoint,
        startOutPoint,
      });

      // Calculate new trim points based on edge
      let newInPoint = startInPoint;
      let newOutPoint = startOutPoint;

      if (edge === 'left') {
        // Dragging left edge (adjusting inPoint, outPoint stays fixed)
        newInPoint = startInPoint + timeDelta;
        newOutPoint = startOutPoint; // Keep outPoint fixed when dragging left edge

        console.log('[useTrimDrag] Left edge - before clamp:', { newInPoint, newOutPoint, clipDuration: clipDurationRef.current });

        // Clamp to valid range: [0, startOutPoint - MIN_DURATION]
        // Ensures inPoint never goes below 0 (start of clip)
        newInPoint = Math.max(0, Math.min(startOutPoint - MIN_DURATION, newInPoint));

        console.log('[useTrimDrag] Left edge - after clamp:', { newInPoint, newOutPoint });
      } else {
        // Dragging right edge (adjusting outPoint, inPoint stays fixed)
        newInPoint = startInPoint; // Keep inPoint fixed when dragging right edge
        newOutPoint = startOutPoint + timeDelta;

        console.log('[useTrimDrag] Right edge - before clamp:', { newInPoint, newOutPoint, clipDuration: clipDurationRef.current });

        // Clamp to valid range: [startInPoint + MIN_DURATION, clip.duration]
        // Auto-correct to full duration if exceeding clip duration
        newOutPoint = Math.max(startInPoint + MIN_DURATION, Math.min(clipDurationRef.current, newOutPoint));

        console.log('[useTrimDrag] Right edge - after clamp:', { newInPoint, newOutPoint });
      }

      // Update tooltip position
      setTooltipPosition({ x: e.clientX, y: e.clientY });

      // Update dragged values
      setDraggedInPoint(newInPoint);
      setDraggedOutPoint(newOutPoint);
    };

    const handleMouseUp = () => {
      endDrag();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, pixelsPerSecond, endDrag]);

  return {
    hoveredEdge,
    dragging,
    tooltipPosition,
    tooltipVisible: dragging !== null,
    draggedInPoint,
    draggedOutPoint,
    checkEdgeHover,
    startDrag,
    endDrag,
  };
}
