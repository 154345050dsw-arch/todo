import {
  API_BASE_KEY,
  apiRequest,
  getApiBaseUrl,
  getToken,
  isDesktopApp,
  isValidApiBaseUrl,
  normalizeApiBase,
  setApiBaseUrl,
  setToken,
} from './app/shared/services/apiClient.js';
import { notificationService } from './app/modules/notifications/services/notificationService.js';
import { organizationService } from './app/modules/organization/services/organizationService.js';
import { statisticsService } from './app/modules/statistics/services/statisticsService.js';
import { taskService } from './app/modules/tasks/services/taskService.js';

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
  markAllNotificationsRead() {
    return apiRequest('/api/notifications/read-all/', { method: 'POST', body: JSON.stringify({}) });
  },
  ...statisticsService,
  ...taskService,
  ...notificationService,
  ...organizationService,
};

export {
  API_BASE_KEY,
  apiRequest,
  getApiBaseUrl,
  getToken,
  isDesktopApp,
  isValidApiBaseUrl,
  normalizeApiBase,
  setApiBaseUrl,
  setToken,
};
