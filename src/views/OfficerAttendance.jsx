import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { DB } from '../utils/db';

const ATLBL = {
  present: '🟢 Present',
  absent: '🔴 Absent',
  office: '🟡 In Office',
};

export default function OfficerAttendance({ user, lat, lng, refreshGPS, showToast, showPhotoModal }) {
  const [attStatus, setAttStatus] = useState('');
  const [remarks, setRemarks] = useState('');
  const [presentTime, setPresentTime] = useState('');
  const [history, setHistory] = useState([]);
  const [todayRecord, setTodayRecord] = useState(null);

  // Attendance photo (GPS tagged) states
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null); // base64 data URL
  const [photoMeta, setPhotoMeta] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  
  // Route Map Refs
  const routeMapRef = useRef(null);
  const routeMapInstanceRef = useRef(null);
  const routeLayersRef = useRef([]);

  const todayStr = new Date().toISOString().split('T')[0];

  // Backend states
  const [trackPoints, setTrackPoints] = useState({});
  const [visitsList, setVisitsList] = useState([]);

  const loadAllData = async () => {
    try {
      const [att, tr, vis] = await Promise.all([
        DB.attendance(),
        DB.track(),
        DB.visits()
      ]);
      setTrackPoints(tr);
      setVisitsList(vis);

      const list = att.filter((a) => a.offId === user.id);
      setHistory(list);

      const todayRec = list.find((a) => a.date === todayStr);
      setTodayRecord(todayRec || null);
      if (todayRec) {
        setAttStatus(todayRec.status);
        setRemarks(todayRec.remarks || '');
        setPresentTime(todayRec.presentTime || '');
        setCapturedPhoto(todayRec.photo || null);
        setPhotoMeta(todayRec.photo ? { name: 'attendance.jpg', size: 0 } : null);
      } else {
        setAttStatus('');
        setRemarks('');
        setPresentTime('');
        setCapturedPhoto(null);
        setPhotoMeta(null);
      }
    } catch (err) {
      console.error('Failed to load attendance data:', err);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [user.id]);

  // Load / Update route map
  useEffect(() => {
    if (!routeMapRef.current) return;
    
    // Initialize map
    if (!routeMapInstanceRef.current) {
      routeMapInstanceRef.current = L.map(routeMapRef.current).setView([20.5937, 78.9629], 5);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(routeMapInstanceRef.current);
    }

    // Render layers
    renderRouteData();

    // Map refresh size
    setTimeout(() => {
      if (routeMapInstanceRef.current) {
        routeMapInstanceRef.current.invalidateSize();
      }
    }, 200);

    return () => {
      // Keep map persistent or clean up if needed
    };
  }, [lat, lng, history]);

  // Attach camera stream to <video> once it is mounted
  useEffect(() => {
    if (!cameraActive) return undefined;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) {
      setCameraLoading(false);
      stopCamera();
      showToast('Unable to open the camera preview. Please check camera permission and try again.', 'red');
      return undefined;
    }

    let cancelled = false;
    (async () => {
      video.srcObject = stream;
      await video.play().catch(() => {});
      const isReady = () => (
        video.readyState >= 2 &&
        (video.videoWidth > 0 || video.videoHeight > 0 || (video.clientWidth > 0 && video.clientHeight > 0))
      );
      if (!isReady()) {
        await new Promise((resolve) => {
          let resolved = false;
          const done = () => {
            if (resolved) return;
            resolved = true;
            resolve();
          };
          video.addEventListener('loadedmetadata', done, { once: true });
          video.addEventListener('canplay', done, { once: true });
          window.setTimeout(done, 3000);
        });
      }
      if (cancelled) return;
      setCameraReady(true);
      setCameraLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [cameraActive]);

  const startCamera = async () => {
    setCameraReady(false);
    setCameraLoading(true);

    const isSecureContext = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !isSecureContext) {
      setCameraLoading(false);
      const fallbackInput = document.getElementById('att-native-camera-fallback');
      if (fallbackInput) {
        showToast('Opening native mobile camera...', 'blue');
        fallbackInput.click();
      } else {
        showToast('Camera is not supported on this device', 'red');
      }
      return;
    }

    try {
      if (navigator.permissions?.query) {
        const permission = await navigator.permissions.query({ name: 'camera' }).catch(() => null);
        if (permission?.state === 'denied') {
          showToast('Camera permission is blocked. Please enable camera access in your browser settings.', 'red');
          setCameraLoading(false);
          return;
        }
      }

      const constraintsList = [
        { video: { facingMode: { ideal: 'user' } }, audio: false },
        { video: { facingMode: { ideal: 'environment' } }, audio: false },
        { video: true, audio: false },
      ];

      let stream = null;
      for (const constraints of constraintsList) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          break;
        } catch (error) {
          if (error.name !== 'NotFoundError') {
            throw error;
          }
        }
      }

      if (!stream) {
        throw new Error('No camera found');
      }

      streamRef.current = stream;
      setCameraActive(true);
    } catch (err) {
      console.error('Camera start error:', err);
      setCameraLoading(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        showToast('Camera permission was denied. Please allow camera access and try again.', 'red');
      } else if (err.name === 'NotFoundError') {
        showToast('No camera was found on this device.', 'amber');
      } else {
        showToast('Camera could not be opened. Please try again.', 'red');
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setCameraReady(false);
    setCameraLoading(false);
  };

  const stampAndFinish = (canvas, ctx, name) => {
    const stamp1 = lat && lng ? `📍 Lat: ${lat}, Long: ${lng}` : '📍 GPS not available';
    const stamp2 = `🕐 ${new Date().toLocaleString('en-IN')}`;
    const fontSize = Math.max(14, Math.round(canvas.width * 0.028));
    ctx.font = `bold ${fontSize}px sans-serif`;

    const padX = fontSize * 0.7;
    const padY = fontSize * 0.6;
    const lineHeight = fontSize * 1.35;
    const barHeight = lineHeight * 2 + padY * 2;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);

    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'top';
    ctx.fillText(stamp1, padX, canvas.height - barHeight + padY);
    ctx.fillText(stamp2, padX, canvas.height - barHeight + padY + lineHeight);

    const base64Data = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedPhoto(base64Data);
    setPhotoMeta({ name, size: Math.round(base64Data.length * 0.75) });
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video || !cameraReady) {
      showToast('Camera loading, please wait', 'amber');
      return;
    }

    const canvas = document.createElement('canvas');
    const width = video.videoWidth || video.clientWidth || 640;
    const height = video.videoHeight || video.clientHeight || 480;

    if (!width || !height) {
      showToast('Camera preview is still not ready. Please try again.', 'amber');
      return;
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    stampAndFinish(canvas, ctx, `attendance_${Date.now()}.jpg`);
    stopCamera();
    showToast('Attendance photo captured!', 'green');
  };

  const handleNativeCameraCapture = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDimension = 1280;
        let width = img.width;
        let height = img.height;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        stampAndFinish(canvas, ctx, file.name || `attendance_${Date.now()}.jpg`);
        showToast('Photo captured and GPS-tagged!', 'green');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    setPhotoMeta(null);
    startCamera();
  };

  const renderRouteData = () => {
    const map = routeMapInstanceRef.current;
    if (!map) return;

    // Clear old layers
    routeLayersRef.current.forEach((layer) => map.removeLayer(layer));
    routeLayersRef.current = [];

    const trackData = trackPoints[user.id];
    const pts = (trackData?.pts || []).filter((p) => p.ts.startsWith(todayStr));
    const visits = visitsList.filter((v) => v.offId === user.id && v.date === todayStr);

    const latlngs = pts.map((p) => [parseFloat(p.lat), parseFloat(p.lng)]);

    // Draw route polyline
    if (latlngs.length > 1) {
      const polyline = L.polyline(latlngs, { color: '#057a55', weight: 4, opacity: 0.75 }).addTo(map);
      routeLayersRef.current.push(polyline);
    }

    // Draw route markers
    pts.forEach((p, i) => {
      const ic = L.divIcon({
        html: `<div style="background:#057a55;color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${i + 1}</div>`,
        iconSize: [24, 24],
        className: '',
      });
      const marker = L.marker([parseFloat(p.lat), parseFloat(p.lng)], { icon: ic })
        .addTo(map)
        .bindPopup(`🕐 ${new Date(p.ts).toLocaleTimeString('en-IN')}`);
      routeLayersRef.current.push(marker);
    });

    // Draw live location
    if (lat && lng) {
      const liveIc = L.divIcon({
        html: `<div style="width:20px;height:20px;border-radius:50%;background:rgba(5,122,85,0.25);display:flex;align-items:center;justify-content:center;"><div style="width:12px;height:12px;border-radius:50%;background:#057a55;border:2px solid #fff;box-shadow:0 0 0 2px #057a55,0 2px 6px rgba(0,0,0,0.4);animation:pulseLive 1.4s ease-in-out infinite;"></div></div>`,
        iconSize: [20, 20],
        className: '',
      });
      const liveMarker = L.marker([parseFloat(lat), parseFloat(lng)], { icon: liveIc, zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup(`🟢 <strong>Live location</strong><br>${lat}, ${lng}`);
      routeLayersRef.current.push(liveMarker);
    }

    // Draw visits today
    visits.forEach((v) => {
      if (!v.lat) return;
      const ic = L.divIcon({
        html: `<div style="background:var(--gn);color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,0.35);">🏢</div>`,
        iconSize: [28, 28],
        className: '',
      });
      const visitMarker = L.marker([parseFloat(v.lat), parseFloat(v.lng)], { icon: ic })
        .addTo(map)
        .bindPopup(`<strong>${v.co}</strong><br>🕐 ${new Date(v.ts).toLocaleTimeString('en-IN')}`);
      routeLayersRef.current.push(visitMarker);
    });

    // Fit map bounds
    const allPts = [
      ...latlngs,
      ...visits.filter((v) => v.lat).map((v) => [parseFloat(v.lat), parseFloat(v.lng)]),
      ...(lat && lng ? [[parseFloat(lat), parseFloat(lng)]] : []),
    ];

    if (allPts.length > 0) {
      map.fitBounds(allPts, { padding: [30, 30] });
    }
  };

  const selectAttOption = (status) => {
    setAttStatus(status);
    if (status !== 'absent') {
      setPresentTime(new Date().toLocaleTimeString('en-IN'));
    } else {
      setPresentTime('');
      stopCamera();
      if (!todayRecord?.photo) {
        setCapturedPhoto(null);
        setPhotoMeta(null);
      }
    }
  };

  const handleSaveAttendance = () => {
    if (!attStatus) {
      showToast('Select Present, Absent or In Office', 'amber');
      return;
    }
    if (attStatus === 'absent' && !remarks.trim()) {
      showToast('Add remarks for absence', 'amber');
      return;
    }
    if (!lat || !lng) {
      showToast('Enable location permission before marking attendance', 'amber');
      return;
    }
    if (attStatus === 'present' && !capturedPhoto) {
      showToast('Capture a GPS-tagged photo to confirm your presence', 'amber');
      return;
    }

    const attendanceRecord = {
      id: todayRecord ? todayRecord.id : Date.now(),
      offId: user.id,
      offName: user.name,
      date: todayStr,
      status: attStatus,
      presentTime: attStatus !== 'absent' ? (presentTime || new Date().toLocaleTimeString('en-IN')) : '',
      remarks: remarks.trim(),
      lat,
      lng,
      photo: attStatus !== 'absent' ? (capturedPhoto || null) : null,
      ts: new Date().toISOString(),
    };

    DB.saveAttendance(attendanceRecord)
      .then(() => {
        showToast(`Attendance saved: ${ATLBL[attStatus]}`, 'green');
        loadAllData();
      })
      .catch((err) => {
        showToast('Failed to save attendance: ' + err.message, 'red');
      });
  };

  // Compile timeline waypoint list
  const getTimelineWaypoints = () => {
    const trackData = trackPoints[user.id];
    const pts = (trackData?.pts || []).filter((p) => p.ts.startsWith(todayStr));
    const visits = visitsList.filter((v) => v.offId === user.id && v.date === todayStr);

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

    return items.sort((a, b) => new Date(a.ts) - new Date(b.ts));
  };

  const waypoints = getTimelineWaypoints();

  return (
    <div className="view on">
      <div className="pb">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <button className="btn bo bsm" onClick={() => { loadAllData(); renderRouteData(); }}>
            🔄 Refresh
          </button>
        </div>
        {/* Attendance Form Card */}
        <div className="card">
          <div className="ch">
            <h3>🕐 Mark Today's Attendance</h3>
          </div>
          <div className="cb">
            {todayRecord ? (
              <div className={`atoday ist-${todayRecord.status}`} style={{ justifyContent: 'space-between' }}>
                <span>
                  {ATLBL[todayRecord.status]} — marked for today
                  {todayRecord.presentTime ? ` at ${todayRecord.presentTime}` : ''}
                  {todayRecord.remarks ? ` · ${todayRecord.remarks}` : ''}
                </span>
                {todayRecord.photo && (
                  <img
                    src={todayRecord.photo}
                    alt="Attendance"
                    className="athumb"
                    onClick={() =>
                      showPhotoModal && showPhotoModal({
                        ph: todayRecord.photo,
                        co: user.name,
                        dno: '',
                        st: ATLBL[todayRecord.status],
                        lat: todayRecord.lat,
                        lng: todayRecord.lng,
                        ts: todayRecord.ts,
                        offName: user.name,
                      })
                    }
                  />
                )}
              </div>
            ) : (
              <div className="atoday" style={{ background: 'var(--bg)', color: 'var(--mu)', borderColor: 'var(--br)' }}>
                ⏳ Attendance not marked yet for today
              </div>
            )}

            {/* GPS Banner */}
            {lat && lng ? (
              <div className="atoday ist-present" style={{ justifyContent: 'space-between' }}>
                <span>📍 <strong>Location permission granted</strong> — {lat}, {lng}</span>
                <button type="button" className="btn bo bsm" onClick={refreshGPS}>🔄 Update</button>
              </div>
            ) : (
              <div className="atoday" style={{ background: 'var(--aml)', color: 'var(--am)', borderColor: 'rgba(217,119,6,.2)', justifyContent: 'space-between' }}>
                <span>📍 <strong>Location permission required</strong> to mark attendance</span>
                <button type="button" className="btn ba bsm" onClick={refreshGPS}>Enable Location</button>
              </div>
            )}

            {/* Attendance Options */}
            <div className="aopt">
              <div
                className={`aob ${attStatus === 'present' ? 'sel-present' : ''}`}
                onClick={() => selectAttOption('present')}
              >
                <span>🟢</span>Present
              </div>
              <div
                className={`aob ${attStatus === 'absent' ? 'sel-absent' : ''}`}
                onClick={() => selectAttOption('absent')}
              >
                <span>🔴</span>Absent
              </div>
              <div
                className={`aob ${attStatus === 'office' ? 'sel-office' : ''}`}
                onClick={() => selectAttOption('office')}
              >
                <span>🟡</span>In Office
              </div>
            </div>

            {/* GPS-tagged Attendance Photo (Present) */}
            {attStatus === 'present' && (
              <div style={{ marginTop: '13px' }}>
                <label style={{ display: 'block', marginBottom: '6px' }}>
                  📷 Attendance Photo <span className="r">*</span>
                  <span className="muted" style={{ marginLeft: '6px' }}>GPS auto-tagged</span>
                </label>

                {!cameraActive && !cameraLoading && !capturedPhoto && (
                  <>
                    <div className="pha" onClick={startCamera}>
                      <div>
                        <div style={{ fontSize: '36px' }}>📷</div>
                        <p className="fw6 mt8">Tap to Open Camera</p>
                        <p className="muted mt8">Live photo — GPS coordinates auto-embedded</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                      <button
                        type="button"
                        className="btn bo bsm"
                        onClick={() => document.getElementById('att-native-camera-fallback').click()}
                      >
                        📂 Or Upload Photo from Device
                      </button>
                    </div>
                  </>
                )}

                {cameraLoading && (
                  <div className="pha" style={{ cursor: 'default' }}>
                    <div>
                      <div style={{ fontSize: '36px' }}>⏳</div>
                      <p className="fw6 mt8">Opening camera…</p>
                      <p className="muted mt8">Please allow camera access if prompted.</p>
                    </div>
                  </div>
                )}

                {cameraActive && (
                  <div id="camWrap">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{
                        width: '100%',
                        maxHeight: '320px',
                        borderRadius: '12px',
                        background: '#000',
                        objectFit: 'cover',
                      }}
                    />
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '10px', flexWrap: 'wrap' }}>
                      <button type="button" className="btn bo bsm" onClick={stopCamera}>
                        ✕ Cancel
                      </button>
                      <button type="button" className="btn bb blg" onClick={capturePhoto} disabled={!cameraReady}>
                        📸 Capture Photo
                      </button>
                    </div>
                  </div>
                )}

                {capturedPhoto && (
                  <div style={{ textAlign: 'center' }}>
                    <img
                      src={capturedPhoto}
                      alt="Attendance"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '240px',
                        borderRadius: '12px',
                        margin: '0 auto',
                        display: 'block',
                        boxShadow: 'var(--shadow-md)',
                      }}
                    />
                    <button type="button" className="btn bo bsm" style={{ marginTop: '10px' }} onClick={retakePhoto}>
                      🔄 Retake Photo
                    </button>
                    <div className="gtag" style={{ display: 'block' }}>
                      📍 <strong>GPS Tagged:</strong> {lat && lng ? `${lat}, ${lng}` : 'Not available yet'}
                    </div>
                  </div>
                )}

                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  id="att-native-camera-fallback"
                  style={{ display: 'none' }}
                  onChange={handleNativeCameraCapture}
                />
              </div>
            )}

            <div className="g2" style={{ marginTop: '13px' }}>
              {attStatus && attStatus !== 'absent' && (
                <div className="fg">
                  <label>Present Time</label>
                  <input type="text" value={presentTime} readOnly />
                </div>
              )}
              {attStatus === 'absent' && (
                <div className="fg full">
                  <label>Remarks <span className="r">*</span></label>
                  <input
                    type="text"
                    placeholder="Reason for absence"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div style={{ marginTop: '13px', textAlign: 'right' }}>
              <button type="button" className="btn bb" onClick={handleSaveAttendance}>
                💾 Save Attendance
              </button>
            </div>

            <div className="divider" />
            <p className="muted mb8">My Attendance History</p>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Present Time</th>
                    <th>Remarks</th>
                    <th>Photo</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length > 0 ? (
                    [...history]
                      .reverse()
                      .slice(0, 15)
                      .map((a) => (
                        <tr key={a.id}>
                          <td>{a.date}</td>
                          <td>
                            <span className={`bdg ${a.status === 'present' ? 'dg' : a.status === 'absent' ? 'dr' : 'da'}`}>
                              {ATLBL[a.status]}
                            </span>
                          </td>
                          <td>{a.presentTime || '—'}</td>
                          <td>{a.remarks || '—'}</td>
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
                                    st: ATLBL[a.status],
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
                      <td colSpan="5" style={{ textAlign: 'center', padding: '18px', color: 'var(--mu)' }}>
                        No attendance records yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Route Card */}
        <div className="card">
          <div className="ch">
            <h3>🗺️ My Route Today</h3>
            <span className="muted" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: 'var(--gn)',
                  display: 'inline-block',
                  animation: 'pulseLive 1.4s ease-in-out infinite',
                }}
              />
              LIVE — updates automatically
            </span>
          </div>
          <div className="cb">
            <div ref={routeMapRef} id="my-route-map" />
            <div className="wproute" id="my-route-list">
              {waypoints.length > 0 ? (
                waypoints.map((it, idx) => (
                  <div key={idx} className="wpitem">
                    <div className={`wpdot ${it.isVisit ? 'wpv' : ''}`}>{it.isVisit ? '🏢' : idx + 1}</div>
                    <div>
                      🕐 {new Date(it.ts).toLocaleTimeString('en-IN')} — {it.html}
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty">
                  <div className="ei">📍</div>
                  <p>No route data recorded yet today</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
