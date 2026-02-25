import { useEffect, useRef } from 'react';
import type * as fabric from 'fabric';
import { useProjectStore } from '../../../store/useProjectStore';
import { serializeCanvas } from '../../../utils/canvasHelpers';

export function useCanvasSync(canvas: fabric.Canvas | null) {
  const setCanvasJSON = useProjectStore((s) => s.setCanvasJSON);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!canvas) return;

    const syncToStore = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setCanvasJSON(serializeCanvas(canvas));
      }, 500);
    };

    canvas.on('object:modified', syncToStore);
    canvas.on('object:added', syncToStore);
    canvas.on('object:removed', syncToStore);

    return () => {
      canvas.off('object:modified', syncToStore);
      canvas.off('object:added', syncToStore);
      canvas.off('object:removed', syncToStore);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [canvas, setCanvasJSON]);
}
