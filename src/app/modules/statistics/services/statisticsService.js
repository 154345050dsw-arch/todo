import { apiRequest, buildQueryString } from '../../../shared/services/apiClient.js';

export const statisticsService = {
  meta() {
    return apiRequest('/api/meta/');
  },
  dashboard(params = {}) {
    return apiRequest(`/api/dashboard/${buildQueryString(params)}`);
  },
  dailyActivity(params = {}) {
    return apiRequest(`/api/stats/daily-activity/${buildQueryString(params)}`);
  },
  updateFrequentOwners(userIds) {
    return apiRequest('/api/frequent-owners/', { method: 'POST', body: JSON.stringify({ user_ids: userIds }) });
  },
};
