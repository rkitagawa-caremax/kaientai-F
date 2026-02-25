import { jsPDF } from 'jspdf';
import type * as fabric from 'fabric';

export function exportToPdf(
  canvas: fabric.Canvas,
  orientation: 'portrait' | 'landscape'
): void {
  // Deselect all objects
  canvas.discardActiveObject();
  canvas.renderAll();

  // Export at high resolution
  const multiplier = 300 / 96;
  const dataUrl = canvas.toDataURL({
    format: 'png',
    quality: 1.0,
    multiplier,
  });

  const pdf = new jsPDF({
    orientation: orientation === 'portrait' ? 'p' : 'l',
    unit: 'mm',
    format: 'a4',
  });

  const pdfWidth = orientation === 'portrait' ? 210 : 297;
  const pdfHeight = orientation === 'portrait' ? 297 : 210;

  pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
  pdf.save('flyer.pdf');
}
