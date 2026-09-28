import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

/** Health Check API */
export const checkHealth = async () => {
  const response = await api.get('/health');
  return response.data;
};

/** Auth APIs */
export const registerApi = async (userData) => {
  const response = await api.post('/auth/register', userData);
  return response.data;
};

export const loginApi = async (credentials) => {
  const response = await api.post('/auth/login', credentials);
  return response.data;
};

export const getMeApi = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

export const testRoleApi = async (roleType) => {
  const response = await api.get(`/test/${roleType}`);
  return response.data;
};

/** Department APIs */
export const getDepartmentsApi = async () => {
  const response = await api.get('/departments');
  return response.data;
};

/** Request APIs */
export const createRequestApi = async (requestData) => {
  const response = await api.post('/requests', requestData);
  return response.data;
};

export const getMyRequestsApi = async (params = {}) => {
  const response = await api.get('/requests/my', { params });
  return response.data;
};

export const getStaffRequestsApi = async (params = {}) => {
  const response = await api.get('/requests/staff', { params });
  return response.data;
};

export const getAllRequestsApi = async (params = {}) => {
  const response = await api.get('/requests', { params });
  return response.data;
};

export const getRequestByIdApi = async (id) => {
  const response = await api.get(`/requests/${id}`);
  return response.data;
};

export const updateRequestStatusApi = async (id, status) => {
  const response = await api.patch(`/requests/${id}/status`, { status });
  return response.data;
};

export const assignRequestApi = async (id, assignData) => {
  const response = await api.patch(`/requests/${id}/assign`, assignData);
  return response.data;
};

/** AI Intelligence Layer APIs */
export const classifyRequestApi = async (requestId) => {
  const response = await api.post(`/ai/classify/${requestId}`);
  return response.data;
};

export const suggestPriorityApi = async (requestId) => {
  const response = await api.post(`/ai/suggest-priority/${requestId}`);
  return response.data;
};

export const getSimilarRequestsApi = async (requestId) => {
  const response = await api.get(`/ai/similar/${requestId}`);
  return response.data;
};

export const generateResolutionApi = async (requestId) => {
  const response = await api.post(`/ai/resolution/${requestId}`);
  return response.data;
};

/** Analytics APIs (Sprint 7) */
export const getStudentAnalyticsApi = async () => {
  const response = await api.get('/analytics/student');
  return response.data;
};

export const getStaffAnalyticsApi = async () => {
  const response = await api.get('/analytics/staff');
  return response.data;
};

export const getAdminAnalyticsApi = async (params = {}) => {
  const response = await api.get('/analytics/admin', { params });
  return response.data;
};

export default api;

