import { apiRequest, buildQueryString } from '../../../shared/services/apiClient.js';

export const organizationService = {
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
    return apiRequest(`/api/org/users/${buildQueryString(params)}`);
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
