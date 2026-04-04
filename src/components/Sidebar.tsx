import { Brain, FolderKanban, LayoutDashboard, Moon, Network, LogOut, Sun } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const navigation = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/topics', label: 'AI Tree', icon: Brain },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/graph',     label: 'Graph',     icon: Network }
];

export function Sidebar() {
  const { signOut, session } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="sidebar glass-card">
      <div>
        <div className="sidebar-brand">
          <div className="brand-icon">L</div>
          <div>
            <strong>MindForge</strong>
            <p>{session?.user.email}</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="sidebar-footer">
        <button
          className="secondary-button sidebar-theme-toggle"
          type="button"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </button>

        <button className="secondary-button sidebar-logout" onClick={() => void signOut()}>
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
