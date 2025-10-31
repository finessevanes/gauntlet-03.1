/**
 * Delete Command
 * Undoable command for deleting clips
 */

import { BaseCommand } from './BaseCommand';
import type { TimelineDoc } from '../../types/timeline';
import { deleteClip, type DeleteOptions } from '../operations/delete';

export class DeleteCommand extends BaseCommand {
  private beforeState: TimelineDoc | null = null;

  constructor(private options: DeleteOptions) {
    super(`Delete clip ${options.clipId.substring(0, 8)}`);
  }

  do(doc: TimelineDoc): TimelineDoc {
    this.beforeState = structuredClone(doc);
    return deleteClip(doc, this.options);
  }

  undo(doc: TimelineDoc): TimelineDoc {
    if (!this.beforeState) {
      throw new Error('Cannot undo: no before state');
    }
    return this.beforeState;
  }
}
