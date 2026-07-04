import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { DB } from '../utils/db';

// Fix Leaflet default icon paths in bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const ASLBL = {
  doc_collection: '📄 Doc. Collection',
  approval: '✅ Approval',
  payment_paid: '💰 Payment Paid',
  close: '🔒 Close',
  others: '📌 Others',
};

const ZONES = ['North Zone', 'South Zone', 'East Zone', 'West Zone', 'Central Zone'];

export default function NewVisit({ user, lat, lng, accuracy, refreshGPS, showToast, openConfirmationModal }) {
  const [assessmentNo, setAssessmentNo] = useState('');
  const [company, setCompany] = useState('');
  const [contact, setContact] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  const [doorNo, setDoorNo] = useState('');
  const [street, setStreet] = useState('');
  const [ward, setWard] = useState('');
  const [zone, setZone] = useState('');
  const [regStatus, setRegStatus] = useState(''); // 'register' or 'unregister'
  const [payStatus, setPayStatus] = useState(''); // 'paid', 'not_paid', 'new_application'
  const [amount, setAmount] = useState('');
  const [appStatus, setAppStatus] = useState(''); // 'doc_collection', 'approval', etc.
  const [hasGST, setHasGST] = useState(false);
  const [hasPAN, setHasPAN] = useState(false);
  const [rentalNeed, setRentalNeed] = useState(false);
  const [staffCount, setStaffCount] = useState('');
  const [periodFrom, setPeriodFrom] = useState('');
  const [remarks, setRemarks] = useState('');
  const [description, setDescription] = useState('');
  
  // Assessment check state
  const [asmResult, setAsmResult] = useState({ show: false, found: false, text: '' });
  const [isNewApp, setIsNewApp] = useState(false);

  // Photo states
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null); // base64 data URL
  const [photoMeta, setPhotoMeta] = useState(null); // size and name
  const [cameraMode, setCameraMode] = useState('environment'); // 'user' or 'environment'
  const [dateTimeStr] = useState(new Date().toLocaleString('en-IN'));

  // Backend visits list state
  const [visitsList, setVisitsList] = useState([]);

  const loadVisits = async () => {
    try {
     const data = await DB.todayVisits(user.id);
      setVisitsList(data);
    } catch (err) {
      console.error('Failed to load visits:', err);
    }
  };

  useEffect(() => {
    loadVisits();
  }, []);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current) return;
    
    // Map initial center
    const defaultCenter = lat && lng ? [parseFloat(lat), parseFloat(lng)] : [20.5937, 78.9629];
    const zoomLevel = lat && lng ? 16 : 5;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current).setView(defaultCenter, zoomLevel);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(mapInstanceRef.current);
    }

    return () => {
      // Clean up map instance on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update map marker when coordinates change
  useEffect(() => {
    if (!mapInstanceRef.current || !lat || !lng) return;
    const pos = [parseFloat(lat), parseFloat(lng)];
    
    mapInstanceRef.current.setView(pos, 16);

    if (markerRef.current) {
      markerRef.current.setLatLng(pos);
    } else {
      markerRef.current = L.marker(pos)
        .addTo(mapInstanceRef.current)
        .bindPopup(`📍 ${user.name}<br>${lat}, ${lng}`)
        .openPopup();
    }
  }, [lat, lng, user.name]);

  // Handle Assessment Lookup
  const handleAssessmentChange = (val) => {
    setAssessmentNo(val);
    const searchVal = val.trim();
    if (!searchVal) {
      setAsmResult({ show: false, found: false, text: '' });
      setIsNewApp(false);
      return;
    }

    const found = visitsList.find(
      (v) => v.asn && v.asn.toLowerCase() === searchVal.toLowerCase()
    );

    if (found) {
      setAsmResult({
        show: true,
        found: true,
        text: `✅ Assessment Found! — ${found.co}, ${found.dno ? found.dno + ', ' : ''}${found.st} (Ward ${found.wd}, ${found.zn})`,
      });
      setIsNewApp(false);
      setCompany(found.co);
      setDoorNo(found.dno || '');
      setStreet(found.st || '');
      setWard(found.wd || '');
      setZone(found.zn || '');
    } else {
      setAsmResult({
        show: true,
        found: false,
        text: `⚠️ New Assessment — Not in database.`,
      });
      setIsNewApp(false);
      // Clear fields to let user enter new property
      setCompany('');
      setDoorNo('');
      setStreet('');
      setWard('');
      setZone('');
    }
  };

  const markNewApplication = () => {
    setIsNewApp(true);
    showToast('Marked as New Application', 'blue');
  };

  const waitForCameraReady = async () => {
    const video = videoRef.current;
    if (!video) return false;

    const isReady = () => (
      (video.readyState >= 2) &&
      ((video.videoWidth > 0) || (video.videoHeight > 0) || (video.clientWidth > 0 && video.clientHeight > 0))
    );

    if (isReady()) {
      return true;
    }

    return await new Promise((resolve) => {
      let resolved = false;
      const cleanup = () => {
        video.removeEventListener('loadedmetadata', onReady);
        video.removeEventListener('canplay', onReady);
        video.removeEventListener('playing', onReady);
      };

      const onReady = () => {
        if (resolved) return;
        if (isReady()) {
          resolved = true;
          cleanup();
          resolve(true);
        }
      };

      video.addEventListener('loadedmetadata', onReady, { once: true });
      video.addEventListener('canplay', onReady, { once: true });
      video.addEventListener('playing', onReady, { once: true });

      window.setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(isReady());
        }
      }, 5000);
    });
  };

  // Attach the camera stream to the <video> element only once it has actually
  // mounted. Previously the stream was attached to videoRef.current inside
  // startCamera() BEFORE cameraActive became true — but the <video> tag is only
  // rendered when cameraActive is true, so videoRef.current was still null at
  // that point. The attach step silently no-op'd, the video element mounted
  // with no stream, and both the live preview and every captured photo came
  // out solid black (the CSS fallback background). This effect runs after the
  // element is in the DOM, so the stream is guaranteed to attach correctly.
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
      const ready = await waitForCameraReady();
      if (cancelled) return;
      if (!ready) {
        stopCamera();
        setCameraLoading(false);
        showToast('Unable to open the camera preview. Please check camera permission and try again.', 'red');
        return;
      }
      setCameraReady(true);
      setCameraLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [cameraActive]);

  // Camera Functions
  const startCamera = async (preferredMode = cameraMode) => {
    setCameraReady(false);
    setCameraLoading(true);

    const isSecureContext = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !isSecureContext) {
      setCameraLoading(false);
      showToast('Opening native mobile camera...', 'blue');
      const fallbackInput = document.getElementById('native-camera-fallback');
      if (fallbackInput) {
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
        { video: { facingMode: { ideal: preferredMode } }, audio: false },
        { video: { facingMode: { ideal: preferredMode === 'environment' ? 'user' : 'environment' } }, audio: false },
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
      // Mount the <video> element; the useEffect above attaches the stream
      // once videoRef.current is guaranteed to point at the mounted node.
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

  const toggleCameraMode = () => {
    const nextMode = cameraMode === 'environment' ? 'user' : 'environment';
    setCameraMode(nextMode);
    stopCamera();
    setTimeout(() => {
      startCamera(nextMode);
    }, 150);
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

    // Safety net: on some devices readyState can report "ready" a moment
    // before the first real frame is actually composited. If the drawn
    // frame is solid black, retry once on the next animation frame.
    const sample = ctx.getImageData(0, 0, Math.min(canvas.width, 50), Math.min(canvas.height, 50)).data;
    let isBlack = true;
    for (let i = 0; i < sample.length; i += 4) {
      if (sample[i] > 8 || sample[i + 1] > 8 || sample[i + 2] > 8) {
        isBlack = false;
        break;
      }
    }
    if (isBlack) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }

    // Burn GPS coordinates + timestamp on image
    const stamp1 = lat && lng ? `📍 Lat: ${lat}, Long: ${lng}` : '📍 GPS not available';
    const stamp2 = `🕐 ${new Date().toLocaleString('en-IN')}`;
    const fontSize = Math.max(16, Math.round(canvas.width * 0.028));
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
    setPhotoMeta({
      name: `visit_${Date.now()}.jpg`,
      size: Math.round(base64Data.length * 0.75),
    });

    stopCamera();
    showToast('Photo captured successfully!', 'green');
  };

  const handleNativeCameraCapture = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        
        // Scale down to max 1280px to save storage/bandwidth
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

        // Burn GPS coordinates + timestamp on image
        const stamp1 = lat && lng ? `📍 Lat: ${lat}, Long: ${lng}` : '📍 GPS not available';
        const stamp2 = `🕐 ${new Date().toLocaleString('en-IN')}`;
        const fontSize = Math.max(16, Math.round(canvas.width * 0.028));
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
        setPhotoMeta({
          name: file.name || `visit_${Date.now()}.jpg`,
          size: Math.round(base64Data.length * 0.75),
        });
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

  // Duplicate Check
  const checkDuplicates = (coName, asmNum, photoSize, photoName) => {
    const dups = [];
    visitsList.forEach((v) => {
      const reasons = [];
      const cleanVAsn = (v.asn || '').trim().toLowerCase();
      const cleanAsmNum = (asmNum || '').trim().toLowerCase();
      
      if (cleanAsmNum && cleanVAsn && cleanVAsn === cleanAsmNum) {
        reasons.push(`Duplicate assessment number (${asmNum})`);
      } else if (v.co.toLowerCase() === coName.toLowerCase() && cleanVAsn && cleanAsmNum && cleanVAsn === cleanAsmNum) {
        reasons.push('Same company + assessment number');
      }
      if (photoSize && v.phf && v.phf.size === photoSize && v.phf.name === photoName) {
        reasons.push('Identical photo file');
      }
      if (reasons.length > 0) {
        dups.push({ visit: v, reasons });
      }
    });
    return dups;
  };

  // Submit Handler
  const handleSubmit = (e) => {
    e.preventDefault();
    const coName = company.trim();
    const asmNum = assessmentNo.trim();
    
    if (!regStatus) {
      showToast('Select Register or Unregister', 'amber');
      return;
    }
    if (regStatus === 'register') {
      if (!payStatus) {
        showToast('Select a Payment Status', 'amber');
        return;
      }
      if (payStatus === 'new_application' && !appStatus) {
        showToast('Select an Application Status', 'amber');
        return;
      }
    }

    // Perform duplicate checks
    const dups = checkDuplicates(coName, asmNum, photoMeta?.size, photoMeta?.name);
    if (dups.length > 0) {
      const reasonString = dups.map((d) => d.reasons.join(', ')).join('; ');
      
      // Save Alert in DB
      DB.saveAlert({
        offId: user.id,
        offName: user.name,
        co: coName,
        asn: asmNum,
        reason: reasonString,
      }).catch((err) => console.error('Failed to save duplicate alert:', err));

      // Open React confirm modal
      openConfirmationModal(
        '⚠️',
        'Duplicate Detected!',
        `Possible duplicate: ${reasonString}. Alert sent to admin. Click "Submit Anyway" to confirm submission.`,
        () => saveVisit(coName, asmNum),
        true,
        'Submit Anyway',
        { backgroundColor: 'var(--rd)' }
      );
      return;
    }

    saveVisit(coName, asmNum);
  };

  const saveVisit = (coName, asmNum) => {
    const isNewRegistration = isNewApp || payStatus === 'new_application';
    
    const visitData = {
      id: Date.now(),
      offId: user.id,
      offName: user.name,
      contact: contact.trim(),
      co: coName,
      asn: asmNum,
      dno: doorNo.trim(),
      st: street.trim(),
      wd: ward.trim(),
      zn: zone,
      isNew: isNewRegistration,
      reg: regStatus,
      pay: regStatus === 'register' ? payStatus : '',
      amt: regStatus === 'register' && payStatus === 'paid' ? (parseFloat(amount) || 0) : 0,
      appStatus: regStatus === 'register' && payStatus === 'new_application' ? appStatus : '',
      appRemarks: regStatus === 'register' && payStatus === 'new_application' ? remarks : '',
      docs: {
        gst: regStatus === 'register' && payStatus === 'new_application' && appStatus === 'doc_collection' ? hasGST : false,
        pan: regStatus === 'register' && payStatus === 'new_application' && appStatus === 'doc_collection' ? hasPAN : false,
        rentalNeed: regStatus === 'register' && payStatus === 'new_application' && appStatus === 'doc_collection' ? rentalNeed : false,
        staffCount: staffCount ? parseInt(staffCount, 10) : 0,
        periodFrom: regStatus === 'register' && payStatus === 'new_application' && appStatus === 'doc_collection' ? periodFrom : '',
        contactPerson: contactPerson.trim(),
        email: email.trim(),
        gstNumber: gstNumber.trim(),
      },
      remarks: regStatus === 'register' ? remarks : remarks,
      desc: description,
      lat: lat || null,
      lng: lng || null,
      ph: capturedPhoto,
      phf: photoMeta,
      ts: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],
    };

    DB.saveVisit(visitData)
      .then(() => {
        showToast('Visit submitted successfully! ✅', 'green');
        
        // Generate formatted text for WhatsApp share
        const formattedWhatsAppText = `ZONE : ${visitData.zn.toUpperCase()}

WARD : ${visitData.wd}

COMPANY NAME : ${visitData.co.toUpperCase()}

CONTACT PERSON : ${visitData.docs.contactPerson.toUpperCase()}

MOBILE NUMBER : ${visitData.contact}

E-mail 📩 : ${visitData.docs.email}

PROFESSIONAL TAX ASSESSMENT NUMBER : ${visitData.asn}

GST NUMBER : ${visitData.docs.gstNumber}

STAFF COUNT : ${visitData.docs.staffCount ? String(visitData.docs.staffCount).padStart(2, '0') : ''}

REMARKS : ${(visitData.remarks || (visitData.pay === 'new_application' ? 'NEW APPLICATION' : visitData.pay)).toUpperCase()}`;

        setSubmittedData({
          text: formattedWhatsAppText,
        });
        setIsSubmitted(true);
        setIsCopied(false);
      })
      .catch((err) => {
        showToast('Failed to save visit: ' + err.message, 'red');
      });
  };

  const resetForm = () => {
    setAssessmentNo('');
    setCompany('');
    setContact('');
    setContactPerson('');
    setEmail('');
    setGstNumber('');
    setDoorNo('');
    setStreet('');
    setWard('');
    setZone('');
    setRegStatus('');
    setPayStatus('');
    setAmount('');
    setAppStatus('');
    setHasGST(false);
    setHasPAN(false);
    setRentalNeed(false);
    setStaffCount('');
    setPeriodFrom('');
    setRemarks('');
    setDescription('');
    setAsmResult({ show: false, found: false, text: '' });
    setIsNewApp(false);
    setCapturedPhoto(null);
    setPhotoMeta(null);
    setCameraReady(false);
    stopCamera();
  };

  if (isSubmitted && submittedData) {
    return (
      <div className="view on">
        <div className="pb" style={{ maxWidth: '500px', margin: '0 auto' }}>
          <div className="card text-center" style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
            <h2 style={{ marginBottom: '8px' }}>Visit Saved Successfully!</h2>
            <p className="muted" style={{ marginBottom: '24px' }}>
              Your visit details have been recorded. You can now copy the formatted details and send them to WhatsApp.
            </p>

            {/* Formatted Text Preview box */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--br)',
              borderRadius: '8px',
              padding: '16px',
              textAlign: 'left',
              fontFamily: 'monospace',
              fontSize: '13px',
              whiteSpace: 'pre-wrap',
              marginBottom: '20px',
              color: 'var(--fg)',
              maxHeight: '260px',
              overflowY: 'auto'
            }}>
              {submittedData.text}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                type="button"
                className="btn bb"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  backgroundColor: isCopied ? '#25d366' : 'var(--bb)',
                  borderColor: isCopied ? '#25d366' : 'var(--bb)',
                  color: '#fff',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  navigator.clipboard.writeText(submittedData.text)
                    .then(() => {
                      setIsCopied(true);
                      showToast('Copied to Clipboard! 📋', 'green');
                      // Open WhatsApp group invite link in new tab
                      setTimeout(() => {
                        window.open('https://chat.whatsapp.com/Bu7mRiit9qt6ZMLqzbjGxu?s=cl&p=a&ilr=0', '_blank');
                      }, 400);
                    })
                    .catch((err) => {
                      showToast('Failed to copy: ' + err.message, 'red');
                    });
                }}
              >
                {isCopied ? '✅ Copied!' : '📋 Copy & Send to WhatsApp'}
              </button>

              <button
                type="button"
                className="btn bo"
                style={{ width: '100%', padding: '12px', fontSize: '16px', cursor: 'pointer' }}
                onClick={() => {
                  setIsSubmitted(false);
                  setSubmittedData(null);
                  resetForm();
                  loadVisits();
                }}
              >
                ➕ Record Another Visit
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="view on">
      <div className="pb">
        <form onSubmit={handleSubmit}>
          {/* Officer Info */}
          <div className="card">
            <div className="ch">
              <h3>👤 Officer Information</h3>
            </div>
            <div className="cb">
              <div className="g2">
                <div className="fg">
                  <label>Field Officer Name</label>
                  <input value={user.name} readOnly />
                </div>
                <div className="fg">
                  <label>Date &amp; Time</label>
                  <input value={dateTimeStr} readOnly />
                </div>
              </div>
            </div>
          </div>

          {/* Property Details */}
          <div className="card">
            <div className="ch">
              <h3>🏢 Property Details</h3>
              <span className="muted">Enter assessment no. to check database</span>
            </div>
            <div className="cb">
              <div className="fg" style={{ marginBottom: '14px' }}>
                <label>Assessment Number</label>
                <input
                  type="text"
                  placeholder="e.g. WD-2024-001"
                  value={assessmentNo}
                  onChange={(e) => handleAssessmentChange(e.target.value)}
                />
                {asmResult.show && (
                  <div className={`asb ${asmResult.found ? 'asf' : 'asn'}`}>
                    <span dangerouslySetInnerHTML={{ __html: asmResult.text }} />
                  </div>
                )}

              </div>
              <div className="g2">
                <div className="fg">
                  <label>Company / Owner Name <span className="r">*</span></label>
                  <input
                    type="text"
                    placeholder="Company name"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    required
                  />
                </div>
                <div className="fg">
                  <label>Contact Person <span className="r">*</span></label>
                  <input
                    type="text"
                    placeholder="Contact person name"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    required
                  />
                </div>
                <div className="fg">
                  <label>Contact / Mobile No. <span class="r">*</span></label>
                  <input
                    type="tel"
                    placeholder="10-digit mobile number"
                    maxLength={10}
                    pattern="[0-9]{10}"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    required
                  />
                </div>
                <div className="fg">
                  <label>E-mail</label>
                  <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="fg">
                  <label>Door No. <span className="r">*</span></label>
                  <input
                    type="text"
                    placeholder="e.g. 14"
                    value={doorNo}
                    onChange={(e) => setDoorNo(e.target.value)}
                    required
                  />
                </div>
                <div className="fg">
                  <label>Street Name <span className="r">*</span></label>
                  <input
                    type="text"
                    placeholder="Street name"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    required
                  />
                </div>
                <div className="fg">
                  <label>Ward No. <span className="r">*</span></label>
                  <input
                    type="text"
                    placeholder="e.g. 12"
                    value={ward}
                    onChange={(e) => setWard(e.target.value)}
                    required
                  />
                </div>
                <div className="fg">
                  <label>Zone <span className="r">*</span></label>
                  <select
                    value={zone}
                    onChange={(e) => setZone(e.target.value)}
                    required
                  >
                    <option value="">Select Zone</option>
                    {ZONES.map((z) => (
                      <option key={z} value={z}>{z}</option>
                    ))}
                  </select>
                </div>
                <div className="fg">
                  <label>GST Number</label>
                  <input
                    type="text"
                    placeholder="15-digit GSTIN"
                    maxLength={15}
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value)}
                  />
                </div>
                <div className="fg">
                  <label>Staff Count</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 5"
                    value={staffCount}
                    onChange={(e) => setStaffCount(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Payment Details */}
          <div className="card">
            <div className="ch">
              <h3>💰 Payment Details</h3>
            </div>
            <div className="cb">
              <div className="fg" style={{ marginBottom: '14px' }}>
                <label>Registration Status <span className="r">*</span></label>
                <div className="rdgrp">
                  <label className="rdopt">
                    <input
                      type="radio"
                      name="vreg"
                      value="register"
                      checked={regStatus === 'register'}
                      onChange={() => setRegStatus('register')}
                      required
                    />{' '}
                    📗 Register
                  </label>
                  <label className="rdopt">
                    <input
                      type="radio"
                      name="vreg"
                      value="unregister"
                      checked={regStatus === 'unregister'}
                      onChange={() => {
                        setRegStatus('unregister');
                        setPayStatus('');
                        setAmount('');
                        setAppStatus('');
                      }}
                    />{' '}
                    📕 Unregister
                  </label>
                </div>
              </div>

              {/* REGISTER BLOCK */}
              {regStatus === 'register' && (
                <div>
                  <div className="g2">
                    <div className="fg">
                      <label>Payment Status <span class="r">*</span></label>
                      <select
                        value={payStatus}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPayStatus(val);
                          if (val !== 'paid') setAmount('');
                          if (val !== 'new_application') {
                            setAppStatus('');
                            setHasGST(false);
                            setHasPAN(false);
                          }
                        }}
                        required
                      >
                        <option value="">Select Status</option>
                        <option value="paid">✅ Paid</option>
                        <option value="not_paid">❌ Unpaid</option>
                        <option value="new_application">📄 New Application</option>
                      </select>
                    </div>
                    {payStatus === 'paid' && (
                      <div className="fg">
                        <label>Amount Paid (₹) <span className="r">*</span></label>
                        <input
                          type="number"
                          placeholder="Enter amount"
                          min="0"
                          step="0.01"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          required
                        />
                      </div>
                    )}
                  </div>

                  {/* New Application block */}
                  {payStatus === 'new_application' && (
                    <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px dashed var(--br)' }}>
                      <div className="g2">
                        <div className="fg">
                          <label>Application Status <span className="r">*</span></label>
                          <select
                            value={appStatus}
                            onChange={(e) => {
                              const val = e.target.value;
                              setAppStatus(val);
                              if (val !== 'doc_collection') {
                                setHasGST(false);
                                setHasPAN(false);
                              }
                            }}
                            required
                          >
                            <option value="">Select Status</option>
                            <option value="doc_collection">📄 Document</option>
                            <option value="approval">✅ Approval</option>
                            <option value="payment_paid">💰 Payment Paid</option>
                            <option value="close">🔒 Close</option>
                            <option value="others">📌 Others</option>
                          </select>
                        </div>
                      </div>

                      {/* Doc checklist */}
                      {appStatus === 'doc_collection' && (
                        <div style={{ marginTop: '13px' }}>
                          <label>Documents Checklist</label>
                          <div className="rdgrp">
                            <label className="rdopt">
                              <input
                                type="checkbox"
                                checked={hasGST}
                                onChange={(e) => setHasGST(e.target.checked)}
                              />{' '}
                              🧾 GST
                            </label>
                            <label className="rdopt">
                              <input
                                type="checkbox"
                                checked={hasPAN}
                                onChange={(e) => setHasPAN(e.target.checked)}
                              />{' '}
                              🪪 PAN
                            </label>
                            <label className="rdopt">
                              <input
                                type="checkbox"
                                checked={rentalNeed}
                                onChange={(e) => setRentalNeed(e.target.checked)}
                              />{' '}
                              🏘️ Rental Deed
                            </label>
                          </div>

                          <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                            <div className="fg" style={{ margin: 0 }}>
                              <label style={{ display: 'block' }}>Period From</label>
                              <input
                                type="date"
                                value={periodFrom}
                                onChange={(e) => setPeriodFrom(e.target.value)}
                                style={{ width: '180px' }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="g2" style={{ marginTop: '13px' }}>
                    <div className="fg">
                      <label>Remarks</label>
                      <input
                        type="text"
                        placeholder="Add remarks"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                      />
                    </div>
                    <div className="fg">
                      <label>Description</label>
                      <input
                        type="text"
                        placeholder="Add description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* UNREGISTER BLOCK */}
              {regStatus === 'unregister' && (
                <div className="g2">
                  <div className="fg">
                    <label>Remarks</label>
                    <input
                      type="text"
                      placeholder="Add remarks"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                    />
                  </div>
                  <div className="fg">
                    <label>Description</label>
                    <input
                      type="text"
                      placeholder="Add description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* GPS Location Map */}
          <div className="card">
            <div className="ch">
              <h3>📍 GPS Location</h3>
              <button
                type="button"
                className="btn bo bsm"
                onClick={() => {
                  refreshGPS();
                  showToast('Refreshing GPS…', 'blue');
                }}
              >
                🔄 Refresh
              </button>
            </div>
            <div className="cb">
              <div ref={mapRef} id="gps-map" />
              <div className="g3">
                <div className="fg">
                  <label>Latitude</label>
                  <input value={lat || ''} readOnly placeholder="Auto" />
                </div>
                <div className="fg">
                  <label>Longitude</label>
                  <input value={lng || ''} readOnly placeholder="Auto" />
                </div>
                <div className="fg">
                  <label>Accuracy (m)</label>
                  <input value={accuracy || '—'} readOnly placeholder="—" />
                </div>
              </div>
            </div>
          </div>

          {/* Photo capture */}
          <div className="card">
            <div className="ch">
              <h3>📷 Visit Photo</h3>
              <span className="muted">Live camera only · GPS auto-tagged</span>
            </div>
            <div className="cb">
              {!cameraActive && !cameraLoading && !capturedPhoto && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
                    <button
                      type="button"
                      className={`btn bsm ${cameraMode === 'environment' ? 'bb' : 'bo'}`}
                      style={{ padding: '6px 12px', fontSize: '12.5px' }}
                      onClick={() => setCameraMode('environment')}
                    >
                      📷 Back Camera
                    </button>
                    <button
                      type="button"
                      className={`btn bsm ${cameraMode === 'user' ? 'bb' : 'bo'}`}
                      style={{ padding: '6px 12px', fontSize: '12.5px' }}
                      onClick={() => setCameraMode('user')}
                    >
                      🤳 Front/Selfie Camera
                    </button>
                  </div>
                  <div className="pha" onClick={() => startCamera()}>
                    <div>
                      <div style={{ fontSize: '42px' }}>📷</div>
                      <p className="fw6 mt8">Tap to Open Camera</p>
                      <p className="muted mt8">
                        Live photo capture — GPS coordinates will be auto-embedded.
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
                    <button
                      type="button"
                      className="btn bo bsm"
                      onClick={() => document.getElementById('native-camera-fallback').click()}
                    >
                      📂 Or Upload Photo from Device
                    </button>
                  </div>
                </>
              )}

              {cameraLoading && (
                <div className="pha" style={{ cursor: 'default' }}>
                  <div>
                    <div style={{ fontSize: '42px' }}>⏳</div>
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
                      maxHeight: '340px',
                      borderRadius: '12px',
                      background: '#000',
                      objectFit: 'cover',
                    }}
                  />
                              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '10px', flexWrap: 'wrap' }}>
                    <button type="button" className="btn bo bsm" onClick={stopCamera}>
                      ✕ Cancel
                    </button>
                    <button type="button" className="btn bo bsm" onClick={toggleCameraMode}>
                      🔄 Switch Camera
                    </button>
                    <button type="button" className="btn bb blg" onClick={capturePhoto} disabled={!cameraReady}>
                      📸 Capture Photo
                    </button>
                  </div>
                </div>
              )}

              {capturedPhoto && (
                <div id="phPrevWrap" style={{ textAlign: 'center' }}>
                  <img
                    id="phpr"
                    src={capturedPhoto}
                    alt="Captured preview"
                    style={{ display: 'block', margin: '0 auto' }}
                  />
                  <button type="button" className="btn bo bsm" style={{ marginTop: '10px' }} onClick={retakePhoto}>
                    🔄 Retake Photo
                  </button>
                </div>
              )}

              {capturedPhoto && (
                <div className="gtag" style={{ display: 'block' }}>
                  📍 <strong>GPS Tagged:</strong> {lat && lng ? `${lat}, ${lng}` : 'Not available yet'}
                </div>
              )}

              {photoMeta && (
                <div style={{ fontSize: '11.5px', color: 'var(--mu)', marginTop: '6px' }}>
                  📷 Live capture ({(photoMeta.size / 1024).toFixed(1)} KB) — GPS stamped
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                capture={cameraMode}
                id="native-camera-fallback"
                style={{ display: 'none' }}
                onChange={handleNativeCameraCapture}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button type="button" className="btn bo" onClick={resetForm}>
              🔄 Reset
            </button>
            <button type="submit" className="btn bb blg">
              ✅ Submit Visit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
