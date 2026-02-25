import * as fabric from 'fabric';

type CanvasObjectLike = Record<string, any>;

async function canDecodeImage(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

async function sanitizeCanvasObject(obj: CanvasObjectLike): Promise<CanvasObjectLike | null> {
  if (obj.type === 'image' && typeof obj.src === 'string') {
    const ok = await canDecodeImage(obj.src);
    return ok ? obj : null;
  }

  if (obj.type === 'group' && Array.isArray(obj.objects)) {
    const children = await Promise.all(obj.objects.map(sanitizeCanvasObject));
    return {
      ...obj,
      objects: children.filter((child): child is CanvasObjectLike => child !== null),
    };
  }

  return obj;
}

export function addTextObject(
  canvas: fabric.Canvas,
  text: string,
  options?: Partial<fabric.TOptions<fabric.TextboxProps>>
): fabric.Textbox {
  const textObj = new fabric.Textbox(text, {
    left: 100,
    top: 100,
    fontSize: 24,
    fontFamily: 'Noto Sans JP, sans-serif',
    fill: '#333333',
    width: 300,
    ...options,
  });
  (textObj as any).id = crypto.randomUUID();
  (textObj as any).elementName = text.substring(0, 20);
  canvas.add(textObj);
  canvas.setActiveObject(textObj);
  canvas.renderAll();
  return textObj;
}

export async function addImageObject(
  canvas: fabric.Canvas,
  url: string,
  options?: { left?: number; top?: number; scaleToWidth?: number }
): Promise<fabric.FabricImage> {
  const img = await fabric.FabricImage.fromURL(url, { crossOrigin: 'anonymous' });
  (img as any).id = crypto.randomUUID();
  (img as any).elementName = 'Image';

  if (options?.scaleToWidth && img.width) {
    const scale = options.scaleToWidth / img.width;
    img.scale(scale);
  }

  img.set({
    left: options?.left ?? 100,
    top: options?.top ?? 100,
  });

  canvas.add(img);
  canvas.setActiveObject(img);
  canvas.renderAll();
  return img;
}

export function getObjectById(canvas: fabric.Canvas, id: string): fabric.FabricObject | undefined {
  return canvas.getObjects().find((obj) => (obj as any).id === id);
}

export function serializeCanvas(canvas: fabric.Canvas): string {
  return JSON.stringify(canvas.toObject(['id', 'elementName']));
}

export async function deserializeCanvas(canvas: fabric.Canvas, json: string): Promise<void> {
  try {
    await canvas.loadFromJSON(json);
    canvas.renderAll();
  } catch (err) {
    console.warn('Canvas JSON load failed. Retrying without broken image objects.', err);
    const parsed = JSON.parse(json) as { objects?: CanvasObjectLike[] } & Record<string, unknown>;
    if (!Array.isArray(parsed.objects)) {
      throw err;
    }
    const sanitizedObjects = await Promise.all(parsed.objects.map(sanitizeCanvasObject));
    const fallbackJSON = JSON.stringify({
      ...parsed,
      objects: sanitizedObjects.filter((obj): obj is CanvasObjectLike => obj !== null),
    });
    await canvas.loadFromJSON(fallbackJSON);
    canvas.renderAll();
  }
}
