/**
 * PresetManager - Manages export preset persistence and validation (Story 14)
 * Handles loading, saving, deleting, and validating custom export presets
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { ExportPreset, BUILTIN_PRESETS, PresetValidationResult, PresetPersistence } from '../../types/export';

const PRESET_FILE_NAME = 'export-presets.json';
const CURRENT_VERSION = 1;

/**
 * Get the full path to the presets file
 */
function getPresetsFilePath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, PRESET_FILE_NAME);
}

/**
 * Load all presets (built-in + custom)
 */
export function loadPresets(): ExportPreset[] {
  const customPresets = getCustomPresets();
  return [...BUILTIN_PRESETS, ...customPresets];
}

/**
 * Get only built-in presets
 */
export function getBuiltinPresets(): ExportPreset[] {
  return [...BUILTIN_PRESETS];
}

/**
 * Get only custom presets from file
 */
export function getCustomPresets(): ExportPreset[] {
  const filePath = getPresetsFilePath();

  // If file doesn't exist, return empty array
  if (!fs.existsSync(filePath)) {
    console.log('[PresetManager] Presets file does not exist, returning empty custom presets');
    return [];
  }

  try {
    const fileContents = fs.readFileSync(filePath, 'utf-8');
    const data: PresetPersistence = JSON.parse(fileContents);

    // Validate version
    if (data.version !== CURRENT_VERSION) {
      console.warn('[PresetManager] Presets file version mismatch. Expected:', CURRENT_VERSION, 'Got:', data.version);
    }

    // Return custom presets array
    return data.customPresets || [];
  } catch (error) {
    console.error('[PresetManager] Failed to load custom presets:', error);
    console.error('[PresetManager] Returning empty custom presets array');
    return [];
  }
}

/**
 * Get preset by ID (searches built-in + custom)
 */
export function getPresetById(id: string): ExportPreset | null {
  const allPresets = loadPresets();
  return allPresets.find(preset => preset.id === id) || null;
}

/**
 * Get the default preset ID
 */
export function getDefaultPresetId(): string | null {
  const filePath = getPresetsFilePath();

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const fileContents = fs.readFileSync(filePath, 'utf-8');
    const data: PresetPersistence = JSON.parse(fileContents);
    return data.defaultPresetId || null;
  } catch (error) {
    console.error('[PresetManager] Failed to read default preset:', error);
    return null;
  }
}

/**
 * Set the default preset ID
 */
export function setDefaultPresetId(presetId: string | null): { success: boolean; error?: string } {
  try {
    // Verify preset exists if setting a default
    if (presetId !== null) {
      const preset = getPresetById(presetId);
      if (!preset) {
        return {
          success: false,
          error: 'Preset not found',
        };
      }
    }

    // Load existing data
    const filePath = getPresetsFilePath();
    let data: PresetPersistence;

    if (fs.existsSync(filePath)) {
      const fileContents = fs.readFileSync(filePath, 'utf-8');
      data = JSON.parse(fileContents);
    } else {
      // Create new file if it doesn't exist
      data = {
        version: CURRENT_VERSION,
        customPresets: [],
      };
    }

    // Update default preset ID
    data.defaultPresetId = presetId || undefined;

    // Write back to file
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log('[PresetManager] Default preset updated:', presetId);

    return { success: true };
  } catch (error) {
    console.error('[PresetManager] Failed to set default preset:', error);
    return {
      success: false,
      error: `Failed to set default preset: ${error.message}`,
    };
  }
}

/**
 * Validate a preset against requirements
 */
export function validatePreset(preset: ExportPreset, existingPresets?: ExportPreset[]): PresetValidationResult {
  // Name required and non-empty
  if (!preset.name || preset.name.trim().length === 0) {
    return {
      valid: false,
      error: 'Name is required',
    };
  }

  // Check for duplicate name (excluding self if updating)
  const presets = existingPresets || loadPresets();
  const duplicate = presets.find(
    p => p.name.toLowerCase() === preset.name.toLowerCase() && p.id !== preset.id
  );
  if (duplicate) {
    return {
      valid: false,
      error: 'A preset with this name already exists',
    };
  }

  // Resolution validation: width >= 320, height >= 180
  if (preset.resolution.width < 320 || preset.resolution.height < 180) {
    return {
      valid: false,
      error: 'Minimum resolution is 320x180',
    };
  }

  // Resolution validation: max 8K
  if (preset.resolution.width > 7680 || preset.resolution.height > 4320) {
    return {
      valid: false,
      error: 'Maximum resolution is 7680x4320 (8K)',
    };
  }

  // Bitrate validation: 1-100 Mbps
  if (preset.bitrate < 1 || preset.bitrate > 100) {
    return {
      valid: false,
      error: 'Bitrate must be between 1 and 100 Mbps',
    };
  }

  // Frame rate validation: 24, 30, or 60
  if (![24, 30, 60].includes(preset.frameRate)) {
    return {
      valid: false,
      error: 'Frame rate must be 24, 30, or 60',
    };
  }

  return { valid: true };
}

/**
 * Save or update a custom preset
 */
export function saveCustomPreset(preset: ExportPreset): { success: boolean; error?: string } {
  try {
    // Load existing custom presets
    const customPresets = getCustomPresets();

    // Validate preset
    const validation = validatePreset(preset, [...BUILTIN_PRESETS, ...customPresets]);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
      };
    }

    // Check if updating existing preset or creating new
    const existingIndex = customPresets.findIndex(p => p.id === preset.id);

    if (existingIndex >= 0) {
      // Update existing preset
      customPresets[existingIndex] = preset;
      console.log('[PresetManager] Updating preset:', preset.id);
    } else {
      // Add new preset
      customPresets.push(preset);
      console.log('[PresetManager] Adding new preset:', preset.id);
    }

    // Write to file
    const filePath = getPresetsFilePath();
    const data: PresetPersistence = {
      version: CURRENT_VERSION,
      customPresets,
    };

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log('[PresetManager] Preset saved successfully');

    return { success: true };
  } catch (error) {
    console.error('[PresetManager] Failed to save preset:', error);
    return {
      success: false,
      error: `Failed to save preset: ${error.message}`,
    };
  }
}

/**
 * Delete a custom preset
 */
export function deleteCustomPreset(presetId: string): { success: boolean; error?: string } {
  try {
    // Check if preset exists
    const preset = getPresetById(presetId);
    if (!preset) {
      return {
        success: false,
        error: 'Preset not found',
      };
    }

    // Verify preset is custom (not built-in)
    if (preset.category === 'builtin') {
      return {
        success: false,
        error: 'Cannot delete built-in preset',
      };
    }

    // Load custom presets
    const customPresets = getCustomPresets();

    // Filter out the preset to delete
    const updatedPresets = customPresets.filter(p => p.id !== presetId);

    // Write updated list to file
    const filePath = getPresetsFilePath();
    const data: PresetPersistence = {
      version: CURRENT_VERSION,
      customPresets: updatedPresets,
    };

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log('[PresetManager] Preset deleted successfully:', presetId);

    return { success: true };
  } catch (error) {
    console.error('[PresetManager] Failed to delete preset:', error);
    return {
      success: false,
      error: `Failed to delete preset: ${error.message}`,
    };
  }
}
