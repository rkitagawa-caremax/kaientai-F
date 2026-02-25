import { useState, useEffect, useCallback } from 'react';
import { useCanvas } from './CanvasContext';
import { useEditorStore } from '../../store/useEditorStore';

interface LayerItem {
  id: string;
  name: string;
  type: string;
  index: number;
}

export function LayerPanel() {
  const canvas = useCanvas();
  const { selectedObjectId, setSelectedObject } = useEditorStore();
  const [layers, setLayers] = useState<LayerItem[]>([]);

  const refreshLayers = useCallback(() => {
    if (!canvas) return;
    const objects = canvas.getObjects();
    const items: LayerItem[] = objects.map((obj, i) => ({
      id: (obj as any).id ?? `layer-${i}`,
      name: (obj as any).elementName ?? obj.type ?? 'Object',
      type: obj.type ?? 'unknown',
      index: i,
    }));
    setLayers(items.reverse()); // Top layer first
  }, [canvas]);

  useEffect(() => {
    refreshLayers();
  }, [refreshLayers]);

  useEffect(() => {
    if (!canvas) return;
    const handler = () => refreshLayers();
    canvas.on('object:added', handler);
    canvas.on('object:removed', handler);
    canvas.on('object:modified', handler);
    return () => {
      canvas.off('object:added', handler);
      canvas.off('object:removed', handler);
      canvas.off('object:modified', handler);
    };
  }, [canvas, refreshLayers]);

  const handleSelect = (id: string) => {
    if (!canvas) return;
    const obj = canvas.getObjects().find((o) => (o as any).id === id);
    if (obj) {
      canvas.setActiveObject(obj);
      canvas.renderAll();
      setSelectedObject(id);
    }
  };

  const handleMoveUp = (index: number) => {
    if (!canvas) return;
    const objects = canvas.getObjects();
    const realIndex = objects.length - 1 - index;
    if (realIndex < objects.length - 1) {
      const obj = objects[realIndex];
      canvas.moveObjectTo(obj, realIndex + 1);
      canvas.renderAll();
      refreshLayers();
    }
  };

  const handleMoveDown = (index: number) => {
    if (!canvas) return;
    const objects = canvas.getObjects();
    const realIndex = objects.length - 1 - index;
    if (realIndex > 0) {
      const obj = objects[realIndex];
      canvas.moveObjectTo(obj, realIndex - 1);
      canvas.renderAll();
      refreshLayers();
    }
  };

  return (
    <div className="layer-panel">
      <h3>レイヤー</h3>
      {layers.length === 0 ? (
        <p className="sidebar-empty">要素なし</p>
      ) : (
        <ul className="layer-list">
          {layers.map((layer, idx) => (
            <li
              key={layer.id}
              className={`layer-item ${selectedObjectId === layer.id ? 'selected' : ''}`}
              onClick={() => handleSelect(layer.id)}
            >
              <span className="layer-type">{layer.type === 'textbox' ? 'T' : '🖼'}</span>
              <span className="layer-name">{layer.name}</span>
              <div className="layer-actions">
                <button
                  className="layer-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMoveUp(idx);
                  }}
                  title="前面へ"
                >
                  ↑
                </button>
                <button
                  className="layer-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMoveDown(idx);
                  }}
                  title="背面へ"
                >
                  ↓
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
