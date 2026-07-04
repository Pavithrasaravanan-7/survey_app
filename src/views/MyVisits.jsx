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

const getLocalDateString = (tsStr) => {
  if (!tsStr) return '';
  const d = new Date(tsStr);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function MyVisits({ user, showPhotoModal, showToast }) {
  const [visits, setVisits] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDate, setSearchDate] = useState('');

  const loadVisits = async () => {
    try {
     const data = await DB.todayVisits(user.id);
      setVisits(data);
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
      result = result.filter((v) => v.date === searchDate || (v.ts && getLocalDateString(v.ts) === searchDate));
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
                  <th>Share</th>
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
                        <td>
                          <button
                            type="button"
                            className="btn bb bsm"
                            style={{
                              backgroundColor: '#25d366',
                              borderColor: '#25d366',
                              color: '#fff',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 8px',
                              fontSize: '11.5px',
                              cursor: 'pointer'
                            }}
                            onClick={() => {
                              const gstNo = v.docs?.gstNumber || '';
                              const contactPerson = v.docs?.contactPerson || '';
                              const email = v.docs?.email || '';
                              const staffCount = v.docs?.staffCount || '';

                              const formattedWhatsAppText = `ZONE : ${v.zn.toUpperCase()}

WARD : ${v.wd}

COMPANY NAME : ${v.co.toUpperCase()}

CONTACT PERSON : ${contactPerson.toUpperCase()}

MOBILE NUMBER : ${v.contact}

E-mail 📩 : ${email}

PROFESSIONAL TAX ASSESSMENT NUMBER : ${v.asn}

GST NUMBER : ${gstNo}

STAFF COUNT : ${staffCount ? String(staffCount).padStart(2, '0') : ''}

REMARKS : ${(v.remarks || (v.pay === 'new_application' ? 'NEW APPLICATION' : v.pay)).toUpperCase()}`;

                              navigator.clipboard.writeText(formattedWhatsAppText)
                                .then(() => {
                                  showToast('Copied to Clipboard! 📋', 'green');
                                  setTimeout(() => {
                                    window.open('https://chat.whatsapp.com/Bu7mRiit9qt6ZMLqzbjGxu?s=cl&p=a&ilr=0', '_blank');
                                  }, 300);
                                })
                                .catch((err) => {
                                  showToast('Failed to copy: ' + err.message, 'red');
                                });
                            }}
                          >
                            💬 WhatsApp
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center', padding: '30px', color: 'var(--mu)' }}>
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
