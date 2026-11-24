import axios from 'axios';
import { Platform } from 'react-native';

// Single source of truth for the backend URL, also used by AuthContext.
export const API_BASE_URL = Platform.OS === 'android'
  ? 'http://10.0.2.2:5000/api'
  : 'http://localhost:5000/api';

axios.defaults.baseURL = API_BASE_URL;

// Catalog routes require authentication; always send the JWT explicitly as well
// as via axios defaults so a screen never depends on provider init order.
export const authHeaders = (token) => (token ? { Authorization: `Bearer ${token}` } : {});

// Backend stores uploads as ./uploads/... relative to the API origin.
export const resolveImageUri = (imagePath) => {
  if (!imagePath) return null;
  if (/^(https?:|file:|data:|content:)/i.test(imagePath)) return imagePath;

  const origin = API_BASE_URL.replace(/\/api\/?$/, '');
  const cleanPath = String(imagePath).replace(/^\.?\//, '');
  const uploadPath = cleanPath.startsWith('uploads/') ? cleanPath : `uploads/${cleanPath}`;
  return `${origin}/${uploadPath}`;
};

export const getStockStatus = (stock) => {
  const quantity = Number(stock) || 0;
  if (quantity <= 0) return 'out';
  if (quantity <= 10) return 'low';
  return 'in';
};
