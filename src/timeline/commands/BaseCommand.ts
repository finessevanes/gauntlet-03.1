/**
 * Base Command Classes
 * Provides utilities for implementing undoable timeline commands
 */

import type { Command } from '../../store/timelineStore';
import type { TimelineDoc } from '../../types/timeline';

/**
 * Abstract base command with description support
 */
export abstract class BaseCommand implements Command {
  constructor(public description: string = 'Unnamed command') {}

  abstract do(doc: TimelineDoc): TimelineDoc;
  abstract undo(doc: TimelineDoc): TimelineDoc;
}

/**
 * Simple state-swapping command
 * Stores before/after states for undo/redo
 */
export class StatefulCommand extends BaseCommand {
  private beforeState: TimelineDoc | null = null;
  private afterState: TimelineDoc | null = null;

  constructor(
    description: string,
    private operation: (doc: TimelineDoc) => TimelineDoc
  ) {
    super(description);
  }

  do(doc: TimelineDoc): TimelineDoc {
    this.beforeState = structuredClone(doc);
    this.afterState = this.operation(doc);
    return this.afterState;
  }

  undo(doc: TimelineDoc): TimelineDoc {
    if (!this.beforeState) {
      throw new Error('Cannot undo: no before state');
    }
    return this.beforeState;
  }
}

/**
 * Batch command - executes multiple commands as one
 */
export class BatchCommand extends BaseCommand {
  constructor(
    description: string,
    private commands: Command[]
  ) {
    super(description);
  }

  do(doc: TimelineDoc): TimelineDoc {
    return this.commands.reduce((currentDoc, cmd) => cmd.do(currentDoc), doc);
  }

  undo(doc: TimelineDoc): TimelineDoc {
    // Undo in reverse order
    return this.commands.reduceRight((currentDoc, cmd) => cmd.undo(currentDoc), doc);
  }
}

/**
 * No-op command (for testing or placeholders)
 */
export class NoOpCommand extends BaseCommand {
  constructor() {
    super('No operation');
  }

  do(doc: TimelineDoc): TimelineDoc {
    return doc;
  }

  undo(doc: TimelineDoc): TimelineDoc {
    return doc;
  }
}
