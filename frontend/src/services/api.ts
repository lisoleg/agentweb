/**
 * API Service Layer
 * Axios configuration and API calls
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { decodeToken, extractTokenFromHeader } from './auth';

// API base URL from environment
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

// Create Axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle errors
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // Return data directly if response format matches { code, data, message }
    if (response.data && typeof response.data.code !== 'undefined') {
      if (response.data.code === 0) {
        return response.data;
      } else {
        return Promise.reject(new Error(response.data.message || 'Request failed'));
      }
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// =============== Auth API ===============

export interface LoginRequest {
  username: string;
  password?: string;
  did?: string;
}

export interface RegisterRequest {
  username: string;
  email?: string;
  password?: string;
}

export interface AuthResponse {
  user: {
    id: string;
    username: string;
    email?: string;
    did?: string;
  };
  token: string;
  refreshToken: string;
}

export const authAPI = {
  login: (data: LoginRequest) => apiClient.post('/auth/login', data),
  register: (data: RegisterRequest) => apiClient.post('/auth/register', data),
  logout: () => apiClient.post('/auth/logout'),
  getProfile: () => apiClient.get('/auth/profile'),
};

// =============== DID API ===============

export interface DIDDocument {
  '@context': string | string[];
  id: string;
  controller?: string | string[];
  verificationMethod?: any[];
  authentication?: string[];
  service?: any[];
  created?: string;
  updated?: string;
}

export const didAPI = {
  create: (userId: string) => apiClient.post('/did/create', { userId }),
  resolve: (did: string) => apiClient.get(`/did/resolve/${encodeURIComponent(did)}`),
  update: (did: string, document: Partial<DIDDocument>) =>
    apiClient.post('/did/update', { did, document }),
  verify: (did: string, challenge: string, signature: string) =>
    apiClient.get(`/did/verify/${encodeURIComponent(did)}`, {
      params: { challenge, signature },
    }),
  getMyDID: () => apiClient.get('/did/my'),
};

// =============== VC API ===============

export const vcAPI = {
  issue: (data: any) => apiClient.post('/vc/issue', data),
  verify: (vc: any) => apiClient.post('/vc/verify', { vc }),
  list: (did: string) => apiClient.get(`/vc/list/${encodeURIComponent(did)}`),
  revoke: (vcId: string) => apiClient.post(`/vc/revoke/${vcId}`),
};

// =============== Phi API ===============

export const phiAPI = {
  calculate: (data: any) => apiClient.post('/phi/calculate', data),
  getHistory: (userId: string) => apiClient.get(`/phi/history/${userId}`),
  getDistribution: () => apiClient.get('/phi/distribution'),
};

// =============== Agent API ===============

export const agentAPI = {
  register: (data: any) => apiClient.post('/agent/register', data),
  list: () => apiClient.get('/agent/list'),
  get: (agentId: string) => apiClient.get(`/agent/${agentId}`),
  update: (agentId: string, data: any) => apiClient.post('/agent/update', { agentId, ...data }),
};

// =============== News API ===============

export const newsAPI = {
  getFeed: () => apiClient.get('/news/feed'),
  publish: (data: any) => apiClient.post('/news/publish', data),
  interact: (contentId: string, type: string, data: any) =>
    apiClient.post('/news/interact', { contentId, type, data }),
};

// =============== Governance API ===============

export const governanceAPI = {
  propose: (description: string, calldata: string) =>
    apiClient.post('/governance/propose', { description, calldata }),
  vote: (proposalId: string, support: boolean) =>
    apiClient.post('/governance/vote', { proposalId, support }),
  list: () => apiClient.get('/governance/list'),
  get: (proposalId: string) => apiClient.get(`/governance/${proposalId}`),
};

export default apiClient;
