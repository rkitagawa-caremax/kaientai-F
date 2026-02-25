import { useRef, useState } from 'react';
import { useCanvas } from './CanvasContext';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';
import { useAuthStore } from '../../store/useAuthStore';
import { addTextObject, addImageObject, serializeCanvas } from '../../utils/canvasHelpers';
import { exportToPdf } from '../../services/exportPdf';
import { exportToExcel } from '../../services/exportExcel';
import { saveProject, updateProject } from '../../services/firestore';
import { readFileAsDataURL } from '../../utils/fileUtils';

interface CanvasToolbarProps {
  undo: () => void;
  redo: () => void;
}

export function CanvasToolbar({ undo, redo }: CanvasToolbarProps) {
  const canvas = useCanvas();
  const { zoom, setZoom } = useEditorStore();
  const { projectId, setProjectId, orientation, projectName, templateId, inputImages, inputTexts } =
    useProjectStore();
  const user = useAuthStore((s) => s.user);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  const handleAddText = () => {
    if (!canvas) return;
    addTextObject(canvas, 'テキストを入力');
  };

  const handleAddImage = () => {
    fileInputRef.current?.click();
  };

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canvas || !e.target.files?.length) return;
    const url = await readFileAsDataURL(e.target.files[0]);
    await addImageObject(canvas, url, { scaleToWidth: 300 });
    e.target.value = '';
  };

  const handleZoomIn = () => {
    if (!canvas) return;
    const newZoom = Math.min(zoom * 1.2, 3);
    setZoom(newZoom);
    canvas.setZoom(newZoom);
  };

  const handleZoomOut = () => {
    if (!canvas) return;
    const newZoom = Math.max(zoom / 1.2, 0.3);
    setZoom(newZoom);
    canvas.setZoom(newZoom);
  };

  const handleExportPdf = () => {
    if (!canvas) return;
    exportToPdf(canvas, orientation);
  };

  const handleExportExcel = () => {
    if (!canvas) return;
    exportToExcel(canvas, projectName);
  };

  const handleSave = async () => {
    if (!canvas || !user || saving) return;
    setSaving(true);
    try {
      const canvasJSON = serializeCanvas(canvas);
      if (projectId) {
        await updateProject(projectId, { canvasJSON });
      } else {
        const id = await saveProject({
          userId: user.uid,
          name: projectName,
          templateId,
          orientation,
          canvasJSON,
          inputImages: inputImages.map(({ file, ...rest }) => rest),
          inputTexts,
        });
        setProjectId(id);
      }
      alert('保存しました');
    } catch (err) {
      console.error('Save failed:', err);
      alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="canvas-toolbar">
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={undo} title="元に戻す (Ctrl+Z)">
          ↩
        </button>
        <button className="toolbar-btn" onClick={redo} title="やり直し (Ctrl+Y)">
          ↪
        </button>
      </div>

      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={handleAddText} title="テキスト追加">
          T
        </button>
        <button className="toolbar-btn" onClick={handleAddImage} title="画像追加">
          🖼
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleImageFile}
        />
      </div>

      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={handleZoomOut} title="縮小">
          −
        </button>
        <span className="zoom-label">{Math.round(zoom * 100)}%</span>
        <button className="toolbar-btn" onClick={handleZoomIn} title="拡大">
          +
        </button>
      </div>

      <div className="toolbar-group">
        <button className="toolbar-btn btn-export" onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : '保存'}
        </button>
        <button className="toolbar-btn btn-export" onClick={handleExportPdf}>
          PDF出力
        </button>
        <button className="toolbar-btn btn-export" onClick={handleExportExcel}>
          Excel出力
        </button>
      </div>
    </div>
  );
}
