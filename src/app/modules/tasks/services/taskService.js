import { apiRequest, buildQueryString } from '../../../shared/services/apiClient.js';

export const taskService = {
  tasks(params = {}) {
    return apiRequest(`/api/tasks/${buildQueryString(params)}`);
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
};
