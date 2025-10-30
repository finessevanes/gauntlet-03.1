/**
 * ScriptPreview Component
 * Displays the generated script for approval before displaying it for reading
 * Story S9: Teleprompter
 */

import React from 'react';
import { ScriptGenerator } from './ScriptGenerator';

interface ScriptPreviewProps {
  scriptText: string;
  estimatedDuration: number;
  onAccept: () => void;
  onRegenerate: ((topic?: string, duration?: number, feedback?: string) => void) | (() => void);
  isLoading: boolean;
  error: string | null;
  feedback?: boolean;
  initialTopic?: string;
}

export function ScriptPreview({
  scriptText,
  estimatedDuration,
  onAccept,
  onRegenerate,
  isLoading,
  error,
  feedback = false,
  initialTopic = '',
}: ScriptPreviewProps) {
  const minutes = Math.floor(estimatedDuration / 60);
  const seconds = estimatedDuration % 60;
  const durationStr = minutes > 0
    ? `${minutes}:${seconds.toString().padStart(2, '0')}`
    : `${seconds}s`;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Script Preview Area */}
      <div className="flex-1 flex flex-col gap-2 min-h-0">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {feedback ? 'Updated Script' : 'Preview'}
          </h3>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Estimated read time at 150 WPM: {durationStr}
          </div>
        </div>

        {/* Script Text */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-base leading-relaxed text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
            {scriptText}
          </p>
        </div>
      </div>

      {/* Action Buttons or Feedback Form */}
      {feedback && isLoading ? (
        <ScriptGenerator
          onGenerate={onRegenerate}
          isLoading={isLoading}
          error={error}
          feedback={true}
          initialTopic={initialTopic}
        />
      ) : feedback ? (
        <div className="flex flex-col gap-2">
          <ScriptGenerator
            onGenerate={onRegenerate}
            isLoading={isLoading}
            error={error}
            feedback={true}
            initialTopic={initialTopic}
          />
          <button
            onClick={() => {
              onAccept();
            }}
            className="w-full px-4 py-2 bg-gray-300 text-gray-900 font-semibold rounded-lg hover:bg-gray-400 transition-colors dark:bg-gray-600 dark:text-white dark:hover:bg-gray-500"
          >
            Accept This Version
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={onAccept}
            className="flex-1 px-4 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors"
          >
            Accept
          </button>
          <button
            onClick={onRegenerate}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-gray-400 text-white font-semibold rounded-lg hover:bg-gray-500 disabled:opacity-50 transition-colors"
          >
            Regenerate
          </button>
        </div>
      )}
    </div>
  );
}
