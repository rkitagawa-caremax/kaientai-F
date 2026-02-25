import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useProjectStore } from '../store/useProjectStore';
import { getUserProjects, deleteProject } from '../services/firestore';
import type { Project } from '../types/project';

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const reset = useProjectStore((s) => s.reset);
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getUserProjects(user.uid)
      .then(setProjects)
      .catch((err) => {
        console.error('Failed to load projects:', err);
        setProjects([]);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const handleNewFlyer = () => {
    reset();
    navigate('/new');
  };

  const handleOpenProject = (project: Project) => {
    navigate(`/editor/${project.id}`);
  };

  const handleDelete = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (!confirm('このプロジェクトを削除しますか？')) return;
    await deleteProject(projectId);
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h2>マイプロジェクト</h2>
        <button className="btn btn-primary" onClick={handleNewFlyer}>
          + 新規作成
        </button>
      </div>

      {loading ? (
        <p>読み込み中...</p>
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <p>まだプロジェクトがありません</p>
          <button className="btn btn-primary" onClick={handleNewFlyer}>
            最初のチラシを作成する
          </button>
        </div>
      ) : (
        <div className="project-grid">
          {projects.map((project) => (
            <div
              key={project.id}
              className="project-card"
              onClick={() => handleOpenProject(project)}
            >
              <div className="project-card-preview">
                <span>{project.orientation === 'portrait' ? '縦' : '横'}</span>
              </div>
              <div className="project-card-info">
                <h3>{project.name}</h3>
                <p>{project.updatedAt?.toDate?.()?.toLocaleDateString('ja-JP') ?? ''}</p>
              </div>
              <button
                className="btn btn-outline btn-sm project-delete"
                onClick={(e) => handleDelete(e, project.id)}
              >
                削除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
