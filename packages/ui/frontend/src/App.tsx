import React, { useState, useEffect, createContext, useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, AuthContext } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SoulManager from './pages/SoulManager';
import MemoryManager from './pages/MemoryManager';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useContext(AuthContext);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

const AppContent: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/soul" element={<SoulManager />} />
                <Route path="/memory" element={<MemoryManager />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
