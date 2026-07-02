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

export default function AdminAllVisits({ showPhotoModal }) {
  const [visits, setVisits] = useState([]);
  const [officers, setOfficers] = useState([]);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOfficer, setSelectedOfficer] = useState('');
  const [selectedPayment, setSelectedPayment] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  const loadData = async () => {
    try {
      const [vList, uList] = await Promise.all([
        DB.visits(),
        DB.users()
      ]);
      setVisits(vList);
      setOfficers(uList.filter((u) => u.role === 'off'));
    } catch (err) {
      console.error('Failed to load visits log:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedOfficer('');
    setSelectedPayment('');
    setSelectedDate('');
  };

  const getFilteredVisits = () => {
    let result = [...visits];
    
    if (selectedOfficer) {
      result = result.filter((v) => v.offId === parseInt(selectedOfficer));
    }
    
    if (selectedPayment) {
      result = result.filter((v) => v.pay === selectedPayment);
    }
    
    if (selectedDate) {
      result = result.filter((v) => v.date === selectedDate);
    }
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (v) =>
          v.co.toLowerCase().includes(q) ||
          (v.dno || '').toLowerCase().includes(q) ||
          (v.st || '').toLowerCase().includes(q) ||
          v.offName.toLowerCase().includes(q) ||
          v.wd.toLowerCase().includes(q) ||
          v.zn.toLowerCase().includes(q) ||
          (v.asn || '').toLowerCase().includes(q)
      );
    }

    return result;
  };

  const filtered = getFilteredVisits();

  return (
    <div className="view on">
      <div className="pb">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <span className="muted" style={{ fontWeight: 600 }}>
            Found {filtered.length} visit{filtered.length !== 1 ? 's' : ''}
          </span>
          <button className="btn bo bsm" onClick={loadData}>
            🔄 Refresh
          </button>
        </div>
        {/* Filter bar card */}
        <div className="card mb12" style={{ marginBottom: '13px' }}>
          <div className="cb" style={{ padding: '13px' }}>
            <div className="fb" style={{ marginBottom: 0 }}>
              <div className="sw" style={{ flex: 2 }}>
                <input
                  type="text"
                  placeholder="Search company, officer, ward, zone, assessment…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <select
                className="fsel"
                value={selectedOfficer}
                onChange={(e) => setSelectedOfficer(e.target.value)}
              >
                <option value="">All Officers</option>
                {officers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <select
                className="fsel"
                value={selectedPayment}
                onChange={(e) => setSelectedPayment(e.target.value)}
              >
                <option value="">All Payments</option>
                <option value="paid">✅ Paid</option>
                <option value="not_paid">❌ Unpaid</option>
                <option value="new_application">📄 New Application</option>
              </select>
              <input
                type="date"
                className="fsel"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
              <button className="btn bo bsm" onClick={handleClearFilters}>
                ✕ Clear
              </button>
            </div>
          </div>
        </div>

        {/* Global visits ledger table */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Officer</th>
                  <th>Company</th>
                  <th>Street</th>
                  <th>Ward</th>
                  <th>Zone</th>
                  <th>Assessment</th>
                  <th>Type</th>
                  <th>Payment</th>
                  <th>Amount</th>
                  <th>Photo</th>
                  <th>GPS</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? (
                  [...filtered].reverse().map((v, index) => {
                    const rowNum = filtered.length - index;
                    const payDetails = PAYLBL[v.pay] || PAYLBL.not_paid;
                    const streetAddress = v.dno ? `${v.dno}, ${v.st}` : v.st;
                    const dateStr = new Date(v.ts).toLocaleString('en-IN');

                    return (
                      <tr key={v.id}>
                        <td>{rowNum}</td>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '11.5px' }}>{dateStr}</td>
                        <td>
                          <strong>{v.offName}</strong>
                        </td>
                        <td>
                          <strong>{v.co}</strong>
                        </td>
                        <td>{streetAddress}</td>
                        <td>{v.wd}</td>
                        <td>{v.zn}</td>
                        <td>
                          {v.asn || <span style={{ color: 'var(--mu)' }}>—</span>}
                          {v.isNew && (
                            <span className="bdg db" style={{ fontSize: '10px', marginLeft: '3px' }}>
                              NEW
                            </span>
                          )}
                        </td>
                        <td>
                          {v.isNew ? (
                            <span className="bdg da">New App</span>
                          ) : (
                            <span className="bdg dm">Existing</span>
                          )}
                          {v.appStatus && (
                            <>
                              <br />
                              <span
                                className="bdg db"
                                style={{ fontSize: '10px', marginTop: '3px' }}
                                title={v.appRemarks}
                              >
                                {ASLBL[v.appStatus] || v.appStatus}
                              </span>
                            </>
                          )}
                        </td>
                        <td>
                          <span className={`bdg ${payDetails.c}`}>{payDetails.t}</span>
                        </td>
                        <td>{v.pay === 'paid' ? <strong>₹{v.amt.toLocaleString('en-IN')}</strong> : '—'}</td>
                        <td>
                          {v.ph ? (
                            <img
                              src={v.ph}
                              alt="Visit preview"
                              style={{
                                width: '36px',
                                height: '36px',
                                objectFit: 'cover',
                                borderRadius: '6px',
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
                        <td style={{ fontSize: '11px', color: 'var(--mu)' }}>
                          {v.lat ? (
                            <>
                              {v.lat},
                              <br />
                              {v.lng}
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="13" style={{ textAlign: 'center', padding: '30px', color: 'var(--mu)' }}>
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
