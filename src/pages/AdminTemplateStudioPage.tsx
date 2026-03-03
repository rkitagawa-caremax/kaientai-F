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
  PlaceholderType,
  StudioProjectSummary,
  TemplateElement,
  TitleFontStyle,
  TitleTextStyle,
  TemplateRect,
} from '../types/studio';

type ResizeHandle = 'n' | 'e' | 's' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
type SyncState = 'connecting' | 'saving' | 'synced' | 'error';
type CanvasMode = 'edit' | 'view';
type InspectorTab = 'element' | 'layers' | 'works';

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
const DEFAULT_BORDER_COLOR = '#1f7a67';
const TRANSPARENT_BORDER_COLOR = 'transparent';
const LOCAL_DRAFT_STORAGE_KEY = 'kaientai-template-studio-draft-v1';
const LOCAL_DRAFT_HISTORY_STORAGE_KEY = 'kaientai-template-studio-draft-history-v1';
const LOCAL_DRAFT_HISTORY_LIMIT = 20;
const MIN_TITLE_FONT_SIZE = 12;
const MAX_TITLE_FONT_SIZE = 120;
const MIN_TITLE_LETTER_SPACING = -2;
const MAX_TITLE_LETTER_SPACING = 12;
const CUSTOM_TITLE_STYLE_PRESET_ID = 'custom';

interface LocalDraftHistoryEntry {
  savedAt: string;
  serializedTemplates: string;
}

interface TitleStylePreset {
  id: string;
  label: string;
  fontFamily: string;
  fontWeight: number;
  fontStyle: TitleFontStyle;
  color: string;
  letterSpacing: number;
  mainFontSize: number;
  subFontSize: number;
}

const TITLE_STYLE_PRESETS: TitleStylePreset[] = [
  {
    id: 'modern-impact',
    label: 'モダンインパクト',
    fontFamily: '"M PLUS 1p", sans-serif',
    fontWeight: 800,
    fontStyle: 'normal',
    color: '#1d3557',
    letterSpacing: 1.4,
    mainFontSize: 56,
    subFontSize: 28,
  },
  {
    id: 'mincho-elegant',
    label: '上品明朝',
    fontFamily: '"Sawarabi Mincho", serif',
    fontWeight: 700,
    fontStyle: 'normal',
    color: '#5c3d2e',
    letterSpacing: 0.9,
    mainFontSize: 50,
    subFontSize: 27,
  },
  {
    id: 'friendly-pop',
    label: 'やわらかポップ',
    fontFamily: '"Yusei Magic", sans-serif',
    fontWeight: 700,
    fontStyle: 'normal',
    color: '#0b7285',
    letterSpacing: 0.4,
    mainFontSize: 52,
    subFontSize: 26,
  },
  {
    id: 'cinematic-serif',
    label: 'シネマ風セリフ',
    fontFamily: '"Noto Serif JP", serif',
    fontWeight: 700,
    fontStyle: 'italic',
    color: '#6a040f',
    letterSpacing: 1.1,
    mainFontSize: 54,
    subFontSize: 28,
  },
  {
    id: 'creative-soft',
    label: 'クリエイティブ',
    fontFamily: '"Kaisei Decol", serif',
    fontWeight: 700,
    fontStyle: 'normal',
    color: '#5f0f40',
    letterSpacing: 0.8,
    mainFontSize: 53,
    subFontSize: 27,
  },
];

const TITLE_STYLE_PRESET_MAP = new Map<string, TitleStylePreset>(
  TITLE_STYLE_PRESETS.map((preset) => [preset.id, preset])
);

const TITLE_FONT_FAMILY_OPTIONS = [
  { label: 'M PLUS 1p', value: '"M PLUS 1p", sans-serif' },
  { label: 'Sawarabi Mincho', value: '"Sawarabi Mincho", serif' },
  { label: 'Yusei Magic', value: '"Yusei Magic", sans-serif' },
  { label: 'Noto Serif JP', value: '"Noto Serif JP", serif' },
  { label: 'Kaisei Decol', value: '"Kaisei Decol", serif' },
];

const CLOUD_ERROR_HINTS: Record<string, string> = {
  'permission-denied': '権限がありません',
  unauthenticated: 'ログインが必要です',
  unavailable: 'ネットワークに接続できません',
  'deadline-exceeded': '通信がタイムアウトしました',
  'resource-exhausted': '保存上限を超えています',
  'invalid-argument': '保存データが不正です',
  'failed-precondition': 'Firestore 設定が不足しています',
};

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function isTitlePlaceholderType(placeholderType: PlaceholderType): placeholderType is 'text-main' | 'text-sub' {
  return placeholderType === 'text-main' || placeholderType === 'text-sub';
}

function getDefaultTitlePresetId(placeholderType: 'text-main' | 'text-sub'): string {
  return placeholderType === 'text-main' ? 'modern-impact' : 'mincho-elegant';
}

function getDefaultTitleSampleText(placeholderType: 'text-main' | 'text-sub'): string {
  return placeholderType === 'text-main' ? 'メインタイトル' : 'サブタイトル';
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function clampOrFallback(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return clamp(numeric, min, max);
}

function sanitizeColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) return normalized;
  return fallback;
}

function createTitleTextStyleFromPreset(
  placeholderType: 'text-main' | 'text-sub',
  presetId: string
): TitleTextStyle {
  const preset =
    TITLE_STYLE_PRESET_MAP.get(presetId) ??
    TITLE_STYLE_PRESET_MAP.get(getDefaultTitlePresetId(placeholderType)) ??
    TITLE_STYLE_PRESETS[0];

  return {
    presetId: preset.id,
    sampleText: getDefaultTitleSampleText(placeholderType),
    fontFamily: preset.fontFamily,
    fontSize: placeholderType === 'text-main' ? preset.mainFontSize : preset.subFontSize,
    fontWeight: preset.fontWeight,
    fontStyle: preset.fontStyle,
    color: preset.color,
    letterSpacing: preset.letterSpacing,
  };
}

