import { apiRequest, buildQueryString } from '../../../shared/services/apiClient.js';

export const statisticsService = {
  meta() {
    return apiRequest('/api/meta/');
  },
  dashboard() {
    return apiRequest('/api/dashboard/');
  },
  dailyActivity(params = {}) {
    return apiRequest(`/api/stats/daily-activity/${buildQueryString(params)}`);
  },
};
