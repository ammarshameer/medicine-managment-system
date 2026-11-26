import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const AuthContext = createContext();

const PLATFORM_ROLES = ['SUPER_ADMIN', 'SUPPORT'];

const applyBusinessHeader = (businessId) => {
  if (businessId) {
    axios.defaults.headers.common['X-Business-Id'] = String(businessId);
  } else {
    delete axios.defaults.headers.common['X-Business-Id'];
  }
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeBusinessId, setActiveBusinessId] = useState(null);
  const [businesses, setBusinesses] = useState([]);

  const refreshBusinesses = async () => {
    try {
      const response = await axios.get('/api/super-admin/businesses', {
        params: { limit: 100 }
      });
      setBusinesses(response.data?.data?.businesses || []);
    } catch (error) {
      console.error('Failed to load businesses:', error);
      setBusinesses([]);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const storedId = parseInt(localStorage.getItem('activeBusinessId'), 10);
      if (Number.isInteger(storedId) && storedId > 0) {
        setActiveBusinessId(storedId);
        applyBusinessHeader(storedId);
      }
      verifyToken();
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async () => {
    try {
      const response = await axios.get('/api/auth/verify');
      const verifiedUser = response.data.data.user;
      setUser(verifiedUser);
      if (PLATFORM_ROLES.includes(verifiedUser.role)) {
        refreshBusinesses();
      } else {
        // Never let a platform switcher selection leak into a business account.
        localStorage.removeItem('activeBusinessId');
        setActiveBusinessId(null);
        applyBusinessHeader(null);
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('activeBusinessId');
      delete axios.defaults.headers.common['Authorization'];
      applyBusinessHeader(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post('/api/auth/login', { email, password });
      const { user: loggedInUser, token } = response.data.data;

      localStorage.setItem('token', token);
      localStorage.removeItem('activeBusinessId');
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      applyBusinessHeader(null);
      setActiveBusinessId(null);
      setBusinesses([]);
      setUser(loggedInUser);

      if (PLATFORM_ROLES.includes(loggedInUser.role)) {
        refreshBusinesses();
      }

      toast.success('Login successful');
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  const selectBusiness = (businessId) => {
    const id = parseInt(businessId, 10);
    if (Number.isInteger(id) && id > 0) {
      localStorage.setItem('activeBusinessId', String(id));
      applyBusinessHeader(id);
      setActiveBusinessId(id);
      toast.success('Business context switched');
    } else {
      localStorage.removeItem('activeBusinessId');
      applyBusinessHeader(null);
      setActiveBusinessId(null);
      toast.success('Platform view restored');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('activeBusinessId');
    delete axios.defaults.headers.common['Authorization'];
    applyBusinessHeader(null);
    setActiveBusinessId(null);
    setBusinesses([]);
    setUser(null);
    toast.success('Logged out successfully');
  };

  const activeBusiness = businesses.find(
    (business) => business.BusinessId === activeBusinessId
  ) || null;

  const value = {
    user,
    login,
    logout,
    loading,
    isAuthenticated: !!user,
    isPlatformAdmin: PLATFORM_ROLES.includes(user?.role),
    activeBusinessId,
    activeBusiness,
    businesses,
    selectBusiness,
    refreshBusinesses
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
