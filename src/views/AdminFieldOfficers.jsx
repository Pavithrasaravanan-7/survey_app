import React, { useState, useEffect } from 'react';
import { DB } from '../utils/db';

export default function AdminFieldOfficers() {
  const [officersList, setOfficersList] = useState([]);

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
    } catch (err) {
      console.error('Failed to load officers performance list:', err);
    }
  };

  useEffect(() => {
    loadOfficersData();
  }, []);

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
                  <th>Today</th>
                  <th>Companies Today</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {officersList.length > 0 ? (
                  officersList.map((o, idx) => (
                    <tr key={o.id}>
                      <td>{idx + 1}</td>
                      <td>
                        <strong>{o.name}</strong>
                      </td>
                      <td>
                        <code>{o.user}</code>
                      </td>
                      <td>{o.zone || '—'}</td>
                      <td style={{ color: 'var(--bl)', fontWeight: 700 }}>{o.totalVisits}</td>
                      <td style={{ color: 'var(--tl)', fontWeight: 700 }}>{o.todayVisits}</td>
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
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '24px', color: 'var(--mu)' }}>
                      No field officers found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
