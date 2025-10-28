/**
 * File Validation Service
 * Validates video files before import (existence, format, permissions)
 */

import * as fs from 'fs';
import * as path from 'path';

// Supported file extensions
const SUPPORTED_EXTENSIONS = ['.mp4', '.mov'];

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate video file
 * @param filePath - Absolute path to video file
 * @returns ValidationResult indicating if file is valid for import
 */
export function validateVideoFile(filePath: string): ValidationResult {
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return {
      valid: false,
      error: 'File not found'
    };
  }

  // Check if path is a file (not directory)
  const stats = fs.statSync(filePath);
  if (!stats.isFile()) {
    return {
      valid: false,
      error: 'Path is not a file'
    };
  }

  // Check file extension
  const ext = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `Unsupported format: ${ext}. Only MP4 and MOV files are supported.`
    };
  }

  // Check file is readable
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
  } catch (error) {
    return {
      valid: false,
      error: 'Cannot access file. Permission denied.'
    };
  }

  // Check file size is not zero
  if (stats.size === 0) {
    return {
      valid: false,
      error: 'File is empty'
    };
  }

  return { valid: true };
}

/**
 * Extract filename from path
 * @param filePath - Absolute path to file
 * @returns Filename with extension
 */
export function extractFilename(filePath: string): string {
  return path.basename(filePath);
}
