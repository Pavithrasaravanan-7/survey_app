import React, { useState, useEffect } from 'react';
import { DB } from '../utils/db';

const ASLBL = {
  doc_collection: '📄 Doc. Collection',
  approval: '✅ Approval',
  payment_paid: '💰 Payment Paid',
  close: '🔒 Close',
  others: '📌 Others',
};

const PAYLBL = {
  paid: { t: '✅ Paid', c: 'dg' },
  not_paid: { t: '❌ Unpaid', c: 'dr' },
  new_application: { t: '📄 New Application', c: 'da' },
};

export default function MyVisits({ user, showPhotoModal }) {
  const [visits, setVisits] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDate, setSearchDate] = useState('');

  const loadVisits = async () => {
    try {
      const data = await DB.visits();
      const list = data.filter((v) => v.offId === user.id);
      setVisits(list);
    } catch (err) {
      console.error('Failed to load visits:', err);
    }
  };

  useEffect(() => {
    loadVisits();
  }, [user.id]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setSearchDate('');
  };

  const getFilteredVisits = () => {
    let result = [...visits];
    if (searchDate) {
      result = result.filter((v) => v.date === searchDate);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (v) =>
          v.co.toLowerCase().includes(q) ||
          (v.dno || '').toLowerCase().includes(q) ||
          (v.st || '').toLowerCase().includes(q) ||
          (v.asn || '').toLowerCase().includes(q)
      );
    }
    return result;
  };

  const filtered = getFilteredVisits();

  return (
    <div className="view on">
      <div className="pb">
        {/* Filter bar */}
        <div className="fb">
          <div className="sw">
            <input
              type="text"
              placeholder="Search company, street, assessment…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <input
            type="date"
            className="fsel"
            value={searchDate}
            onChange={(e) => setSearchDate(e.target.value)}
          />
          <button className="btn bo bsm" onClick={handleClearFilters}>
            ✕ Clear
          </button>
          <button className="btn bo bsm" onClick={loadVisits} style={{ marginLeft: 'auto' }}>
            🔄 Refresh
          </button>
        </div>

        {/* Visits Table */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date &amp; Time</th>
                  <th>Company</th>
                  <th>Street</th>
                  <th>Ward/Zone</th>
                  <th>Assessment</th>
                  <th>Payment</th>
                  <th>Amount</th>
                  <th>Photo</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? (
                  [...filtered].reverse().map((v, index) => {
                    const rowNum = filtered.length - index;
                    const payDetails = PAYLBL[v.pay] || PAYLBL.not_paid;
                    const dateStr = new Date(v.ts).toLocaleString('en-IN');
                    const streetAddress = v.dno ? `${v.dno}, ${v.st}` : v.st;

                    return (
                      <tr key={v.id}>
                        <td>{rowNum}</td>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '12px' }}>{dateStr}</td>
                        <td>
                          <strong>{v.co}</strong>
                        </td>
                        <td>{streetAddress}</td>
                        <td style={{ fontSize: '12px' }}>
                          {v.wd} / {v.zn}
                        </td>
                        <td>
                          {v.asn || <span style={{ color: 'var(--mu)' }}>—</span>}
                          {v.isNew && (
                            <span className="bdg db" style={{ fontSize: '10px', marginLeft: '4px' }}>
                              NEW
                            </span>
                          )}
                        </td>
                        <td>
                          <span className={`bdg ${payDetails.c}`}>{payDetails.t}</span>
                          {v.appStatus && (
                            <>
                              <br />
                              <span className="bdg db" style={{ fontSize: '10px', marginTop: '4px' }} title={v.appRemarks}>
                                {ASLBL[v.appStatus] || v.appStatus}
                              </span>
                            </>
                          )}
                        </td>
                        <td>{v.pay === 'paid' ? <strong>₹{v.amt.toLocaleString('en-IN')}</strong> : '—'}</td>
                        <td>
                          {v.ph ? (
                            <img
                              src={v.ph}
                              alt="Visit thumbnail"
                              style={{
                                width: '38px',
                                height: '38px',
                                objectFit: 'cover',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                boxShadow: 'var(--shadow-sm)',
                              }}
                              onClick={() => showPhotoModal(v)}
                              title="View photo"
                            />
                          ) : (
                            <span style={{ color: 'var(--mu)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: 'var(--mu)' }}>
                      No visits found
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
