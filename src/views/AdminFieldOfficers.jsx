import React, { useState, useEffect } from 'react';
import { DB } from '../utils/db';

export default function AdminFieldOfficers({ showPhotoModal }) {
  const [officersList, setOfficersList] = useState([]);
  const [visitsList, setVisitsList] = useState([]);
  const [selectedOfficerId, setSelectedOfficerId] = useState(null);
  const [selectedOfficerName, setSelectedOfficerName] = useState('');

  const loadOfficersData = async () => {
    try {
      const [U, V] = await Promise.all([
        DB.users(),
        DB.visits()
      ]);
      const today = new Date().toISOString().split('T')[0];
      const offs = U.filter((u) => u.role === 'off');

      const summary = offs.map((o) => {
        const myVisits = V.filter((v) => v.offId === o.id);
        const myVisitsToday = myVisits.filter((v) => v.date === today);
        const myTotalCollected = myVisits
          .filter((v) => v.pay === 'paid')
          .reduce((sum, v) => sum + v.amt, 0);

        const uniqueCosToday = [...new Set(myVisitsToday.map((v) => v.co))];

        return {
          id: o.id,
          name: o.name,
          user: o.user,
          zone: o.zone,
          totalVisits: myVisits.length,
          todayVisits: myVisitsToday.length,
          companiesToday: uniqueCosToday,
          totalAmount: myTotalCollected,
        };
      });

      setOfficersList(summary);
      setVisitsList(V);
    } catch (err) {
      console.error('Failed to load officers performance list:', err);
    }
  };

  useEffect(() => {
    loadOfficersData();
  }, []);

  const selectedOfficerVisits = selectedOfficerId
    ? visitsList.filter((v) => v.offId === selectedOfficerId)
    : [];

  return (
    <div className="view on">
      <div className="pb">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <button className="btn bo bsm" onClick={loadOfficersData}>
            🔄 Refresh
          </button>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Zone</th>
                  <th>Total Visits</th>
                  <th>Companies Today</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {officersList.length > 0 ? (
                  officersList.map((o, idx) => {
                    const isSelected = o.id === selectedOfficerId;
                    return (
                      <tr
                        key={o.id}
                        onClick={() => {
                          setSelectedOfficerId(o.id);
                          setSelectedOfficerName(o.name);
                        }}
                        style={{
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(26, 86, 219, 0.08)' : '',
                          transition: 'background 0.2s ease',
                        }}
                      >
                        <td>{idx + 1}</td>
                        <td>
                          <strong>{o.name}</strong>
                        </td>
                        <td>
                          <code>{o.user}</code>
                        </td>
                        <td>{o.zone || '—'}</td>
                        <td style={{ color: 'var(--bl)', fontWeight: 700 }}>{o.totalVisits}</td>
                        <td>
                          {o.companiesToday.length > 0 ? (
                            o.companiesToday.slice(0, 3).map((c, i) => (
                              <span
                                key={i}
                                className="bdg db"
                                style={{ fontSize: '10px', marginRight: '4px', marginBottom: '2px' }}
                              >
                                {c}
                              </span>
                            ))
                          ) : (
                            '—'
                          )}
                          {o.companiesToday.length > 3 && (
                            <span style={{ fontSize: '11px', color: 'var(--mu)' }}>
                              +{o.companiesToday.length - 3}
                            </span>
                          )}
                        </td>
                        <td style={{ color: 'var(--gn)', fontWeight: 700 }}>
                          ₹{o.totalAmount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: 'var(--mu)' }}>
                      No field officers found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Officer Visits Details */}
        {selectedOfficerId ? (
          <div className="card" style={{ marginTop: '20px' }}>
            <div className="ch">
              <h3>📋 Visit Details for {selectedOfficerName}</h3>
              <span className="muted">Showing {selectedOfficerVisits.length} visits</span>
            </div>
            <div className="cb">
              {selectedOfficerVisits.length > 0 ? (
                <div className="tw">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Photo</th>
                        <th>Company Name</th>
                        <th>Assessment No.</th>
                        <th>Zone</th>
                        <th>Date &amp; Time</th>
                        <th>Address</th>
                        <th>Payment</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...selectedOfficerVisits].reverse().map((v, i) => (
                        <tr key={v.id}>
                          <td>{i + 1}</td>
                          <td>
                            {v.ph ? (
                              <img
                                src={v.ph}
                                alt="Visit Preview"
                                className="athumb"
                                style={{ width: '45px', height: '45px', borderRadius: '8px', objectFit: 'cover', cursor: 'pointer' }}
                                onClick={() => showPhotoModal && showPhotoModal(v)}
                              />
                            ) : (
                              <span style={{ color: 'var(--mu)' }}>—</span>
                            )}
                          </td>
                          <td><strong>{v.co}</strong></td>
                          <td>{v.asn || <span style={{ color: 'var(--mu)' }}>—</span>}</td>
                          <td>{v.zn || '—'}</td>
                          <td>{new Date(v.ts).toLocaleString('en-IN')}</td>
                          <td style={{ fontSize: '12px', color: 'var(--mu)' }}>
                            {v.dno ? `${v.dno}, ` : ''}{v.st} (Ward: {v.wd || '—'})
                          </td>
                          <td>
                            <span className={`bdg ${v.pay === 'paid' ? 'dg' : v.pay === 'new_application' ? 'da' : 'dr'}`}>
                              {v.pay === 'paid' ? 'Paid' : v.pay === 'new_application' ? 'New App' : 'Unpaid'}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700, color: 'var(--gn)' }}>
                            {v.pay === 'paid' ? `₹${v.amt.toLocaleString('en-IN')}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty">
                  <div className="ei">📋</div>
                  <p>No visits recorded for this officer</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="card" style={{ marginTop: '20px', textAlign: 'center', padding: '30px' }}>
            <span style={{ fontSize: '24px' }}>👥</span>
            <p style={{ color: 'var(--mu)', marginTop: '8px' }}>Select a field officer from the list above to view their detailed visits with photos, zone, company, and assessment number.</p>
          </div>
        )}
      </div>
    </div>
  );
}
