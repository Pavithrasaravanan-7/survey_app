import React from 'react';

export default function Sidebar({
  user,
  currentTab,
  onTabChange,
  onLogout,
  gpsStatus = 'Tracking…',
  isOpen,
  onClose
}) {
  const isAdmin = user.role === 'admin';

  const handleTabClick = (tab) => {
    onTabChange(tab);
    onClose(); // Close sidebar on mobile after clicking
  };

  const renderOfficerMenu = () => (
    <>
      <div className="sbsec">Menu</div>
      <div
        className={`ni ${currentTab === 'nv' ? 'on' : ''}`}
        onClick={() => handleTabClick('nv')}
      >
        ➕ New Visit
      </div>
      <div
        className={`ni ${currentTab === 'mv' ? 'on' : ''}`}
        onClick={() => handleTabClick('mv')}
      >
        📋 My Visits
      </div>
      <div
        className={`ni ${currentTab === 'att' ? 'on' : ''}`}
        onClick={() => handleTabClick('att')}
      >
        ✅ Attendance
      </div>
    </>
  );

  const renderAdminMenu = () => (
    <>
      <div className="sbsec">Management</div>
      <div
        className={`ni ${currentTab === 'dash' ? 'on' : ''}`}
        onClick={() => handleTabClick('dash')}
      >
        🏠 Dashboard
      </div>
      <div
        className={`ni ${currentTab === 'vis' ? 'on' : ''}`}
        onClick={() => handleTabClick('vis')}
      >
        📋 All Visits
      </div>
      <div
        className={`ni ${currentTab === 'offs' ? 'on' : ''}`}
        onClick={() => handleTabClick('offs')}
      >
        👥 Field Officers
      </div>
      <div
        className={`ni ${currentTab === 'att' ? 'on' : ''}`}
        onClick={() => handleTabClick('att')}
      >
        ✅ Attendance
      </div>
      <div
        className={`ni ${currentTab === 'track' ? 'on' : ''}`}
        onClick={() => handleTabClick('track')}
      >
        📍 GPS Tracking
      </div>
      <div
        className={`ni ${currentTab === 'rpt' ? 'on' : ''}`}
        onClick={() => handleTabClick('rpt')}
      >
        📊 Reports
      </div>
      <div
        className={`ni ${currentTab === 'set' ? 'on' : ''}`}
        onClick={() => handleTabClick('set')}
      >
        ⚙️ Settings
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Overlay */}
      <div className={`sb-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      
      <div className={`sb ${isOpen ? 'open' : ''}`} id={isAdmin ? 'sba' : 'sbo'}>
        <div className="sbh">
          <div className="appn">Survey App</div>
          <div className="apps">{isAdmin ? 'Admin Panel' : 'Field Officer Panel'}</div>
        </div>
        
        <div className="sbu">
          <div
            className="ava"
            style={{
              background: isAdmin
                ? 'linear-gradient(135deg, #dc2626, #9333ea)'
                : 'linear-gradient(135deg, var(--bl), var(--tl))'
            }}
          >
            {user.name ? user.name[0].toUpperCase() : 'U'}
          </div>
          <div className="unam">{user.name}</div>
          <span
            className="urol"
            style={
              isAdmin
                ? { background: 'rgba(220, 38, 38, 0.2)', color: '#f87171' }
                : {}
            }
          >
            {isAdmin ? 'Administrator' : 'Field Officer'}
          </span>
        </div>

        <div className="sbn">
          {isAdmin ? renderAdminMenu() : renderOfficerMenu()}
        </div>

        <div className="sbf">
          {!isAdmin && (
            <div className="gpsi mb8" style={{ marginBottom: '10px' }}>
              <div className="gpsd" />
              <span>{gpsStatus}</span>
            </div>
          )}
          <button className="lbtn" onClick={onLogout}>
            🚪 Logout
          </button>
        </div>
      </div>
    </>
  );
}
