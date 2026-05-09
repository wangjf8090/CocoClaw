import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

interface User {
  username: string;
  role: string;
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isAuthenticated: false,
  login: async () => false,
  logout: () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
        setIsAuthenticated(true);
      }
    }
  }, [token]);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await axios.post('/api/auth/login', { username, password });

      if (response.data.success) {
        const { accessToken, user } = response.data.data;
        setToken(accessToken);
        setUser(user);
        setIsAuthenticated(true);
        localStorage.setItem('token', accessToken);
        localStorage.setItem('user', JSON.stringify(user));
        axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
