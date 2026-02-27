import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { signOut } from '../../services/auth';

export function Header() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <h1 className="app-logo" onClick={() => navigate('/')}>
          Kaientai-F
        </h1>
      </div>
      <div className="header-right">
        {user && (
          <>
            <span className="user-name">{user.displayName ?? 'ユーザー'}</span>
            <button className="btn btn-outline" onClick={handleSignOut}>
              ログアウト
            </button>
          </>
        )}
      </div>
    </header>
  );
}
