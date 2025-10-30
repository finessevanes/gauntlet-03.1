/**
 * Export preset types for advanced export options (Story 14)
 */

export interface ExportPreset {
  id: string;                    // "youtube" | "instagram" | UUID for custom
  name: string;                  // "YouTube", "My 720p"
  category: 'builtin' | 'custom';
  resolution: { width: number; height: number };
  bitrate: number;               // Mbps
  frameRate: 24 | 30 | 60;
  platform?: string;             // "youtube", "instagram", etc.
  description?: string;
  createdAt?: number;            // timestamp for custom
}

/**
 * Built-in platform presets (read-only)
 */
export const BUILTIN_PRESETS: ExportPreset[] = [
  {
    id: 'youtube',
    name: 'YouTube',
    category: 'builtin',
    platform: 'youtube',
    resolution: { width: 1920, height: 1080 },
    bitrate: 12,
    frameRate: 30,
    description: '1080p at 30fps, optimized for YouTube',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    category: 'builtin',
    platform: 'instagram',
    resolution: { width: 1080, height: 1350 },
    bitrate: 5,
    frameRate: 30,
    description: 'Vertical format for Instagram posts',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    category: 'builtin',
    platform: 'tiktok',
    resolution: { width: 1080, height: 1920 },
    bitrate: 5,
    frameRate: 30,
    description: 'Vertical format for TikTok videos',
  },
  {
    id: 'twitter',
    name: 'Twitter',
    category: 'builtin',
    platform: 'twitter',
    resolution: { width: 1280, height: 720 },
    bitrate: 8,
    frameRate: 30,
    description: '720p optimized for Twitter',
  },
];

/**
 * Preset validation result
 */
export interface PresetValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Persistence file structure for export-presets.json
 */
export interface PresetPersistence {
  version: number;
  customPresets: ExportPreset[];
  defaultPresetId?: string; // Story 14: Default preset for quick export
}