function normalizeTitleTextStyle(
  candidate: unknown,
  placeholderType: PlaceholderType
): TitleTextStyle | undefined {
  if (!isTitlePlaceholderType(placeholderType)) {
    return undefined;
  }

  const fallback = createTitleTextStyleFromPreset(
    placeholderType,
    getDefaultTitlePresetId(placeholderType)
  );

  if (typeof candidate !== 'object' || candidate === null) {
    return fallback;
  }

  const value = candidate as Partial<TitleTextStyle>;
  const rawPresetId =
    typeof value.presetId === 'string' && value.presetId.length > 0 ? value.presetId : fallback.presetId;
  const presetBase =
    rawPresetId === CUSTOM_TITLE_STYLE_PRESET_ID
      ? fallback
      : createTitleTextStyleFromPreset(placeholderType, rawPresetId);
  const sampleText =
    typeof value.sampleText === 'string' && value.sampleText.trim().length > 0
      ? value.sampleText.trim().slice(0, 80)
      : presetBase.sampleText;

  return {
    presetId:
      rawPresetId === CUSTOM_TITLE_STYLE_PRESET_ID || TITLE_STYLE_PRESET_MAP.has(rawPresetId)
        ? rawPresetId
        : fallback.presetId,
    sampleText,
    fontFamily:
      typeof value.fontFamily === 'string' && value.fontFamily.trim().length > 0
        ? value.fontFamily
        : presetBase.fontFamily,
    fontSize: clampOrFallback(value.fontSize, presetBase.fontSize, MIN_TITLE_FONT_SIZE, MAX_TITLE_FONT_SIZE),
    fontWeight: clampOrFallback(value.fontWeight, presetBase.fontWeight, 300, 900),
    fontStyle: value.fontStyle === 'italic' ? 'italic' : 'normal',
    color: sanitizeColor(value.color, presetBase.color),
    letterSpacing: clampOrFallback(
      value.letterSpacing,
      presetBase.letterSpacing,
      MIN_TITLE_LETTER_SPACING,
      MAX_TITLE_LETTER_SPACING
    ),
  };
}

function clampRectToCanvas(rect: TemplateRect, canvasWidth: number, canvasHeight: number): TemplateRect {
  const width = clamp(rect.width, MIN_ELEMENT_SIZE, canvasWidth);
  const height = clamp(rect.height, MIN_ELEMENT_SIZE, canvasHeight);
  const x = clamp(rect.x, 0, canvasWidth - width);
  const y = clamp(rect.y, 0, canvasHeight - height);
  return { x, y, width, height };
}

function resolveCloudErrorMessage(error: unknown, phase: 'connect' | 'save'): string {
  const fallback =
    phase === 'connect' ? 'クラウド接続に失敗しました' : 'クラウド保存に失敗しました';

  const code =
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
      ? (error as { code: string }).code
      : '';
  const normalizedCode = code.startsWith('firebase/') ? code.slice('firebase/'.length) : code;

  if (normalizedCode && CLOUD_ERROR_HINTS[normalizedCode]) {
    return `${fallback}（${CLOUD_ERROR_HINTS[normalizedCode]} / ${normalizedCode}）`;
  }

  if (normalizedCode) {
    return `${fallback}（${normalizedCode}）`;
  }

  if (error instanceof Error && error.message) {
    return `${fallback}（${error.message}）`;
  }

  return fallback;
}

function normalizePlaceholderType(value: unknown): PlaceholderType {
  if (value === 'image-slot' || value === 'text-main' || value === 'text-sub') {
    return value;
  }
  return 'generic';
}

function getPlaceholderLabel(placeholderType: PlaceholderType): string {
  switch (placeholderType) {
    case 'image-slot':
      return '画像枠';
    case 'text-main':
      return 'メインタイトル枠';
    case 'text-sub':
      return 'サブタイトル枠';
    default:
      return 'フレーム';
  }
}

function getTitlePreviewTextStyle(titleStyle: TitleTextStyle): {
  fontFamily: string;
  fontSize: string;
  fontWeight: number;
  fontStyle: TitleFontStyle;
  color: string;
  letterSpacing: string;
} {
  return {
    fontFamily: titleStyle.fontFamily,
    fontSize: `${titleStyle.fontSize}px`,
    fontWeight: titleStyle.fontWeight,
    fontStyle: titleStyle.fontStyle,
    color: titleStyle.color,
    letterSpacing: `${titleStyle.letterSpacing}px`,
  };
}

function sanitizeTemplateElement(
  candidate: Partial<TemplateElement>,
  canvasWidth: number,
  canvasHeight: number,
  index: number
): TemplateElement {
  const kind: ElementKind = candidate.kind === 'image' ? 'image' : 'frame';
  const placeholderType = normalizePlaceholderType(candidate.placeholderType);
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
  const titleTextStyle = normalizeTitleTextStyle(candidate.titleTextStyle, placeholderType);

  return {
    id: typeof candidate.id === 'string' ? candidate.id : createId(),
    kind,
    placeholderType,
    name:
      typeof candidate.name === 'string'
        ? candidate.name
        : kind === 'image'
          ? `画像 ${index + 1}`
          : `${getPlaceholderLabel(placeholderType)} ${index + 1}`,
    src: kind === 'image' && typeof candidate.src === 'string' ? candidate.src : undefined,
    fit,
    borderColor:
      typeof candidate.borderColor === 'string' ? candidate.borderColor : TRANSPARENT_BORDER_COLOR,
    borderWidth: clamp(Number(candidate.borderWidth) || 2, 0, 16),
    borderStyle,
    opacity: clamp(Number(candidate.opacity) || 1, 0.1, 1),
    radius: clamp(Number(candidate.radius) || 14, 0, 80),
    titleTextStyle,
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
    name: typeof candidate.name === 'string' ? candidate.name : `テンプレート ${index + 1}`,
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

function getLatestTemplateUpdatedAt(templates: LayoutTemplate[]): number {
  return templates.reduce((latest, template) => {
    const timestamp = new Date(template.updatedAt).getTime();
    if (Number.isNaN(timestamp)) return latest;
    return Math.max(latest, timestamp);
  }, 0);
}

function toSanitizedTemplates(raw: unknown): LayoutTemplate[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((template, index) => sanitizeTemplate(template as Partial<LayoutTemplate>, index));
}

function parseSerializedTemplates(serializedTemplates: string): LayoutTemplate[] {
  try {
    const parsed = JSON.parse(serializedTemplates);
    return toSanitizedTemplates(parsed);
  } catch {
    return [];
  }
}

function readLocalDraftTemplates(): LayoutTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_DRAFT_STORAGE_KEY);
    if (!raw) return [];
    return parseSerializedTemplates(raw);
  } catch {
    return [];
  }
}

