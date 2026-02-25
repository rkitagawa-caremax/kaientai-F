import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  saveStudioTemplates,
  subscribeStudioProjects,
  subscribeStudioTemplates,
  uploadTemplateImage,
} from '../services/studioCloud';
import type {
  BorderStyle,
  CanvasPreset,
  ElementKind,
  FitMode,
  LayoutTemplate,
  StudioProjectSummary,
  TemplateElement,
  TemplateRect,
} from '../types/studio';

type ResizeHandle = 'n' | 'e' | 's' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
type SyncState = 'connecting' | 'saving' | 'synced' | 'error';

interface InteractionState {
  mode: 'move' | 'resize';
  elementId: string;
  handle?: ResizeHandle;
  startClientX: number;
  startClientY: number;
  startRect: TemplateRect;
}

const MIN_ELEMENT_SIZE = 48;
const DEFAULT_CANVAS_WIDTH = 900;
const DEFAULT_CANVAS_HEIGHT = 1273;
const HANDLE_POSITIONS: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function clampRectToCanvas(rect: TemplateRect, canvasWidth: number, canvasHeight: number): TemplateRect {
  const width = clamp(rect.width, MIN_ELEMENT_SIZE, canvasWidth);
  const height = clamp(rect.height, MIN_ELEMENT_SIZE, canvasHeight);
  const x = clamp(rect.x, 0, canvasWidth - width);
  const y = clamp(rect.y, 0, canvasHeight - height);
  return { x, y, width, height };
}

function sanitizeTemplateElement(
  candidate: Partial<TemplateElement>,
  canvasWidth: number,
  canvasHeight: number,
  index: number
): TemplateElement {
  const kind: ElementKind = candidate.kind === 'image' ? 'image' : 'frame';
  const rect = clampRectToCanvas(
    {
      x: Number(candidate.x) || 0,
      y: Number(candidate.y) || 0,
      width: Number(candidate.width) || 280,
      height: Number(candidate.height) || 200,
    },
    canvasWidth,
    canvasHeight
  );

  const fit: FitMode = candidate.fit === 'contain' ? 'contain' : 'cover';
  const borderStyle: BorderStyle = candidate.borderStyle === 'solid' ? 'solid' : 'dashed';

  return {
    id: typeof candidate.id === 'string' ? candidate.id : createId(),
    kind,
    name:
      typeof candidate.name === 'string'
        ? candidate.name
        : kind === 'image'
          ? `Image ${index + 1}`
          : `Frame ${index + 1}`,
    src: kind === 'image' && typeof candidate.src === 'string' ? candidate.src : undefined,
    fit,
    borderColor: typeof candidate.borderColor === 'string' ? candidate.borderColor : '#1f7a67',
    borderWidth: clamp(Number(candidate.borderWidth) || 2, 0, 16),
    borderStyle,
    opacity: clamp(Number(candidate.opacity) || 1, 0.1, 1),
    radius: clamp(Number(candidate.radius) || 14, 0, 80),
    ...rect,
  };
}

function sanitizeTemplate(candidate: Partial<LayoutTemplate>, index: number): LayoutTemplate {
  const canvasWidth = clamp(Number(candidate.canvasWidth) || DEFAULT_CANVAS_WIDTH, 360, 2400);
  const canvasHeight = clamp(Number(candidate.canvasHeight) || DEFAULT_CANVAS_HEIGHT, 480, 2400);

  const elements = Array.isArray(candidate.elements)
    ? candidate.elements.map((element, elementIndex) =>
        sanitizeTemplateElement(element, canvasWidth, canvasHeight, elementIndex)
      )
    : [];

  return {
    id: typeof candidate.id === 'string' ? candidate.id : createId(),
    name: typeof candidate.name === 'string' ? candidate.name : `Template ${index + 1}`,
    canvasWidth,
    canvasHeight,
    elements,
    createdAt:
      typeof candidate.createdAt === 'string' && candidate.createdAt.length > 0
        ? candidate.createdAt
        : nowIso(),
    updatedAt:
      typeof candidate.updatedAt === 'string' && candidate.updatedAt.length > 0
        ? candidate.updatedAt
        : nowIso(),
  };
}

