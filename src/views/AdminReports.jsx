import React, { useState, useEffect } from 'react';
import { DB } from '../utils/db';

const MO = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const PAYLBL = {
  paid: { t: 'Paid', c: 'dg' },
  not_paid: { t: 'Unpaid', c: 'dr' },
  new_application: { t: 'New Application', c: 'da' },
};

const ASLBL = {
  doc_collection: '📄 Doc. Collection',
  approval: '✅ Approval',
  payment_paid: '💰 Payment Paid',
  close: '🔒 Close',
  others: '📌 Others',
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

export default function AdminReports({ showToast, showPhotoModal }) {
  const [officers, setOfficers] = useState([]);
  const [activeReportTab, setActiveReportTab] = useState('day');
  
  // Day report inputs
  const [dayDate, setDayDate] = useState(new Date().toISOString().split('T')[0]);
  const [dayOfficer, setDayOfficer] = useState('');
  const [dayCompany, setDayCompany] = useState('');
  const [daySort, setDaySort] = useState('time');

  // Month report inputs
  const [monthVal, setMonthVal] = useState(new Date().getMonth());
  const [yearVal, setYearVal] = useState(new Date().getFullYear());
  const [monthOfficer, setMonthOfficer] = useState('');
  const [monthCompany, setMonthCompany] = useState('');
  const [monthSort, setMonthSort] = useState('time');

  // Summaries inputs
  const [summaryPeriod, setSummaryPeriod] = useState('');
  const [summaryMonthOptions, setSummaryMonthOptions] = useState([]);

  // Company summary search
  const [companySearch, setCompanySearch] = useState('');

  const [visitsList, setVisitsList] = useState([]);

  const loadData = async () => {
    try {
      const [uList, vList] = await Promise.all([
        DB.users(),
        DB.visits()
      ]);
      setOfficers(uList.filter((u) => u.role === 'off'));
      setVisitsList(vList);

      // Populate month options for summary dropdowns
      const now = new Date();
      const opts = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        return {
          value: `${d.getFullYear()}-${d.getMonth()}`,
          label: `${MO[d.getMonth()]} ${d.getFullYear()}`,
        };
      });
      setSummaryMonthOptions(opts);
      if (opts.length > 0) {
        setSummaryPeriod(opts[0].value);
      }
    } catch (err) {
      console.error('Failed to load reports data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePrintReport = (type) => {
    let V = [...visitsList];
    let title = '';
    let periodStr = '';
    let officerName = 'All Officers';

    if (type === 'day') {
      if (!dayDate) {
        showToast('Select a date', 'amber');
        return;
      }
      V = V.filter((v) => v.date === dayDate || (v.ts && getLocalDateString(v.ts) === dayDate));
      periodStr = dayDate;
      title = 'Day-wise Report';

      if (dayOfficer) {
        V = V.filter((v) => v.offId === parseInt(dayOfficer));
        officerName = officers.find((o) => o.id === parseInt(dayOfficer))?.name || 'Unknown';
      }
      if (dayCompany.trim()) {
        const cF = dayCompany.trim().toLowerCase();
        V = V.filter((v) => v.co.toLowerCase().includes(cF));
      }
    } else {
      const mo = parseInt(monthVal);
      const yr = parseInt(yearVal);
      V = V.filter((v) => {
        const dateStr = v.date || (v.ts ? getLocalDateString(v.ts) : '');
        if (!dateStr) return false;
        const parts = dateStr.split('-');
        if (parts.length < 2) return false;
        const vYr = parseInt(parts[0], 10);
        const vMo = parseInt(parts[1], 10) - 1;
        return vYr === yr && vMo === mo;
      });
      periodStr = `${MO[mo]} ${yr}`;
      title = `Month-wise Report — ${periodStr}`;

      if (monthOfficer) {
        V = V.filter((v) => v.offId === parseInt(monthOfficer));
        officerName = officers.find((o) => o.id === parseInt(monthOfficer))?.name || 'Unknown';
      }
      if (monthCompany.trim()) {
        const cF = monthCompany.trim().toLowerCase();
        V = V.filter((v) => v.co.toLowerCase().includes(cF));
      }
    }

    // Sort alphabetically if requested (by Officer name)
    const sortVal = type === 'day' ? daySort : monthSort;
    if (sortVal === 'off_asc') {
      V.sort((a, b) => a.offName.localeCompare(b.offName));
    } else if (sortVal === 'off_desc') {
      V.sort((a, b) => b.offName.localeCompare(a.offName));
    }

    const paidVisits = V.filter((v) => v.pay === 'paid');
    const totalCollected = paidVisits.reduce((sum, v) => sum + v.amt, 0);

    // Generate Printable Window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>${title} - ${periodStr}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #000; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 15px; }
            .header h2 { margin: 0; font-size: 22px; }
            .header h3 { margin: 5px 0 0 0; font-size: 15px; color: #444; }
            .header p { margin: 5px 0 0 0; font-size: 11px; color: #666; }
            .metrics { display: flex; gap: 20px; font-weight: bold; font-size: 13px; margin-bottom: 15px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ccc; padding: 8px; font-size: 11px; text-align: left; }
            th { background: #f0f0f0; }
            tfoot td { background: #e8e8e8; font-weight: bold; }
          </style>
        </head>
        <body onload="window.print()">
          <div class="header">
            <h2>📋 Survey Application</h2>
            <h3>${title}</h3>
            <p>Officer: <strong>${officerName}</strong> | Period: <strong>${periodStr}</strong> | Printed: ${new Date().toLocaleString('en-IN')}</p>
          </div>
          <div class="metrics">
            <span>Total Visits: ${V.length}</span>
            <span>Paid: ${paidVisits.length}</span>
            <span>Unpaid: ${V.length - paidVisits.length}</span>
            <span>Amount: ₹${totalCollected.toLocaleString('en-IN')}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Photos</th>
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
              </tr>
            </thead>
            <tbody>
              ${V.map((v, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>
                    <div style="display:flex;gap:4px;align-items:center;">
                      ${v.ph ? `<img src="${v.ph}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;" />` : '—'}
                      ${(v.receiptPhoto || v.docs?.receiptPhoto) ? `<img src="${v.receiptPhoto || v.docs.receiptPhoto}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;border:1.5px solid green;" />` : ''}
                      ${v.docs?.gstPhoto ? `<img src="${v.docs.gstPhoto}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;border:1.5px solid blue;" />` : ''}
                      ${v.docs?.panPhoto ? `<img src="${v.docs.panPhoto}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;border:1.5px solid blue;" />` : ''}
                      ${v.docs?.rentalPhoto ? `<img src="${v.docs.rentalPhoto}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;border:1.5px solid blue;" />` : ''}
                    </div>
                  </td>
                  <td>${new Date(v.ts).toLocaleString('en-IN')}</td>
                  <td>${v.offName}</td>
                  <td>${v.co}</td>
                  <td>${v.dno ? v.dno + ', ' : ''}${v.st}</td>
                  <td>${v.wd}</td>
                  <td>${v.zn}</td>
                  <td>${v.asn || '—'}</td>
                  <td>${v.isNew ? 'New App' : 'Existing'}</td>
                  <td>
                    ${payStatusText(v.pay)}
                    ${v.pay === 'paid' ? `
                      <br/>
                      <span style="font-size:9px;color:#555;display:block;margin-top:2px;">
                        Mode: ${v.payMode === 'online_payment' ? 'Online' : v.payMode === 'cheque' ? 'Cheque' : v.payMode === 'cash' ? 'Cash' : (v.docs?.payMode === 'online_payment' ? 'Online' : v.docs?.payMode === 'cheque' ? 'Cheque' : v.docs?.payMode === 'cash' ? 'Cash' : '—')}
                        <br/>
                        Receipt: ${(v.receiptCollected === 'yes' || v.docs?.receiptCollected === 'yes') ? 'Yes' : 'No'}
                      </span>
                    ` : ''}
                  </td>
                  <td>${v.pay === 'paid' ? '₹' + v.amt.toLocaleString('en-IN') : '—'}</td>
                </tr>
              `).join('') || '<tr><td colspan="12" style="text-align:center;">No records found</td></tr>'}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="11" style="text-align:right;">TOTAL</td>
                <td>₹${totalCollected.toLocaleString('en-IN')}</td>
              </tr>
            </tfoot>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const payStatusText = (status) => {
    if (status === 'paid') return 'Paid';
    if (status === 'new_application') return 'New Application';
    return 'Unpaid';
  };

  // Compile Officer Summary list
  const getOfficerSummary = () => {
    if (!summaryPeriod) return [];
    const [yr, mo] = summaryPeriod.split('-').map(Number);
    const V = visitsList.filter((v) => {
      const dateStr = v.date || (v.ts ? getLocalDateString(v.ts) : '');
      if (!dateStr) return false;
      const parts = dateStr.split('-');
      if (parts.length < 2) return false;
      const vYr = parseInt(parts[0], 10);
      const vMo = parseInt(parts[1], 10) - 1;
      return vYr === yr && vMo === mo;
    });

    return officers.map((o) => {
      const myVisits = V.filter((v) => v.offId === o.id);
      const paid = myVisits.filter((v) => v.pay === 'paid');
      const amt = paid.reduce((sum, v) => sum + v.amt, 0);

      return {
        id: o.id,
        name: o.name,
        zone: o.zone,
        total: myVisits.length,
        paid: paid.length,
        unpaid: myVisits.length - paid.length,
        amount: amt,
      };
    }).sort((a, b) => b.total - a.total);
  };

  // Compile Company Summary list
  const getCompanySummary = () => {
    if (!summaryPeriod) return [];
    const [yr, mo] = summaryPeriod.split('-').map(Number);
    let V = visitsList.filter((v) => {
      const dateStr = v.date || (v.ts ? getLocalDateString(v.ts) : '');
      if (!dateStr) return false;
      const parts = dateStr.split('-');
      if (parts.length < 2) return false;
      const vYr = parseInt(parts[0], 10);
      const vMo = parseInt(parts[1], 10) - 1;
      return vYr === yr && vMo === mo;
    });

    if (companySearch) {
      const q = companySearch.toLowerCase().trim();
      V = V.filter((v) => v.co.toLowerCase().includes(q));
    }

    const map = {};
    V.forEach((v) => {
      const name = v.co.trim();
      if (!map[name]) {
        map[name] = {
          name,
          total: 0,
          paid: 0,
          unpaid: 0,
          amount: 0,
          officers: new Set(),
        };
      }
      map[name].total++;
      if (v.pay === 'paid') {
        map[name].paid++;
        map[name].amount += v.amt;
      } else {
        map[name].unpaid++;
      }
      map[name].officers.add(v.offName);
    });

    return Object.values(map).sort((a, b) => b.total - a.total);
  };

  const officerSummaryRows = getOfficerSummary();
  const companySummaryRows = getCompanySummary();

  const totalSummary = officerSummaryRows.reduce(
    (acc, cur) => {
      acc.total += cur.total;
      acc.paid += cur.paid;
      acc.unpaid += cur.unpaid;
      acc.amount += cur.amount;
      return acc;
    },
    { total: 0, paid: 0, unpaid: 0, amount: 0 }
  );

  const totalCoSummary = companySummaryRows.reduce(
    (acc, cur) => {
      acc.total += cur.total;
      acc.paid += cur.paid;
      acc.unpaid += cur.unpaid;
      acc.amount += cur.amount;
      return acc;
    },
    { total: 0, paid: 0, unpaid: 0, amount: 0 }
  );

  const getFilteredVisits = () => {
    let V = [...visitsList];
    if (activeReportTab === 'day') {
      if (!dayDate) return [];
      V = V.filter((v) => v.date === dayDate || (v.ts && getLocalDateString(v.ts) === dayDate));
      if (dayOfficer) {
        V = V.filter((v) => v.offId === parseInt(dayOfficer));
      }
      if (dayCompany.trim()) {
        const cF = dayCompany.trim().toLowerCase();
        V = V.filter((v) => v.co.toLowerCase().includes(cF));
      }
    } else {
      const mo = parseInt(monthVal);
      const yr = parseInt(yearVal);
      V = V.filter((v) => {
        const dateStr = v.date || (v.ts ? getLocalDateString(v.ts) : '');
        if (!dateStr) return false;
        const parts = dateStr.split('-');
        if (parts.length < 2) return false;
        const vYr = parseInt(parts[0], 10);
        const vMo = parseInt(parts[1], 10) - 1;
        return vYr === yr && vMo === mo;
      });
      if (monthOfficer) {
        V = V.filter((v) => v.offId === parseInt(monthOfficer));
      }
      if (monthCompany.trim()) {
        const cF = monthCompany.trim().toLowerCase();
        V = V.filter((v) => v.co.toLowerCase().includes(cF));
      }
    }
    return V;
  };

  const filteredVisits = getFilteredVisits();

  return (
    <div className="view on">
      <div className="pb">
        {/* Reports Generator forms */}
        <div className="col2">
          {/* Day wise */}
          <div className="card">
            <div className="ch">
              <h3>📅 Day-wise Report</h3>
            </div>
            <div className="cb">
              <div className="fg mb12">
                <label>Date</label>
                <input
                  type="date"
                  value={dayDate}
                  onChange={(e) => setDayDate(e.target.value)}
                />
              </div>
              <div className="fg mb12">
                <label>Officer (optional)</label>
                <select
                  className="fsel"
                  style={{ width: '100%' }}
                  value={dayOfficer}
                  onChange={(e) => setDayOfficer(e.target.value)}
                >
                  <option value="">All Officers</option>
                  {officers.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fg mb12">
                <label>Company Name (optional)</label>
                <input
                  type="text"
                  placeholder="Filter by company…"
                  style={{ width: '100%' }}
                  value={dayCompany}
                  onChange={(e) => setDayCompany(e.target.value)}
                />
              </div>
              <div className="fg mb12">
                <label>Sort Alphabetically</label>
                <select
                  className="fsel"
                  style={{ width: '100%' }}
                  value={daySort}
                  onChange={(e) => setDaySort(e.target.value)}
                >
                  <option value="time">📅 Default (By Time)</option>
                  <option value="off_asc">🔤 Field Officer (A to Z)</option>
                  <option value="off_desc">🔤 Field Officer (Z to A)</option>
                </select>
              </div>
              <button className="btn bb bw" onClick={() => handlePrintReport('day')}>
                🖨️ Print Day Report
              </button>
            </div>
          </div>

          {/* Month wise */}
          <div className="card">
            <div className="ch">
              <h3>&nbsp;📆 Month-wise Report</h3>
            </div>
            <div className="cb">
              <div className="g2 mb12" style={{ marginBottom: '12px' }}>
                <div className="fg">
                  <label>Month</label>
                  <select
                    value={monthVal}
                    onChange={(e) => setMonthVal(e.target.value)}
                  >
                    {MO.map((m, idx) => (
                      <option key={idx} value={idx}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="fg">
                  <label>Year</label>
                  <input
                    type="number"
                    value={yearVal}
                    min="2020"
                    max="2035"
                    onChange={(e) => setYearVal(e.target.value)}
                  />
                </div>
              </div>
              <div className="fg mb12">
                <label>Officer (optional)</label>
                <select
                  className="fsel"
                  style={{ width: '100%' }}
                  value={monthOfficer}
                  onChange={(e) => setMonthOfficer(e.target.value)}
                >
                  <option value="">All Officers</option>
                  {officers.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fg mb12">
                <label>Company Name (optional)</label>
                <input
                  type="text"
                  placeholder="Filter by company…"
                  style={{ width: '100%' }}
                  value={monthCompany}
                  onChange={(e) => setMonthCompany(e.target.value)}
                />
              </div>
              <div className="fg mb12">
                <label>Sort Alphabetically</label>
                <select
                  className="fsel"
                  style={{ width: '100%' }}
                  value={monthSort}
                  onChange={(e) => setMonthSort(e.target.value)}
                >
                  <option value="time">📅 Default (By Time)</option>
                  <option value="off_asc">🔤 Field Officer (A to Z)</option>
                  <option value="off_desc">🔤 Field Officer (Z to A)</option>
                </select>
              </div>
              <button className="btn bg bw" onClick={() => handlePrintReport('month')}>
                🖨️ Print Month Report
              </button>
            </div>
          </div>
        </div>

        {/* Summaries sections */}
        <div className="card">
          <div className="ch">
            <h3>📈 Officer-wise Summary</h3>
            <select
              className="fsel"
              value={summaryPeriod}
              onChange={(e) => setSummaryPeriod(e.target.value)}
            >
              {summaryMonthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="cb">
            {officerSummaryRows.length > 0 ? (
              <div className="tw">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '9px' }}>Officer</th>
                      <th style={{ textAlign: 'center', padding: '9px' }}>Total</th>
                      <th style={{ textAlign: 'center', padding: '9px' }}>Paid</th>
                      <th style={{ textAlign: 'center', padding: '9px' }}>Not Paid</th>
                      <th style={{ textAlign: 'right', padding: '9px' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {officerSummaryRows.map((r) => (
                      <tr key={r.id}>
                        <td style={{ padding: '11px 9px', borderBottom: '1px solid #f3f4f6' }}>
                          <strong>{r.name}</strong>
                          <br />
                          <span style={{ fontSize: '11px', color: 'var(--mu)' }}>{r.zone || '—'}</span>
                        </td>
                        <td style={{ padding: '11px 9px', borderBottom: '1px solid #f3f4f6', textAlign: 'center', fontWeight: 800, fontSize: '16px', color: 'var(--bl)' }}>
                          {r.total}
                        </td>
                        <td style={{ padding: '11px 9px', borderBottom: '1px solid #f3f4f6', textAlign: 'center', fontWeight: 700, color: 'var(--gn)' }}>
                          {r.paid}
                        </td>
                        <td style={{ padding: '11px 9px', borderBottom: '1px solid #f3f4f6', textAlign: 'center', fontWeight: 700, color: 'var(--rd)' }}>
                          {r.unpaid}
                        </td>
                        <td style={{ padding: '11px 9px', borderBottom: '1px solid #f3f4f6', textAlign: 'right', fontWeight: 700, color: 'var(--gn)', fontSize: '14px' }}>
                          ₹{r.amount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ background: '#f8fafc' }}>
                      <td style={{ padding: '11px 9px', fontWeight: 700 }}>TOTAL</td>
                      <td style={{ padding: '11px 9px', textAlign: 'center', fontWeight: 800, color: 'var(--bl)' }}>
                        {totalSummary.total}
                      </td>
                      <td style={{ padding: '11px 9px', textAlign: 'center', fontWeight: 700, color: 'var(--gn)' }}>
                        {totalSummary.paid}
                      </td>
                      <td style={{ padding: '11px 9px', textAlign: 'center', fontWeight: 700, color: 'var(--rd)' }}>
                        {totalSummary.unpaid}
                      </td>
                      <td style={{ padding: '11px 9px', textAlign: 'right', fontWeight: 700, color: 'var(--gn)' }}>
                        ₹{totalSummary.amount.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty">
                <div className="ei">📊</div>
                <p>No summary data for this month</p>
              </div>
            )}
          </div>
        </div>

        {/* Company Summary */}
        <div className="card" style={{ marginTop: 0 }}>
          <div className="ch">
            <h3>🏢 Company-wise Summary</h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Search company…"
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                style={{
                  padding: '6px 10px',
                  border: '1.5px solid var(--br)',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  width: '180px',
                }}
              />
              <select
                className="fsel"
                value={summaryPeriod}
                onChange={(e) => setSummaryPeriod(e.target.value)}
              >
                {summaryMonthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="cb">
            {companySummaryRows.length > 0 ? (
              <div className="tw">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th style={{ textAlign: 'left' }}>Company Name</th>
                      <th style={{ textAlign: 'center' }}>Total</th>
                      <th style={{ textAlign: 'center' }}>Paid</th>
                      <th style={{ textAlign: 'center' }}>Not Paid</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                      <th style={{ textAlign: 'left' }}>Officers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companySummaryRows.map((r, i) => (
                      <tr key={i}>
                        <td style={{ color: 'var(--mu)' }}>{i + 1}</td>
                        <td>
                          <strong>{r.name}</strong>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--bl)', fontSize: '15px' }}>
                          {r.total}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--gn)' }}>
                          {r.paid}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--rd)' }}>
                          {r.unpaid}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--gn)' }}>
                          ₹{r.amount.toLocaleString('en-IN')}
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--mu)' }}>
                          {[...r.officers].join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#f8fafc', fontWeight: 'bold' }}>
                      <td colSpan="2">TOTAL</td>
                      <td style={{ textAlign: 'center', color: 'var(--bl)' }}>{totalCoSummary.total}</td>
                      <td style={{ textAlign: 'center', color: 'var(--gn)' }}>{totalCoSummary.paid}</td>
                      <td style={{ textAlign: 'center', color: 'var(--rd)' }}>{totalCoSummary.unpaid}</td>
                      <td style={{ textAlign: 'right', color: 'var(--gn)' }}>
                        ₹{totalCoSummary.amount.toLocaleString('en-IN')}
                      </td>
                      <td style={{ color: 'var(--mu)' }}>
                        {new Set(companySummaryRows.flatMap((c) => [...c.officers])).size} officers
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="empty">
                <div className="ei">🏢</div>
                <p>No company data for selected period</p>
              </div>
            )}
          </div>
        </div>

        {/* On-screen Report Preview Table */}
        <div className="card" style={{ marginTop: '20px' }}>
          <div className="ch" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3>📋 Visited Records Preview</h3>
              <span className="muted">Detailed report list showing matching entries with date and time</span>
            </div>
            <div className="rtabs" style={{ margin: 0, padding: '2px' }}>
              <button
                className={`rtab ${activeReportTab === 'day' ? 'on' : ''}`}
                onClick={() => setActiveReportTab('day')}
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                📅 Day Filter
              </button>
              <button
                className={`rtab ${activeReportTab === 'month' ? 'on' : ''}`}
                onClick={() => setActiveReportTab('month')}
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                📆 Month Filter
              </button>
            </div>
          </div>
          <div className="cb">
            {filteredVisits.length > 0 ? (
              <div className="tw">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '10px' }}>#</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Photos</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Date &amp; Time</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Officer</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Company</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Address</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Ward/Zone</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Payment</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Amount</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>App. Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVisits.map((v, idx) => (
                      <tr key={v.id}>
                        <td style={{ padding: '10px', color: 'var(--mu)', textAlign: 'center' }}>{idx + 1}</td>
                        <td style={{ padding: '10px' }}>
                          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                            {v.ph ? (
                              <img
                                src={v.ph}
                                alt="Visit"
                                style={{ width: '30px', height: '30px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer' }}
                                onClick={() => showPhotoModal && showPhotoModal(v)}
                                title="View visit photo"
                              />
                            ) : (
                              <span style={{ color: 'var(--mu)' }}>—</span>
                            )}
                            {(v.receiptPhoto || v.docs?.receiptPhoto) && (
                              <img
                                src={v.receiptPhoto || v.docs.receiptPhoto}
                                alt="Receipt"
                                style={{ width: '30px', height: '30px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '1.2px solid var(--gn)' }}
                                onClick={() => showPhotoModal && showPhotoModal({
                                  ...v,
                                  ph: v.receiptPhoto || v.docs.receiptPhoto,
                                  co: `${v.co} (Receipt)`
                                })}
                                title="View receipt photo"
                              />
                            )}
                            {v.docs?.gstPhoto && (
                              <img
                                src={v.docs.gstPhoto}
                                alt="GST"
                                style={{ width: '30px', height: '30px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '1.2px solid var(--bl)' }}
                                onClick={() => showPhotoModal && showPhotoModal({
                                  ...v,
                                  ph: v.docs.gstPhoto,
                                  co: `${v.co} (GST Doc)`
                                })}
                                title="View GST Doc"
                              />
                            )}
                            {v.docs?.panPhoto && (
                              <img
                                src={v.docs.panPhoto}
                                alt="PAN"
                                style={{ width: '30px', height: '30px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '1.2px solid var(--bl)' }}
                                onClick={() => showPhotoModal && showPhotoModal({
                                  ...v,
                                  ph: v.docs.panPhoto,
                                  co: `${v.co} (PAN Doc)`
                                })}
                                title="View PAN Doc"
                              />
                            )}
                            {v.docs?.rentalPhoto && (
                              <img
                                src={v.docs.rentalPhoto}
                                alt="Rental"
                                style={{ width: '30px', height: '30px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '1.2px solid var(--bl)' }}
                                onClick={() => showPhotoModal && showPhotoModal({
                                  ...v,
                                  ph: v.docs.rentalPhoto,
                                  co: `${v.co} (Rental Deed)`
                                })}
                                title="View Rental Deed"
                              />
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '10px', fontWeight: 600 }}>
                          {v.ts ? new Date(v.ts).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          }) : v.date}
                        </td>
                        <td style={{ padding: '10px' }}><strong>{v.offName}</strong></td>
                        <td style={{ padding: '10px' }}>{v.co}</td>
                        <td style={{ padding: '10px', fontSize: '12px', color: 'var(--mu)' }}>
                          {v.dno ? v.dno + ', ' : ''}{v.st}
                        </td>
                        <td style={{ padding: '10px' }}>{v.wd || '—'} / {v.zn || '—'}</td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <span className={`bdg ${PAYLBL[v.pay]?.c || 'dm'}`} style={{ fontSize: '10px', padding: '2px 8px' }}>
                            {PAYLBL[v.pay]?.t || 'Unpaid'}
                          </span>
                          {v.pay === 'paid' && (
                            <>
                              <br />
                              <span className="bdg dm" style={{ fontSize: '10px', marginTop: '3px', display: 'inline-block' }}>
                                {v.payMode === 'online_payment' ? 'Online' : v.payMode === 'cheque' ? 'Cheque' : v.payMode === 'cash' ? 'Cash' : (v.docs?.payMode === 'online_payment' ? 'Online' : v.docs?.payMode === 'cheque' ? 'Cheque' : v.docs?.payMode === 'cash' ? 'Cash' : '—')}
                              </span>
                              <br />
                              <span className={`bdg ${(v.receiptCollected === 'yes' || v.docs?.receiptCollected === 'yes') ? 'dg' : 'dr'}`} style={{ fontSize: '10px', marginTop: '3px', display: 'inline-block' }}>
                                {(v.receiptCollected === 'yes' || v.docs?.receiptCollected === 'yes') ? 'Receipt: Yes' : 'Receipt: No'}
                              </span>
                            </>
                          )}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: 'var(--gn)' }}>
                          {v.pay === 'paid' ? `₹${v.amt.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <span className={`bdg ${v.appStatus === 'approved' ? 'dg' : v.appStatus === 'rejected' ? 'dr' : 'da'}`} style={{ fontSize: '10px', padding: '2px 8px' }}>
                            {ASLBL[v.appStatus] || v.appStatus || 'Pending'}
                          </span>
                          {v.appStatus === 'doc_collection' && v.docs && (
                            <div style={{ marginTop: '5px', fontSize: '9.5px', color: 'var(--mu)', lineHeight: '1.4' }}>
                              Docs: {v.docs.gst ? '🧾GST ' : ''}{v.docs.pan ? '🪪PAN ' : ''}{v.docs.rentalNeed ? '🏘️Rental' : ''}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty">
                <div className="ei">📋</div>
                <p>No records found matching the active filters</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
