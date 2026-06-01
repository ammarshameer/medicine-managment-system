import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Configure axios base URL
  axios.defaults.baseURL = 'http://localhost:3000/api';

  useEffect(() => {
    const loadToken = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('token');
        if (storedToken) {
          setToken(storedToken);
          axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          await verifyToken(storedToken);
        }
      } catch (error) {
        console.error('Error loading token:', error);
      } finally {
        setLoading(false);
      }
    };

    loadToken();
  }, []);

  const verifyToken = async (authToken) => {
    try {
      const response = await axios.get('/auth/verify');
      setUser(response.data.data.user);
    } catch (error) {
      console.error('Token verification failed:', error);
      await logout();
    }
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post('/auth/login', { email, password });
      const { user: userData, token: authToken } = response.data.data;
      
      setUser(userData);
      setToken(authToken);
      
      await AsyncStorage.setItem('token', authToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
      
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed';
      return { success: false, message };
    }
  };

  const register = async (userData) => {
    try {
      const response = await axios.post('/auth/register', userData);
      const { user: newUser, token: authToken } = response.data.data;
      
      setUser(newUser);
      setToken(authToken);
      
      await AsyncStorage.setItem('token', authToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
      
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed';
      return { success: false, message };
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);
      setToken(null);
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const value = {
    user,
    token,
    login,
    register,
    logout,
    loading,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
