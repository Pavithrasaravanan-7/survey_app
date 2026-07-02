import React, { useState, useEffect } from 'react';
import { DB } from '../utils/db';

const PAYLBL = {
  paid: { t: '✅ Paid', c: 'dg' },
  not_paid: { t: '❌ Unpaid', c: 'dr' },
  new_application: { t: '📄 New Application', c: 'da' },
};

export default function AdminDashboard({ openConfirmationModal, showToast }) {
  const [stats, setStats] = useState({
    totalVisits: 0,
    todayVisits: 0,
    totalCollected: 0,
    todayCollected: 0,
    officersCount: 0,
    dupAlertsCount: 0,
    companiesCount: 0,
    newAppsCount: 0,
  });

  const [alerts, setAlerts] = useState([]);
  const [recentVisits, setRecentVisits] = useState([]);
  const [officerActivity, setOfficerActivity] = useState([]);

  const loadDashboardData = async () => {
    try {
      const [V, U, A] = await Promise.all([
        DB.visits(),
        DB.users(),
        DB.alerts()
      ]);
      const offs = U.filter((u) => u.role === 'off');
      
      const today = new Date().toISOString().split('T')[0];
      const tv = V.filter((v) => v.date === today);
      const paidVisits = V.filter((v) => v.pay === 'paid');
      
      const tAmt = paidVisits.reduce((sum, v) => sum + v.amt, 0);
      const tdAmt = tv.filter((v) => v.pay === 'paid').reduce((sum, v) => sum + v.amt, 0);
      const uniqueCompanies = new Set(V.map((v) => v.co.trim().toLowerCase())).size;

      setStats({
        totalVisits: V.length,
        todayVisits: tv.length,
        totalCollected: tAmt,
        todayCollected: tdAmt,
        officersCount: offs.length,
        dupAlertsCount: A.length,
        companiesCount: uniqueCompanies,
        newAppsCount: V.filter((v) => v.isNew).length,
      });

      setAlerts(A);
      setRecentVisits([...V].reverse().slice(0, 6));

      // Compile officer activity list
      const activity = offs.map((o) => {
        const myVisitsToday = tv.filter((v) => v.offId === o.id);
        const myCollectionToday = myVisitsToday
          .filter((v) => v.pay === 'paid')
          .reduce((sum, v) => sum + v.amt, 0);
        
        const uniqueCosVisited = [...new Set(myVisitsToday.map((v) => v.co))];
        
        return {
          id: o.id,
          name: o.name,
          zone: o.zone,
          visitsCount: myVisitsToday.length,
          companies: uniqueCosVisited,
          collection: myCollectionToday,
        };
      });

      setOfficerActivity(activity);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleClearAlerts = () => {
    openConfirmationModal(
      '🗑️',
      'Clear Alerts?',
      'Are you sure you want to remove all duplicate alerts?',
      () => {
        DB.clearAlerts().then(() => {
          loadDashboardData();
          showToast('Duplicate alerts cleared', 'blue');
        }).catch((err) => {
          showToast('Failed to clear alerts: ' + err.message, 'red');
        });
      },
      true
    );
  };

  return (
    <div className="view on">
      <div className="pb">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <button className="btn bo bsm" onClick={loadDashboardData}>
            🔄 Refresh
          </button>
        </div>
        {/* Stats Grid */}
        <div className="sgrid">
          <div className="sc">
            <div className="si" style={{ background: 'var(--bll)' }}>📋</div>
            <div className="sv">{stats.totalVisits}</div>
            <div className="sl">Total Visits</div>
          </div>
          <div className="sc">
            <div className="si" style={{ background: 'var(--aml)' }}>📅</div>
            <div className="sv">{stats.todayVisits}</div>
            <div className="sl">Today's Visits</div>
          </div>
          <div className="sc">
            <div className="si" style={{ background: 'var(--gnl)' }}>₹</div>
            <div className="sv" style={{ fontSize: '18px' }}>
              ₹{stats.totalCollected.toLocaleString('en-IN')}
            </div>
            <div className="sl">Total Collected</div>
          </div>
          <div className="sc">
            <div className="si" style={{ background: 'var(--gnl)' }}>🌅</div>
            <div className="sv" style={{ fontSize: '18px' }}>
              ₹{stats.todayCollected.toLocaleString('en-IN')}
            </div>
            <div className="sl">Today's Collection</div>
          </div>
          <div className="sc">
            <div className="si" style={{ background: 'var(--bll)' }}>👥</div>
            <div className="sv">{stats.officersCount}</div>
            <div className="sl">Field Officers</div>
          </div>
          <div className="sc">
            <div className="si" style={{ background: stats.dupAlertsCount ? 'var(--rdl)' : 'var(--gnl)' }}>
              {stats.dupAlertsCount ? '⚠️' : '✅'}
            </div>
            <div className="sv">{stats.dupAlertsCount}</div>
            <div className="sl">Dup. Alerts</div>
          </div>
          <div className="sc">
            <div className="si" style={{ background: 'var(--bll)' }}>🏢</div>
            <div className="sv">{stats.companiesCount}</div>
            <div className="sl">Companies</div>
          </div>
          <div className="sc">
            <div className="si" style={{ background: 'var(--bll)' }}>📄</div>
            <div className="sv">{stats.newAppsCount}</div>
            <div className="sl">New Applications</div>
          </div>
        </div>

        {/* Alerts and Recent */}
        <div className="col2">
          {/* Alerts card */}
          <div className="card">
            <div className="ch">
              <h3>⚠️ Duplicate Alerts</h3>
              {alerts.length > 0 && (
                <button className="btn bo bsm" onClick={handleClearAlerts}>
                  Clear All
                </button>
              )}
            </div>
            <div className="cb">
              {alerts.length > 0 ? (
                [...alerts].reverse().map((a) => (
                  <div key={a.id} className="ac">
                    <div style={{ fontWeight: 700, color: 'var(--rd)' }}>
                      ⚠️ {a.co} — {a.asn || 'N/A'}
                    </div>
                    <div style={{ color: 'var(--mu)', fontSize: '11px', marginTop: '2px' }}>
                      By <strong>{a.offName}</strong> — {new Date(a.ts).toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: '11.5px', marginTop: '3px' }}>Reason: {a.reason}</div>
                  </div>
                ))
              ) : (
                <div className="empty">
                  <div className="ei">✅</div>
                  <p>No duplicate alerts</p>
                </div>
              )}
            </div>
          </div>

          {/* Recent visits */}
          <div className="card">
            <div className="ch">
              <h3>📋 Recent Visits</h3>
            </div>
            <div className="cb">
              {recentVisits.length > 0 ? (
                recentVisits.map((v) => {
                  const payDetails = PAYLBL[v.pay] || PAYLBL.not_paid;
                  return (
                    <div
                      key={v.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 0',
                        borderBottom: '1px solid var(--br)',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13.5px', fontWeight: 700 }}>{v.co}</div>
                        <div style={{ fontSize: '11.5px', color: 'var(--mu)' }}>
                          {v.offName} — {new Date(v.ts).toLocaleString('en-IN')}
                        </div>
                      </div>
                      <span className={`bdg ${payDetails.c}`}>{payDetails.t}</span>
                    </div>
                  );
                })
              ) : (
                <div className="empty">
                  <div className="ei">📋</div>
                  <p>No visits yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Officer activity table */}
        <div className="card">
          <div className="ch">
            <h3>👥 Officer Activity Today</h3>
          </div>
          <div className="cb">
            <div className="tw">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '9px' }}>Officer</th>
                    <th style={{ textAlign: 'center', padding: '9px' }}>Visits</th>
                    <th style={{ padding: '9px' }}>Companies Visited Today</th>
                    <th style={{ textAlign: 'right', padding: '9px' }}>Collection</th>
                  </tr>
                </thead>
                <tbody>
                  {officerActivity.length > 0 ? (
                    officerActivity.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <strong>{o.name}</strong>
                          <br />
                          <span style={{ fontSize: '11px', color: 'var(--mu)' }}>{o.zone || '—'}</span>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--bl)' }}>
                          {o.visitsCount}
                        </td>
                        <td>
                          {o.companies.length > 0 ? (
                            o.companies.slice(0, 3).map((c, i) => (
                              <span
                                key={i}
                                className="bdg db"
                                style={{ fontSize: '10px', marginRight: '4px', marginBottom: '2px' }}
                              >
                                {c}
                              </span>
                            ))
                          ) : (
                            <span style={{ color: 'var(--mu)', fontSize: '12.5px' }}>—</span>
                          )}
                          {o.companies.length > 3 && (
                            <span style={{ fontSize: '11px', color: 'var(--mu)' }}>
                              +{o.companies.length - 3} more
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--gn)' }}>
                          {o.collection > 0 ? `₹${o.collection.toLocaleString('en-IN')}` : '—'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: 'var(--mu)' }}>
                        No officers registered
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
