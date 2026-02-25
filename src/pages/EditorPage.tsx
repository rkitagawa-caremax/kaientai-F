import { useEffect, useCallback, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import * as fabric from 'fabric';
import { FabricCanvas } from '../components/canvas/FabricCanvas';
import { useProjectStore } from '../store/useProjectStore';
import { useAuthStore } from '../store/useAuthStore';
import { getProject } from '../services/firestore';
import { autoLayout } from '../services/autoLayout';
import { deserializeCanvas } from '../utils/canvasHelpers';
import { getBuiltInTemplateById } from '../assets/templates';
import { getCanvasDimensions } from '../utils/dimensions';

const DEFAULT_TEMPLATE_ID = 'kaientai-news-202601-food-orange';

function normalizeExcelFrame(canvas: fabric.Canvas, orientation: 'portrait' | 'landscape') {
  const target = canvas
    .getObjects()
    .find(
      (obj) =>
        obj.type === 'image' &&
        ((obj as any).id === 'excel-full-frame' || (obj as any).id === 'template-thumbnail-fallback')
    ) as fabric.FabricImage | undefined;

  if (!target || !target.width || !target.height) return;

  const dims = getCanvasDimensions(orientation);
  const scale = Math.min(dims.width / target.width, dims.height / target.height);
  target.set({
    left: (dims.width - target.width * scale) / 2,
    top: (dims.height - target.height * scale) / 2,
    selectable: false,
    evented: false,
  });
  target.scale(scale);
  canvas.moveObjectTo(target, 0);
  canvas.renderAll();
}

export function EditorPage() {
  const { projectId: urlProjectId } = useParams();
  const user = useAuthStore((s) => s.user);
  const {
    setProjectId,
    setProjectName,
    setTemplate,
    orientation,
    templateId,
    inputImages,
    inputTexts,
    canvasJSON,
  } = useProjectStore();
  const [loading, setLoading] = useState(!!urlProjectId);
  const [savedCanvasJSON, setSavedCanvasJSON] = useState<string | null>(null);

  const hasEditorContext =
    !!templateId || !!canvasJSON || inputImages.length > 0 || inputTexts.length > 0;

  // Load existing project from Firestore
  useEffect(() => {
    if (!urlProjectId || !user) return;
    getProject(urlProjectId).then((project) => {
      if (!project) {
        setLoading(false);
        return;
      }
      setProjectId(project.id);
      setProjectName(project.name);
      setTemplate(project.templateId, project.orientation, null);
      setSavedCanvasJSON(project.canvasJSON);
      setLoading(false);
    });
  }, [urlProjectId, user, setProjectId, setProjectName, setTemplate]);

  const handleCanvasReady = useCallback(
    async (canvas: fabric.Canvas) => {
      let loaded = false;
      const effectiveTemplateId = templateId || DEFAULT_TEMPLATE_ID;

      if (savedCanvasJSON) {
        await deserializeCanvas(canvas, savedCanvasJSON);
        loaded = canvas.getObjects().length > 0;
      }

      if (canvasJSON) {
        await deserializeCanvas(canvas, canvasJSON);
        loaded = canvas.getObjects().length > 0;
      }

      if (!loaded) {
        const template = getBuiltInTemplateById(effectiveTemplateId);
        if (template?.canvasJSON) {
          await deserializeCanvas(canvas, template.canvasJSON);
          loaded = canvas.getObjects().length > 0;
        }

        // Last-resort fallback: place template thumbnail as a background image.
        if (!loaded && template?.thumbnail) {
          try {
            const img = await fabric.FabricImage.fromURL(template.thumbnail, {
              crossOrigin: 'anonymous',
            });
            if (img.width && img.height) {
              const dims = getCanvasDimensions(orientation);
              const scale = Math.min(dims.width / img.width, dims.height / img.height);
              img.set({
                left: (dims.width - img.width * scale) / 2,
                top: (dims.height - img.height * scale) / 2,
                selectable: false,
                evented: false,
              });
              img.scale(scale);
              (img as any).id = 'template-thumbnail-fallback';
              (img as any).elementName = 'Template Fallback';
              canvas.add(img);
              canvas.renderAll();
              loaded = true;
            }
          } catch (err) {
            console.error('Template thumbnail fallback failed:', err);
          }
        }
      }

      if (effectiveTemplateId === 'kaientai-news-202601-food-orange') {
        normalizeExcelFrame(canvas, orientation);
      }

      if (inputImages.length > 0 || inputTexts.length > 0) {
        await autoLayout(canvas, {
          orientation,
          images: inputImages,
          texts: inputTexts,
        });
      }
    },
    [savedCanvasJSON, canvasJSON, templateId, orientation, inputImages, inputTexts]
  );

  if (loading) {
    return (
      <div className="editor-page loading">
        <p>読み込み中...</p>
      </div>
    );
  }

  if (!urlProjectId && !hasEditorContext) {
    return <Navigate to="/new" replace />;
  }

  return (
    <div className="editor-page">
      <FabricCanvas onCanvasReady={handleCanvasReady} />
    </div>
  );
}
