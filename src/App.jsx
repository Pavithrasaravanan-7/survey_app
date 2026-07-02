import React, { useState, useEffect, useRef } from 'react';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Modal from './components/Modal';
import ToastContainer from './components/Toast';
import { DB } from './utils/db';

// Views
import NewVisit from './views/NewVisit';
import MyVisits from './views/MyVisits';
import OfficerAttendance from './views/OfficerAttendance';
import AdminDashboard from './views/AdminDashboard';
import AdminAllVisits from './views/AdminAllVisits';
import AdminFieldOfficers from './views/AdminFieldOfficers';
import AdminGPSTracking from './views/AdminGPSTracking';
import AdminReports from './views/AdminReports';
import AdminAttendance from './views/AdminAttendance';
import AdminSettings from './views/AdminSettings';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentTab, setCurrentTab] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Modals and notifications states
  const [toasts, setToasts] = useState([]);
  const [modalState, setModalState] = useState({
    isOpen: false,
    icon: '⚠️',
    title: 'Alert',
    message: '',
    onConfirm: null,
    showCancel: false,
    confirmText: 'OK',
    confirmBtnStyle: {},
  });

  const [previewPhoto, setPreviewPhoto] = useState(null); // stores visit details for photo viewer

  // Geolocation state
  const [gps, setGps] = useState({ lat: null, lng: null, accuracy: null });
  const watchId = useRef(null);

  // Background watch GPS for officers
  useEffect(() => {
    if (!currentUser || currentUser.role === 'admin') {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      setGps({ lat: null, lng: null, accuracy: null });
      return;
    }

    const startGPS = async () => {
      if (!navigator.geolocation) {
        showToast('GPS is not supported on this browser', 'amber');
        return;
      }

      try {
        if (navigator.permissions?.query) {
          const permission = await navigator.permissions.query({ name: 'geolocation' }).catch(() => null);
          if (permission?.state === 'denied') {
            showToast('Location permission is blocked. Please enable location access in your browser settings.', 'red');
            setGps({ lat: null, lng: null, accuracy: '—' });
            return;
          }
        }
      } catch (err) {
        console.warn('Geolocation permission query failed:', err);
      }

      const success = (pos) => {
        const cLat = pos.coords.latitude.toFixed(6);
        const cLng = pos.coords.longitude.toFixed(6);
        const cAcc = pos.coords.accuracy ? pos.coords.accuracy.toFixed(0) : '—';

        setGps({ lat: cLat, lng: cLng, accuracy: cAcc });

        // Post track point to backend
        DB.postTrackPoint(currentUser.id, currentUser.name, cLat, cLng)
          .catch((err) => console.error('Failed to log location to server:', err));
      };

      const error = (err) => {
        console.error('GPS error:', err);
        if (err.code === 1) {
          showToast('Location permission was denied. Please allow location access and try again.', 'red');
        } else if (err.code === 2) {
          showToast('Location is temporarily unavailable. Please try again.', 'amber');
        } else {
          showToast('Unable to get live GPS location right now.', 'amber');
        }
        setGps({ lat: null, lng: null, accuracy: '—' });
      };

      navigator.geolocation.getCurrentPosition(success, error, { enableHighAccuracy: true, timeout: 20000 });
      watchId.current = navigator.geolocation.watchPosition(success, error, {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 20000,
      });
    };

    startGPS();

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, [currentUser]);

  // Set default tabs on login
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'admin') {
        setCurrentTab('dash');
      } else {
        setCurrentTab('nv');
      }
    } else {
      setCurrentTab('');
    }
  }, [currentUser]);

  // Toast controls
  const showToast = (msg, type = 'blue') => {
    const id = Date.now() + Math.random().toString(36).substr(2, 5);
    setToasts((prev) => [...prev, { id, msg, type }]);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Confirmation Modal controls
  const openConfirmationModal = (
    icon,
    title,
    message,
    onConfirm,
    showCancel = false,
    confirmText = 'OK',
    confirmBtnStyle = {}
  ) => {
    setModalState({
      isOpen: true,
      icon,
      title,
      message,
      onConfirm,
      showCancel,
      confirmText,
      confirmBtnStyle,
    });
  };

  const closeConfirmationModal = () => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
  };

  const handleLogout = () => {
    openConfirmationModal(
      '🚪',
      'Logout?',
      'Are you sure you want to log out of the session?',
      () => {
        if (watchId.current !== null) {
          navigator.geolocation.clearWatch(watchId.current);
          watchId.current = null;
        }
        setCurrentUser(null);
        setPreviewPhoto(null);
        showToast('Logged out successfully', 'blue');
      },
      true
    );
  };

  const refreshGPSManually = async () => {
    if (!navigator.geolocation) {
      showToast('GPS is not supported', 'red');
      return;
    }

    try {
      if (navigator.permissions?.query) {
        const permission = await navigator.permissions.query({ name: 'geolocation' }).catch(() => null);
        if (permission?.state === 'denied') {
          showToast('Location permission is blocked. Please enable location access in your browser settings.', 'red');
          return;
        }
      }
    } catch (err) {
      console.warn('Geolocation permission query failed:', err);
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const cLat = pos.coords.latitude.toFixed(6);
        const cLng = pos.coords.longitude.toFixed(6);
        const cAcc = pos.coords.accuracy ? pos.coords.accuracy.toFixed(0) : '—';
        setGps({ lat: cLat, lng: cLng, accuracy: cAcc });
        showToast('GPS location updated', 'green');
      },
      (err) => {
        if (err.code === 1) {
          showToast('Location permission was denied. Please allow location access and try again.', 'red');
        } else {
          showToast('Failed to update GPS manually', 'red');
        }
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  // Rendering matching views
  const renderActiveView = () => {
    if (!currentUser) return null;

    if (currentUser.role === 'admin') {
      switch (currentTab) {
        case 'dash':
          return (
            <AdminDashboard
              openConfirmationModal={openConfirmationModal}
              showToast={showToast}
            />
          );
        case 'vis':
          return <AdminAllVisits showPhotoModal={setPreviewPhoto} />;
        case 'offs':
          return <AdminFieldOfficers />;
        case 'track':
          return <AdminGPSTracking showToast={showToast} />;
        case 'rpt':
          return <AdminReports showToast={showToast} />;
        case 'att':
          return <AdminAttendance showToast={showToast} showPhotoModal={setPreviewPhoto} />;
        case 'set':
          return (
            <AdminSettings
              openConfirmationModal={openConfirmationModal}
              showToast={showToast}
            />
          );
        default:
          return <AdminDashboard openConfirmationModal={openConfirmationModal} showToast={showToast} />;
      }
    } else {
      switch (currentTab) {
        case 'nv':
          return (
            <NewVisit
              user={currentUser}
              lat={gps.lat}
              lng={gps.lng}
              accuracy={gps.accuracy}
              refreshGPS={refreshGPSManually}
              showToast={showToast}
              openConfirmationModal={openConfirmationModal}
            />
          );
        case 'mv':
          return <MyVisits user={currentUser} showPhotoModal={setPreviewPhoto} />;
        case 'att':
          return (
            <OfficerAttendance
              user={currentUser}
              lat={gps.lat}
              lng={gps.lng}
              refreshGPS={refreshGPSManually}
              showToast={showToast}
              showPhotoModal={setPreviewPhoto}
            />
          );
        default:
          return (
            <NewVisit
              user={currentUser}
              lat={gps.lat}
              lng={gps.lng}
              accuracy={gps.accuracy}
              refreshGPS={refreshGPSManually}
              showToast={showToast}
              openConfirmationModal={openConfirmationModal}
            />
          );
      }
    }
  };

  const getHeaderTitle = () => {
    if (currentUser.role === 'admin') {
      const titles = {
        dash: '🏠 Admin Dashboard',
        vis: '📋 All Visits',
        offs: '👥 Field Officers',
        track: '📍 GPS Tracking',
        rpt: '📊 Reports',
        att: '✅ Attendance',
        set: '⚙️ Settings — User Management',
      };
      return titles[currentTab] || 'Admin Panel';
    } else {
      const titles = {
        nv: '📝 New Visit',
        mv: '📋 My Visits',
        att: '✅ Attendance',
      };
      return titles[currentTab] || 'Field Officer Panel';
    }
  };

  if (!currentUser) {
    return (
      <>
        <Login onLoginSuccess={setCurrentUser} showToast={showToast} />
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </>
    );
  }

  const gpsString = gps.lat && gps.lng ? `${gps.lat}, ${gps.lng}` : 'Tracking…';

  return (
    <div className="app">
      {/* Sidebar Navigation */}
      <Sidebar
        user={currentUser}
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        onLogout={handleLogout}
        gpsStatus={gpsString}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main View Area */}
      <div className="mn">
        {/* Header (with Hamburger menu trigger for mobile screen sizes) */}
        <div className="ph">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              className={`ham ${sidebarOpen ? 'open' : ''}`}
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <span />
              <span />
              <span />
            </button>
            <h2>{getHeaderTitle()}</h2>
          </div>
          {currentUser.role === 'off' && (
            <div className="gpsi">
              <div className="gpsd" />
              <span>{gpsString}</span>
            </div>
          )}
        </div>

        {/* View Component */}
        {renderActiveView()}
      </div>

      {/* Shared Modal Popup */}
      <Modal
        isOpen={modalState.isOpen}
        icon={modalState.icon}
        title={modalState.title}
        message={modalState.message}
        onConfirm={modalState.onConfirm}
        onClose={closeConfirmationModal}
        showCancel={modalState.showCancel}
        confirmText={modalState.confirmText}
        confirmBtnStyle={modalState.confirmBtnStyle}
      />

      {/* Shared Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Photo Preview Overlay */}
      {previewPhoto && (
        <div
          className="ovl op"
          style={{ display: 'flex', zIndex: 9500 }}
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="mdl"
            style={{
              maxWidth: '820px',
              padding: '20px',
              background: '#111827',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewPhoto.ph}
              alt="Visit"
              style={{
                width: '100%',
                maxHeight: '70vh',
                objectFit: 'contain',
                borderRadius: '10px',
              }}
            />
            <div style={{ marginTop: '14px', textAlign: 'center', fontSize: '13.5px' }}>
              <p style={{ fontWeight: 700, fontSize: '15px' }}>
                🏢 {previewPhoto.co} — {previewPhoto.dno ? `${previewPhoto.dno}, ` : ''}{previewPhoto.st}
              </p>
              <p style={{ marginTop: '6px', color: '#9ca3af' }}>
                📍 GPS: {previewPhoto.lat || 'N/A'}, {previewPhoto.lng || 'N/A'}
              </p>
              <p style={{ marginTop: '4px', color: '#9ca3af' }}>
                📅 {new Date(previewPhoto.ts).toLocaleString('en-IN')} | 👤 {previewPhoto.offName}
              </p>
              <button
                className="btn bo bsm"
                style={{
                  marginTop: '12px',
                  color: '#fff',
                  borderColor: 'rgba(255,255,255,0.2)',
                  background: 'rgba(255,255,255,0.05)',
                }}
                onClick={() => setPreviewPhoto(null)}
              >
                ✕ Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
