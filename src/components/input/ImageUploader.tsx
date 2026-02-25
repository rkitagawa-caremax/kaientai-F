import { useCallback, useRef } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { readFileAsDataURL, getImageDimensions } from '../../utils/fileUtils';

export function ImageUploader() {
  const { inputImages, addInputImage, removeInputImage } = useProjectStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList) => {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        const url = await readFileAsDataURL(file);
        const dims = await getImageDimensions(url);
        addInputImage({
          id: crypto.randomUUID(),
          file,
          url,
          originalName: file.name,
          width: dims.width,
          height: dims.height,
        });
      }
    },
    [addInputImage]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="image-uploader">
      <h3>画像をアップロード</h3>
      <div className="drop-zone" onDrop={handleDrop} onDragOver={handleDragOver}>
        <p>ここに画像をドラッグ＆ドロップ</p>
        <p>または</p>
        <button className="btn btn-outline" onClick={() => fileInputRef.current?.click()}>
          ファイルを選択
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {inputImages.length > 0 && (
        <div className="image-preview-list">
          {inputImages.map((img) => (
            <div key={img.id} className="image-preview-item">
              <img src={img.url} alt={img.originalName} />
              <span>{img.originalName}</span>
              <button className="btn btn-sm" onClick={() => removeInputImage(img.id)}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
