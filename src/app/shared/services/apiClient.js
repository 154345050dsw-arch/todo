const TOKEN_KEY = 'flowdesk-token';
export const API_BASE_KEY = 'flowdesk-api-base-url';

export function normalizeApiBase(value = '') {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  return trimmed.replace(/\/+$/, '').replace(/\/api(?:\/health)?$/i, '');
}

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

export function buildQueryString(params = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== '')).toString();
  return query ? `?${query}` : '';
}
