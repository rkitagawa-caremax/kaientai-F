import { useEffect, useRef } from 'react';
import * as fabric from 'fabric';
import { useEditorStore } from '../../../store/useEditorStore';

interface UseFabricCanvasOptions {
  width: number;
  height: number;
}

export function useFabricCanvas(
  canvasElRef: React.RefObject<HTMLCanvasElement | null>,
  options: UseFabricCanvasOptions
) {
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const setSelectedObject = useEditorStore((s) => s.setSelectedObject);
  const setCanvasReady = useEditorStore((s) => s.setCanvasReady);

  useEffect(() => {
    if (!canvasElRef.current || fabricRef.current) return;

    const canvas = new fabric.Canvas(canvasElRef.current, {
      width: options.width,
      height: options.height,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
    });

    canvas.on('selection:created', (e) => {
      const obj = e.selected?.[0];
      if (obj) setSelectedObject((obj as any).id ?? null);
    });

    canvas.on('selection:updated', (e) => {
      const obj = e.selected?.[0];
      if (obj) setSelectedObject((obj as any).id ?? null);
    });

    canvas.on('selection:cleared', () => {
      setSelectedObject(null);
    });

    fabricRef.current = canvas;
    setCanvasReady(true);

    return () => {
      canvas.dispose();
      fabricRef.current = null;
      setCanvasReady(false);
    };
  }, [options.width, options.height, setSelectedObject, setCanvasReady]);

  return fabricRef;
}
