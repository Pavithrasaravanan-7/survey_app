import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { DB } from '../utils/db';

const getLocalDateString = (tsStr) => {
  if (!tsStr) return '';
  const d = new Date(tsStr);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getDistanceKM = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const getAngle = (lat1, lon1, lat2, lon2) => {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  let brng = Math.atan2(y, x) * 180 / Math.PI;
  return (brng + 360) % 360;
};

const getTimeDiffString = (ts1, ts2) => {
  if (!ts1 || !ts2) return '';
  const diffMs = Math.abs(new Date(ts2) - new Date(ts1));
  const diffSecs = Math.round(diffMs / 1000);
  
  if (diffSecs < 60) {
    return `${diffSecs} sec${diffSecs !== 1 ? 's' : ''}`;
  }
  
  const mins = Math.floor(diffSecs / 60);
  const secs = diffSecs % 60;
  
  if (mins < 60) {
    return `${mins} min${mins !== 1 ? 's' : ''} ${secs} sec${secs !== 1 ? 's' : ''}`;
  }
  
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hrs} hr${hrs !== 1 ? 's' : ''} ${remainingMins} min${remainingMins !== 1 ? 's' : ''} ${secs} sec${secs !== 1 ? 's' : ''}`;
};

const OFFICER_COLORS = [
  '#1a56db', '#0694a2', '#057a55', '#d97706', '#e02424',
  '#7e3af2', '#c2780e', '#0b8a00', '#9061f9', '#a21caf'
];

const getOfficerColor = (id) => {
  return OFFICER_COLORS[id % OFFICER_COLORS.length];
};

export default function AdminGPSTracking({ showToast }) {
  const [officers, setOfficers] = useState([]);
  const [liveTrackPoints, setLiveTrackPoints] = useState({});
  const [visitsList, setVisitsList] = useState([]);
  const [selectedOfficer, setSelectedOfficer] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [routeWaypoints, setRouteWaypoints] = useState([]);

  // Map elements
  const liveMapRef = useRef(null);
  const liveMapInstance = useRef(null);
  const liveMarkers = useRef({});
  const liveMapLayers = useRef([]);

  const routeMapRef = useRef(null);
  const routeMapInstance = useRef(null);
  const routeLayers = useRef([]);

  const todayStr = new Date().toISOString().split('T')[0];

  const loadData = async () => {
    try {
      const [uList, tr, vList] = await Promise.all([
        DB.users(),
        DB.track(),
        DB.visits()
      ]);
      setOfficers(uList.filter((u) => u.role === 'off'));
      setLiveTrackPoints(tr);
      setVisitsList(vList);
    } catch (err) {
      console.error('Failed to load tracking data:', err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, []);

  // Cleanup maps on unmount
  useEffect(() => {
    return () => {
      if (liveMapInstance.current) {
        liveMapInstance.current.remove();
        liveMapInstance.current = null;
      }
      if (routeMapInstance.current) {
        routeMapInstance.current.remove();
        routeMapInstance.current = null;
      }
    };
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
  }, [liveTrackPoints, officers, visitsList]);

  const updateLiveMarkers = () => {
    const map = liveMapInstance.current;
    if (!map) return;

    // Clear old layers
    liveMapLayers.current.forEach((layer) => {
      if (map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    });
    liveMapLayers.current = [];
    liveMarkers.current = {};

    const todayString = new Date().toISOString().split('T')[0];

    // Add today's routes, visits, and last positions
    officers.forEach((o) => {
      const data = liveTrackPoints[o.id];
      const pts = (data?.pts || []).filter((p) => getLocalDateString(p.ts) === todayString);

      // Draw polyline route for today
      const latlngs = pts.map((p) => [parseFloat(p.lat), parseFloat(p.lng)]);
      if (latlngs.length > 1) {
        const polyline = L.polyline(latlngs, {
          color: getOfficerColor(o.id),
          weight: 4,
          opacity: 0.75,
          dashArray: '5, 10'
        }).addTo(map);
        liveMapLayers.current.push(polyline);
      }

      // Draw visited companies today by this officer
      const visitsToday = visitsList.filter(
        (v) => v.offId === o.id && (v.date === todayString || (v.ts && getLocalDateString(v.ts) === todayString))
      );
      visitsToday.forEach((v) => {
        if (!v.lat || !v.lng) return;
        const ic = L.divIcon({
          html: `<div style="background:var(--gn);color:#fff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:11px;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:1.5px solid white;">🏢</div>`,
          iconSize: [26, 26],
          className: '',
        });
        const marker = L.marker([parseFloat(v.lat), parseFloat(v.lng)], { icon: ic })
          .addTo(map)
          .bindPopup(`<strong>${o.name} visited:</strong><br>🏢 ${v.co}<br>🕐 ${new Date(v.ts).toLocaleTimeString('en-IN')}<br>${v.dno ? v.dno + ', ' : ''}${v.st}`);
        liveMapLayers.current.push(marker);
      });

      // Draw last seen marker
      const lastPoint = pts[pts.length - 1] || data?.pts?.[data.pts.length - 1];
      if (lastPoint) {
        const ll = [parseFloat(lastPoint.lat), parseFloat(lastPoint.lng)];
        const ic = L.divIcon({
          html: `<div style="background:${getOfficerColor(o.id)};color:#fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.3); border:2.5px solid white;">${o.name[0]}</div>`,
          iconSize: [32, 32],
          className: '',
        });

        const marker = L.marker(ll, { icon: ic })
          .addTo(map)
          .bindPopup(`<strong>${o.name}</strong><br>📍 ${lastPoint.lat}, ${lastPoint.lng}<br>🕐 ${new Date(lastPoint.ts).toLocaleTimeString('en-IN')}`);
        
        liveMarkers.current[o.id] = marker;
        liveMapLayers.current.push(marker);
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
      const rawPts = (trackData?.pts || []).filter((p) => getLocalDateString(p.ts) === selectedDate);
      const sortedPts = [...rawPts].sort((a, b) => new Date(a.ts) - new Date(b.ts));

      const pts = sortedPts.map((p, index) => {
        if (index === 0) {
          return {
            ...p,
            distanceText: 'Start point',
            timeText: '',
          };
        }
        const prev = sortedPts[index - 1];
        const km = getDistanceKM(
          parseFloat(prev.lat),
          parseFloat(prev.lng),
          parseFloat(p.lat),
          parseFloat(p.lng)
        );
        const timeDiff = getTimeDiffString(prev.ts, p.ts);
        return {
          ...p,
          distanceText: `${km.toFixed(2)} km`,
          timeText: `${timeDiff}`,
        };
      });

      const visits = V.filter(
        (v) =>
          v.offId === parseInt(selectedOfficer) &&
          (v.date === selectedDate || (v.ts && getLocalDateString(v.ts) === selectedDate))
      );

      if (pts.length === 0 && visits.length === 0) {
        showToast('No GPS or visit data for that officer and date', 'amber');
        setRouteWaypoints([]);
        return;
      }

      const latlngs = pts.map((p) => [parseFloat(p.lat), parseFloat(p.lng)]);

      // Draw route polyline and direction arrows
      if (latlngs.length > 1) {
        const polyline = L.polyline(latlngs, { color: '#1a56db', weight: 4, opacity: 0.75 }).addTo(map);
        routeLayers.current.push(polyline);

        // Draw direction arrows along the segments
        for (let idx = 1; idx < latlngs.length; idx++) {
          const prev = latlngs[idx - 1];
          const cur = latlngs[idx];
          const midLat = (prev[0] + cur[0]) / 2;
          const midLng = (prev[1] + cur[1]) / 2;
          const angle = getAngle(prev[0], prev[1], cur[0], cur[1]);

          const arrowIcon = L.divIcon({
            html: `<div style="transform: rotate(${angle}deg); font-size: 13px; color: #1a56db; line-height: 1; text-align: center; text-shadow: 0 0 2px #fff;">➤</div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
            className: '',
          });
          const arrowMarker = L.marker([midLat, midLng], { icon: arrowIcon }).addTo(map);
          routeLayers.current.push(arrowMarker);
        }
      }

      // Draw track point markers
      pts.forEach((p, i) => {
        const isStart = i === 0;
        const isEnd = i === pts.length - 1;

        let color = '#1a56db';
        let label = `${i + 1}`;
        let size = 26;
        let borderRadius = '50%';
        let border = 'none';

        if (isStart) {
          color = '#057a55'; // Green for Start
          label = 'START';
          size = 46;
          borderRadius = '4px';
          border = '2px solid #fff';
        } else if (isEnd) {
          color = '#e02424'; // Red for End
          label = 'END';
          size = 38;
          borderRadius = '4px';
          border = '2px solid #fff';
        }

        const ic = L.divIcon({
          html: `<div style="background:${color};color:#fff;border-radius:${borderRadius};width:${size}px;height:26px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:${border};">${label}</div>`,
          iconSize: [size, 26],
          className: '',
        });
        
        let popupContent = `<strong>Point ${i + 1}</strong><br>🕐 ${new Date(p.ts).toLocaleTimeString('en-IN')}`;
        if (isStart) popupContent = `🏁 <strong>Start Point (Point 1)</strong><br>🕐 ${new Date(p.ts).toLocaleTimeString('en-IN')}`;
        if (isEnd) popupContent = `🏁 <strong>End Point (Point ${i + 1})</strong><br>🕐 ${new Date(p.ts).toLocaleTimeString('en-IN')}`;
        
        if (i > 0 && p.distanceText) {
          popupContent += `<br>➡️ Distance: ${p.distanceText} (${p.timeText} from Point ${i})`;
        }

        const marker = L.marker([parseFloat(p.lat), parseFloat(p.lng)], { icon: ic })
          .addTo(map)
          .bindPopup(popupContent);
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

      // Fit bounds and zoom in closely
      const allPts = [
        ...latlngs,
        ...visits.filter((v) => v.lat).map((v) => [parseFloat(v.lat), parseFloat(v.lng)]),
      ];
      if (allPts.length > 0) {
        map.fitBounds(allPts, { padding: [50, 50], maxZoom: 17 });
        if (allPts.length === 1) {
          map.setView(allPts[0], 17);
        }
      }

      // Waypoints lists
      const rawItems = [
        ...pts.map((p, index) => ({
          ts: p.ts,
          lat: p.lat,
          lng: p.lng,
          html: `📍 ${p.lat}, ${p.lng}`,
          isVisit: false,
          pointIndex: index + 1,
        })),
        ...visits.map((v) => ({
          ts: v.ts,
          lat: v.lat,
          lng: v.lng,
          html: <strong>{v.co} — {v.dno ? v.dno + ', ' : ''}{v.st}</strong>,
          isVisit: true,
        })),
      ];

      const sortedItems = rawItems.sort((a, b) => new Date(a.ts) - new Date(b.ts));

      const enrichedItems = sortedItems.map((it, idx) => {
        if (idx === 0) {
          return {
            ...it,
            distanceText: '',
            timeText: '',
          };
        }

        // Find previous item with coordinates
        let prev = null;
        for (let j = idx - 1; j >= 0; j--) {
          if (sortedItems[j].lat && sortedItems[j].lng) {
            prev = sortedItems[j];
            break;
          }
        }

        if (prev && it.lat && it.lng) {
          const km = getDistanceKM(
            parseFloat(prev.lat),
            parseFloat(prev.lng),
            parseFloat(it.lat),
            parseFloat(it.lng)
          );
          const timeDiff = getTimeDiffString(prev.ts, it.ts);
          return {
            ...it,
            distanceText: `${km.toFixed(2)} km`,
            timeText: `${timeDiff}`,
          };
        }

        return {
          ...it,
          distanceText: '',
          timeText: '',
        };
      });

      setRouteWaypoints(enrichedItems);
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
      const rawPts = (trackData?.pts || []).filter((p) => getLocalDateString(p.ts) === selectedDate);
      console.log("trackData:", trackData);
      console.log("rawPts:", rawPts);
      const sortedPts = [...rawPts].sort((a, b) => new Date(a.ts) - new Date(b.ts));

      const enrichedPts = sortedPts.map((p, index) => {
        if (index === 0) {
          return {
            ...p,
            distanceText: 'Start point',
            timeText: '',
          };
        }
        const prev = sortedPts[index - 1];
        const km = getDistanceKM(
          parseFloat(prev.lat),
          parseFloat(prev.lng),
          parseFloat(p.lat),
          parseFloat(p.lng)
        );
        const timeDiff = getTimeDiffString(prev.ts, p.ts);
        return {
          ...p,
          distanceText: `${km.toFixed(2)} km`,
          timeText: `${timeDiff}`,
        };
      });

      const V = VList.filter(
        (v) =>
          v.offId === parseInt(selectedOfficer) &&
          (v.date === selectedDate || (v.ts && getLocalDateString(v.ts) === selectedDate))
      );
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
              <span>GPS Points: ${enrichedPts.length}</span>
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
                  <th>Distance from Previous</th>
                  <th>Time Elapsed</th>
                </tr>
              </thead>
              <tbody>
                ${enrichedPts.map((p, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td>${new Date(p.ts).toLocaleTimeString('en-IN')}</td>
                    <td>${p.lat}</td>
                    <td>${p.lng}</td>
                    <td>${i === 0 ? 'Start' : p.distanceText}</td>
                    <td>${i === 0 ? '—' : p.timeText}</td>
                  </tr>
                `).join('') || '<tr><td colspan="6" style="text-align:center;">No GPS points recorded</td></tr>'}
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

  const handleLocateOfficer = (officerId) => {
    const marker = liveMarkers.current[officerId];
    const map = liveMapInstance.current;
    if (marker && map) {
      const latlng = marker.getLatLng();
      map.setView(latlng, 18);
      marker.openPopup();
      liveMapRef.current?.scrollIntoView({ behavior: 'smooth' });
      showToast('Centering live map on officer location 📍', 'green');
    } else {
      showToast('No live location available for this officer', 'amber');
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
                  onClick={() => handleLocateOfficer(o.id)}
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
                    cursor: lastPt ? 'pointer' : 'default',
                  }}
                  title={lastPt ? 'Click to locate officer on live map' : ''}
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
                  <div key={i} className="wpitem" style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderBottom: '1px dashed var(--br)', paddingBottom: '8px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className={`wpdot ${it.isVisit ? 'wpv' : ''}`}>{it.isVisit ? '🏢' : it.pointIndex}</div>
                      <div>
                        🕐 {new Date(it.ts).toLocaleTimeString('en-IN')} — {it.html}
                      </div>
                    </div>
                    {it.distanceText && (
                      <div style={{ marginLeft: '36px', fontSize: '11.5px', color: 'var(--tl)', fontWeight: 600 }}>
                        ➡️ Segment: <span style={{ color: 'var(--bl)' }}>{it.distanceText}</span> in <span style={{ color: 'var(--bl)' }}>{it.timeText}</span>
                      </div>
                    )}
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
