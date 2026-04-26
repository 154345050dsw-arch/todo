const TOKEN_KEY = 'flowdesk-token';
export const API_BASE_KEY = 'flowdesk-api-base-url';

const DEFAULT_API_BASE_URL = normalizeApiBase(import.meta.env.VITE_API_BASE_URL || '');

export function isDesktopApp() {
  return import.meta.env.VITE_DESKTOP === 'true';
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function normalizeApiBase(value = '') {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  return trimmed.replace(/\/+$/, '').replace(/\/api(?:\/health)?$/i, '');
}

export function isValidApiBaseUrl(value) {
  const normalized = normalizeApiBase(value);
  if (!normalized) return false;
  try {
    const url = new URL(normalized);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

export function getApiBaseUrl() {
  const stored = localStorage.getItem(API_BASE_KEY);
  return normalizeApiBase(stored === null ? DEFAULT_API_BASE_URL : stored);
}

export function setApiBaseUrl(value) {
  const previous = getApiBaseUrl();
  const normalized = normalizeApiBase(value);

  if (normalized) {
    localStorage.setItem(API_BASE_KEY, normalized);
  } else {
    localStorage.removeItem(API_BASE_KEY);
  }

  if (previous !== normalized) {
    setToken(null);
    window.dispatchEvent(new CustomEvent('flowdesk:api-base-changed', { detail: { apiBaseUrl: normalized } }));
  }

  return normalized;
}

export async function apiRequest(path, options = {}) {
  const {
    apiBaseUrl,
    headers: customHeaders,
    skipAuth = false,
    ...fetchOptions
  } = options;
  const baseUrl = normalizeApiBase(apiBaseUrl ?? getApiBaseUrl());
  const requestPath = path.startsWith('/') ? path : `/${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(customHeaders || {}),
  };
  const token = skipAuth ? null : getToken();
  if (token) {
    headers.Authorization = `Token ${token}`;
  }

  let response;
  try {
    response = await fetch(`${baseUrl}${requestPath}`, {
      ...fetchOptions,
      headers,
    });
  } catch {
    throw new Error('无法连接服务器，请检查服务器地址、网络连接或后端 CORS 配置。');
  }

  if (response.status === 401) {
    setToken(null);
    window.dispatchEvent(new CustomEvent('flowdesk:unauthorized'));
  }

  const text = await response.text();
  const contentType = response.headers.get('content-type') || '';
  let data = null;
  if (text && contentType.includes('application/json')) {
    data = JSON.parse(text);
  }

  if (!response.ok) {
    const message = data?.detail || data?.error || (text.startsWith('<!DOCTYPE') ? `服务器返回 ${response.status}，请检查后端错误日志。` : text || '请求失败');
    throw new Error(message);
  }

  if (text && !data) {
    throw new Error('接口返回了非 JSON 内容，请检查后端服务或代理配置。');
  }

  return data;
}

export const api = {
  health(apiBaseUrl) {
    return apiRequest('/api/health/', { skipAuth: true, apiBaseUrl });
  },
  login(payload) {
    return apiRequest('/api/auth/login/', { method: 'POST', skipAuth: true, body: JSON.stringify(payload) });
  },
  me() {
    return apiRequest('/api/auth/me/');
  },
  meta() {
    return apiRequest('/api/meta/');
  },
  dashboard() {
    return apiRequest('/api/dashboard/');
  },
  dailyActivity(params = {}) {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== '')).toString();
    return apiRequest(`/api/stats/daily-activity/${query ? `?${query}` : ''}`);
  },
  tasks(params = {}) {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== '')).toString();
    return apiRequest(`/api/tasks/${query ? `?${query}` : ''}`);
  },
  createTask(payload) {
    return apiRequest('/api/tasks/', { method: 'POST', body: JSON.stringify(payload) });
  },
  task(id) {
    return apiRequest(`/api/tasks/${id}/`);
  },
  patchTask(id, payload) {
    return apiRequest(`/api/tasks/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) });
  },
  taskAction(id, payload) {
    return apiRequest(`/api/tasks/${id}/actions/`, { method: 'POST', body: JSON.stringify(payload) });
  },
  remindTask(id, payload) {
    return apiRequest(`/api/tasks/${id}/reminders/`, { method: 'POST', body: JSON.stringify(payload) });
  },
  comment(id, content) {
    return apiRequest(`/api/tasks/${id}/comments/`, { method: 'POST', body: JSON.stringify({ content }) });
  },
  notifications(params = {}) {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== '')).toString();
    return apiRequest(`/api/notifications/${query ? `?${query}` : ''}`);
  },
  markNotificationRead(id) {
    return apiRequest(`/api/notifications/${id}/read/`, { method: 'POST', body: JSON.stringify({}) });
  },
  // 组织管理 API
  departmentTree() {
    return apiRequest('/api/org/departments/tree/');
  },
  inactiveDepartments() {
    return apiRequest('/api/org/departments/inactive/');
  },
  createDepartment(payload) {
    return apiRequest('/api/org/departments/', { method: 'POST', body: JSON.stringify(payload) });
  },
  updateDepartment(id, payload) {
    return apiRequest(`/api/org/departments/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) });
  },
  deactivateDepartment(id) {
    return apiRequest(`/api/org/departments/${id}/deactivate/`, { method: 'POST', body: JSON.stringify({}) });
  },
  activateDepartment(id) {
    return apiRequest(`/api/org/departments/${id}/activate/`, { method: 'POST', body: JSON.stringify({}) });
  },
  orgUsers(params = {}) {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== '')).toString();
    return apiRequest(`/api/org/users/${query ? `?${query}` : ''}`);
  },
  createOrgUser(payload) {
    return apiRequest('/api/org/users/', { method: 'POST', body: JSON.stringify(payload) });
  },
  updateOrgUser(id, payload) {
    return apiRequest(`/api/org/users/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) });
  },
  deactivateOrgUser(id) {
    return apiRequest(`/api/org/users/${id}/deactivate/`, { method: 'POST', body: JSON.stringify({}) });
  },
  activateOrgUser(id) {
    return apiRequest(`/api/org/users/${id}/activate/`, { method: 'POST', body: JSON.stringify({}) });
  },
  resetUserPassword(id, payload) {
    return apiRequest(`/api/org/users/${id}/reset-password/`, { method: 'POST', body: JSON.stringify(payload) });
  },
  deleteOrgUser(id) {
    return apiRequest(`/api/org/users/${id}/delete/`, { method: 'DELETE' });
  },
  transferUserTasks(id, payload) {
    return apiRequest(`/api/org/users/${id}/transfer-tasks/`, { method: 'POST', body: JSON.stringify(payload) });
  },
};