function createBlankTemplate(name: string): LayoutTemplate {
  const timestamp = nowIso();
  return {
    id: createId(),
    name,
    canvasWidth: DEFAULT_CANVAS_WIDTH,
    canvasHeight: DEFAULT_CANVAS_HEIGHT,
    elements: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function formatDateTime(iso?: string): string {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function sanitizeFileName(value: string): string {
  const normalized = value.trim().replace(/[\\/:*?"<>|]+/g, '_');
  return normalized.length > 0 ? normalized : 'template';
}

function readImageSizeFromFile(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      URL.revokeObjectURL(objectUrl);
      resolve({ width, height });
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to read image size.'));
    };

    image.src = objectUrl;
  });
}

function resizeRectFromHandle(
  handle: ResizeHandle,
  startRect: TemplateRect,
  deltaX: number,
  deltaY: number,
  canvasWidth: number,
  canvasHeight: number
): TemplateRect {
  let nextX = startRect.x;
  let nextY = startRect.y;
  let nextWidth = startRect.width;
  let nextHeight = startRect.height;

  if (handle.includes('e')) nextWidth = startRect.width + deltaX;
  if (handle.includes('s')) nextHeight = startRect.height + deltaY;
  if (handle.includes('w')) {
    nextWidth = startRect.width - deltaX;
    nextX = startRect.x + deltaX;
  }
  if (handle.includes('n')) {
    nextHeight = startRect.height - deltaY;
    nextY = startRect.y + deltaY;
  }

  if (nextWidth < MIN_ELEMENT_SIZE) {
    if (handle.includes('w')) nextX -= MIN_ELEMENT_SIZE - nextWidth;
    nextWidth = MIN_ELEMENT_SIZE;
  }
  if (nextHeight < MIN_ELEMENT_SIZE) {
    if (handle.includes('n')) nextY -= MIN_ELEMENT_SIZE - nextHeight;
    nextHeight = MIN_ELEMENT_SIZE;
  }

  if (nextX < 0) {
    if (handle.includes('w')) nextWidth += nextX;
    nextX = 0;
  }
  if (nextY < 0) {
    if (handle.includes('n')) nextHeight += nextY;
    nextY = 0;
  }

  if (nextX + nextWidth > canvasWidth) {
    if (handle.includes('e')) {
      nextWidth = canvasWidth - nextX;
    } else {
      nextX = canvasWidth - nextWidth;
    }
  }
  if (nextY + nextHeight > canvasHeight) {
    if (handle.includes('s')) {
      nextHeight = canvasHeight - nextY;
    } else {
      nextY = canvasHeight - nextHeight;
    }
  }

  return clampRectToCanvas(
    { x: nextX, y: nextY, width: nextWidth, height: nextHeight },
    canvasWidth,
    canvasHeight
  );
}

export function AdminTemplateStudioPage() {
  const [templates, setTemplates] = useState<LayoutTemplate[]>([createBlankTemplate('Template 1')]);
  const [activeTemplateId, setActiveTemplateId] = useState<string>('');
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [interaction, setInteraction] = useState<InteractionState | null>(null);
  const [canvasScale, setCanvasScale] = useState<number>(1);
  const [projects, setProjects] = useState<StudioProjectSummary[]>([]);
  const [syncState, setSyncState] = useState<SyncState>('connecting');
  const [syncMessage, setSyncMessage] = useState<string>('Cloud connecting...');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [cloudReady, setCloudReady] = useState<boolean>(false);

  const canvasViewportRef = useRef<HTMLDivElement | null>(null);
  const imageUploadRef = useRef<HTMLInputElement | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const lastCloudSerializedRef = useRef<string | null>(null);

  const activeTemplate = useMemo(
    () => templates.find((template) => template.id === activeTemplateId) ?? null,
    [templates, activeTemplateId]
  );

  const selectedElement = useMemo(
    () => activeTemplate?.elements.find((element) => element.id === selectedElementId) ?? null,
    [activeTemplate, selectedElementId]
  );

  const serializedTemplates = useMemo(() => JSON.stringify(templates), [templates]);

  useEffect(() => {
    setSyncState('connecting');
    setSyncMessage('Cloud connecting...');

    const unsubscribe = subscribeStudioTemplates(
      (remoteTemplates) => {
        const sanitized =
          remoteTemplates.length > 0
            ? remoteTemplates.map((template, index) =>
                sanitizeTemplate(template as Partial<LayoutTemplate>, index)
              )
            : [createBlankTemplate('Template 1')];

        lastCloudSerializedRef.current =
          remoteTemplates.length > 0 ? JSON.stringify(sanitized) : JSON.stringify([]);

        setTemplates(sanitized);
        setActiveTemplateId((previousId) => {
          if (sanitized.some((template) => template.id === previousId)) return previousId;
          return sanitized[0].id;
        });
        setCloudReady(true);
        setSyncState('synced');
        setSyncMessage('Live synced');
      },
      (error) => {
        setCloudReady(true);
        setSyncState('error');
        setSyncMessage(error.message || 'Cloud connection failed');
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeStudioProjects(
      (remoteProjects) => {
        setProjects(remoteProjects);
      },
      (error) => {
        console.error(error);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!cloudReady) return;
    if (templates.length === 0) return;
    if (serializedTemplates === lastCloudSerializedRef.current) return;

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    setSyncState('saving');
    setSyncMessage('Cloud saving...');

    saveTimerRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          await saveStudioTemplates(templates);
          lastCloudSerializedRef.current = serializedTemplates;
          setSyncState('synced');
          setSyncMessage('Live synced');
        } catch (error) {
          console.error(error);
          setSyncState('error');
          setSyncMessage('Cloud save failed');
        }
      })();
    }, 360);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [templates, serializedTemplates, cloudReady]);

  useEffect(() => {
    if (!activeTemplate) return;
    const viewport = canvasViewportRef.current;
    if (!viewport) return;

    const updateScale = () => {
      const bounds = viewport.getBoundingClientRect();
      const availableWidth = Math.max(bounds.width - 48, 220);
      const availableHeight = Math.max(bounds.height - 48, 220);
      const nextScale = Math.min(
        availableWidth / activeTemplate.canvasWidth,
        availableHeight / activeTemplate.canvasHeight,
        1
      );
      setCanvasScale(clamp(nextScale, 0.1, 1));
    };

    updateScale();
    const observer = new ResizeObserver(() => updateScale());
    observer.observe(viewport);

    return () => observer.disconnect();
  }, [activeTemplate]);

  useEffect(() => {
    if (templates.length === 0) return;
    const activeExists = templates.some((template) => template.id === activeTemplateId);
    if (!activeExists) {
      setActiveTemplateId(templates[0].id);
    }
  }, [templates, activeTemplateId]);

  useEffect(() => {
    if (!activeTemplate || !selectedElementId) return;
    const selectedExists = activeTemplate.elements.some((element) => element.id === selectedElementId);
    if (!selectedExists) {
      setSelectedElementId(null);
    }
  }, [activeTemplate, selectedElementId]);

  const updateActiveTemplate = useCallback(
    (updater: (template: LayoutTemplate) => LayoutTemplate) => {
      setTemplates((currentTemplates) =>
        currentTemplates.map((template) => {
          if (template.id !== activeTemplateId) return template;
          const nextTemplate = updater(template);
          return {
            ...nextTemplate,
            updatedAt: nowIso(),
          };
        })
      );
    },
    [activeTemplateId]
  );

  const updateSelectedElement = useCallback(
    (changes: Partial<TemplateElement>) => {
      if (!selectedElementId) return;

      updateActiveTemplate((template) => {
        const nextElements = template.elements.map((element): TemplateElement => {
          if (element.id !== selectedElementId) return element;

          const merged = { ...element, ...changes };
          const rect = clampRectToCanvas(merged, template.canvasWidth, template.canvasHeight);
          const fit: FitMode = merged.fit === 'contain' ? 'contain' : 'cover';
          const borderStyle: BorderStyle = merged.borderStyle === 'solid' ? 'solid' : 'dashed';

          return {
            ...merged,
            ...rect,
            fit,
            borderStyle,
            borderWidth: clamp(merged.borderWidth, 0, 16),
            opacity: clamp(merged.opacity, 0.1, 1),
            radius: clamp(merged.radius, 0, 80),
          };
        });

        return {
          ...template,
          elements: nextElements,
        };
      });
    },
    [selectedElementId, updateActiveTemplate]
  );

  const createTemplate = useCallback(() => {
    const newTemplate = createBlankTemplate(`Template ${templates.length + 1}`);
    setTemplates((current) => [...current, newTemplate]);
    setActiveTemplateId(newTemplate.id);
    setSelectedElementId(null);
  }, [templates.length]);

  const duplicateTemplate = useCallback(() => {
    if (!activeTemplate) return;

    const duplicated: LayoutTemplate = {
      ...activeTemplate,
      id: createId(),
      name: `${activeTemplate.name} Copy`,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      elements: activeTemplate.elements.map((element) => ({
        ...element,
        id: createId(),
      })),
    };

    setTemplates((current) => [...current, duplicated]);
    setActiveTemplateId(duplicated.id);
    setSelectedElementId(null);
  }, [activeTemplate]);

  const deleteActiveTemplate = useCallback(() => {
    if (!activeTemplate) return;

    const confirmed = window.confirm(`Delete "${activeTemplate.name}"?`);
    if (!confirmed) return;

    if (templates.length <= 1) {
      const fallback = createBlankTemplate('Template 1');
      setTemplates([fallback]);
      setActiveTemplateId(fallback.id);
      setSelectedElementId(null);
      return;
    }

    setTemplates((current) => current.filter((template) => template.id !== activeTemplate.id));
    setSelectedElementId(null);
  }, [activeTemplate, templates.length]);

  const addFrameElement = useCallback(() => {
    if (!activeTemplate) return;

    const width = Math.round(activeTemplate.canvasWidth * 0.38);
    const height = Math.round(activeTemplate.canvasHeight * 0.2);

    const element: TemplateElement = {
      id: createId(),
      kind: 'frame',
      name: `Frame ${activeTemplate.elements.filter((item) => item.kind === 'frame').length + 1}`,
      x: Math.round((activeTemplate.canvasWidth - width) / 2),
      y: Math.round((activeTemplate.canvasHeight - height) / 2),
      width,
      height,
      src: undefined,
      fit: 'cover',
      borderColor: '#1f7a67',
      borderWidth: 3,
      borderStyle: 'dashed',
      opacity: 1,
      radius: 16,
    };

    updateActiveTemplate((template) => ({
      ...template,
      elements: [...template.elements, element],
    }));
    setSelectedElementId(element.id);
  }, [activeTemplate, updateActiveTemplate]);

  const removeSelectedElement = useCallback(() => {
    if (!selectedElementId) return;
    updateActiveTemplate((template) => ({
      ...template,
      elements: template.elements.filter((element) => element.id !== selectedElementId),
    }));
    setSelectedElementId(null);
  }, [selectedElementId, updateActiveTemplate]);

  const duplicateSelectedElement = useCallback(() => {
    if (!activeTemplate || !selectedElement) return;

    const shiftedRect = clampRectToCanvas(
      {
        x: selectedElement.x + 24,
        y: selectedElement.y + 24,
        width: selectedElement.width,
        height: selectedElement.height,
      },
      activeTemplate.canvasWidth,
      activeTemplate.canvasHeight
    );

    const duplicated: TemplateElement = {
      ...selectedElement,
      ...shiftedRect,
      id: createId(),
      name: `${selectedElement.name} Copy`,
    };

    updateActiveTemplate((template) => ({
      ...template,
      elements: [...template.elements, duplicated],
    }));
    setSelectedElementId(duplicated.id);
  }, [activeTemplate, selectedElement, updateActiveTemplate]);

  const moveSelectedLayer = useCallback(
    (direction: 'forward' | 'backward') => {
      if (!selectedElementId) return;

      updateActiveTemplate((template) => {
        const currentIndex = template.elements.findIndex((element) => element.id === selectedElementId);
        if (currentIndex < 0) return template;

        const targetIndex =
          direction === 'forward'
            ? Math.min(template.elements.length - 1, currentIndex + 1)
            : Math.max(0, currentIndex - 1);

        if (targetIndex === currentIndex) return template;

        const nextElements = [...template.elements];
        const [moving] = nextElements.splice(currentIndex, 1);
        nextElements.splice(targetIndex, 0, moving);

        return {
          ...template,
          elements: nextElements,
        };
      });
    },
    [selectedElementId, updateActiveTemplate]
  );

  const setCanvasPreset = useCallback(
    (preset: CanvasPreset) => {
      const width = preset === 'portrait' ? DEFAULT_CANVAS_WIDTH : DEFAULT_CANVAS_HEIGHT;
      const height = preset === 'portrait' ? DEFAULT_CANVAS_HEIGHT : DEFAULT_CANVAS_WIDTH;

      updateActiveTemplate((template) => {
        if (template.canvasWidth === width && template.canvasHeight === height) return template;

        return {
          ...template,
          canvasWidth: width,
          canvasHeight: height,
          elements: template.elements.map((element) => ({
            ...element,
            ...clampRectToCanvas(element, width, height),
          })),
        };
      });
    },
    [updateActiveTemplate]
  );

  const exportActiveTemplate = useCallback(() => {
    if (!activeTemplate) return;

    const blob = new Blob([JSON.stringify(activeTemplate, null, 2)], {
      type: 'application/json',
    });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `${sanitizeFileName(activeTemplate.name)}.json`;
    anchor.click();
    URL.revokeObjectURL(href);
  }, [activeTemplate]);

  const importTemplate = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as Partial<LayoutTemplate>;
        const imported = sanitizeTemplate(parsed, templates.length);
        const template: LayoutTemplate = {
          ...imported,
          id: createId(),
          name: `${imported.name} Imported`,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        setTemplates((current) => [...current, template]);
        setActiveTemplateId(template.id);
        setSelectedElementId(null);
      } catch (error) {
        console.error(error);
        window.alert('Template JSON import failed.');
      } finally {
        event.target.value = '';
      }
    },
    [templates.length]
  );

  const handleUploadTemplateImages = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      if (!activeTemplate || files.length === 0) {
        event.target.value = '';
        return;
      }

      setIsUploading(true);

      const createdElements: TemplateElement[] = [];
      const maxWidth = activeTemplate.canvasWidth * 0.72;
      const maxHeight = activeTemplate.canvasHeight * 0.6;

      for (const [index, file] of files.entries()) {
        const elementId = createId();

        try {
          const size = await readImageSizeFromFile(file);
          const scale = Math.min(maxWidth / size.width, maxHeight / size.height, 1);
          const width = Math.max(MIN_ELEMENT_SIZE, Math.round(size.width * scale));
          const height = Math.max(MIN_ELEMENT_SIZE, Math.round(size.height * scale));
          const x = clamp(
            Math.round((activeTemplate.canvasWidth - width) / 2 + index * 22),
            0,
            activeTemplate.canvasWidth - width
          );
          const y = clamp(
            Math.round((activeTemplate.canvasHeight - height) / 2 + index * 22),
            0,
            activeTemplate.canvasHeight - height
          );

          const imageUrl = await uploadTemplateImage(activeTemplate.id, elementId, file);

          createdElements.push({
            id: elementId,
            kind: 'image',
            name: file.name.replace(/\.[^.]+$/, '') || `Image ${activeTemplate.elements.length + index + 1}`,
            x,
            y,
            width,
            height,
            src: imageUrl,
            fit: 'cover',
            borderColor: '#d06f2e',
            borderWidth: 2,
            borderStyle: 'solid',
            opacity: 1,
            radius: 14,
          });
        } catch (error) {
          console.error(error);
        }
      }

      if (createdElements.length > 0) {
        updateActiveTemplate((template) => ({
          ...template,
          elements: [...template.elements, ...createdElements],
        }));
        setSelectedElementId(createdElements[createdElements.length - 1].id);
      }

      setIsUploading(false);
      event.target.value = '';
    },
    [activeTemplate, updateActiveTemplate]
  );

  const startMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, elementId: string) => {
      if (event.button !== 0 || !activeTemplate) return;
      event.preventDefault();
      event.stopPropagation();

      const targetElement = activeTemplate.elements.find((element) => element.id === elementId);
      if (!targetElement) return;

      setSelectedElementId(elementId);
      setInteraction({
        mode: 'move',
        elementId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startRect: {
          x: targetElement.x,
          y: targetElement.y,
          width: targetElement.width,
          height: targetElement.height,
        },
      });
    },
    [activeTemplate]
  );

  const startResize = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, elementId: string, handle: ResizeHandle) => {
      if (event.button !== 0 || !activeTemplate) return;
      event.preventDefault();
      event.stopPropagation();

      const targetElement = activeTemplate.elements.find((element) => element.id === elementId);
      if (!targetElement) return;

      setSelectedElementId(elementId);
      setInteraction({
        mode: 'resize',
        elementId,
        handle,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startRect: {
          x: targetElement.x,
          y: targetElement.y,
          width: targetElement.width,
          height: targetElement.height,
        },
      });
    },
    [activeTemplate]
  );

  useEffect(() => {
    if (!interaction) return;

    const handlePointerMove = (event: PointerEvent) => {
      const scale = canvasScale || 1;
      const deltaX = (event.clientX - interaction.startClientX) / scale;
      const deltaY = (event.clientY - interaction.startClientY) / scale;

      setTemplates((currentTemplates) =>
        currentTemplates.map((template) => {
          if (template.id !== activeTemplateId) return template;

          const nextElements = template.elements.map((element) => {
            if (element.id !== interaction.elementId) return element;

            if (interaction.mode === 'move') {
              return {
                ...element,
                x: clamp(
                  interaction.startRect.x + deltaX,
                  0,
                  template.canvasWidth - interaction.startRect.width
                ),
                y: clamp(
                  interaction.startRect.y + deltaY,
                  0,
                  template.canvasHeight - interaction.startRect.height
                ),
              };
            }

            return {
              ...element,
              ...resizeRectFromHandle(
                interaction.handle ?? 'se',
                interaction.startRect,
                deltaX,
                deltaY,
                template.canvasWidth,
                template.canvasHeight
              ),
            };
          });

          return {
            ...template,
            elements: nextElements,
            updatedAt: nowIso(),
          };
        })
      );
    };

    const endInteraction = () => {
      setInteraction(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', endInteraction);
    window.addEventListener('pointercancel', endInteraction);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', endInteraction);
      window.removeEventListener('pointercancel', endInteraction);
    };
  }, [interaction, activeTemplateId, canvasScale]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedElementId) {
        event.preventDefault();
        removeSelectedElement();
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd' && selectedElementId) {
        event.preventDefault();
        duplicateSelectedElement();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedElementId, removeSelectedElement, duplicateSelectedElement]);

  const isPortrait =
    activeTemplate !== null && activeTemplate.canvasHeight >= activeTemplate.canvasWidth;

  return (
    <div className="studio-shell">
      <header className="studio-header">
        <div>
          <p className="studio-kicker">Design Admin Console</p>
          <h1>Template Layout Studio</h1>
          <p className="studio-copy">
            Cloud-saved template management with real-time updates. Add frames, upload images, move,
            and resize freely.
          </p>
        </div>
        <div className="studio-header-actions">
          <span className={`sync-badge sync-${syncState}`}>{syncMessage}</span>
          <button type="button" className="btn btn-secondary" onClick={createTemplate}>
            New template
          </button>
          <button type="button" className="btn btn-primary" onClick={exportActiveTemplate}>
            Export JSON
          </button>
        </div>
      </header>

      <main className="studio-workspace">
        <aside className="studio-panel template-panel">
          <div className="panel-head">
            <h2>Templates</h2>
            <span>{templates.length} items</span>
          </div>

          <div className="template-panel-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={duplicateTemplate}>
              Duplicate
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={deleteActiveTemplate}>
              Delete
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => importRef.current?.click()}
            >
              Import JSON
            </button>
          </div>

          <div className="template-list">
            {templates.map((template) => {
              const previewScale = Math.min(180 / template.canvasWidth, 120 / template.canvasHeight);
              return (
                <button
                  key={template.id}
                  type="button"
                  className={`template-card ${template.id === activeTemplateId ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTemplateId(template.id);
                    setSelectedElementId(null);
                  }}
                >
                  <div
                    className="template-preview"
                    style={{
                      width: Math.round(template.canvasWidth * previewScale),
                      height: Math.round(template.canvasHeight * previewScale),
                    }}
                  >
                    {template.elements.map((element) => (
                      <div
                        key={element.id}
                        className={`template-preview-element ${element.kind}`}
                        style={{
                          left: Math.round(element.x * previewScale),
                          top: Math.round(element.y * previewScale),
                          width: Math.max(2, Math.round(element.width * previewScale)),
                          height: Math.max(2, Math.round(element.height * previewScale)),
                          borderColor: element.borderColor,
                          borderWidth: Math.max(1, Math.round(element.borderWidth * previewScale)),
                          borderStyle: element.borderStyle,
                          borderRadius: Math.round(element.radius * previewScale),
                          opacity: element.opacity,
                        }}
                      >
                        {element.kind === 'image' && element.src ? (
                          <img src={element.src} alt="" loading="lazy" />
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <div className="template-card-text">
                    <strong>{template.name}</strong>
                    <span>
                      {template.canvasWidth} x {template.canvasHeight}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="studio-panel canvas-panel">
          {activeTemplate ? (
            <>
              <div className="canvas-toolbar">
                <div className="toolbar-group">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={addFrameElement}>
                    Add frame
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => imageUploadRef.current?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? 'Uploading...' : 'Upload template images'}
                  </button>
                </div>
                <div className="toolbar-group">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={!selectedElement}
                    onClick={duplicateSelectedElement}
                  >
                    Duplicate element
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={!selectedElement}
                    onClick={removeSelectedElement}
                  >
                    Delete element
                  </button>
                </div>
                <div className="toolbar-group">
                  <span className="zoom-label">{Math.round(canvasScale * 100)}%</span>
                </div>
              </div>

              <div className="canvas-viewport" ref={canvasViewportRef}>
                <div
                  className="canvas-scale-shell"
                  style={{
                    width: activeTemplate.canvasWidth * canvasScale,
                    height: activeTemplate.canvasHeight * canvasScale,
                  }}
                >
                  <div
                    className="canvas-paper"
                    style={{
                      width: activeTemplate.canvasWidth,
                      height: activeTemplate.canvasHeight,
                      transform: `scale(${canvasScale})`,
                    }}
                    onPointerDown={() => setSelectedElementId(null)}
                  >
                    {activeTemplate.elements.map((element) => {
                      const isSelected = element.id === selectedElementId;
                      const isDragging = interaction?.elementId === element.id;
                      return (
                        <div
                          key={element.id}
                          className={`canvas-element ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
                          data-kind={element.kind}
                          style={{
                            left: element.x,
                            top: element.y,
                            width: element.width,
                            height: element.height,
                            borderColor: element.borderColor,
                            borderStyle: element.borderStyle,
                            borderWidth: element.borderWidth,
                            borderRadius: element.radius,
                            opacity: element.opacity,
                          }}
                          onPointerDown={(event) => startMove(event, element.id)}
                        >
                          {element.kind === 'image' && element.src ? (
                            <img
                              src={element.src}
                              alt={element.name}
                              draggable={false}
                              style={{ objectFit: element.fit }}
                            />
                          ) : (
                            <span>{element.name}</span>
                          )}

                          {isSelected &&
                            HANDLE_POSITIONS.map((handle) => (
                              <button
                                key={handle}
                                type="button"
                                className={`resize-handle resize-${handle}`}
                                onPointerDown={(event) => startResize(event, element.id, handle)}
                                aria-label={`resize-${handle}`}
                              />
                            ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </section>

        <aside className="studio-panel inspector-panel">
          <div className="panel-head">
            <h2>Properties</h2>
          </div>

          {activeTemplate ? (
            <>
              <div className="inspector-section">
                <label className="field-label" htmlFor="template-name">
                  Template name
                </label>
                <input
                  id="template-name"
                  className="field-input"
                  type="text"
                  value={activeTemplate.name}
                  onChange={(event) =>
                    updateActiveTemplate((template) => ({
                      ...template,
                      name: event.target.value,
                    }))
                  }
                />
                <div className="preset-switch">
                  <button
                    type="button"
                    className={`preset-btn ${isPortrait ? 'active' : ''}`}
                    onClick={() => setCanvasPreset('portrait')}
                  >
                    A4 portrait
                  </button>
                  <button
                    type="button"
                    className={`preset-btn ${isPortrait ? '' : 'active'}`}
                    onClick={() => setCanvasPreset('landscape')}
                  >
                    A4 landscape
                  </button>
                </div>
              </div>

              <div className="inspector-section">
                <h3>Layer order</h3>
                <div className="layer-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={!selectedElement}
                    onClick={() => moveSelectedLayer('backward')}
                  >
                    Send back
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={!selectedElement}
                    onClick={() => moveSelectedLayer('forward')}
                  >
                    Bring front
                  </button>
                </div>
                <div className="layer-list">
                  {[...activeTemplate.elements].reverse().map((element) => (
                    <button
                      key={element.id}
                      type="button"
                      className={`layer-item ${element.id === selectedElementId ? 'active' : ''}`}
                      onClick={() => setSelectedElementId(element.id)}
                    >
                      <span>{element.kind === 'image' ? 'image' : 'frame'}</span>
                      <strong>{element.name}</strong>
                    </button>
                  ))}
                  {activeTemplate.elements.length === 0 ? (
                    <p className="empty-message">No elements yet.</p>
                  ) : null}
                </div>
              </div>

              <div className="inspector-section">
                <h3>Selected element</h3>
                {selectedElement ? (
                  <div className="element-fields">
                    <label className="field-label" htmlFor="element-name">
                      Name
                    </label>
                    <input
                      id="element-name"
                      className="field-input"
                      type="text"
                      value={selectedElement.name}
                      onChange={(event) => updateSelectedElement({ name: event.target.value })}
                    />

                    <div className="field-grid">
                      <label className="field-label">
                        X
                        <input
                          className="field-input"
                          type="number"
                          value={Math.round(selectedElement.x)}
                          onChange={(event) => updateSelectedElement({ x: Number(event.target.value) || 0 })}
                        />
                      </label>
                      <label className="field-label">
                        Y
                        <input
                          className="field-input"
                          type="number"
                          value={Math.round(selectedElement.y)}
                          onChange={(event) => updateSelectedElement({ y: Number(event.target.value) || 0 })}
                        />
                      </label>
                      <label className="field-label">
                        Width
                        <input
                          className="field-input"
                          type="number"
                          value={Math.round(selectedElement.width)}
                          onChange={(event) =>
                            updateSelectedElement({
                              width: Number(event.target.value) || MIN_ELEMENT_SIZE,
                            })
                          }
                        />
                      </label>
                      <label className="field-label">
                        Height
                        <input
                          className="field-input"
                          type="number"
                          value={Math.round(selectedElement.height)}
                          onChange={(event) =>
                            updateSelectedElement({
                              height: Number(event.target.value) || MIN_ELEMENT_SIZE,
                            })
                          }
                        />
                      </label>
                    </div>

                    <div className="field-grid">
                      <label className="field-label">
                        Border color
                        <input
                          className="field-input"
                          type="color"
                          value={selectedElement.borderColor}
                          onChange={(event) => updateSelectedElement({ borderColor: event.target.value })}
                        />
                      </label>
                      <label className="field-label">
                        Border width
                        <input
                          className="field-input"
                          type="number"
                          min={0}
                          max={16}
                          value={selectedElement.borderWidth}
                          onChange={(event) =>
                            updateSelectedElement({ borderWidth: Number(event.target.value) || 0 })
                          }
                        />
                      </label>
                      <label className="field-label">
                        Opacity
                        <input
                          className="field-input"
                          type="number"
                          step={0.05}
                          min={0.1}
                          max={1}
                          value={selectedElement.opacity}
                          onChange={(event) =>
                            updateSelectedElement({ opacity: Number(event.target.value) || 0.1 })
                          }
                        />
                      </label>
                      <label className="field-label">
                        Radius
                        <input
                          className="field-input"
                          type="number"
                          min={0}
                          max={80}
                          value={selectedElement.radius}
                          onChange={(event) =>
                            updateSelectedElement({ radius: Number(event.target.value) || 0 })
                          }
                        />
                      </label>
                    </div>

                    <div className="field-grid">
                      <label className="field-label">
                        Border style
                        <select
                          className="field-input"
                          value={selectedElement.borderStyle}
                          onChange={(event) =>
                            updateSelectedElement({
                              borderStyle: event.target.value === 'solid' ? 'solid' : 'dashed',
                            })
                          }
                        >
                          <option value="dashed">Dashed</option>
                          <option value="solid">Solid</option>
                        </select>
                      </label>

                      {selectedElement.kind === 'image' ? (
                        <label className="field-label">
                          Image fit
                          <select
                            className="field-input"
                            value={selectedElement.fit}
                            onChange={(event) =>
                              updateSelectedElement({
                                fit: event.target.value === 'contain' ? 'contain' : 'cover',
                              })
                            }
                          >
                            <option value="cover">Cover</option>
                            <option value="contain">Contain</option>
                          </select>
                        </label>
                      ) : (
                        <div className="field-placeholder" />
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="empty-message">Select an element to edit properties.</p>
                )}
              </div>
            </>
          ) : null}

          <div className="inspector-section works-section">
            <h3>Works (real-time)</h3>
            <div className="works-list">
              {projects.map((project) => (
                <article key={project.id} className="work-card">
                  <div className="work-thumb">
                    {project.thumbnailRef ? (
                      <img src={project.thumbnailRef} alt={project.name} loading="lazy" />
                    ) : (
                      <span>No preview</span>
                    )}
                  </div>
                  <div className="work-meta">
                    <strong>{project.name}</strong>
                    <p>Template: {project.templateId}</p>
                    <p>User: {project.userId}</p>
                    <p>Updated: {formatDateTime(project.updatedAt)}</p>
                  </div>
                </article>
              ))}
              {projects.length === 0 ? <p className="empty-message">No works found.</p> : null}
            </div>
          </div>
        </aside>
      </main>

      <input
        ref={imageUploadRef}
        type="file"
        hidden
        multiple
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={handleUploadTemplateImages}
      />
      <input
        ref={importRef}
        type="file"
        hidden
        accept="application/json,.json"
        onChange={importTemplate}
      />
    </div>
  );
}
