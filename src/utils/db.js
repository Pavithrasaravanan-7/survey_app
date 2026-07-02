const API_BASE = import.meta.env.PROD ? '/api' : 'http://localhost:5000/api';

export const DB = {
  async login(username, password, role) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Unauthorized');
    }
    return await res.json();
  },

  async users() {
    const res = await fetch(`${API_BASE}/users`);
    if (!res.ok) throw new Error('Failed to load users');
    return await res.json();
  },

  async addUser(user) {
    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to add user');
    }
    return await res.json();
  },

  async updateUser(id, user) {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update user');
    }
    return await res.json();
  },

  async deleteUser(id) {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete user');
    }
    return await res.json();
  },

  async visits() {
    const res = await fetch(`${API_BASE}/visits`);
    if (!res.ok) throw new Error('Failed to load visits');
    return await res.json();
  },

  async saveVisit(visit) {
    const res = await fetch(`${API_BASE}/visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(visit)
    });
    if (!res.ok) throw new Error('Failed to save visit');
    return await res.json();
  },

  async clearVisits() {
    const res = await fetch(`${API_BASE}/visits`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to clear visits');
    return await res.json();
  },

  async track() {
    const res = await fetch(`${API_BASE}/track`);
    if (!res.ok) throw new Error('Failed to load tracking data');
    return await res.json();
  },

  async postTrackPoint(userId, name, lat, lng, ts) {
    const res = await fetch(`${API_BASE}/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, name, lat, lng, ts })
    });
    if (!res.ok) throw new Error('Failed to log location');
    return await res.json();
  },

  async alerts() {
    const res = await fetch(`${API_BASE}/alerts`);
    if (!res.ok) throw new Error('Failed to load alerts');
    return await res.json();
  },

  async saveAlert(alert) {
    const res = await fetch(`${API_BASE}/alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alert)
    });
    if (!res.ok) throw new Error('Failed to save alert');
    return await res.json();
  },

  async clearAlerts() {
    const res = await fetch(`${API_BASE}/alerts`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to clear alerts');
    return await res.json();
  },

  async attendance() {
    const res = await fetch(`${API_BASE}/attendance`);
    if (!res.ok) throw new Error('Failed to load attendance');
    return await res.json();
  },

  async saveAttendance(record) {
    const res = await fetch(`${API_BASE}/attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
    if (!res.ok) throw new Error('Failed to save attendance');
    return await res.json();
  }
};
