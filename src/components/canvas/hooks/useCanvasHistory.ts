import { useRef, useCallback } from 'react';
import type * as fabric from 'fabric';

export function useCanvasHistory(canvas: fabric.Canvas | null) {
  const historyRef = useRef<string[]>([]);
  const indexRef = useRef(-1);
  const isRestoringRef = useRef(false);

  const saveState = useCallback(() => {
    if (!canvas || isRestoringRef.current) return;

    const json = JSON.stringify(canvas.toObject(['id', 'elementName']));

    // Remove future states if we've undone
    if (indexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, indexRef.current + 1);
    }

    historyRef.current.push(json);
    indexRef.current = historyRef.current.length - 1;

    // Limit history size
    if (historyRef.current.length > 50) {
      historyRef.current.shift();
      indexRef.current--;
    }
  }, [canvas]);

  const undo = useCallback(async () => {
    if (!canvas || indexRef.current <= 0) return;
    isRestoringRef.current = true;
    indexRef.current--;
    const json = historyRef.current[indexRef.current];
    await canvas.loadFromJSON(json);
    canvas.renderAll();
    isRestoringRef.current = false;
  }, [canvas]);

  const redo = useCallback(async () => {
    if (!canvas || indexRef.current >= historyRef.current.length - 1) return;
    isRestoringRef.current = true;
    indexRef.current++;
    const json = historyRef.current[indexRef.current];
    await canvas.loadFromJSON(json);
    canvas.renderAll();
    isRestoringRef.current = false;
  }, [canvas]);

  const canUndo = indexRef.current > 0;
  const canRedo = indexRef.current < historyRef.current.length - 1;

  return { saveState, undo, redo, canUndo, canRedo };
}
