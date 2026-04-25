const TOKEN_KEY = 'flowdesk-token';

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

export async function apiRequest(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const token = getToken();
  if (token) {
    headers.Authorization = `Token ${token}`;
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

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
  register(payload) {
    return apiRequest('/api/auth/register/', { method: 'POST', body: JSON.stringify(payload) });
  },
  login(payload) {
    return apiRequest('/api/auth/login/', { method: 'POST', body: JSON.stringify(payload) });
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
  comment(id, content) {
    return apiRequest(`/api/tasks/${id}/comments/`, { method: 'POST', body: JSON.stringify({ content }) });
  },
};
