/**
 * ScriptDisplay Component
 * Displays accepted script with manual and auto-scroll controls
 * Story S9: Teleprompter
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTeleprompterStore } from '../store/teleprompterStore';

interface ScriptDisplayProps {
  scriptText: string;
  onClose?: () => void;
  onClear?: () => void;
}

export function ScriptDisplay({ scriptText, onClose, onClear }: ScriptDisplayProps) {
  const {
    scrollPosition,
    isAutoScrolling,
    isPaused,
    setScrollPosition,
    setIsAutoScrolling,
    setIsPaused,
  } = useTeleprompterStore();

  const [fontSize, setFontSize] = useState(20);
  const [currentWpm, setCurrentWpm] = useState(150);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastScrollTimeRef = useRef<number>(Date.now());

  // Split script into lines
  const lines = scriptText.split('\n').filter((line) => line.trim().length > 0);
  const maxScroll = Math.max(0, lines.length - 1);

  // Auto-scroll logic using requestAnimationFrame
  useEffect(() => {
    if (!isAutoScrolling || isPaused) {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      return;
    }

    const scroll = () => {
      const now = Date.now();
      const timeDelta = now - lastScrollTimeRef.current;
      lastScrollTimeRef.current = now;

      // Calculate scroll rate: WPM / 60 seconds = words per second
      // Estimate ~8 words per line
      // So: (WPM / 60) / 8 = lines per second
      const linesPerSecond = currentWpm / 60 / 8;
      const linesPerFrame = linesPerSecond * (timeDelta / 1000);

      setScrollPosition(Math.min(scrollPosition + linesPerFrame, maxScroll));
      rafIdRef.current = requestAnimationFrame(scroll);
    };

    rafIdRef.current = requestAnimationFrame(scroll);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [isAutoScrolling, isPaused, currentWpm, scrollPosition, maxScroll, setScrollPosition]);

  // Update scroll container position
  useEffect(() => {
    if (scrollContainerRef.current) {
      const lineHeight = fontSize * 1.5; // Approximate line height
      const scrollTop = scrollPosition * lineHeight;
      scrollContainerRef.current.scrollTop = scrollTop;
    }
  }, [scrollPosition, fontSize]);

  // Handle manual scroll up
  const handleScrollUp = () => {
    setScrollPosition(scrollPosition - 2);
  };

  // Handle manual scroll down
  const handleScrollDown = () => {
    setScrollPosition(scrollPosition + 2);
  };

  // Handle WPM change
  const handleWpmChange = (newWpm: number) => {
    const clamped = Math.max(80, Math.min(200, newWpm));
    setCurrentWpm(clamped);
  };

  // Handle font size change
  const handleFontSizeChange = (newSize: number) => {
    const clamped = Math.max(12, Math.min(32, newSize));
    setFontSize(clamped);
  };

  return (
    <div className="flex flex-col gap-4 h-full bg-white dark:bg-gray-900">
      {/* Close and Clear Buttons */}
      <div className="flex justify-between items-center">
        {onClear && (
          <button
            onClick={onClear}
            className="px-3 py-2 bg-red-500 text-white text-sm font-semibold rounded hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700"
            title="Clear script and start over"
          >
            Clear Script
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title="Close teleprompter"
          >
            ✕
          </button>
        )}
      </div>

      {/* Main Script Display Area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-hidden bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 flex items-center justify-center"
      >
        <div
          className="text-center leading-relaxed text-gray-900 dark:text-gray-100 transition-all"
          style={{ fontSize: `${fontSize}px` }}
        >
          {lines.map((line, idx) => (
            <div
              key={idx}
              className={`transition-opacity ${
                idx >= Math.floor(scrollPosition) && idx <= Math.floor(scrollPosition) + 3
                  ? 'opacity-100'
                  : 'opacity-50'
              }`}
            >
              {line}
            </div>
          ))}
        </div>
      </div>

      {/* Control Panel */}
      <div className="flex flex-col gap-3 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        {/* Playback Controls Row 1 */}
        <div className="flex items-center gap-2">
          {/* Manual Scroll Buttons */}
          <button
            onClick={handleScrollUp}
            disabled={scrollPosition <= 0}
            className="px-3 py-2 bg-gray-300 text-gray-900 font-semibold rounded hover:bg-gray-400 disabled:opacity-50 dark:bg-gray-600 dark:text-white dark:hover:bg-gray-500"
            title="Scroll up"
          >
            ▲
          </button>

          <button
            onClick={handleScrollDown}
            disabled={scrollPosition >= maxScroll}
            className="px-3 py-2 bg-gray-300 text-gray-900 font-semibold rounded hover:bg-gray-400 disabled:opacity-50 dark:bg-gray-600 dark:text-white dark:hover:bg-gray-500"
            title="Scroll down"
          >
            ▼
          </button>

          {/* Auto-Scroll Toggle */}
          <button
            onClick={() => setIsAutoScrolling(!isAutoScrolling)}
            className={`px-4 py-2 font-semibold rounded transition-colors ${
              isAutoScrolling
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-gray-300 text-gray-900 hover:bg-gray-400 dark:bg-gray-600 dark:text-white dark:hover:bg-gray-500'
            }`}
            title={isAutoScrolling ? 'Disable auto-scroll' : 'Enable auto-scroll'}
          >
            {isAutoScrolling ? '▶ Auto' : '⏸ Manual'}
          </button>

          {/* Pause/Play Button (only show when auto-scrolling) */}
          {isAutoScrolling && (
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`px-4 py-2 font-semibold rounded transition-colors ${
                isPaused
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-yellow-500 text-white hover:bg-yellow-600'
              }`}
              title={isPaused ? 'Resume' : 'Pause'}
            >
              {isPaused ? '▶ Resume' : '⏸ Pause'}
            </button>
          )}
        </div>

        {/* Playback Controls Row 2 - Sliders */}
        <div className="flex flex-col gap-2">
          {/* WPM Slider */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 w-20">
              WPM:
            </label>
            <input
              type="range"
              min="80"
              max="200"
              value={currentWpm}
              onChange={(e) => handleWpmChange(parseInt(e.target.value, 10))}
              className="flex-1 h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer dark:bg-gray-600"
              title="Adjust reading speed (words per minute)"
            />
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 w-12 text-right">
              {currentWpm}
            </span>
          </div>

          {/* Font Size Slider */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 w-20">
              Size:
            </label>
            <input
              type="range"
              min="12"
              max="32"
              value={fontSize}
              onChange={(e) => handleFontSizeChange(parseInt(e.target.value, 10))}
              className="flex-1 h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer dark:bg-gray-600"
              title="Adjust font size"
            />
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 w-12 text-right">
              {fontSize}px
            </span>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="text-center text-sm text-gray-600 dark:text-gray-400">
          Line {Math.floor(scrollPosition) + 1} of {lines.length}
        </div>
      </div>
    </div>
  );
}
