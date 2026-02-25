import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { AuthGuard } from './components/layout/AuthGuard';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { TemplateSelectPage } from './pages/TemplateSelectPage';
import { InputPage } from './pages/InputPage';
import { EditorPage } from './pages/EditorPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <AuthGuard>
        <AppShell />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'new', element: <TemplateSelectPage /> },
      { path: 'new/input', element: <InputPage /> },
      { path: 'editor/:projectId?', element: <EditorPage /> },
    ],
  },
]);
