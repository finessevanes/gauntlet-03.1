/**
 * TeleprompterModal Component
 * Main modal container for the teleprompter feature
 * Story S9: Teleprompter
 */

import React, { useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useTeleprompterStore } from '../store/teleprompterStore';
import { TeleprompterScript } from '../types/teleprompter';
import { ScriptGenerator } from './ScriptGenerator';
import { ScriptPreview } from './ScriptPreview';
import { ScriptDisplay } from './ScriptDisplay';

interface TeleprompterModalProps {
  isOpen: boolean;
  onClose: () => void;
  showBackdrop?: boolean;
}

type ModalState = 'generator' | 'preview' | 'display' | 'feedback';

export function TeleprompterModal({ isOpen, onClose, showBackdrop = true }: TeleprompterModalProps) {
  const {
    script,
    isGenerating,
    error,
    setScript,
    setIsGenerating,
    setError,
    clearError,
    resetScript,
  } = useTeleprompterStore();

  const [modalState, setModalState] = useState<ModalState>('generator');
  const [previewScript, setPreviewScript] = useState<{ text: string; duration: number } | null>(null);
  const [originalTopic, setOriginalTopic] = useState<string>('');

  // Draggable window state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  // Initialize modal state on open
  React.useEffect(() => {
    if (isOpen && script?.isAccepted) {
      // If script is already accepted, show display mode
      setModalState('display');
    } else if (isOpen && !script) {
      // If no script, show generator
      setModalState('generator');
    }
  }, [isOpen, script]);

  // Initialize position to center of screen on open
  React.useEffect(() => {
    if (isOpen && modalRef.current) {
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const modalWidth = 500; // w-10/12 max-w-lg
      const modalHeight = 384; // max-h-96

      const centerX = (windowWidth - modalWidth) / 2;
      const centerY = (windowHeight - modalHeight) / 2;

      setPosition({
        x: Math.max(0, centerX),
        y: Math.max(0, centerY),
      });
    }
  }, [isOpen]);

  // Handle mouse down on header
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (modalRef.current) {
      const rect = modalRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setIsDragging(true);
    }
  };

  // Handle mouse move for dragging
  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  if (!isOpen) {
    return null;
  }

  // Handle script generation request
  const handleGenerate = async (topic: string, duration: number, feedback?: string) => {
    clearError();
    setIsGenerating(true);

    // Store the original topic on first generation (only when not in feedback mode)
    if (modalState !== 'feedback' && !originalTopic) {
      setOriginalTopic(topic);
    }

    try {
      const response = await window.electron.ai.generateScript({
        topic,
        duration,
        feedback,
        previousScript: modalState === 'feedback' ? previewScript?.text : undefined,
      });

      setPreviewScript({
        text: response.scriptText,
        duration: response.estimatedDuration,
      });

      setModalState('preview');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate script';
      setError(message);
      console.error('[TeleprompterModal] Generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle accepting the generated script
  const handleAccept = () => {
    if (!previewScript) return;

    const newScript: TeleprompterScript = {
      id: uuidv4(),
      topic: previewScript.text.substring(0, 50), // Use first 50 chars as topic
      duration: previewScript.duration,
      scriptText: previewScript.text,
      wpm: 150,
      createdAt: Date.now(),
      isAccepted: true,
    };

    setScript(newScript);
    setPreviewScript(null);
    setModalState('display');
  };

  // Handle regenerate button click - switch to feedback mode
  const handleRegenerateClick = () => {
    setModalState('feedback');
  };

  // Handle clearing the script
  const handleClear = () => {
    resetScript();
    setPreviewScript(null);
    setOriginalTopic('');
    setModalState('generator');
  };

  // Handle closing the modal
  const handleClose = () => {
    // Script is automatically saved in Zustand store, so we don't lose it on modal close
    onClose();
  };

  // Modal backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center z-[1100] pointer-events-none ${showBackdrop ? 'bg-black bg-opacity-50 pointer-events-auto' : ''}`}
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-10/12 max-w-lg max-h-96 overflow-hidden flex flex-col z-[1101] pointer-events-auto"
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
      >
        {/* Modal Header - Draggable */}
        <div
          className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          style={{ userSelect: 'none' }}
        >
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {modalState === 'display' ? 'Teleprompter' : 'Generate Script'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-auto p-6">
          {modalState === 'generator' && script?.isAccepted ? (
            // Show script display if script is already accepted
            <ScriptDisplay scriptText={script.scriptText} onClose={handleClose} onClear={handleClear} />
          ) : modalState === 'display' && script?.isAccepted ? (
            <ScriptDisplay scriptText={script.scriptText} onClose={handleClose} onClear={handleClear} />
          ) : modalState === 'preview' && previewScript ? (
            <ScriptPreview
              scriptText={previewScript.text}
              estimatedDuration={previewScript.duration}
              onAccept={handleAccept}
              onRegenerate={handleRegenerateClick}
              isLoading={isGenerating}
              error={error}
              feedback={false}
            />
          ) : modalState === 'feedback' && previewScript ? (
            <ScriptPreview
              scriptText={previewScript.text}
              estimatedDuration={previewScript.duration}
              onAccept={handleAccept}
              onRegenerate={handleGenerate}
              isLoading={isGenerating}
              error={error}
              feedback={true}
              initialTopic={originalTopic}
            />
          ) : (
            <ScriptGenerator
              onGenerate={handleGenerate}
              isLoading={isGenerating}
              error={error}
              feedback={false}
            />
          )}
        </div>

        {/* Modal Footer (optional) */}
        {modalState === 'display' && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800 text-center text-sm text-gray-600 dark:text-gray-400">
            Press Esc or click the X button to close
          </div>
        )}
      </div>
    </div>
  );
}
