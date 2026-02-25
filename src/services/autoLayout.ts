import * as fabric from 'fabric';
import type { InputImage, InputText } from '../types/project';
import { getCanvasDimensions, CANVAS_PADDING } from '../utils/dimensions';

interface AutoLayoutOptions {
  orientation: 'portrait' | 'landscape';
  images: InputImage[];
  texts: InputText[];
}

export async function autoLayout(
  canvas: fabric.Canvas,
  options: AutoLayoutOptions
): Promise<void> {
  const { orientation, images, texts } = options;
  const dims = getCanvasDimensions(orientation);
  const pad = CANVAS_PADDING;

  const contentWidth = dims.width - pad * 2;
  const contentHeight = dims.height - pad * 2;

  // Zone ratios
  const headings = texts.filter((t) => t.role === 'heading');
  const subheadings = texts.filter((t) => t.role === 'subheading');
  const bodies = texts.filter((t) => t.role === 'body');

  const hasHeading = headings.length > 0 || subheadings.length > 0;
  const hasImages = images.length > 0;
  const hasBody = bodies.length > 0;

  const headingRatio = hasHeading ? 0.18 : 0;
  const bodyRatio = hasBody ? 0.2 : 0;
  const imageRatio = 1 - headingRatio - bodyRatio;

  let currentY = pad;

  // Heading zone
  if (hasHeading) {
    const zoneHeight = contentHeight * headingRatio;
    let textY = currentY;

    for (const h of headings) {
      const fontSize = Math.min(48, contentWidth / (h.content.length * 0.6));
      const text = new fabric.Textbox(h.content, {
        left: pad,
        top: textY,
        width: contentWidth,
        fontSize: Math.max(fontSize, 20),
        fontFamily: 'Noto Sans JP, sans-serif',
        fill: '#1a1a2e',
        textAlign: 'center',
        fontWeight: 'bold',
      });
      (text as any).id = crypto.randomUUID();
      (text as any).elementName = h.content.substring(0, 15);
      canvas.add(text);
      textY += text.calcTextHeight() + 10;
    }

    for (const s of subheadings) {
      const text = new fabric.Textbox(s.content, {
        left: pad,
        top: textY,
        width: contentWidth,
        fontSize: 20,
        fontFamily: 'Noto Sans JP, sans-serif',
        fill: '#4a4a6a',
        textAlign: 'center',
      });
      (text as any).id = crypto.randomUUID();
      (text as any).elementName = s.content.substring(0, 15);
      canvas.add(text);
      textY += text.calcTextHeight() + 10;
    }

    currentY += zoneHeight;
  }

  // Image zone
  if (hasImages) {
    const zoneHeight = contentHeight * imageRatio;
    const gap = 16;

    if (images.length === 1) {
      await placeImage(canvas, images[0], pad, currentY, contentWidth, zoneHeight - gap);
    } else if (images.length === 2) {
      const cellWidth = (contentWidth - gap) / 2;
      await placeImage(canvas, images[0], pad, currentY, cellWidth, zoneHeight - gap);
      await placeImage(canvas, images[1], pad + cellWidth + gap, currentY, cellWidth, zoneHeight - gap);
    } else if (images.length === 3) {
      const leftWidth = contentWidth * 0.6 - gap / 2;
      const rightWidth = contentWidth * 0.4 - gap / 2;
      const halfHeight = (zoneHeight - gap * 2) / 2;
      await placeImage(canvas, images[0], pad, currentY, leftWidth, zoneHeight - gap);
      await placeImage(canvas, images[1], pad + leftWidth + gap, currentY, rightWidth, halfHeight);
      await placeImage(canvas, images[2], pad + leftWidth + gap, currentY + halfHeight + gap, rightWidth, halfHeight);
    } else {
      // Grid layout: 2 columns
      const cols = 2;
      const rows = Math.ceil(images.length / cols);
      const cellWidth = (contentWidth - gap * (cols - 1)) / cols;
      const cellHeight = (zoneHeight - gap * (rows + 1)) / rows;

      for (let i = 0; i < images.length; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = pad + col * (cellWidth + gap);
        const y = currentY + row * (cellHeight + gap);
        await placeImage(canvas, images[i], x, y, cellWidth, cellHeight);
      }
    }

    currentY += zoneHeight;
  }

  // Body zone
  if (hasBody) {
    let textY = currentY + 10;
    for (const b of bodies) {
      const text = new fabric.Textbox(b.content, {
        left: pad,
        top: textY,
        width: contentWidth,
        fontSize: 16,
        fontFamily: 'Noto Sans JP, sans-serif',
        fill: '#333333',
        lineHeight: 1.6,
      });
      (text as any).id = crypto.randomUUID();
      (text as any).elementName = b.content.substring(0, 15);
      canvas.add(text);
      textY += text.calcTextHeight() + 12;
    }
  }

  canvas.renderAll();
}

async function placeImage(
  canvas: fabric.Canvas,
  imageData: InputImage,
  x: number,
  y: number,
  maxWidth: number,
  maxHeight: number
): Promise<void> {
  try {
    const img = await fabric.FabricImage.fromURL(imageData.url, { crossOrigin: 'anonymous' });
    if (!img.width || !img.height) return;

    const scaleX = maxWidth / img.width;
    const scaleY = maxHeight / img.height;
    const scale = Math.min(scaleX, scaleY);

    img.scale(scale);
    img.set({
      left: x + (maxWidth - img.width * scale) / 2,
      top: y + (maxHeight - img.height * scale) / 2,
    });
    (img as any).id = crypto.randomUUID();
    (img as any).elementName = imageData.originalName.substring(0, 15);

    canvas.add(img);
  } catch (err) {
    console.error('Failed to load image:', err);
  }
}