function readLocalDraftHistory(): LocalDraftHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_DRAFT_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry): entry is LocalDraftHistoryEntry =>
          typeof entry === 'object' &&
          entry !== null &&
          typeof (entry as LocalDraftHistoryEntry).savedAt === 'string' &&
          typeof (entry as LocalDraftHistoryEntry).serializedTemplates === 'string'
      )
      .slice(-LOCAL_DRAFT_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function appendLocalDraftHistory(serializedTemplates: string): LocalDraftHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  const history = readLocalDraftHistory();
  const latest = history.length > 0 ? history[history.length - 1] : null;
  if (latest && latest.serializedTemplates === serializedTemplates) {
    return history;
  }

  const nextHistory = [
    ...history,
    {
      savedAt: nowIso(),
      serializedTemplates,
    },
  ].slice(-LOCAL_DRAFT_HISTORY_LIMIT);

  window.localStorage.setItem(LOCAL_DRAFT_HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
  return nextHistory;
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
  return normalized.length > 0 ? normalized : 'テンプレート';
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
      reject(new Error('画像サイズの取得に失敗しました。'));
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
  const [templates, setTemplates] = useState<LayoutTemplate[]>([createBlankTemplate('テンプレート 1')]);
  const [activeTemplateId, setActiveTemplateId] = useState<string>('');
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [interaction, setInteraction] = useState<InteractionState | null>(null);
  const [canvasScale, setCanvasScale] = useState<number>(1);
  const [projects, setProjects] = useState<StudioProjectSummary[]>([]);
  const [syncState, setSyncState] = useState<SyncState>('connecting');
  const [syncMessage, setSyncMessage] = useState<string>('クラウドに接続中...');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [cloudReady, setCloudReady] = useState<boolean>(false);
  const [hasHydratedTemplates, setHasHydratedTemplates] = useState<boolean>(false);
  const [localHistoryCount, setLocalHistoryCount] = useState<number>(0);
  const [canvasMode, setCanvasMode] = useState<CanvasMode>('edit');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('element');

  const canvasViewportRef = useRef<HTMLDivElement | null>(null);
  const imageUploadRef = useRef<HTMLInputElement | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const lastCloudSerializedRef = useRef<string | null>(null);
  const lastLocalSerializedRef = useRef<string | null>(null);
  const localDraftTemplatesRef = useRef<LayoutTemplate[]>([]);

  const activeTemplate = useMemo(
    () => templates.find((template) => template.id === activeTemplateId) ?? null,
    [templates, activeTemplateId]
  );

  const selectedElement = useMemo(
    () => activeTemplate?.elements.find((element) => element.id === selectedElementId) ?? null,
    [activeTemplate, selectedElementId]
  );

  const layerOverview = useMemo(() => {
    if (!activeTemplate) return [];

    const total = activeTemplate.elements.length;
    return activeTemplate.elements
      .map((element, index) => ({
        element,
        stackOrder: total - index,
        boundsText: `X:${Math.round(element.x)} Y:${Math.round(element.y)} W:${Math.round(element.width)} H:${Math.round(element.height)}`,
      }))
      .reverse();
  }, [activeTemplate]);

  const isEditMode = canvasMode === 'edit';

  const serializedTemplates = useMemo(() => JSON.stringify(templates), [templates]);

  useEffect(() => {
    const history = readLocalDraftHistory();
    let localDraft = readLocalDraftTemplates();
    if (localDraft.length === 0 && history.length > 0) {
      for (let index = history.length - 1; index >= 0; index -= 1) {
        const recovered = parseSerializedTemplates(history[index].serializedTemplates);
        if (recovered.length > 0) {
          localDraft = recovered;
          break;
        }
      }
    }

    localDraftTemplatesRef.current = localDraft;
    lastLocalSerializedRef.current = localDraft.length > 0 ? JSON.stringify(localDraft) : null;
    setLocalHistoryCount(history.length);
  }, []);

  useEffect(() => {
    setSyncState('connecting');
    setSyncMessage('クラウドに接続中...');

    const unsubscribe = subscribeStudioTemplates(
      (remoteTemplates) => {
        const sanitizedRemote =
          remoteTemplates.length > 0
            ? remoteTemplates.map((template, index) =>
                sanitizeTemplate(template as Partial<LayoutTemplate>, index)
              )
            : [];

        const remoteLatest = getLatestTemplateUpdatedAt(sanitizedRemote);
        const localLatest = getLatestTemplateUpdatedAt(localDraftTemplatesRef.current);
        const prefersLocalDraft = localLatest > remoteLatest && localDraftTemplatesRef.current.length > 0;
        const merged =
          sanitizedRemote.length > 0
            ? prefersLocalDraft
              ? localDraftTemplatesRef.current
              : sanitizedRemote
            : localDraftTemplatesRef.current.length > 0
              ? localDraftTemplatesRef.current
              : [createBlankTemplate('テンプレート 1')];

        lastCloudSerializedRef.current =
          remoteTemplates.length > 0 ? JSON.stringify(sanitizedRemote) : JSON.stringify([]);

        setTemplates(merged);
        setActiveTemplateId((previousId) => {
          if (merged.some((template) => template.id === previousId)) return previousId;
          return merged[0].id;
        });
        setCloudReady(true);
        setHasHydratedTemplates(true);
        setSyncState('synced');
        setSyncMessage('同期済み');
      },
      (error) => {
        const fallback =
          localDraftTemplatesRef.current.length > 0
            ? localDraftTemplatesRef.current
            : [createBlankTemplate('テンプレート 1')];
        setTemplates(fallback);
        setActiveTemplateId((previousId) => {
          if (fallback.some((template) => template.id === previousId)) return previousId;
          return fallback[0].id;
        });
        setCloudReady(true);
        setHasHydratedTemplates(true);
        setSyncState('error');
        if (localDraftTemplatesRef.current.length > 0) {
          setSyncMessage('クラウド接続失敗（ローカル下書きを表示中）');
        } else {
          setSyncMessage(resolveCloudErrorMessage(error, 'connect'));
        }
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
    setSyncMessage('クラウドに保存中...');

    saveTimerRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          await saveStudioTemplates(templates);
          lastCloudSerializedRef.current = serializedTemplates;
          setSyncState('synced');
          setSyncMessage('同期済み');
        } catch (error) {
          console.error(error);
          setSyncState('error');
          setSyncMessage(resolveCloudErrorMessage(error, 'save'));
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
    if (typeof window === 'undefined') return;
    if (!hasHydratedTemplates) return;
    try {
      window.localStorage.setItem(LOCAL_DRAFT_STORAGE_KEY, serializedTemplates);
      if (serializedTemplates !== lastLocalSerializedRef.current) {
        const nextHistory = appendLocalDraftHistory(serializedTemplates);
        setLocalHistoryCount(nextHistory.length);
        lastLocalSerializedRef.current = serializedTemplates;
      }
    } catch {
      // Ignore storage quota/permission errors and continue cloud sync flow.
    }
  }, [serializedTemplates, hasHydratedTemplates]);

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

  useEffect(() => {
    if (canvasMode !== 'view') return;
    setSelectedElementId(null);
    setInteraction(null);
  }, [canvasMode]);

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
          const placeholderType = normalizePlaceholderType(merged.placeholderType);
          const rect = clampRectToCanvas(merged, template.canvasWidth, template.canvasHeight);
          const fit: FitMode = merged.fit === 'contain' ? 'contain' : 'cover';
          const borderStyle: BorderStyle = merged.borderStyle === 'solid' ? 'solid' : 'dashed';
          const titleTextStyle = normalizeTitleTextStyle(merged.titleTextStyle, placeholderType);

          return {
            ...merged,
            ...rect,
            placeholderType,
            fit,
            borderStyle,
            borderWidth: clamp(merged.borderWidth, 0, 16),
            opacity: clamp(merged.opacity, 0.1, 1),
            radius: clamp(merged.radius, 0, 80),
            titleTextStyle,
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

  const selectedTitleTextStyle = useMemo(() => {
    if (!selectedElement) return null;
    return normalizeTitleTextStyle(selectedElement.titleTextStyle, selectedElement.placeholderType) ?? null;
  }, [selectedElement]);

  const updateSelectedTitleTextStyle = useCallback(
    (updater: (current: TitleTextStyle, placeholderType: 'text-main' | 'text-sub') => TitleTextStyle) => {
      if (!selectedElement || !isTitlePlaceholderType(selectedElement.placeholderType)) return;
      const currentStyle = normalizeTitleTextStyle(
        selectedElement.titleTextStyle,
        selectedElement.placeholderType
      );
      if (!currentStyle) return;

      const nextStyle = normalizeTitleTextStyle(
        updater(currentStyle, selectedElement.placeholderType),
        selectedElement.placeholderType
      );
      if (!nextStyle) return;

      updateSelectedElement({ titleTextStyle: nextStyle });
    },
    [selectedElement, updateSelectedElement]
  );

  const restoreLatestLocalDraft = useCallback(() => {
    const history = readLocalDraftHistory();
    if (history.length === 0) {
      window.alert('復元できるローカル履歴が見つかりませんでした。');
      return;
    }

    for (let index = history.length - 1; index >= 0; index -= 1) {
      const entry = history[index];
      const recoveredTemplates = parseSerializedTemplates(entry.serializedTemplates);
      if (recoveredTemplates.length === 0) continue;

      localDraftTemplatesRef.current = recoveredTemplates;
      lastLocalSerializedRef.current = entry.serializedTemplates;
      setTemplates(recoveredTemplates);
      setActiveTemplateId((previousId) => {
        if (recoveredTemplates.some((template) => template.id === previousId)) return previousId;
        return recoveredTemplates[0].id;
      });
      setSelectedElementId(null);
      setHasHydratedTemplates(true);
      setSyncState('synced');
      setSyncMessage(`ローカル履歴を復元しました（${formatDateTime(entry.savedAt)}）`);
      return;
    }

    window.alert('ローカル履歴の読み込みに失敗しました。');
  }, []);

  const createTemplate = useCallback(() => {
    const newTemplate = createBlankTemplate(`テンプレート ${templates.length + 1}`);
    setTemplates((current) => [...current, newTemplate]);
    setActiveTemplateId(newTemplate.id);
    setSelectedElementId(null);
  }, [templates.length]);

  const duplicateTemplate = useCallback(() => {
    if (!activeTemplate) return;

    const duplicated: LayoutTemplate = {
      ...activeTemplate,
      id: createId(),
      name: `${activeTemplate.name} のコピー`,
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

    const confirmed = window.confirm(`「${activeTemplate.name}」を削除しますか？`);
    if (!confirmed) return;

    if (templates.length <= 1) {
      const fallback = createBlankTemplate('テンプレート 1');
      setTemplates([fallback]);
      setActiveTemplateId(fallback.id);
      setSelectedElementId(null);
      return;
    }

    setTemplates((current) => current.filter((template) => template.id !== activeTemplate.id));
    setSelectedElementId(null);
  }, [activeTemplate, templates.length]);

  const addPlaceholderElement = useCallback(
    (placeholderType: PlaceholderType) => {
      if (!activeTemplate) return;

      const configMap: Record<
        PlaceholderType,
        {
          widthRatio: number;
          heightRatio: number;
          borderColor: string;
          borderWidth: number;
          borderStyle: BorderStyle;
          radius: number;
        }
      > = {
        generic: {
          widthRatio: 0.38,
          heightRatio: 0.2,
          borderColor: TRANSPARENT_BORDER_COLOR,
          borderWidth: 3,
          borderStyle: 'dashed',
          radius: 16,
        },
        'image-slot': {
          widthRatio: 0.72,
          heightRatio: 0.34,
          borderColor: '#1f7a67',
          borderWidth: 3,
          borderStyle: 'dashed',
          radius: 12,
        },
        'text-main': {
          widthRatio: 0.8,
          heightRatio: 0.12,
          borderColor: '#1d4ed8',
          borderWidth: 2,
          borderStyle: 'solid',
          radius: 10,
        },
        'text-sub': {
          widthRatio: 0.68,
          heightRatio: 0.1,
          borderColor: '#1d4ed8',
          borderWidth: 2,
          borderStyle: 'dashed',
          radius: 10,
        },
      };

      const config = configMap[placeholderType];
      const width = Math.round(activeTemplate.canvasWidth * config.widthRatio);
      const height = Math.round(activeTemplate.canvasHeight * config.heightRatio);
      const count = activeTemplate.elements.filter(
        (item) => item.kind === 'frame' && item.placeholderType === placeholderType
      ).length;

      const element: TemplateElement = {
        id: createId(),
        kind: 'frame',
        placeholderType,
        name: `${getPlaceholderLabel(placeholderType)} ${count + 1}`,
        x: Math.round((activeTemplate.canvasWidth - width) / 2),
        y: Math.round((activeTemplate.canvasHeight - height) / 2),
        width,
        height,
        src: undefined,
        fit: 'cover',
        borderColor: config.borderColor,
        borderWidth: config.borderWidth,
        borderStyle: config.borderStyle,
        opacity: 1,
        radius: config.radius,
        titleTextStyle: normalizeTitleTextStyle(undefined, placeholderType),
      };

      updateActiveTemplate((template) => ({
        ...template,
        elements: [...template.elements, element],
      }));
      setSelectedElementId(element.id);
    },
    [activeTemplate, updateActiveTemplate]
  );

  const addFrameElement = useCallback(() => {
    addPlaceholderElement('generic');
  }, [addPlaceholderElement]);

  const addImageSlotElement = useCallback(() => {
    addPlaceholderElement('image-slot');
  }, [addPlaceholderElement]);

  const addTextMainSlotElement = useCallback(() => {
    addPlaceholderElement('text-main');
  }, [addPlaceholderElement]);

  const addTextSubSlotElement = useCallback(() => {
    addPlaceholderElement('text-sub');
  }, [addPlaceholderElement]);

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
      name: `${selectedElement.name} のコピー`,
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
          name: `${imported.name}（インポート）`,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        setTemplates((current) => [...current, template]);
        setActiveTemplateId(template.id);
        setSelectedElementId(null);
      } catch (error) {
        console.error(error);
        window.alert('テンプレートJSONの読み込みに失敗しました。');
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

      try {
        const createdElements: TemplateElement[] = [];
        const cloudFallbacks: string[] = [];
        const hardFailures: string[] = [];
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

            let imageUrl: string;
            try {
              imageUrl = await uploadTemplateImage(activeTemplate.id, elementId, file);
            } catch (error) {
              console.error(error);
              const reason = error instanceof Error ? error.message : 'unknown error';
              cloudFallbacks.push(file.name + ': ' + reason);
              imageUrl = URL.createObjectURL(file);
            }

            createdElements.push({
              id: elementId,
              kind: 'image',
              placeholderType: 'generic',
              name:
                file.name.replace(/\.[^.]+$/, '') ||
                '画像 ' + (activeTemplate.elements.length + index + 1),
              x,
              y,
              width,
              height,
              src: imageUrl,
              fit: 'cover',
              borderColor: TRANSPARENT_BORDER_COLOR,
              borderWidth: 2,
              borderStyle: 'solid',
              opacity: 1,
              radius: 14,
            });
          } catch (error) {
            console.error(error);
            const reason = error instanceof Error ? error.message : 'unknown error';
            hardFailures.push(file.name + ': ' + reason);
          }
        }

        if (createdElements.length > 0) {
          updateActiveTemplate((template) => ({
            ...template,
            elements: [...template.elements, ...createdElements],
          }));
          setSelectedElementId(createdElements[createdElements.length - 1].id);
        }

        const summarize = (items: string[]) => {
          const preview = items.slice(0, 3).join('\n');
          const extra = items.length > 3 ? '\nほか ' + (items.length - 3) + ' 件' : '';
          return preview + extra;
        };

        const alerts: string[] = [];
        if (cloudFallbacks.length > 0) {
          alerts.push(
            'クラウドへのアップロードに失敗したため、ローカル画像として配置しました（クラウドには保存されません）。\n' +
              summarize(cloudFallbacks)
          );
        }
        if (hardFailures.length > 0) {
          alerts.push('画像の追加に失敗しました。\n' + summarize(hardFailures));
        }
        if (alerts.length > 0) {
          window.alert(alerts.join('\n\n'));
        }
      } finally {
        setIsUploading(false);
        event.target.value = '';
      }
    },
    [activeTemplate, updateActiveTemplate]
  );

  const startMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, elementId: string) => {
      if (canvasMode !== 'edit' || event.button !== 0 || !activeTemplate) return;
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
    [activeTemplate, canvasMode]
  );

  const startResize = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, elementId: string, handle: ResizeHandle) => {
      if (canvasMode !== 'edit' || event.button !== 0 || !activeTemplate) return;
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
    [activeTemplate, canvasMode]
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
      if (!isEditMode) return;

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
  }, [selectedElementId, removeSelectedElement, duplicateSelectedElement, isEditMode]);

  const isPortrait =
    activeTemplate !== null && activeTemplate.canvasHeight >= activeTemplate.canvasWidth;

  return (
    <div className="studio-shell">
      <header className="studio-header">
        <div>
          <p className="studio-kicker">デザイン管理コンソール</p>
          <h1>テンプレートレイアウトスタジオ</h1>
          <p className="studio-copy">
            クラウドに保存したテンプレートをリアルタイムで管理できます。フレーム追加、画像アップロード、
            移動・リサイズを自由に行えます。
          </p>
        </div>
        <div className="studio-header-actions">
          <span className={`sync-badge sync-${syncState}`}>{syncMessage}</span>
          <button type="button" className="btn btn-secondary" onClick={createTemplate}>
            新規テンプレート
          </button>
          <button type="button" className="btn btn-secondary" onClick={restoreLatestLocalDraft}>
            ローカル復元{localHistoryCount > 0 ? ` (${localHistoryCount})` : ''}
          </button>
          <button type="button" className="btn btn-primary" onClick={exportActiveTemplate}>
            JSONを書き出し
          </button>
        </div>
      </header>

      <main className="studio-workspace">
        <aside className="studio-panel template-panel">
          <div className="panel-head">
            <h2>テンプレート</h2>
            <span>{templates.length} 件</span>
          </div>

          <div className="template-panel-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={duplicateTemplate}>
              複製
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={deleteActiveTemplate}>
              削除
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => importRef.current?.click()}
            >
              JSONを読み込み
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
                    {template.elements.map((element) => {
                      const titleTextStyle = normalizeTitleTextStyle(
                        element.titleTextStyle,
                        element.placeholderType
                      );

                      return (
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
                          {titleTextStyle ? (
                            <span
                              className="template-preview-text"
                              style={{
                                ...getTitlePreviewTextStyle(titleTextStyle),
                                fontSize: `${Math.max(
                                  6,
                                  Math.round(titleTextStyle.fontSize * previewScale)
                                )}px`,
                                letterSpacing: `${Math.round(
                                  titleTextStyle.letterSpacing * previewScale * 10
                                ) / 10}px`,
                              }}
                            >
                              {titleTextStyle.sampleText}
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
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
                    フレーム追加
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={addImageSlotElement}
                  >
                    画像枠を追加
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={addTextMainSlotElement}
                  >
                    メインタイトル枠
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={addTextSubSlotElement}
                  >
                    サブタイトル枠
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => imageUploadRef.current?.click()}
                    disabled={isUploading || !isEditMode}
                  >
                    {isUploading ? 'アップロード中...' : 'テンプレート画像をアップロード'}
                  </button>
                </div>
                <div className="toolbar-group mode-toggle">
                  <button
                    type="button"
                    className={`btn btn-secondary btn-sm ${isEditMode ? 'btn-mode-active' : ''}`}
                    onClick={() => setCanvasMode('edit')}
                  >
                    編集モード
                  </button>
                  <button
                    type="button"
                    className={`btn btn-secondary btn-sm ${isEditMode ? '' : 'btn-mode-active'}`}
                    onClick={() => setCanvasMode('view')}
                  >
                    チラシ全体ビュー
                  </button>
                </div>
                <div className="toolbar-group">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={!selectedElement || !isEditMode}
                    onClick={duplicateSelectedElement}
                  >
                    要素を複製
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={!selectedElement || !isEditMode}
                    onClick={removeSelectedElement}
                  >
                    要素を削除
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
                    className={`canvas-paper ${isEditMode ? '' : 'view-only'}`}
                    style={{
                      width: activeTemplate.canvasWidth,
                      height: activeTemplate.canvasHeight,
                      transform: `scale(${canvasScale})`,
                    }}
                    onPointerDown={isEditMode ? () => setSelectedElementId(null) : undefined}
                  >
                    {activeTemplate.elements.map((element) => {
                      const isSelected = isEditMode && element.id === selectedElementId;
                      const isDragging = isEditMode && interaction?.elementId === element.id;
                      const titleTextStyle = normalizeTitleTextStyle(
                        element.titleTextStyle,
                        element.placeholderType
                      );
                      return (
                        <div
                          key={element.id}
                          className={`canvas-element ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
                          data-kind={element.kind}
                          data-placeholder-type={element.placeholderType}
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
                          onPointerDown={isEditMode ? (event) => startMove(event, element.id) : undefined}
                        >
                          {element.kind === 'image' && element.src ? (
                            <img
                              src={element.src}
                              alt={element.name}
                              draggable={false}
                              style={{ objectFit: element.fit }}
                            />
                          ) : titleTextStyle ? (
                            <span
                              className="canvas-element-text-preview"
                              style={getTitlePreviewTextStyle(titleTextStyle)}
                            >
                              {titleTextStyle.sampleText}
                            </span>
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
                                aria-label={`サイズ変更-${handle}`}
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
            <h2>プロパティ</h2>
          </div>
          <div className="inspector-tabs">
            <button
              type="button"
              className={`inspector-tab ${inspectorTab === 'element' ? 'active' : ''}`}
              onClick={() => setInspectorTab('element')}
            >
              要素
            </button>
            <button
              type="button"
              className={`inspector-tab ${inspectorTab === 'layers' ? 'active' : ''}`}
              onClick={() => setInspectorTab('layers')}
            >
              レイヤー
            </button>
            <button
              type="button"
              className={`inspector-tab ${inspectorTab === 'works' ? 'active' : ''}`}
              onClick={() => setInspectorTab('works')}
            >
              作品
            </button>
          </div>

          {activeTemplate ? (
            <>
              {inspectorTab === 'element' ? (
                <div className="inspector-section">
                  <label className="field-label" htmlFor="template-name">
                    テンプレート名
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
                      A4 縦
                    </button>
                    <button
                      type="button"
                      className={`preset-btn ${isPortrait ? '' : 'active'}`}
                      onClick={() => setCanvasPreset('landscape')}
                    >
                      A4 横
                    </button>
                  </div>
                </div>
              ) : null}

              {inspectorTab === 'layers' ? (
                <div className="inspector-section">
                <h3>レイヤー順</h3>
                <div className="layer-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={!selectedElement || !isEditMode}
                    onClick={() => moveSelectedLayer('backward')}
                  >
                    背面へ
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={!selectedElement || !isEditMode}
                    onClick={() => moveSelectedLayer('forward')}
                  >
                    前面へ
                  </button>
                </div>
                <div className="layer-list">
                  {[...activeTemplate.elements].reverse().map((element) => (
                    <button
                      key={element.id}
                      type="button"
                      className={`layer-item ${isEditMode && element.id === selectedElementId ? 'active' : ''}`}
                      disabled={!isEditMode}
                      onClick={() => setSelectedElementId(element.id)}
                    >
                      <span>
                        {element.kind === 'image'
                          ? '画像'
                          : getPlaceholderLabel(element.placeholderType)}
                      </span>
                      <strong>{element.name}</strong>
                    </button>
                  ))}
                  {activeTemplate.elements.length === 0 ? (
                    <p className="empty-message">要素はまだありません。</p>
                  ) : null}
                </div>
                <details className="layer-overview-details">
                  <summary className="layer-overview-summary">
                    {`全${layerOverview.length}レイヤー（前面→背面）の詳細`}
                  </summary>
                  <div className="layer-overview-list">
                    {layerOverview.map(({ element, stackOrder, boundsText }) => (
                      <button
                        key={`${element.id}-overview`}
                        type="button"
                        className={`layer-overview-item ${isEditMode && element.id === selectedElementId ? 'active' : ''}`}
                        disabled={!isEditMode}
                        onClick={() => setSelectedElementId(element.id)}
                      >
                        <div className="layer-overview-main">
                          <span className="layer-overview-index">#{stackOrder}</span>
                          <strong>{element.name}</strong>
                        </div>
                        <p className="layer-overview-meta">
                          {`${element.kind === 'image' ? '画像' : getPlaceholderLabel(element.placeholderType)} / ${boundsText} / 透明度 ${Math.round(element.opacity * 100)}%`}
                        </p>
                      </button>
                    ))}
                  </div>
                </details>
              </div>
              ) : null}

              {inspectorTab === 'element' ? (
                <div className="inspector-section">
                <h3>選択中の要素</h3>
                {selectedElement ? (
                  <div className="element-fields">
                    <label className="field-label" htmlFor="element-name">
                      名前
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
                        幅
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
                        高さ
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
                        枠線の色
                        <select
                          className="field-input"
                          value={
                            selectedElement.borderColor === TRANSPARENT_BORDER_COLOR
                              ? TRANSPARENT_BORDER_COLOR
                              : 'color'
                          }
                          onChange={(event) =>
                            updateSelectedElement({
                              borderColor:
                                event.target.value === TRANSPARENT_BORDER_COLOR
                                  ? TRANSPARENT_BORDER_COLOR
                                  : DEFAULT_BORDER_COLOR,
                            })
                          }
                        >
                          <option value={TRANSPARENT_BORDER_COLOR}>透明</option>
                          <option value="color">色を指定</option>
                        </select>
                        <input
                          className="field-input"
                          type="color"
                          value={
                            selectedElement.borderColor === TRANSPARENT_BORDER_COLOR
                              ? DEFAULT_BORDER_COLOR
                              : selectedElement.borderColor
                          }
                          disabled={selectedElement.borderColor === TRANSPARENT_BORDER_COLOR}
                          onChange={(event) => updateSelectedElement({ borderColor: event.target.value })}
                        />
                      </label>
                      <label className="field-label">
                        枠線の太さ
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
                        不透明度
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
                        角丸
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
                        枠線スタイル
                        <select
                          className="field-input"
                          value={selectedElement.borderStyle}
                          onChange={(event) =>
                            updateSelectedElement({
                              borderStyle: event.target.value === 'solid' ? 'solid' : 'dashed',
                            })
                          }
                        >
                          <option value="dashed">破線</option>
                          <option value="solid">実線</option>
                        </select>
                      </label>

                      {selectedElement.kind === 'image' ? (
                        <label className="field-label">
                          画像フィット
                          <select
                            className="field-input"
                            value={selectedElement.fit}
                            onChange={(event) =>
                              updateSelectedElement({
                                fit: event.target.value === 'contain' ? 'contain' : 'cover',
                              })
                            }
                          >
                            <option value="cover">塗りつぶし</option>
                            <option value="contain">全体表示</option>
                          </select>
                        </label>
                      ) : (
                        <label className="field-label">
                          枠の用途
                          <select
                            className="field-input"
                            value={selectedElement.placeholderType}
                            onChange={(event) =>
                              updateSelectedElement({
                                placeholderType: normalizePlaceholderType(event.target.value),
                              })
                            }
                          >
                            <option value="generic">フレーム</option>
                            <option value="image-slot">画像枠</option>
                            <option value="text-main">メインタイトル枠</option>
                            <option value="text-sub">サブタイトル枠</option>
                          </select>
                        </label>
                      )}
                    </div>

                    {selectedElement.kind === 'frame' &&
                    isTitlePlaceholderType(selectedElement.placeholderType) &&
                    selectedTitleTextStyle ? (
                      <div className="title-style-editor">
                        <h4>タイトル文字スタイル（編集者ビュー）</h4>
                        <div className="field-grid">
                          <label className="field-label">
                            デザインプリセット
                            <select
                              className="field-input"
                              value={selectedTitleTextStyle.presetId}
                              onChange={(event) => {
                                const presetId = event.target.value;
                                if (presetId === CUSTOM_TITLE_STYLE_PRESET_ID) return;
                                updateSelectedTitleTextStyle((current, placeholderType) => ({
                                  ...createTitleTextStyleFromPreset(placeholderType, presetId),
                                  sampleText: current.sampleText,
                                  presetId,
                                }));
                              }}
                            >
                              {TITLE_STYLE_PRESETS.map((preset) => (
                                <option key={preset.id} value={preset.id}>
                                  {preset.label}
                                </option>
                              ))}
                              <option value={CUSTOM_TITLE_STYLE_PRESET_ID}>カスタム</option>
                            </select>
                          </label>

                          <label className="field-label">
                            フォント
                            <select
                              className="field-input"
                              value={selectedTitleTextStyle.fontFamily}
                              onChange={(event) =>
                                updateSelectedTitleTextStyle((current) => ({
                                  ...current,
                                  presetId: CUSTOM_TITLE_STYLE_PRESET_ID,
                                  fontFamily: event.target.value,
                                }))
                              }
                            >
                              {!TITLE_FONT_FAMILY_OPTIONS.some(
                                (option) => option.value === selectedTitleTextStyle.fontFamily
                              ) ? (
                                <option value={selectedTitleTextStyle.fontFamily}>
                                  カスタムフォント
                                </option>
                              ) : null}
                              {TITLE_FONT_FAMILY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>

                        <div className="field-grid">
                          <label className="field-label">
                            文字色
                            <input
                              className="field-input"
                              type="color"
                              value={selectedTitleTextStyle.color}
                              onChange={(event) =>
                                updateSelectedTitleTextStyle((current) => ({
                                  ...current,
                                  presetId: CUSTOM_TITLE_STYLE_PRESET_ID,
                                  color: event.target.value,
                                }))
                              }
                            />
                          </label>
                          <label className="field-label">
                            文字サイズ
                            <input
                              className="field-input"
                              type="number"
                              min={MIN_TITLE_FONT_SIZE}
                              max={MAX_TITLE_FONT_SIZE}
                              value={selectedTitleTextStyle.fontSize}
                              onChange={(event) =>
                                updateSelectedTitleTextStyle((current) => ({
                                  ...current,
                                  presetId: CUSTOM_TITLE_STYLE_PRESET_ID,
                                  fontSize: Number(event.target.value),
                                }))
                              }
                            />
                          </label>
                          <label className="field-label">
                            太さ
                            <select
                              className="field-input"
                              value={selectedTitleTextStyle.fontWeight}
                              onChange={(event) =>
                                updateSelectedTitleTextStyle((current) => ({
                                  ...current,
                                  presetId: CUSTOM_TITLE_STYLE_PRESET_ID,
                                  fontWeight: Number(event.target.value),
                                }))
                              }
                            >
                              <option value={400}>400</option>
                              <option value={500}>500</option>
                              <option value={600}>600</option>
                              <option value={700}>700</option>
                              <option value={800}>800</option>
                              <option value={900}>900</option>
                            </select>
                          </label>
                          <label className="field-label">
                            字間
                            <input
                              className="field-input"
                              type="number"
                              step={0.1}
                              min={MIN_TITLE_LETTER_SPACING}
                              max={MAX_TITLE_LETTER_SPACING}
                              value={selectedTitleTextStyle.letterSpacing}
                              onChange={(event) =>
                                updateSelectedTitleTextStyle((current) => ({
                                  ...current,
                                  presetId: CUSTOM_TITLE_STYLE_PRESET_ID,
                                  letterSpacing: Number(event.target.value),
                                }))
                              }
                            />
                          </label>
                        </div>

                        <label className="field-label">
                          プレビュー用テキスト
                          <input
                            className="field-input"
                            type="text"
                            maxLength={80}
                            value={selectedTitleTextStyle.sampleText}
                            onChange={(event) =>
                              updateSelectedTitleTextStyle((current) => ({
                                ...current,
                                sampleText: event.target.value,
                              }))
                            }
                          />
                        </label>

                        <div className="title-style-preview">
                          <p>管理者ビュー プレビュー</p>
                          <div className="title-style-preview-surface">
                            <span
                              className="title-style-preview-text"
                              style={getTitlePreviewTextStyle(selectedTitleTextStyle)}
                            >
                              {selectedTitleTextStyle.sampleText}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="empty-message">編集する要素を選択してください。</p>
                )}
              </div>
              ) : null}
            </>
          ) : null}

          {inspectorTab === 'works' ? (
            <div className="inspector-section works-section">
            <h3>作品一覧（リアルタイム）</h3>
            <div className="works-list">
              {projects.map((project) => (
                <article key={project.id} className="work-card">
                  <div className="work-thumb">
                    {project.thumbnailRef ? (
                      <img src={project.thumbnailRef} alt={project.name} loading="lazy" />
                    ) : (
                      <span>プレビューなし</span>
                    )}
                  </div>
                  <div className="work-meta">
                    <strong>{project.name}</strong>
                    <p>テンプレート: {project.templateId}</p>
                    <p>ユーザー: {project.userId}</p>
                    <p>更新: {formatDateTime(project.updatedAt)}</p>
                  </div>
                </article>
              ))}
              {projects.length === 0 ? <p className="empty-message">作品がありません。</p> : null}
            </div>
          </div>
          ) : null}
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
