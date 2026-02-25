import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type * as fabric from 'fabric';

export async function exportToExcel(
  canvas: fabric.Canvas,
  projectName: string
): Promise<void> {
  canvas.discardActiveObject();
  canvas.renderAll();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('チラシ内容');

  sheet.columns = [
    { header: '要素タイプ', key: 'type', width: 15 },
    { header: '内容', key: 'content', width: 50 },
    { header: 'X座標', key: 'x', width: 10 },
    { header: 'Y座標', key: 'y', width: 10 },
    { header: '幅', key: 'width', width: 10 },
    { header: '高さ', key: 'height', width: 10 },
    { header: 'フォント', key: 'font', width: 20 },
    { header: '色', key: 'color', width: 12 },
  ];

  // Style header row
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' },
  };
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  canvas.getObjects().forEach((obj) => {
    if (obj.type === 'textbox' || obj.type === 'i-text') {
      const textObj = obj as fabric.Textbox;
      sheet.addRow({
        type: 'テキスト',
        content: textObj.text,
        x: Math.round(obj.left ?? 0),
        y: Math.round(obj.top ?? 0),
        width: Math.round(obj.getScaledWidth()),
        height: Math.round(obj.getScaledHeight()),
        font: textObj.fontFamily,
        color: typeof textObj.fill === 'string' ? textObj.fill : '',
      });
    } else if (obj.type === 'image') {
      sheet.addRow({
        type: '画像',
        content: (obj as any).elementName ?? 'Image',
        x: Math.round(obj.left ?? 0),
        y: Math.round(obj.top ?? 0),
        width: Math.round(obj.getScaledWidth()),
        height: Math.round(obj.getScaledHeight()),
        font: '',
        color: '',
      });
    }
  });

  // Add preview sheet with canvas image
  try {
    const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 0.5 });
    const base64 = dataUrl.split(',')[1];
    const imageId = workbook.addImage({ base64, extension: 'png' });
    const previewSheet = workbook.addWorksheet('プレビュー');
    previewSheet.addImage(imageId, 'A1:J30');
  } catch (err) {
    console.error('Failed to add preview image:', err);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, `${projectName}.xlsx`);
}
