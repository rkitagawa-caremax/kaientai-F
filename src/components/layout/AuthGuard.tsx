import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { onAuthChange } from '../../services/auth';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, setUser } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthChange((u) => {
      setUser(u);
      if (!u) navigate('/login');
    });
    return unsubscribe;
  }, [setUser, navigate]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>読み込み中...</p>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
