/**
 * Move Command
 * Undoable command for moving clips
 */

import { BaseCommand } from './BaseCommand';
import type { TimelineDoc } from '../../types/timeline';
import { moveClip, moveClips, type MoveOptions } from '../operations/move';

export class MoveCommand extends BaseCommand {
  private beforeState: TimelineDoc | null = null;

  constructor(private options: MoveOptions) {
    super(`Move clip ${options.clipId.substring(0, 8)}`);
  }

  do(doc: TimelineDoc): TimelineDoc {
    this.beforeState = structuredClone(doc);
    return moveClip(doc, this.options);
  }

  undo(doc: TimelineDoc): TimelineDoc {
    if (!this.beforeState) {
      throw new Error('Cannot undo: no before state');
    }
    return this.beforeState;
  }
}

/**
 * Move multiple clips together
 */
export class MoveMultipleCommand extends BaseCommand {
  private beforeState: TimelineDoc | null = null;

  constructor(
    private clipIds: string[],
    private options: Omit<MoveOptions, 'clipId'>
  ) {
    super(`Move ${clipIds.length} clips`);
  }

  do(doc: TimelineDoc): TimelineDoc {
    this.beforeState = structuredClone(doc);
    return moveClips(doc, this.clipIds, this.options);
  }

  undo(doc: TimelineDoc): TimelineDoc {
    if (!this.beforeState) {
      throw new Error('Cannot undo: no before state');
    }
    return this.beforeState;
  }
}
