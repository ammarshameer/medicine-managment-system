import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const AuthContext = createContext();

const PLATFORM_ROLES = ['SUPER_ADMIN', 'SUPPORT'];
const REMEMBER_TOKEN_KEY = 'mmsPlatformRememberToken';
const REMEMBER_EMAIL_KEY = 'mmsPlatformRememberEmail';

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

  const loadCurrentUser = async () => {
    const response = await axios.get('/api/auth/verify');
    const verified = response.data.data.user;
    setUser(verified);
    if (PLATFORM_ROLES.includes(verified.role)) {
      refreshBusinesses();
    } else {
      // Never let a platform switcher selection leak into a business account.
      localStorage.removeItem('activeBusinessId');
      setActiveBusinessId(null);
      applyBusinessHeader(null);
    }
    return verified;
  };

  // Session restore is intentionally a mount-only operation.
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const storedId = parseInt(localStorage.getItem('activeBusinessId'), 10);
      if (Number.isInteger(storedId) && storedId > 0) {
        setActiveBusinessId(storedId);
        applyBusinessHeader(storedId);
      }
      loadCurrentUser()
        .catch(() => {
          localStorage.removeItem('token');
          delete axios.defaults.headers.common['Authorization'];
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Installs a token issued by /auth/login or the one-click support endpoint.
  // `remember` persists a dedicated platform session token, never a password.
  const loginWithToken = async (token, options = {}) => {
    localStorage.setItem('token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    if (options.remember) {
      localStorage.setItem(REMEMBER_TOKEN_KEY, token);
      if (options.email) localStorage.setItem(REMEMBER_EMAIL_KEY, options.email);
    }

    const businessId = parseInt(options.activeBusinessId, 10);
    if (Number.isInteger(businessId) && businessId > 0) {
      localStorage.setItem('activeBusinessId', String(businessId));
      applyBusinessHeader(businessId);
      setActiveBusinessId(businessId);
    } else if (options.clearBusiness) {
      localStorage.removeItem('activeBusinessId');
      applyBusinessHeader(null);
      setActiveBusinessId(null);
    }

    try {
      const verified = await loadCurrentUser();
      return { success: true, user: verified };
    } catch (error) {
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
      if (options.remember) {
        localStorage.removeItem(REMEMBER_TOKEN_KEY);
        localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }
      return { success: false, message: error.response?.data?.message || 'Session verification failed' };
    }
  };

  const restorePlatformSession = async () => {
    const remembered = localStorage.getItem(REMEMBER_TOKEN_KEY);
    if (!remembered) return false;
    const result = await loginWithToken(remembered, { clearBusiness: true });
    const platformSession = result.success && PLATFORM_ROLES.includes(result.user?.role);
    if (!platformSession) {
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
      localStorage.removeItem(REMEMBER_TOKEN_KEY);
      localStorage.removeItem(REMEMBER_EMAIL_KEY);
      setUser(null);
      return false;
    }
    return true;
  };

  const forgetPlatformSession = () => {
    localStorage.removeItem(REMEMBER_TOKEN_KEY);
    localStorage.removeItem(REMEMBER_EMAIL_KEY);
  };

  const getRememberedPlatformEmail = () => localStorage.getItem(REMEMBER_EMAIL_KEY) || '';

  const login = async (email, password, options = {}) => {
    try {
      const response = await axios.post('/api/auth/login', {
        email,
        password,
        remember: Boolean(options.remember)
      });
      const { token } = response.data.data;
      const result = await loginWithToken(token, {
        remember: options.remember,
        email,
        clearBusiness: true
      });
      if (!result.success) throw new Error(result.message);

      toast.success('Login successful');
      return { success: true, user: result.user };
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Login failed';
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
    loginWithToken,
    logout,
    loading,
    isAuthenticated: !!user,
    isPlatformAdmin: PLATFORM_ROLES.includes(user?.role),
    activeBusinessId,
    activeBusiness,
    businesses,
    selectBusiness,
    refreshBusinesses,
    restorePlatformSession,
    forgetPlatformSession,
    getRememberedPlatformEmail
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
