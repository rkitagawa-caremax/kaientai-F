import { useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import type { InputText } from '../../types/project';

export function TextInputForm() {
  const { inputTexts, addInputText, updateInputText, removeInputText } = useProjectStore();
  const [newText, setNewText] = useState('');
  const [newRole, setNewRole] = useState<InputText['role']>('body');

  const handleAdd = () => {
    if (!newText.trim()) return;
    addInputText({
      id: crypto.randomUUID(),
      content: newText.trim(),
      role: newRole,
    });
    setNewText('');
  };

  return (
    <div className="text-input-form">
      <h3>テキストを追加</h3>

      <div className="text-add-row">
        <select value={newRole} onChange={(e) => setNewRole(e.target.value as InputText['role'])}>
          <option value="heading">見出し</option>
          <option value="subheading">小見出し</option>
          <option value="body">本文</option>
        </select>
        <input
          type="text"
          placeholder="テキストを入力..."
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button className="btn btn-primary" onClick={handleAdd}>
          追加
        </button>
      </div>

      {inputTexts.length > 0 && (
        <div className="text-list">
          {inputTexts.map((t) => (
            <div key={t.id} className="text-list-item">
              <span className={`text-role-badge role-${t.role}`}>
                {t.role === 'heading' ? '見出し' : t.role === 'subheading' ? '小見出し' : '本文'}
              </span>
              <input
                type="text"
                value={t.content}
                onChange={(e) => updateInputText(t.id, { content: e.target.value })}
              />
              <button className="btn btn-sm" onClick={() => removeInputText(t.id)}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
