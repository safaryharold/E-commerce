import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
    
    // Check for session_id in URL fragment (Google OAuth callback)
    const hash = window.location.hash;
    if (hash && hash.includes('session_id=')) {
      const sessionId = hash.split('session_id=')[1].split('&')[0];
      processGoogleAuth(sessionId);
    }
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token') || getCookie('session_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true
      });
      setUser(response.data.user);
    } catch (error) {
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  };

  const processGoogleAuth = async (sessionId) => {
    try {
      setLoading(true);
      const response = await axios.post(
        `${API}/auth/session`,
        {},
        { 
          headers: { 'X-Session-ID': sessionId },
          withCredentials: true 
        }
      );

      const { session_token, user } = response.data;
      
      // Store in cookie
      document.cookie = `session_token=${session_token}; path=/; max-age=${7*24*60*60}; secure; samesite=none`;
      
      setUser(user);
      
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Redirect to main app
      window.location.href = '/';
    } catch (error) {
      console.error('Google auth error:', error);
      window.location.href = '/login';
    } finally {
      setLoading(false);
    }
  };

  const register = async (email, password, name) => {
    const response = await axios.post(`${API}/auth/register`, { email, password, name });
    const { token, user } = response.data;
    localStorage.setItem('token', token);
    setUser(user);
    return user;
  };

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    const { token, user } = response.data;
    localStorage.setItem('token', token);
    setUser(user);
    return user;
  };

  const loginWithGoogle = () => {
    const redirectUrl = `${window.location.origin}/`;
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
    } catch (error) {
      console.error('Logout error:', error);
    }
    localStorage.removeItem('token');
    document.cookie = 'session_token=; path=/; max-age=0';
    setUser(null);
    navigate('/login');
  };

  const getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  };

  const getAuthHeader = () => {
    const token = localStorage.getItem('token') || getCookie('session_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const value = {
    user,
    loading,
    register,
    login,
    loginWithGoogle,
    logout,
    getAuthHeader
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}