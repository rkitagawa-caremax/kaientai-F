import { useNavigate } from 'react-router-dom';
import { TemplateGrid } from '../components/templates/TemplateGrid';
import { useProjectStore } from '../store/useProjectStore';
import type { Template } from '../types/template';
import { builtInTemplates } from '../assets/templates';

export function TemplateSelectPage() {
  const setTemplate = useProjectStore((s) => s.setTemplate);
  const navigate = useNavigate();

  const handleSelect = (template: Template) => {
    const initialCanvasJSON = template.id.startsWith('blank-') ? null : template.canvasJSON;
    setTemplate(template.id, template.orientation, initialCanvasJSON);
    navigate('/new/input');
  };

  return (
    <div className="template-select-page">
      <h2>テンプレートを選択</h2>
      <p>ベースとなるフレームを選んでください</p>
      <TemplateGrid templates={builtInTemplates} onSelect={handleSelect} />
    </div>
  );
}
