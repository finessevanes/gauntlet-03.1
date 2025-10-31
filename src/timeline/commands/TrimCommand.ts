/**
 * Trim Command
 * Undoable command for trimming clips
 */

import { BaseCommand } from './BaseCommand';
import type { TimelineDoc, EditMode } from '../../types/timeline';
import { trimClip, trimIn, trimOut, type TrimOptions } from '../operations/trim';

export class TrimCommand extends BaseCommand {
  private beforeState: TimelineDoc | null = null;

  constructor(private options: TrimOptions) {
    super(`Trim clip ${options.clipId.substring(0, 8)}`);
  }

  do(doc: TimelineDoc): TimelineDoc {
    this.beforeState = structuredClone(doc);
    return trimClip(doc, this.options);
  }

  undo(doc: TimelineDoc): TimelineDoc {
    if (!this.beforeState) {
      throw new Error('Cannot undo: no before state');
    }
    return this.beforeState;
  }
}

/**
 * Trim In Command (adjust left edge)
 */
export class TrimInCommand extends BaseCommand {
  private beforeState: TimelineDoc | null = null;

  constructor(
    private clipId: string,
    private newInPoint: number,
    private mode?: EditMode
  ) {
    super(`Trim in clip ${clipId.substring(0, 8)}`);
  }

  do(doc: TimelineDoc): TimelineDoc {
    this.beforeState = structuredClone(doc);
    return trimIn(doc, this.clipId, this.newInPoint, this.mode);
  }

  undo(doc: TimelineDoc): TimelineDoc {
    if (!this.beforeState) {
      throw new Error('Cannot undo: no before state');
    }
    return this.beforeState;
  }
}

/**
 * Trim Out Command (adjust right edge)
 */
export class TrimOutCommand extends BaseCommand {
  private beforeState: TimelineDoc | null = null;

  constructor(
    private clipId: string,
    private newOutPoint: number,
    private mode?: EditMode
  ) {
    super(`Trim out clip ${clipId.substring(0, 8)}`);
  }

  do(doc: TimelineDoc): TimelineDoc {
    this.beforeState = structuredClone(doc);
    return trimOut(doc, this.clipId, this.newOutPoint, this.mode);
  }

  undo(doc: TimelineDoc): TimelineDoc {
    if (!this.beforeState) {
      throw new Error('Cannot undo: no before state');
    }
    return this.beforeState;
  }
}
