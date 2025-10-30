/**
 * ScriptGenerator Component
 * Provides UI for user to input topic and duration, then generates script via AI
 * Story S9: Teleprompter
 */

import React, { useState } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

interface ScriptGeneratorProps {
  onGenerate: (topic: string, duration: number, feedback?: string) => void;
  isLoading: boolean;
  error: string | null;
  feedback?: boolean;
  initialTopic?: string;
}

export function ScriptGenerator({
  onGenerate,
  isLoading,
  error,
  feedback = false,
  initialTopic = '',
}: ScriptGeneratorProps) {
  const [topic, setTopic] = useState(initialTopic);
  const [duration, setDuration] = useState('30');
  const [feedbackText, setFeedbackText] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validation
    if (!topic.trim()) {
      setValidationError('Topic is required');
      return;
    }

    const durationNum = parseInt(duration, 10);
    if (isNaN(durationNum) || durationNum < 1 || durationNum > 300) {
      setValidationError('Duration must be between 1 and 300 seconds');
      return;
    }

    // Call the onGenerate callback
    onGenerate(topic.trim(), durationNum, feedbackText.trim() || undefined);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Topic Input */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {feedback ? 'Additional Feedback' : 'What do you want to talk about?'}
        </label>
        <input
          type="text"
          value={feedback ? feedbackText : topic}
          onChange={(e) => (feedback ? setFeedbackText(e.target.value) : setTopic(e.target.value))}
          placeholder={feedback ? 'e.g., shorter, more casual, technical details' : 'e.g., benefits of creatine'}
          disabled={isLoading}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:opacity-50"
        />
      </div>

      {/* Duration Input (only show for initial generation) */}
      {!feedback && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Duration (seconds)
          </label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            min="1"
            max="300"
            disabled={isLoading}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:opacity-50"
          />
        </div>
      )}

      {/* Error Messages */}
      {(validationError || error) && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-400">
            {validationError || error}
          </p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-4">
          <LoadingSpinner />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Generating script...
          </span>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading || (!feedback && (!topic.trim() || !duration))}
        className="w-full px-4 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {feedback ? 'Regenerate' : 'Generate'}
      </button>
    </form>
  );
}
