import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { DB } from '../utils/db';

export default function AdminGPSTracking({ showToast }) {
  const [officers, setOfficers] = useState([]);
  const [liveTrackPoints, setLiveTrackPoints] = useState({});
  const [selectedOfficer, setSelectedOfficer] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [routeWaypoints, setRouteWaypoints] = useState([]);

  // Map elements
  const liveMapRef = useRef(null);
  const liveMapInstance = useRef(null);
  const liveMarkers = useRef({});

  const routeMapRef = useRef(null);
  const routeMapInstance = useRef(null);
  const routeLayers = useRef([]);

  const todayStr = new Date().toISOString().split('T')[0];

  const loadData = async () => {
    try {
      const [uList, tr] = await Promise.all([
        DB.users(),
        DB.track()
      ]);
      setOfficers(uList.filter((u) => u.role === 'off'));
      setLiveTrackPoints(tr);
    } catch (err) {
      console.error('Failed to load tracking data:', err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, []);

  // 1. Live Map Rendering
  useEffect(() => {
    if (!liveMapRef.current) return;

    if (!liveMapInstance.current) {
      liveMapInstance.current = L.map(liveMapRef.current).setView([20.5937, 78.9629], 5);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(liveMapInstance.current);
    }

    updateLiveMarkers();

    return () => {
      // Keep persistent or cleanup
    };
  }, [liveTrackPoints, officers]);

  const updateLiveMarkers = () => {
    const map = liveMapInstance.current;
    if (!map) return;

    // Add marker for each officer last position
    officers.forEach((o) => {
      const data = liveTrackPoints[o.id];
      const lastPoint = data?.pts?.[data.pts.length - 1];
      if (!lastPoint) return;

      const ll = [parseFloat(lastPoint.lat), parseFloat(lastPoint.lng)];

      if (liveMarkers.current[o.id]) {
        liveMarkers.current[o.id].setLatLng(ll);
      } else {
        const ic = L.divIcon({
          html: `<div style="background:var(--bl);color:#fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.3); border:2px solid white;">${o.name[0]}</div>`,
          iconSize: [32, 32],
          className: '',
        });

        liveMarkers.current[o.id] = L.marker(ll, { icon: ic })
          .addTo(map)
          .bindPopup(`<strong>${o.name}</strong><br>📍 ${lastPoint.lat}, ${lastPoint.lng}<br>🕐 ${new Date(lastPoint.ts).toLocaleTimeString('en-IN')}`);
      }
    });

    // Fit view to markers if we have positions
    const bounds = [];
    Object.values(liveMarkers.current).forEach((m) => {
      bounds.push(m.getLatLng());
    });
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  };

  // 2. Route Map Rendering
  useEffect(() => {
    if (!routeMapRef.current) return;

    if (!routeMapInstance.current) {
      routeMapInstance.current = L.map(routeMapRef.current).setView([20.5937, 78.9629], 5);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(routeMapInstance.current);
    }

    setTimeout(() => {
      if (routeMapInstance.current) {
        routeMapInstance.current.invalidateSize();
      }
    }, 200);
  }, []);

  const handleShowRoute = async () => {
    const map = routeMapInstance.current;
    if (!map) return;
    if (!selectedOfficer || !selectedDate) {
      showToast('Select officer and date', 'amber');
      return;
    }

    // Clear route layers
    routeLayers.current.forEach((layer) => map.removeLayer(layer));
    routeLayers.current = [];

    try {
      const [TR, V] = await Promise.all([
        DB.track(),
        DB.visits()
      ]);
      
      const trackData = TR[selectedOfficer];
      const pts = (trackData?.pts || []).filter((p) => p.ts.startsWith(selectedDate));
      const visits = V.filter((v) => v.offId === parseInt(selectedOfficer) && v.date === selectedDate);

      if (pts.length === 0 && visits.length === 0) {
        showToast('No GPS or visit data for that officer and date', 'amber');
        setRouteWaypoints([]);
        return;
      }

      const latlngs = pts.map((p) => [parseFloat(p.lat), parseFloat(p.lng)]);

      // Draw route polyline
      if (latlngs.length > 1) {
        const polyline = L.polyline(latlngs, { color: '#1a56db', weight: 4, opacity: 0.7 }).addTo(map);
        routeLayers.current.push(polyline);
      }

      // Draw track point markers
      pts.forEach((p, i) => {
        const ic = L.divIcon({
          html: `<div style="background:#1a56db;color:#fff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${i + 1}</div>`,
          iconSize: [26, 26],
          className: '',
        });
        const marker = L.marker([parseFloat(p.lat), parseFloat(p.lng)], { icon: ic })
          .addTo(map)
          .bindPopup(`🕐 ${new Date(p.ts).toLocaleTimeString('en-IN')}`);
        routeLayers.current.push(marker);
      });

      // Draw visited companies today
      visits.forEach((v) => {
        if (!v.lat) return;
        const ic = L.divIcon({
          html: `<div style="background:var(--gn);color:#fff;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.35);">🏢</div>`,
          iconSize: [30, 30],
          className: '',
        });
        const marker = L.marker([parseFloat(v.lat), parseFloat(v.lng)], { icon: ic })
          .addTo(map)
          .bindPopup(`<strong>${v.co}</strong><br>🕐 ${new Date(v.ts).toLocaleTimeString('en-IN')}<br>${v.dno ? v.dno + ', ' : ''}${v.st}`);
        routeLayers.current.push(marker);
      });

      // Fit bounds
      const allPts = [
        ...latlngs,
        ...visits.filter((v) => v.lat).map((v) => [parseFloat(v.lat), parseFloat(v.lng)]),
      ];
      if (allPts.length > 0) {
        map.fitBounds(allPts, { padding: [30, 30] });
      }

      // Waypoints lists
      const items = [
        ...pts.map((p) => ({
          ts: p.ts,
          html: `📍 ${p.lat}, ${p.lng}`,
          isVisit: false,
        })),
        ...visits.map((v) => ({
          ts: v.ts,
          html: <strong>{v.co} — {v.dno ? v.dno + ', ' : ''}{v.st}</strong>,
          isVisit: true,
        })),
      ];
      setRouteWaypoints(items.sort((a, b) => new Date(a.ts) - new Date(b.ts)));
    } catch (err) {
      showToast('Failed to retrieve route: ' + err.message, 'red');
    }
  };

  const handleDownloadPDF = async () => {
    if (!selectedOfficer || !selectedDate) {
      showToast('Select officer and date first', 'amber');
      return;
    }
    try {
      const off = officers.find((u) => u.id === parseInt(selectedOfficer));
      const [TR, VList] = await Promise.all([
        DB.track(),
        DB.visits()
      ]);
      
      const trackData = TR[selectedOfficer];
      const pts = (trackData?.pts || []).filter((p) => p.ts.startsWith(selectedDate));
      const V = VList.filter((v) => v.offId === parseInt(selectedOfficer) && v.date === selectedDate);
      const paid = V.filter((v) => v.pay === 'paid');
      const totAmt = paid.reduce((sum, v) => sum + v.amt, 0);

      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>Route Report - ${off?.name} - ${selectedDate}</title>
            <style>
              body { font-family: sans-serif; padding: 20px; color: #000; }
              h2 { text-align: center; margin-bottom: 5px; }
              h3 { text-align: center; margin-top: 5px; margin-bottom: 20px; color: #333; }
              .meta { display: flex; gap: 20px; margin-bottom: 20px; font-size: 13px; font-weight: bold; border-bottom: 2px solid #000; padding-bottom: 10px; }
              table { width: 100%; border-collapse: collapse; margin-top: 15px; }
              th, td { border: 1px solid #ccc; padding: 8px; font-size: 11px; text-align: left; }
              th { background: #f0f0f0; }
              tfoot td { background: #e8e8e8; font-weight: bold; }
            </style>
          </head>
          <body onload="window.print()">
            <h2>📋 Survey Application</h2>
            <h3>Officer Route & Visit Details</h3>
            <div class="meta">
              <span>Officer: ${off?.name}</span>
              <span>Date: ${selectedDate}</span>
              <span>Visits: ${V.length}</span>
              <span>Amount: ₹${totAmt.toLocaleString('en-IN')}</span>
              <span>GPS Points: ${pts.length}</span>
            </div>

            <h4>Visits Summary</h4>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Time</th>
                  <th>Company</th>
                  <th>Street</th>
                  <th>Ward/Zone</th>
                  <th>Payment</th>
                  <th>Amount</th>
                  <th>App. Status</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                ${V.map((v, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td>${new Date(v.ts).toLocaleTimeString('en-IN')}</td>
                    <td>${v.co}</td>
                    <td>${v.dno ? v.dno + ', ' : ''}${v.st}</td>
                    <td>${v.wd}/${v.zn}</td>
                    <td>${v.pay === 'paid' ? 'Paid' : v.pay === 'new_application' ? 'New App' : 'Unpaid'}</td>
                    <td>${v.pay === 'paid' ? '₹' + v.amt.toLocaleString('en-IN') : '—'}</td>
                    <td>${v.appStatus || '—'}</td>
                    <td>${v.remarks || '—'}</td>
                  </tr>
                `).join('') || '<tr><td colspan="9" style="text-align:center;">No visits recorded</td></tr>'}
              </tbody>
            </table>

            <h4>GPS Waypoints</h4>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Time</th>
                  <th>Latitude</th>
                  <th>Longitude</th>
                </tr>
              </thead>
              <tbody>
                ${pts.map((p, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td>${new Date(p.ts).toLocaleTimeString('en-IN')}</td>
                    <td>${p.lat}</td>
                    <td>${p.lng}</td>
                  </tr>
                `).join('') || '<tr><td colspan="4" style="text-align:center;">No GPS points recorded</td></tr>'}
              </tbody>
            </table>
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch (err) {
      showToast('Failed to print route report: ' + err.message, 'red');
    }
  };

  const now = Date.now();

  return (
    <div className="view on">
      <div className="pb">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <button className="btn bo bsm" onClick={loadData}>
            🔄 Refresh
          </button>
        </div>
        {/* Officers Live map */}
        <div className="card">
          <div className="ch">
            <h3>🗺️ Officers Map (Live)</h3>
          </div>
          <div className="cb">
            <div ref={liveMapRef} id="adm-map" />
          </div>
        </div>

        {/* Officers list details */}
        <div id="atrk" style={{ marginBottom: '20px' }}>
          {officers.length > 0 ? (
            officers.map((o) => {
              const data = liveTrackPoints[o.id];
              const lastSeen = data?.lastSeen ? new Date(data.lastSeen).toLocaleString('en-IN') : 'Never';
              const lastPt = data?.pts?.[data.pts.length - 1];
              const todayPoints = (data?.pts || []).filter((p) => p.ts.startsWith(todayStr));
              
              // Active status check (within last 5 mins)
              const isOnline = data?.lastSeen && now - new Date(data.lastSeen).getTime() < 5 * 60 * 1000;

              return (
                <div
                  key={o.id}
                  style={{
                    background: 'rgba(255,255,255,.97)',
                    backdropFilter: 'blur(8px)',
                    borderRadius: '14px',
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    boxShadow: 'var(--shadow-sm)',
                    marginBottom: '10px',
                    border: '1px solid rgba(255,255,255,.8)',
                  }}
                >
                  <div
                    style={{
                      width: '46px',
                      height: '46px',
                      background: 'linear-gradient(135deg, var(--bl), var(--tl))',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '19px',
                      fontWeight: 700,
                      color: '#fff',
                      flexShrink: 0,
                      boxShadow: '0 4px 12px rgba(26,86,219,.3)',
                    }}
                  >
                    {o.name[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '15px' }}>{o.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--mu)' }}>
                      Zone: {o.zone || '—'} | Last seen: {lastSeen}
                    </div>
                    {lastPt && (
                      <div style={{ fontSize: '12px', color: 'var(--tl)', marginTop: '3px' }}>
                        📍 {lastPt.lat}, {lastPt.lng}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--bl)' }}>
                      {todayPoints.length}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--mu)' }}>pts today</div>
                    <div className={isOnline ? 'gpsi' : 'bdg dm'} style={{ marginTop: '6px', fontSize: '11px' }}>
                      {isOnline ? (
                        <>
                          <div className="gpsd" /> Online
                        </>
                      ) : (
                        '⭕ Offline'
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="empty">
              <div className="ei">👥</div>
              <p>No field officers registered</p>
            </div>
          )}
        </div>

        {/* Route details lookup card */}
        <div className="card">
          <div className="ch">
            <h3>🧭 Officer Route &amp; Visit Details</h3>
            <span className="muted">Places covered, time marks, downloadable report</span>
          </div>
          <div className="cb">
            <div className="fb">
              <select
                className="fsel"
                value={selectedOfficer}
                onChange={(e) => setSelectedOfficer(e.target.value)}
              >
                <option value="">Select Officer</option>
                {officers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                className="fsel"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
              <button className="btn bb bsm" onClick={handleShowRoute}>
                🧭 Show Route
              </button>
              <button className="btn bo bsm" onClick={handleDownloadPDF}>
                📄 Download PDF
              </button>
            </div>

            <div ref={routeMapRef} id="route-map" />
            <p className="muted mb8">Waypoints (time-marked)</p>
            <div className="wproute" id="rt-list">
              {routeWaypoints.length > 0 ? (
                routeWaypoints.map((it, i) => (
                  <div key={i} className="wpitem">
                    <div className={`wpdot ${it.isVisit ? 'wpv' : ''}`}>{it.isVisit ? '🏢' : i + 1}</div>
                    <div>
                      🕐 {new Date(it.ts).toLocaleTimeString('en-IN')} — {it.html}
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty">
                  <div className="ei">📍</div>
                  <p>Select an officer and date, then click "Show Route"</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
