import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPassword } from '../services/auth';

export function LoginPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');

    try {
      await signInWithPassword(password);
      navigate('/');
    } catch (err) {
      console.error('Login failed:', err);
      setError('パスワードが違います');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-logo">Kaientai-F</h1>
        <p className="login-subtitle">A4チラシ自動作成アプリ</p>
        <form className="login-form" onSubmit={handleLogin}>
          <input
            className="login-input"
            type="password"
            placeholder="パスワードを入力"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="login-error">{error}</p>}
          <button className="btn btn-primary btn-lg" type="submit" disabled={!password || submitting}>
            {submitting ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  );
}
