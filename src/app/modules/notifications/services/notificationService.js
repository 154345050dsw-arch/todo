import { apiRequest, buildQueryString } from '../../../shared/services/apiClient.js';

export const notificationService = {
  notifications(params = {}) {
    return apiRequest(`/api/notifications/${buildQueryString(params)}`);
  },
  markNotificationRead(id) {
    return apiRequest(`/api/notifications/${id}/read/`, { method: 'POST', body: JSON.stringify({}) });
  },
};
