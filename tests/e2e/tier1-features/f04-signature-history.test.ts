import { describe, it, expect, beforeEach } from 'vitest';
import { attachCanvasSpy, CanvasSpyInstance } from '../../helpers/canvasSpy';
import { CONTRACTOR_STROKES_FIXTURE } from '../../fixtures/signatures.fixture';
import { SignatureHistoryManager } from '../../../src/components/signature/SignaturePad';
import type { SignatureStroke } from '../../../src/types';

export { SignatureHistoryManager };

describe('Feature 4: Signature History & Reset (f04-signature-history)', () => {
  let canvas: HTMLCanvasElement;
  let spy: CanvasSpyInstance;
  let history: SignatureHistoryManager;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 200;
    spy = attachCanvasSpy(canvas);
    history = new SignatureHistoryManager(canvas);
  });

  it('initializes with empty history, canUndo=false, canRedo=false, and isEmpty=true', () => {
    expect(history.isEmpty()).toBe(true);
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
    expect(history.getStrokes()).toHaveLength(0);
  });

  it('records completed strokes, enables undo, and transitions isEmpty to false', () => {
    const stroke1: SignatureStroke = {
      points: [
        { x: 10, y: 10 },
        { x: 20, y: 20 },
      ],
    };
    history.addStroke(stroke1);

    expect(history.isEmpty()).toBe(false);
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);
    expect(history.getStrokes()).toHaveLength(1);

    const strokeCalls = spy.getCalls('stroke');
    expect(strokeCalls.length).toBe(1);
  });

  it('reverts last stroke on undo and redraws remaining strokes onto canvas', () => {
    const stroke1 = CONTRACTOR_STROKES_FIXTURE[0];
    const stroke2 = CONTRACTOR_STROKES_FIXTURE[1];

    history.addStroke(stroke1);
    history.addStroke(stroke2);
    expect(history.getStrokes()).toHaveLength(2);

    spy.reset();

    const undoSuccess = history.undo();
    expect(undoSuccess).toBe(true);
    expect(history.getStrokes()).toHaveLength(1);
    expect(history.canRedo()).toBe(true);
    expect(history.getRedoCount()).toBe(1);

    // Redraw must clear canvas first then stroke remaining stroke1
    const clearCalls = spy.getCalls('clearRect');
    const strokeCalls = spy.getCalls('stroke');
    expect(clearCalls.length).toBe(1);
    expect(strokeCalls.length).toBe(1);
  });

  it('restores undone stroke on redo and updates canvas accordingly', () => {
    const stroke1 = CONTRACTOR_STROKES_FIXTURE[0];
    const stroke2 = CONTRACTOR_STROKES_FIXTURE[1];

    history.addStroke(stroke1);
    history.addStroke(stroke2);
    history.undo(); // Undo stroke2

    spy.reset();
    const redoSuccess = history.redo(); // Redo stroke2

    expect(redoSuccess).toBe(true);
    expect(history.getStrokes()).toHaveLength(2);
    expect(history.canRedo()).toBe(false);

    const clearCalls = spy.getCalls('clearRect');
    const strokeCalls = spy.getCalls('stroke');
    expect(clearCalls.length).toBe(1);
    expect(strokeCalls.length).toBe(2); // stroke1 and stroke2 redrawn
  });

  it('invalidates redo stack when a new stroke is drawn after undo', () => {
    const stroke1: SignatureStroke = { points: [{ x: 5, y: 5 }, { x: 15, y: 15 }] };
    const stroke2: SignatureStroke = { points: [{ x: 25, y: 25 }, { x: 35, y: 35 }] };
    const stroke3: SignatureStroke = { points: [{ x: 50, y: 50 }, { x: 60, y: 60 }] };

    history.addStroke(stroke1);
    history.addStroke(stroke2);
    history.undo(); // strokes = [stroke1], redo = [stroke2]
    expect(history.canRedo()).toBe(true);

    // Draw stroke3: must purge stroke2 from redoStack
    history.addStroke(stroke3);
    expect(history.canRedo()).toBe(false);
    expect(history.getRedoCount()).toBe(0);
    expect(history.getStrokes()).toHaveLength(2);
    expect(history.getStrokes()[1]).toBe(stroke3);
  });

  it('clears canvas and resets both undo and redo stacks upon clear request', () => {
    history.addStroke(CONTRACTOR_STROKES_FIXTURE[0]);
    history.addStroke(CONTRACTOR_STROKES_FIXTURE[1]);
    history.undo(); // 1 stroke, 1 redo

    spy.reset();
    history.clear();

    expect(history.isEmpty()).toBe(true);
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
    expect(history.getStrokes()).toHaveLength(0);

    const clearCalls = spy.getCalls('clearRect');
    expect(clearCalls.length).toBe(1);
  });

  it('guards against undo and redo on empty stacks without throwing errors', () => {
    expect(() => {
      const undoResult = history.undo();
      expect(undoResult).toBe(false);
      const redoResult = history.redo();
      expect(redoResult).toBe(false);
    }).not.toThrow();

    expect(history.isEmpty()).toBe(true);
  });
});
