import { useRef, useEffect, useCallback } from 'react';
import * as fabric from 'fabric';
import { useFabricCanvas } from './hooks/useFabricCanvas';
import { useCanvasHistory } from './hooks/useCanvasHistory';
import { useCanvasSync } from './hooks/useCanvasSync';
import { CanvasProvider } from './CanvasContext';
import { CanvasToolbar } from './CanvasToolbar';
import { ElementSidebar } from './ElementSidebar';
import { LayerPanel } from './LayerPanel';
import { useProjectStore } from '../../store/useProjectStore';
import { getCanvasDimensions } from '../../utils/dimensions';

interface FabricCanvasProps {
  onCanvasReady?: (canvas: fabric.Canvas) => void;
}

export function FabricCanvas({ onCanvasReady }: FabricCanvasProps) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const orientation = useProjectStore((s) => s.orientation);
  const dims = getCanvasDimensions(orientation);
  const onReadyCalledRef = useRef(false);

  const fabricRef = useFabricCanvas(canvasElRef, dims);
  const canvas = fabricRef.current;
  const { saveState, undo, redo } = useCanvasHistory(canvas);
  useCanvasSync(canvas);

  // Notify parent when canvas is ready
  useEffect(() => {
    if (canvas && onCanvasReady && !onReadyCalledRef.current) {
      onReadyCalledRef.current = true;
      onCanvasReady(canvas);
    }
  }, [canvas, onCanvasReady]);

  // Save state after modifications
  useEffect(() => {
    if (!canvas) return;
    const handler = () => saveState();
    canvas.on('object:modified', handler);
    canvas.on('object:added', handler);
    canvas.on('object:removed', handler);
    saveState();
    return () => {
      canvas.off('object:modified', handler);
      canvas.off('object:added', handler);
      canvas.off('object:removed', handler);
    };
  }, [canvas, saveState]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!canvas) return;
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
      } else if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        redo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const active = canvas.getActiveObject();
        if (active && !(active as any).isEditing) {
          canvas.remove(active);
          canvas.renderAll();
        }
      }
    },
    [canvas, undo, redo]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <CanvasProvider value={canvas}>
      <div className="editor-layout">
        <CanvasToolbar undo={undo} redo={redo} />
        <div className="editor-body">
          <div className="canvas-container">
            <div
              className="canvas-wrapper"
              style={{ width: dims.width, height: dims.height }}
            >
              <canvas ref={canvasElRef} />
            </div>
          </div>
          <div className="editor-sidebar">
            <ElementSidebar />
            <LayerPanel />
          </div>
        </div>
      </div>
    </CanvasProvider>
  );
}
