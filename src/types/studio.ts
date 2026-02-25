export type ElementKind = 'frame' | 'image';
export type FitMode = 'cover' | 'contain';
export type BorderStyle = 'solid' | 'dashed';
export type CanvasPreset = 'portrait' | 'landscape';

export interface TemplateRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TemplateElement extends TemplateRect {
  id: string;
  kind: ElementKind;
  name: string;
  src?: string;
  fit: FitMode;
  borderColor: string;
  borderWidth: number;
  borderStyle: BorderStyle;
  opacity: number;
  radius: number;
}

export interface LayoutTemplate {
  id: string;
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  elements: TemplateElement[];
  createdAt: string;
  updatedAt: string;
}

export interface StudioProjectSummary {
  id: string;
  userId: string;
  name: string;
  templateId: string;
  orientation: 'portrait' | 'landscape';
  thumbnailRef?: string;
  createdAt?: string;
  updatedAt?: string;
}
