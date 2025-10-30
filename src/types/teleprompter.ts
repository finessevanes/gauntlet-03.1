/**
 * Teleprompter Types
 * Data models and interfaces for the teleprompter feature (Story S9)
 */

export interface TeleprompterScript {
  id: string;
  topic: string;
  duration: number;
  scriptText: string;
  wpm: number;
  createdAt: number;
  isAccepted: boolean;
}

export interface TeleprompterState {
  script: TeleprompterScript | null;
  isGenerating: boolean;
  error: string | null;
  scrollPosition: number;
  isAutoScrolling: boolean;
  isPaused: boolean;
}

export interface GenerateScriptRequest {
  topic: string;
  duration: number;
  feedback?: string;
  previousScript?: string;
}

export interface GenerateScriptResponse {
  scriptText: string;
  estimatedDuration: number;
}
