import React, { useState, useEffect } from 'react';
import { DB } from '../utils/db';

const PAYLBL = {
  paid: { t: '✅ Paid', c: 'dg' },
  not_paid: { t: '❌ Unpaid', c: 'dr' },
  new_application: { t: '📄 New Application', c: 'da' },
};

const getTodayLocalDate = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getYesterdayLocalDate = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getLocalDateString = (tsStr) => {
  if (!tsStr) return '';
  const d = new Date(tsStr);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const matchesDate = (item, targetDate) => {
  if (!targetDate) return true;
  if (item.date) {
    const dStr = typeof item.date === 'string'
      ? (item.date.includes('T') ? item.date.split('T')[0] : item.date.trim())
      : '';
    if (dStr === targetDate) return true;
  }
  if (item.ts) {
    if (getLocalDateString(item.ts) === targetDate) return true;
  }
  return false;
};

export default function AdminDashboard({ openConfirmationModal, showToast, onRedirect }) {
  const [taxFilter, setTaxFilter] = useState('Professional Tax');
  const [dateFilter, setDateFilter] = useState('all'); // 'all', 'today', 'yesterday'
  const [stats, setStats] = useState({
    totalVisits: 0,
    todayVisits: 0,
    yesterdayVisits: 0,
    totalCollected: 0,
    todayCollected: 0,
    yesterdayCollected: 0,
    officersCount: 0,
    dupAlertsCount: 0,
    companiesCount: 0,
    todayCompaniesCount: 0,
    yesterdayCompaniesCount: 0,
    newAppsCount: 0,
    todayNewAppsCount: 0,
    yesterdayNewAppsCount: 0,
    todayPaidCount: 0,
    todayUnpaidCount: 0,
    yesterdayPaidCount: 0,
    yesterdayUnpaidCount: 0,
    todayPresent: 0,
    todayAbsent: 0,
    yesterdayPresent: 0,
    yesterdayAbsent: 0,
  });

  const [alerts, setAlerts] = useState([]);
  const [recentVisits, setRecentVisits] = useState([]);
  const [officerActivity, setOfficerActivity] = useState([]);

  const loadDashboardData = async () => {
    try {
      const [rawV, U, A, ATT] = await Promise.all([
        DB.visits(),
        DB.users(),
        DB.alerts(),
        DB.attendance()
      ]);

      const V = taxFilter === 'all'
        ? rawV
        : rawV.filter((v) => (v.docs?.taxType || 'Professional Tax') === taxFilter);

      const offs = U.filter((u) => u.role === 'off');
      
      const todayLocal = getTodayLocalDate();
      const yesterdayLocal = getYesterdayLocalDate();

      const tv = V.filter((v) => matchesDate(v, todayLocal));
      const yv = V.filter((v) => matchesDate(v, yesterdayLocal));

      const paidVisitsAll = V.filter((v) => v.pay === 'paid' || Number(v.amt) > 0);
      const paidVisitsToday = tv.filter((v) => v.pay === 'paid' || Number(v.amt) > 0);
      const paidVisitsYesterday = yv.filter((v) => v.pay === 'paid' || Number(v.amt) > 0);
      
      const tAmt = paidVisitsAll.reduce((sum, v) => sum + (Number(v.amt) || 0), 0);
      const tdAmt = paidVisitsToday.reduce((sum, v) => sum + (Number(v.amt) || 0), 0);
      const ytdAmt = paidVisitsYesterday.reduce((sum, v) => sum + (Number(v.amt) || 0), 0);

      const uniqueCompaniesAll = new Set(V.map((v) => (v.co || '').trim().toLowerCase()).filter(Boolean)).size;
      const uniqueCompaniesToday = new Set(tv.map((v) => (v.co || '').trim().toLowerCase()).filter(Boolean)).size;
      const uniqueCompaniesYesterday = new Set(yv.map((v) => (v.co || '').trim().toLowerCase()).filter(Boolean)).size;

      const todayAtt = ATT.filter((a) => matchesDate(a, todayLocal));
      const yesterdayAtt = ATT.filter((a) => matchesDate(a, yesterdayLocal));

      const presToday = todayAtt.filter((a) => a.status === 'present').length;
      const absToday = todayAtt.filter((a) => a.status === 'absent').length;

      const presYesterday = yesterdayAtt.filter((a) => a.status === 'present').length;
      const absYesterday = yesterdayAtt.filter((a) => a.status === 'absent').length;

      setStats({
        totalVisits: V.length,
        todayVisits: tv.length,
        yesterdayVisits: yv.length,
        totalCollected: tAmt,
        todayCollected: tdAmt,
        yesterdayCollected: ytdAmt,
        officersCount: offs.length,
        dupAlertsCount: A.length,
        companiesCount: uniqueCompaniesAll,
        todayCompaniesCount: uniqueCompaniesToday,
        yesterdayCompaniesCount: uniqueCompaniesYesterday,
        newAppsCount: V.filter((v) => v.isNew || v.pay === 'new_application').length,
        todayNewAppsCount: tv.filter((v) => v.isNew || v.pay === 'new_application').length,
        yesterdayNewAppsCount: yv.filter((v) => v.isNew || v.pay === 'new_application').length,
        todayPaidCount: paidVisitsToday.length,
        todayUnpaidCount: tv.filter((v) => v.pay === 'not_paid' && !v.isNew).length,
        yesterdayPaidCount: paidVisitsYesterday.length,
        yesterdayUnpaidCount: yv.filter((v) => v.pay === 'not_paid' && !v.isNew).length,
        todayPresent: presToday,
        todayAbsent: absToday,
        yesterdayPresent: presYesterday,
        yesterdayAbsent: absYesterday,
      });

      setAlerts(A);

      // Display visits list matching active period
      if (dateFilter === 'today') {
        setRecentVisits([...tv].reverse());
      } else if (dateFilter === 'yesterday') {
        setRecentVisits([...yv].reverse());
      } else {
        setRecentVisits([...V].reverse().slice(0, 8));
      }

      // Compile officer activity list based on selected date filter
      const targetOfficerVisits = dateFilter === 'yesterday' ? yv : tv;
      const activity = offs.map((o) => {
        const myVisits = targetOfficerVisits.filter((v) => Number(v.offId) === Number(o.id));
        const myCollection = myVisits
          .filter((v) => v.pay === 'paid' || Number(v.amt) > 0)
          .reduce((sum, v) => sum + (Number(v.amt) || 0), 0);
        
        const uniqueCosVisited = [...new Set(myVisits.map((v) => v.co))];
        
        return {
          id: o.id,
          name: o.name,
          zone: o.zone,
          visitsCount: myVisits.length,
          companies: uniqueCosVisited,
          collection: myCollection,
        };
      });

      setOfficerActivity(activity);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [taxFilter, dateFilter]);

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            {/* Tax Type Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', margin: 0, whiteSpace: 'nowrap' }}>
                Tax Type:
              </label>
              <select
                className="fsel"
                value={taxFilter}
                onChange={(e) => setTaxFilter(e.target.value)}
                style={{ padding: '6px 12px', fontSize: '13px', borderRadius: '8px', fontWeight: '600' }}
              >
                <option value="Professional Tax">💼 Professional Tax</option>
                <option value="Property Tax">🏢 Property Tax</option>
                <option value="Non Tax">🚫 Non Tax</option>
                <option value="all">🌐 All Tax Types</option>
              </select>
            </div>

            {/* Date / Period Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', margin: 0, whiteSpace: 'nowrap' }}>
                Period:
              </label>
              <div style={{ display: 'inline-flex', background: '#e2e8f0', padding: '3px', borderRadius: '10px', gap: '3px' }}>
                <button
                  type="button"
                  style={{
                    padding: '6px 14px',
                    fontSize: '13px',
                    borderRadius: '7px',
                    border: 'none',
                    fontWeight: '600',
                    cursor: 'pointer',
                    background: dateFilter === 'all' ? 'var(--bl)' : 'transparent',
                    color: dateFilter === 'all' ? '#fff' : '#475569',
                    boxShadow: dateFilter === 'all' ? '0 2px 6px rgba(26,86,219,0.3)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                  onClick={() => setDateFilter('all')}
                >
                  🌐 All Records
                </button>
                <button
                  type="button"
                  style={{
                    padding: '6px 14px',
                    fontSize: '13px',
                    borderRadius: '7px',
                    border: 'none',
                    fontWeight: '600',
                    cursor: 'pointer',
                    background: dateFilter === 'today' ? 'var(--bl)' : 'transparent',
                    color: dateFilter === 'today' ? '#fff' : '#475569',
                    boxShadow: dateFilter === 'today' ? '0 2px 6px rgba(26,86,219,0.3)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                  onClick={() => setDateFilter('today')}
                >
                  📅 Today
                </button>
                <button
                  type="button"
                  style={{
                    padding: '6px 14px',
                    fontSize: '13px',
                    borderRadius: '7px',
                    border: 'none',
                    fontWeight: '600',
                    cursor: 'pointer',
                    background: dateFilter === 'yesterday' ? 'var(--bl)' : 'transparent',
                    color: dateFilter === 'yesterday' ? '#fff' : '#475569',
                    boxShadow: dateFilter === 'yesterday' ? '0 2px 6px rgba(26,86,219,0.3)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                  onClick={() => setDateFilter('yesterday')}
                >
                  ⏪ Yesterday
                </button>
              </div>
            </div>
          </div>

          <button className="btn bo bsm" onClick={loadDashboardData}>
            🔄 Refresh
          </button>
        </div>

        {/* Stats Grid */}
        <div className="sgrid">
          {dateFilter === 'all' && (
            <>
              <div className="sc" style={{ cursor: 'pointer' }} onClick={() => onRedirect && onRedirect('vis')}>
                <div className="si" style={{ background: 'var(--bll)' }}>📋</div>
                <div className="sv">{stats.totalVisits}</div>
                <div className="sl">Total Visits</div>
              </div>
              <div className="sc" style={{ cursor: 'pointer' }} onClick={() => onRedirect && onRedirect('vis', { date: getTodayLocalDate() })}>
                <div className="si" style={{ background: 'var(--aml)' }}>📅</div>
                <div className="sv">{stats.todayVisits}</div>
                <div className="sl">Today's Visits</div>
              </div>
              <div className="sc" style={{ cursor: 'pointer' }} onClick={() => onRedirect && onRedirect('vis', { payment: 'paid' })}>
                <div className="si" style={{ background: 'var(--gnl)' }}>₹</div>
                <div className="sv" style={{ fontSize: '18px' }}>
                  ₹{stats.totalCollected.toLocaleString('en-IN')}
                </div>
                <div className="sl">Total Collected</div>
              </div>
              <div className="sc" style={{ cursor: 'pointer' }} onClick={() => onRedirect && onRedirect('vis', { payment: 'paid', date: getTodayLocalDate() })}>
                <div className="si" style={{ background: 'var(--gnl)' }}>🌅</div>
                <div className="sv" style={{ fontSize: '18px' }}>
                  ₹{stats.todayCollected.toLocaleString('en-IN')}
                </div>
                <div className="sl">Today's Collection</div>
              </div>
              <div className="sc" style={{ cursor: 'pointer' }} onClick={() => onRedirect && onRedirect('offs')}>
                <div className="si" style={{ background: 'var(--bll)' }}>👥</div>
                <div className="sv">{stats.officersCount}</div>
                <div className="sl">Field Officers</div>
              </div>
              <div className="sc" style={{ cursor: 'pointer' }} onClick={() => { document.getElementById('alerts-section')?.scrollIntoView({ behavior: 'smooth' }); }}>
                <div className="si" style={{ background: stats.dupAlertsCount ? 'var(--rdl)' : 'var(--gnl)' }}>
                  {stats.dupAlertsCount ? '⚠️' : '✅'}
                </div>
                <div className="sv">{stats.dupAlertsCount}</div>
                <div className="sl">Dup. Alerts</div>
              </div>
              <div className="sc" style={{ cursor: 'pointer' }} onClick={() => onRedirect && onRedirect('rpt')}>
                <div className="si" style={{ background: 'var(--bll)' }}>🏢</div>
                <div className="sv">{stats.companiesCount}</div>
                <div className="sl">Companies</div>
              </div>
              <div className="sc" style={{ cursor: 'pointer' }} onClick={() => onRedirect && onRedirect('vis', { payment: 'new_application' })}>
                <div className="si" style={{ background: 'var(--bll)' }}>📄</div>
                <div className="sv">{stats.newAppsCount}</div>
                <div className="sl">New Applications</div>
              </div>
              <div className="sc" style={{ cursor: 'pointer' }} onClick={() => onRedirect && onRedirect('att')}>
                <div className="si" style={{ background: 'var(--gnl)' }}>✅</div>
                <div className="sv">{stats.todayPresent}</div>
                <div className="sl">Today Present</div>
              </div>
              <div className="sc" style={{ cursor: 'pointer' }} onClick={() => onRedirect && onRedirect('att')}>
                <div className="si" style={{ background: 'var(--rdl)' }}>❌</div>
                <div className="sv">{stats.todayAbsent}</div>
                <div className="sl">Today Absent</div>
              </div>
            </>
          )}

          {dateFilter === 'today' && (
            <>
              <div className="sc" style={{ cursor: 'pointer' }} onClick={() => onRedirect && onRedirect('vis', { date: getTodayLocalDate() })}>
                <div className="si" style={{ background: 'var(--aml)' }}>📅</div>
                <div className="sv">{stats.todayVisits}</div>
                <div className="sl">Today's Visits</div>
              </div>
              <div className="sc" style={{ cursor: 'pointer' }} onClick={() => onRedirect && onRedirect('vis', { payment: 'paid', date: getTodayLocalDate() })}>
                <div className="si" style={{ background: 'var(--gnl)' }}>🌅</div>
                <div className="sv" style={{ fontSize: '18px' }}>
                  ₹{stats.todayCollected.toLocaleString('en-IN')}
                </div>
                <div className="sl">Today's Collection</div>
              </div>
              <div className="sc" style={{ cursor: 'pointer' }} onClick={() => onRedirect && onRedirect('vis', { payment: 'paid', date: getTodayLocalDate() })}>
                <div className="si" style={{ background: 'var(--gnl)' }}>✅</div>
                <div className="sv">{stats.todayPaidCount}</div>
                <div className="sl">Today Paid Visits</div>
              </div>
              <div className="sc" style={{ cursor: 'pointer' }} onClick={() => onRedirect && onRedirect('vis', { payment: 'not_paid', date: getTodayLocalDate() })}>
                <div className="si" style={{ background: 'var(--rdl)' }}>❌</div>
                <div className="sv">{stats.todayUnpaidCount}</div>
                <div className="sl">Today Unpaid Visits</div>
              </div>
              <div className="sc" style={{ cursor: 'pointer' }} onClick={() => onRedirect && onRedirect('offs')}>
                <div className="si" style={{ background: 'var(--bll)' }}>👥</div>
                <div className="sv">{stats.officersCount}</div>
                <div className="sl">Field Officers</div>
              </div>
              <div className="sc" style={{ cursor: 'pointer' }} onClick={() => { document.getElementById('alerts-section')?.scrollIntoView({ behavior: 'smooth' }); }}>
                <div className="si" style={{ background: stats.dupAlertsCount ? 'var(--rdl)' : 'var(--gnl)' }}>
                  {stats.dupAlertsCount ? '⚠️' : '✅'}
                </div>
                <div className="sv">{stats.dupAlertsCount}</div>
                <div className="sl">Dup. Alerts</div>
              </div>
              <div className="sc" style={{ cursor: 'pointer' }} onClick={() => onRedirect && onRedirect('rpt')}>
                <div className="si" style={{ background: 'var(--bll)' }}>🏢</div>
                <div className="sv">{stats.todayCompaniesCount}</div>
                <div className="sl">Companies (Today)</div>
              </div>
              <div className="sc" style={{ cursor: 'pointer' }} onClick={() => onRedirect && onRedirect('vis', { payment: 'new_application', date: getTodayLocalDate() })}>
                <div className="si" style={{ background: 'var(--bll)' }}>📄</div>
                <div className="sv">{stats.todayNewAppsCount}</div>
                <div className="sl">New Apps (Today)</div>
              </div>
              <div className="sc" style={{ cursor: 'pointer' }} onClick={() => onRedirect && onRedirect('att')}>
                <div className="si" style={{ background: 'var(--gnl)' }}>✅</div>
                <div className="sv">{stats.todayPresent}</div>
                <div className="sl">Today Present</div>
              </div>
              <div className="sc" style={{ cursor: 'pointer' }} onClick={() => onRedirect && onRedirect('att')}>
                <div className="si" style={{ background: 'var(--rdl)' }}>❌</div>
                <div className="sv">{stats.todayAbsent}</div>
                <div className="sl">Today Absent</div>
              </div>
            </>
          )}

          {dateFilter === 'yesterday' && (
            <>
              <div className="sc" style={{ cursor: 'pointer' }} onClick={() => onRedirect && onRedirect('vis', { date: getYesterdayLocalDate() })}>
                <div className="si" style={{ background: 'var(--aml)' }}>⏪</div>
                <div className="sv">{stats.yesterdayVisits}</div>
                <div className="sl">Yesterday's Visits</div>
              </div>
              <div className="sc" style={{ cursor: 'pointer' }} onClick={() => onRedirect && onRedirect('vis', { payment: 'paid', date: getYesterdayLocalDate() })}>
                <div className="si" style={{ background: 'var(--gnl)' }}>💰</div>
                <div className="sv" style={{ fontSize: '18px' }}>
                  ₹{stats.yesterdayCollected.toLocaleString('en-IN')}
                </div>
                <div className="sl">Yesterday's Collection</div>
              </div>
              <div className="sc" style={{ cursor: 'pointer' }} onClick={() => onRedirect && onRedirect('vis', { payment: 'paid', date: getYesterdayLocalDate() })}>
                <div className="si" style={{ background: 'var(--gnl)' }}>✅</div>
                <div className="sv">{stats.yesterdayPaidCount}</div>
                <div className="sl">Yesterday Paid Visits</div>
              </div>
              <div className="sc" style={{ cursor: 'pointer' }} onClick={() => onRedirect && onRedirect('vis', { payment: 'not_paid', date: getYesterdayLocalDate() })}>
                <div className="si" style={{ background: 'var(--rdl)' }}>❌</div>
                <div className="sv">{stats.yesterdayUnpaidCount}</div>
                <div className="sl">Yesterday Unpaid Visits</div>
              </div>
              <div className="sc" style={{ cursor: 'pointer' }} onClick={() => onRedirect && onRedirect('offs')}>
                <div className="si" style={{ background: 'var(--bll)' }}>👥</div>
                <div className="sv">{stats.officersCount}</div>
                <div className="sl">Field Officers</div>
              </div>
              <div className="sc" style={{ cursor: 'pointer' }} onClick={() => { document.getElementById('alerts-section')?.scrollIntoView({ behavior: 'smooth' }); }}>
                <div className="si" style={{ background: stats.dupAlertsCount ? 'var(--rdl)' : 'var(--gnl)' }}>
                  {stats.dupAlertsCount ? '⚠️' : '✅'}
                </div>
                <div className="sv">{stats.dupAlertsCount}</div>
                <div className="sl">Dup. Alerts</div>
              </div>
              <div className="sc" style={{ cursor: 'pointer' }} onClick={() => onRedirect && onRedirect('rpt')}>
                <div className="si" style={{ background: 'var(--bll)' }}>🏢</div>
                <div className="sv">{stats.yesterdayCompaniesCount}</div>
                <div className="sl">Companies (Yesterday)</div>
              </div>
              <div className="sc" style={{ cursor: 'pointer' }} onClick={() => onRedirect && onRedirect('vis', { payment: 'new_application', date: getYesterdayLocalDate() })}>
                <div className="si" style={{ background: 'var(--bll)' }}>📄</div>
                <div className="sv">{stats.yesterdayNewAppsCount}</div>
                <div className="sl">New Apps (Yesterday)</div>
              </div>
              <div className="sc" style={{ cursor: 'pointer' }} onClick={() => onRedirect && onRedirect('att', { date: getYesterdayLocalDate() })}>
                <div className="si" style={{ background: 'var(--gnl)' }}>✅</div>
                <div className="sv">{stats.yesterdayPresent}</div>
                <div className="sl">Yesterday Present</div>
              </div>
              <div className="sc" style={{ cursor: 'pointer' }} onClick={() => onRedirect && onRedirect('att', { date: getYesterdayLocalDate() })}>
                <div className="si" style={{ background: 'var(--rdl)' }}>❌</div>
                <div className="sv">{stats.yesterdayAbsent}</div>
                <div className="sl">Yesterday Absent</div>
              </div>
            </>
          )}
        </div>

        {/* Alerts and Recent */}
        <div className="col2">
          {/* Alerts card */}
          <div className="card" id="alerts-section">
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
              <h3>
                {dateFilter === 'today'
                  ? `📅 Today's Visits (${recentVisits.length})`
                  : dateFilter === 'yesterday'
                  ? `⏪ Yesterday's Visits (${recentVisits.length})`
                  : `📋 Recent Visits (${recentVisits.length})`}
              </h3>
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
                  <p>
                    {dateFilter === 'today'
                      ? 'No visits recorded today yet'
                      : dateFilter === 'yesterday'
                      ? 'No visits recorded yesterday'
                      : 'No visits yet'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Officer activity table */}
        <div className="card">
          <div className="ch">
            <h3>
              {dateFilter === 'yesterday'
                ? '👥 Officer Activity (Yesterday)'
                : dateFilter === 'today'
                ? '👥 Officer Activity (Today)'
                : '👥 Officer Activity (Today)'}
            </h3>
          </div>
          <div className="cb">
            <div className="tw">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '9px' }}>Officer</th>
                    <th style={{ textAlign: 'center', padding: '9px' }}>Visits</th>
                    <th style={{ padding: '9px' }}>
                      {dateFilter === 'yesterday'
                        ? 'Companies Visited (Yesterday)'
                        : 'Companies Visited (Today)'}
                    </th>
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
