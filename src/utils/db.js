const DEFAULT_BACKEND = 'https://survey-app-7h98.onrender.com/api';
const API_BASE = (
  import.meta.env.VITE_API_BASE ||
  (import.meta.env.DEV ? 'http://localhost:5000/api' : DEFAULT_BACKEND)
).replace(/\/+$/, '');

async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  let res;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
  } catch (err) {
    throw new Error(`Unable to connect to backend server (${API_BASE}). Please check network or CORS.`);
  }

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    if (!res.ok) {
      throw new Error(`Server error (${res.status} ${res.statusText || ''})`);
    }
    throw new Error('Invalid JSON response from server');
  }

  if (!res.ok) {
    throw new Error(data.error || data.message || `Request failed with status ${res.status}`);
  }

  return data;
}

export const DB = {
  async login(username, password, role) {
    return apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, role })
    });
  },

  async users() {
    return apiCall('/users');
  },

  async addUser(user) {
    return apiCall('/users', {
      method: 'POST',
      body: JSON.stringify(user)
    });
  },

  async updateUser(id, user) {
    return apiCall(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(user)
    });
  },

  async deleteUser(id) {
    return apiCall(`/users/${id}`, {
      method: 'DELETE'
    });
  },

  async visits() {
    return apiCall('/visits');
  },

  async todayVisits(offId) {
    return apiCall(`/visits/today/${offId}`);
  },

  async saveVisit(visit) {
    return apiCall('/visits', {
      method: 'POST',
      body: JSON.stringify(visit)
    });
  },

  async clearVisits() {
    return apiCall('/visits', {
      method: 'DELETE'
    });
  },

  async track() {
    return apiCall('/track');
  },

  async postTrackPoint(userId, name, lat, lng, ts) {
    return apiCall('/track', {
      method: 'POST',
      body: JSON.stringify({ userId, name, lat, lng, ts })
    });
  },

  async alerts() {
    return apiCall('/alerts');
  },

  async saveAlert(alert) {
    return apiCall('/alerts', {
      method: 'POST',
      body: JSON.stringify(alert)
    });
  },

  async clearAlerts() {
    return apiCall('/alerts', {
      method: 'DELETE'
    });
  },

  async attendance() {
    return apiCall('/attendance');
  },

  async saveAttendance(record) {
    return apiCall('/attendance', {
      method: 'POST',
      body: JSON.stringify(record)
    });
  }
};
