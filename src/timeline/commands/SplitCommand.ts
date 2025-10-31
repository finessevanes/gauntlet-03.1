/**
 * Split Command
 * Undoable command for splitting clips
 */

import { BaseCommand } from './BaseCommand';
import type { TimelineDoc } from '../../types/timeline';
import { splitClip, splitLinkedGroup, type SplitOptions } from '../operations/split';

export class SplitCommand extends BaseCommand {
  private beforeState: TimelineDoc | null = null;

  constructor(private options: SplitOptions) {
    super(`Split clip ${options.clipId.substring(0, 8)} at ${options.atTime}`);
  }

  do(doc: TimelineDoc): TimelineDoc {
    this.beforeState = structuredClone(doc);
    return splitClip(doc, this.options);
  }

  undo(doc: TimelineDoc): TimelineDoc {
    if (!this.beforeState) {
      throw new Error('Cannot undo: no before state');
    }
    return this.beforeState;
  }
}

/**
 * Split all clips in a linked group
 */
export class SplitLinkedGroupCommand extends BaseCommand {
  private beforeState: TimelineDoc | null = null;

  constructor(
    private linkedGroupId: string,
    private atTime: number
  ) {
    super(`Split linked group ${linkedGroupId.substring(0, 8)} at ${atTime}`);
  }

  do(doc: TimelineDoc): TimelineDoc {
    this.beforeState = structuredClone(doc);
    return splitLinkedGroup(doc, this.linkedGroupId, this.atTime);
  }

  undo(doc: TimelineDoc): TimelineDoc {
    if (!this.beforeState) {
      throw new Error('Cannot undo: no before state');
    }
    return this.beforeState;
  }
}
