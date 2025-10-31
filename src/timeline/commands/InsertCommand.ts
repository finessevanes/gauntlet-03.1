/**
 * Insert Command
 * Undoable command for inserting clips
 */

import { BaseCommand } from './BaseCommand';
import type { TimelineDoc, Clip } from '../../types/timeline';
import { insertClip, type InsertOptions } from '../operations/insert';

export class InsertCommand extends BaseCommand {
  private beforeState: TimelineDoc | null = null;
  private insertedClipId: string;

  constructor(private options: InsertOptions) {
    super(`Insert clip ${options.clip.id.substring(0, 8)}`);
    this.insertedClipId = options.clip.id;
  }

  do(doc: TimelineDoc): TimelineDoc {
    this.beforeState = structuredClone(doc);
    return insertClip(doc, this.options);
  }

  undo(doc: TimelineDoc): TimelineDoc {
    if (!this.beforeState) {
      throw new Error('Cannot undo: no before state');
    }
    return this.beforeState;
  }
}
