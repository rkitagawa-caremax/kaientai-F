import { useState, useEffect, useCallback } from 'react';
import { useCanvas } from './CanvasContext';
import { useEditorStore } from '../../store/useEditorStore';
import { getObjectById } from '../../utils/canvasHelpers';
import type * as fabric from 'fabric';

const FONT_FAMILIES = [
  'Noto Sans JP',
  'Arial',
  'Helvetica',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Impact',
];

export function ElementSidebar() {
  const canvas = useCanvas();
  const selectedObjectId = useEditorStore((s) => s.selectedObjectId);
  const [props, setProps] = useState<Record<string, any>>({});

  const refreshProps = useCallback(() => {
    if (!canvas || !selectedObjectId) {
      setProps({});
      return;
    }
    const obj = getObjectById(canvas, selectedObjectId);
    if (!obj) {
      setProps({});
      return;
    }
    setProps({
      type: obj.type,
      left: Math.round(obj.left ?? 0),
      top: Math.round(obj.top ?? 0),
      width: Math.round(obj.getScaledWidth()),
      height: Math.round(obj.getScaledHeight()),
      angle: Math.round(obj.angle ?? 0),
      opacity: obj.opacity ?? 1,
      // text props
      text: (obj as any).text,
      fontFamily: (obj as any).fontFamily,
      fontSize: (obj as any).fontSize,
      fill: (obj as any).fill,
      textAlign: (obj as any).textAlign,
      fontWeight: (obj as any).fontWeight,
      fontStyle: (obj as any).fontStyle,
    });
  }, [canvas, selectedObjectId]);

  useEffect(() => {
    refreshProps();
  }, [refreshProps]);

  useEffect(() => {
    if (!canvas) return;
    const handler = () => refreshProps();
    canvas.on('object:modified', handler);
    canvas.on('object:scaling', handler);
    canvas.on('object:moving', handler);
    canvas.on('object:rotating', handler);
    return () => {
      canvas.off('object:modified', handler);
      canvas.off('object:scaling', handler);
      canvas.off('object:moving', handler);
      canvas.off('object:rotating', handler);
    };
  }, [canvas, refreshProps]);

  const updateObject = (key: string, value: any) => {
    if (!canvas || !selectedObjectId) return;
    const obj = getObjectById(canvas, selectedObjectId);
    if (!obj) return;
    obj.set(key as keyof fabric.FabricObject, value);
    canvas.renderAll();
    setProps((prev) => ({ ...prev, [key]: value }));
  };

  if (!selectedObjectId) {
    return (
      <div className="element-sidebar">
        <p className="sidebar-empty">要素を選択してください</p>
      </div>
    );
  }

  const isText = props.type === 'textbox' || props.type === 'i-text';

  return (
    <div className="element-sidebar">
      <h3>プロパティ</h3>

      <div className="prop-group">
        <label>位置</label>
        <div className="prop-row">
          <label>X</label>
          <input
            type="number"
            value={props.left ?? 0}
            onChange={(e) => updateObject('left', Number(e.target.value))}
          />
          <label>Y</label>
          <input
            type="number"
            value={props.top ?? 0}
            onChange={(e) => updateObject('top', Number(e.target.value))}
          />
        </div>
      </div>

      <div className="prop-group">
        <label>回転</label>
        <input
          type="number"
          value={props.angle ?? 0}
          onChange={(e) => updateObject('angle', Number(e.target.value))}
        />
      </div>

      <div className="prop-group">
        <label>不透明度</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={props.opacity ?? 1}
          onChange={(e) => updateObject('opacity', Number(e.target.value))}
        />
      </div>

      {isText && (
        <>
          <div className="prop-group">
            <label>フォント</label>
            <select
              value={props.fontFamily ?? 'Noto Sans JP'}
              onChange={(e) => updateObject('fontFamily', e.target.value)}
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <div className="prop-group">
            <label>サイズ</label>
            <input
              type="number"
              min="8"
              max="200"
              value={props.fontSize ?? 24}
              onChange={(e) => updateObject('fontSize', Number(e.target.value))}
            />
          </div>

          <div className="prop-group">
            <label>色</label>
            <input
              type="color"
              value={typeof props.fill === 'string' ? props.fill : '#333333'}
              onChange={(e) => updateObject('fill', e.target.value)}
            />
          </div>

          <div className="prop-group">
            <label>揃え</label>
            <div className="prop-row">
              {(['left', 'center', 'right'] as const).map((align) => (
                <button
                  key={align}
                  className={`toolbar-btn ${props.textAlign === align ? 'active' : ''}`}
                  onClick={() => updateObject('textAlign', align)}
                >
                  {align === 'left' ? '左' : align === 'center' ? '中' : '右'}
                </button>
              ))}
            </div>
          </div>

          <div className="prop-group">
            <label>スタイル</label>
            <div className="prop-row">
              <button
                className={`toolbar-btn ${props.fontWeight === 'bold' ? 'active' : ''}`}
                onClick={() =>
                  updateObject('fontWeight', props.fontWeight === 'bold' ? 'normal' : 'bold')
                }
              >
                B
              </button>
              <button
                className={`toolbar-btn ${props.fontStyle === 'italic' ? 'active' : ''}`}
                onClick={() =>
                  updateObject('fontStyle', props.fontStyle === 'italic' ? 'normal' : 'italic')
                }
              >
                I
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
