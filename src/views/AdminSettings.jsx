import React, { useState, useEffect } from 'react';
import { DB } from '../utils/db';

const ZONES = ['North Zone', 'South Zone', 'East Zone', 'West Zone', 'Central Zone'];

export default function AdminSettings({ openConfirmationModal, showToast }) {
  const [users, setUsers] = useState([]);
  const [visits, setVisits] = useState([]);
  
  // User Modal Form states
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('Add User');
  
  // Form fields
  const [userId, setUserId] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('off'); // 'admin' or 'off'
  const [zone, setZone] = useState('');
  const [company, setCompany] = useState('');

  const loadData = async () => {
    try {
      const [uList, vList] = await Promise.all([
        DB.users(),
        DB.visits()
      ]);
      setUsers(uList);
      setVisits(vList);
    } catch (err) {
      console.error('Failed to load settings data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddUser = () => {
    setModalTitle('➕ Add New User');
    setUserId('');
    setName('');
    setUsername('');
    setPassword('');
    setRole('off');
    setZone('');
    setCompany('');
    setShowModal(true);
  };

  const openEditUser = (u) => {
    setModalTitle('✏️ Edit User');
    setUserId(u.id);
    setName(u.name || '');
    setUsername(u.user || '');
    setPassword(u.pass || '');
    setRole(u.role || 'off');
    setZone(u.zone || '');
    setCompany(u.co || '');
    setShowModal(true);
  };

  const handleSaveUser = () => {
    const n = name.trim();
    const u = username.trim();
    const p = password;
    
    if (!n || !u || !p) {
      showToast('Fill all required fields', 'amber');
      return;
    }

    const currentUsers = [...users];

    const payload = {
      name: n,
      user: u,
      pass: p,
      role,
      zone: role === 'admin' ? '' : zone,
      co: company.trim(),
    };

    const action = !userId
      ? DB.addUser(payload)
      : DB.updateUser(userId, payload);

    action
      .then(() => {
        showToast(`User "${n}" saved successfully!`, 'green');
        loadData();
        setShowModal(false);
      })
      .catch((err) => {
        showToast('Failed to save user: ' + err.message, 'red');
      });
  };

  const handleDeleteUser = (u) => {
    openConfirmationModal(
      '⚠️',
      `Delete "${u.name}"?`,
      'This will remove the user permanently. Their submitted visits will remain in logs.',
      () => {
        DB.deleteUser(u.id)
          .then(() => {
            showToast('User deleted', 'blue');
            loadData();
          })
          .catch((err) => {
            showToast('Failed to delete user: ' + err.message, 'red');
          });
      },
      true,
      'Delete',
      { backgroundColor: 'var(--rd)' }
    );
  };

  const handleClearVisits = () => {
    openConfirmationModal(
      '🗑️',
      'Clear All Visits?',
      'Are you sure you want to remove all visit submissions and duplicate alerts? This cannot be undone.',
      () => {
        Promise.all([
          DB.clearVisits(),
          DB.clearAlerts()
        ])
          .then(() => {
            loadData();
            showToast('All visits data cleared', 'amber');
          })
          .catch((err) => {
            showToast('Failed to clear visits: ' + err.message, 'red');
          });
      },
      true
    );
  };

  return (
    <div className="view on">
      <div className="pb">
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '16px' }}>
          <button className="btn bb bsm" onClick={openAddUser}>
            ➕ Add User
          </button>
          <button className="btn br bsm" onClick={handleClearVisits}>
            🗑️ Clear Visits
          </button>
          <button className="btn bo bsm" onClick={loadData}>
            🔄 Refresh
          </button>
        </div>
        {/* Users Table */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Zone</th>
                  <th>Company</th>
                  <th>Total Visits</th>
                  <th>Edit</th>
                  <th>Delete</th>
                </tr>
              </thead>
              <tbody>
                {users.length > 0 ? (
                  users.map((u, i) => {
                    const totalVisits = visits.filter((v) => v.offId === u.id).length;
                    const canDelete = u.role !== 'admin' || users.filter((x) => x.role === 'admin').length > 1;

                    return (
                      <tr key={u.id}>
                        <td>{i + 1}</td>
                        <td>
                          <strong>{u.name}</strong>
                        </td>
                        <td>
                          <code>{u.user}</code>
                        </td>
                        <td>
                          <span className={`bdg ${u.role === 'admin' ? 'dr' : 'db'}`}>
                            {u.role === 'admin' ? '🛡️ Admin' : '👤 Officer'}
                          </span>
                        </td>
                        <td>{u.zone || '—'}</td>
                        <td>
                          {u.co ? <span className="bdg db">{u.co}</span> : <span style={{ color: 'var(--mu)' }}>—</span>}
                        </td>
                        <td style={{ color: 'var(--bl)', fontWeight: 700 }}>{totalVisits}</td>
                        <td>
                          <button className="btn bo bsm" onClick={() => openEditUser(u)}>
                            ✏️ Edit
                          </button>
                        </td>
                        <td>
                          {canDelete ? (
                            <button className="btn br bsm" onClick={() => handleDeleteUser(u)}>
                              🗑️ Delete
                            </button>
                          ) : (
                            <span className="muted" style={{ fontSize: '11px' }}>Protected</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '20px', color: 'var(--mu)' }}>
                      No users configured
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* User CRUD Modal */}
      {showModal && (
        <div className="ovl op" onClick={() => setShowModal(false)}>
          <div className="mdl" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <h3>{modalTitle}</h3>
            <div className="divider" />
            
            <div className="g2 mt12" style={{ marginTop: '14px' }}>
              <div className="fg">
                <label>
                  Full Name <span className="r">*</span>
                </label>
                <input
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="fg">
                <label>
                  Username <span className="r">*</span>
                </label>
                <input
                  placeholder="Login username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="fg">
                <label>
                  Password <span className="r">*</span>
                </label>
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="fg">
                <label>Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="off">👤 Field Officer</option>
                  <option value="admin">🛡️ Admin</option>
                </select>
              </div>
              
              {role !== 'admin' && (
                <div className="fg full">
                  <label>Zone</label>
                  <select
                    value={zone}
                    onChange={(e) => setZone(e.target.value)}
                  >
                    <option value="">Select Zone</option>
                    {ZONES.map((z) => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="fg full">
                <label>Company / Organization</label>
                <input
                  type="text"
                  placeholder="Company name (optional)"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>
            </div>

            <div className="mact mt16" style={{ marginTop: '18px' }}>
              <button className="btn bo" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="btn bb" onClick={handleSaveUser}>
                💾 Save User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
