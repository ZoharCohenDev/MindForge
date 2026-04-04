import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { AuthGate } from './components/AuthGate';
import { useAuth } from './context/AuthContext';
import { DashboardPage } from './pages/DashboardPage';
import { GraphPage } from './pages/GraphPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { TopicsPage } from './pages/TopicsPage';

function ProtectedRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/topics" element={<TopicsPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/graph" element={<GraphPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  const { session } = useAuth();

  return <BrowserRouter>{session ? <ProtectedRoutes /> : <AuthGate />}</BrowserRouter>;
}
