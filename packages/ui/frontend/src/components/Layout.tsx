import React, { useContext, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Brain,
  Database,
  Settings,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  Bot
} from 'lucide-react';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { isDark, toggleTheme } = useContext(ThemeContext);
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'SOUL', href: '/soul', icon: Brain },
    { name: 'Memory', href: '/memory', icon: Database }
  ];

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 flex flex-col`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-soul-500 rounded-lg flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            {sidebarOpen && (
              <span className="font-bold text-xl bg-gradient-to-r from-primary-600 to-soul-600 bg-clip-text text-transparent">
                SelfClaw
              </span>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="ml-auto p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {sidebarOpen ? (
              <X className="w-5 h-5 text-gray-500" />
            ) : (
              <Menu className="w-5 h-5 text-gray-500" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="font-medium">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            {sidebarOpen && <span className="font-medium">{isDark ? 'Light' : 'Dark'}</span>}
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
          >
            <LogOut className="w-5 h-5" />
            {sidebarOpen && <span className="font-medium">Logout</span>}
          </button>

          {sidebarOpen && user && (
            <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
              Logged in as <span className="font-medium text-gray-700 dark:text-gray-300">{user.username}</span>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
