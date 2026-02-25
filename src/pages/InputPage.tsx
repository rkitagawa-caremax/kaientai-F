import { useNavigate } from 'react-router-dom';
import { ImageUploader } from '../components/input/ImageUploader';
import { TextInputForm } from '../components/input/TextInputForm';
import { useProjectStore } from '../store/useProjectStore';

export function InputPage() {
  const { inputImages, inputTexts, templateId, canvasJSON } = useProjectStore();
  const navigate = useNavigate();

  if (!templateId) {
    navigate('/new');
    return null;
  }

  const canProceed = !!canvasJSON || inputImages.length > 0 || inputTexts.length > 0;

  const handleAutoCreate = () => {
    navigate('/editor');
  };

  return (
    <div className="input-page">
      <h2>コンテンツを追加</h2>
      <p>チラシに載せる画像やテキストを追加してください</p>

      <div className="input-sections">
        <ImageUploader />
        <TextInputForm />
      </div>

      <div className="input-actions">
        <button className="btn btn-outline" onClick={() => navigate('/new')}>
          戻る
        </button>
        <button
          className="btn btn-primary btn-lg"
          disabled={!canProceed}
          onClick={handleAutoCreate}
        >
          自動作成
        </button>
      </div>
    </div>
  );
}
