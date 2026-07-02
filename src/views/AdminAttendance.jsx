import React, { useState, useEffect } from 'react';
import { DB } from '../utils/db';

const ATLBL = {
  present: '🟢 Present',
  absent: '🔴 Absent',
  office: '🟡 In Office',
};

const MO = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function AdminAttendance({ showToast, showPhotoModal }) {
  const [officers, setOfficers] = useState([]);
  
  // Day states
  const [dayDate, setDayDate] = useState(new Date().toISOString().split('T')[0]);
  const [dayOfficer, setDayOfficer] = useState('');
  const [dayRecords, setDayRecords] = useState([]);

  // Month states
  const [monthVal, setMonthVal] = useState(new Date().getMonth());
  const [yearVal, setYearVal] = useState(new Date().getFullYear());
  const [monthSummary, setMonthSummary] = useState([]);

  // Full attendance logs from server
  const [attendanceList, setAttendanceList] = useState([]);

  const loadInitialData = async () => {
    try {
      const [uList, aList] = await Promise.all([
        DB.users(),
        DB.attendance()
      ]);
      setOfficers(uList.filter((u) => u.role === 'off'));
      setAttendanceList(aList);
    } catch (err) {
      console.error('Failed to load attendance log database:', err);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Update Day wise records list
  useEffect(() => {
    let list = attendanceList.filter((a) => a.date === dayDate);
    if (dayOfficer) {
      list = list.filter((a) => a.offId === parseInt(dayOfficer));
    }
    setDayRecords(list);
  }, [attendanceList, dayDate, dayOfficer]);

  // Update Month wise summary records
  const handleShowMonthSummary = () => {
    const A = attendanceList.filter((a) => {
      const d = new Date(a.date);
      return d.getMonth() === parseInt(monthVal) && d.getFullYear() === parseInt(yearVal);
    });

    const summary = officers.map((o) => {
      const myAtt = A.filter((a) => a.offId === o.id);
      return {
        id: o.id,
        name: o.name,
        present: myAtt.filter((a) => a.status === 'present').length,
        absent: myAtt.filter((a) => a.status === 'absent').length,
        office: myAtt.filter((a) => a.status === 'office').length,
      };
    });

    setMonthSummary(summary);
  };

  useEffect(() => {
    handleShowMonthSummary();
  }, [monthVal, yearVal, officers]);

  const handleDownloadPDF = (type) => {
    let title = '';
    let period = '';
    let tableHtml = '';

    if (type === 'day') {
      title = 'Day-wise Attendance Report';
      period = dayDate;
      tableHtml = `
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Officer</th>
              <th>Status</th>
              <th>Present Time</th>
              <th>Remarks</th>
              <th>GPS Coordinates</th>
            </tr>
          </thead>
          <tbody>
            ${dayRecords.map((a, i) => `
              <tr>
                <td>${i + 1}</td>
                <td><strong>${a.offName}</strong></td>
                <td>${ATLBL[a.status] || a.status}</td>
                <td>${a.presentTime || '—'}</td>
                <td>${a.remarks || '—'}</td>
                <td>${a.lat ? a.lat + ', ' + a.lng : '—'}</td>
              </tr>
            `).join('') || '<tr><td colspan="6" style="text-align:center;">No records marked for this date</td></tr>'}
          </tbody>
        </table>
      `;
    } else {
      title = 'Month-wise Attendance Summary';
      period = `${MO[monthVal]} ${yearVal}`;
      tableHtml = `
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Officer</th>
              <th>Present Days</th>
              <th>Absent Days</th>
              <th>In Office Days</th>
            </tr>
          </thead>
          <tbody>
            ${monthSummary.map((r, i) => `
              <tr>
                <td>${i + 1}</td>
                <td><strong>${r.name}</strong></td>
                <td style="color:#057a55;">${r.present}</td>
                <td style="color:#e02424;">${r.absent}</td>
                <td style="color:#d97706;">${r.office}</td>
              </tr>
            `).join('') || '<tr><td colspan="5" style="text-align:center;">No summary data</td></tr>'}
          </tbody>
        </table>
      `;
    }

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>${title} - ${period}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #000; }
            h2 { text-align: center; margin-bottom: 5px; }
            h3 { text-align: center; margin-top: 5px; margin-bottom: 20px; color: #333; }
            .meta { font-size: 13px; font-weight: bold; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ccc; padding: 8px; font-size: 11px; text-align: left; }
            th { background: #f0f0f0; }
          </style>
        </head>
        <body onload="window.print()">
          <h2>📋 Survey Application</h2>
          <h3>${title}</h3>
          <div class="meta">
            Period: ${period} | Printed: ${new Date().toLocaleString('en-IN')}
          </div>
          ${tableHtml}
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="view on">
      <div className="pb">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <button
            className="btn bo bsm"
            onClick={() => {
              loadInitialData();
              handleShowMonthSummary();
            }}
          >
            🔄 Refresh
          </button>
        </div>
        <div className="col2">
          {/* Day wise card */}
          <div className="card">
            <div className="ch">
              <h3>📅 Day-wise Attendance</h3>
            </div>
            <div className="cb">
              <div className="g2 mb12" style={{ marginBottom: '12px' }}>
                <div className="fg">
                  <label>Date</label>
                  <input
                    type="date"
                    value={dayDate}
                    onChange={(e) => setDayDate(e.target.value)}
                  />
                </div>
                <div className="fg">
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
              </div>

              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>Officer</th>
                      <th>Status</th>
                      <th>Present Time</th>
                      <th>Remarks</th>
                      <th>GPS</th>
                      <th>Photo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayRecords.length > 0 ? (
                      dayRecords.map((a) => (
                        <tr key={a.id}>
                          <td>
                            <strong>{a.offName}</strong>
                          </td>
                          <td>
                            <span className={`bdg ${a.status === 'present' ? 'dg' : a.status === 'absent' ? 'dr' : 'da'}`}>
                              {ATLBL[a.status] || a.status}
                            </span>
                          </td>
                          <td>{a.presentTime || '—'}</td>
                          <td>{a.remarks || '—'}</td>
                          <td style={{ fontSize: '11px', color: 'var(--mu)' }}>
                            {a.lat ? (
                              <>
                                {a.lat},
                                <br />
                                {a.lng}
                              </>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>
                            {a.photo ? (
                              <img
                                src={a.photo}
                                alt="Attendance"
                                className="athumb"
                                onClick={() =>
                                  showPhotoModal && showPhotoModal({
                                    ph: a.photo,
                                    co: a.offName,
                                    dno: '',
                                    st: ATLBL[a.status] || a.status,
                                    lat: a.lat,
                                    lng: a.lng,
                                    ts: a.ts,
                                    offName: a.offName,
                                  })
                                }
                              />
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: 'var(--mu)' }}>
                          No attendance marked for this date
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ textAlign: 'right', marginTop: '15px' }}>
                <button className="btn bb bsm" onClick={() => handleDownloadPDF('day')}>
                  📄 Download PDF
                </button>
              </div>
            </div>
          </div>

          {/* Month wise card */}
          <div className="card">
            <div className="ch">
              <h3>&nbsp;📆 Month-wise Attendance</h3>
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

              <button
                className="btn bg bw mb12"
                style={{ marginBottom: '12px' }}
                onClick={handleShowMonthSummary}
              >
                📊 Show Summary
              </button>

              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>Officer</th>
                      <th>Present</th>
                      <th>Absent</th>
                      <th>In Office</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthSummary.length > 0 ? (
                      monthSummary.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <strong>{r.name}</strong>
                          </td>
                          <td style={{ color: 'var(--gn)', fontWeight: 700, textAlign: 'center' }}>
                            {r.present}
                          </td>
                          <td style={{ color: 'var(--rd)', fontWeight: 700, textAlign: 'center' }}>
                            {r.absent}
                          </td>
                          <td style={{ color: 'var(--am)', fontWeight: 700, textAlign: 'center' }}>
                            {r.office}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: 'var(--mu)' }}>
                          No summary details
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ textAlign: 'right', marginTop: '15px' }}>
                <button className="btn bb bsm" onClick={() => handleDownloadPDF('month')}>
                  📄 Download PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
