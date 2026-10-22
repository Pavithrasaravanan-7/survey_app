import React, { useState } from 'react';
import { DB } from '../utils/db';

export default function Login({ onLoginSuccess, showToast }) {
  const [role, setRole] = useState('admin'); // 'admin' or 'officer'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const u = username.trim();
      const p = password;
      const targetRole = role === 'admin' ? 'admin' : 'off';
      
      const matchedUser = await DB.login(u, p, targetRole);

      showToast(`Welcome back, ${matchedUser.name}!`, 'green');
      onLoginSuccess(matchedUser);
    } catch (err) {
      console.error('Login error:', err);
      showToast('Login failed: ' + err.message, 'red');
    }
  };

  // Generate 20 login bubble styles for the background
  const bubbles = [
    { left: '5%', width: '50px', height: '50px', duration: '7s', delay: '0s' },
    { left: '15%', width: '90px', height: '90px', duration: '11s', delay: '1s' },
    { left: '25%', width: '35px', height: '35px', duration: '6s', delay: '2.5s' },
    { left: '40%', width: '120px', height: '120px', duration: '14s', delay: '0.4s' },
    { left: '55%', width: '60px', height: '60px', duration: '9s', delay: '1.8s' },
    { left: '65%', width: '80px', height: '80px', duration: '12s', delay: '3.2s' },
    { left: '75%', width: '45px', height: '45px', duration: '7.5s', delay: '0.9s' },
    { left: '85%', width: '100px', height: '100px', duration: '13s', delay: '2s' },
    { left: '92%', width: '55px', height: '55px', duration: '8s', delay: '4s' },
    { left: '10%', width: '70px', height: '70px', duration: '10s', delay: '3.5s' },
    { left: '30%', width: '40px', height: '40px', duration: '6.5s', delay: '5s' },
    { left: '50%', width: '110px', height: '110px', duration: '15s', delay: '1.5s' },
    { left: '70%', width: '65px', height: '65px', duration: '9.5s', delay: '2.8s' },
    { left: '80%', width: '85px', height: '85px', duration: '12.5s', delay: '0.2s' },
    { left: '20%', width: '55px', height: '55px', duration: '8.5s', delay: '4.5s' },
    { left: '45%', width: '30px', height: '30px', duration: '5.5s', delay: '3s' },
    { left: '60%', width: '95px', height: '95px', duration: '13.5s', delay: '0.7s' },
    { left: '35%', width: '75px', height: '75px', duration: '11s', delay: '2.2s' },
    { left: '88%', width: '42px', height: '42px', duration: '7s', delay: '3.8s' },
    { left: '3%', width: '130px', height: '130px', duration: '16s', delay: '1.2s' },
  ];

  return (
    <div id="sl" className="screen active" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'linear-gradient(135deg, #1845c8 0%, #0a7ea0 100%)', position: 'relative', overflow: 'hidden' }}>
      <div className="lbbl-bg" aria-hidden="true">
        {bubbles.map((b, i) => (
          <div
            key={i}
            className="lbbl"
            style={{
              left: b.left,
              width: b.width,
              height: b.height,
              animationDuration: b.duration,
              animationDelay: b.delay,
            }}
          />
        ))}
      </div>
      <div className="lcard">
        <div className="llogo">
          <div className="lico">📋</div>
          <h1>Survey Application</h1>
          <p>Field Visit Tracking System</p>
        </div>
        <div className="rtabs">
          <button
            className={`rtab ${role === 'admin' ? 'on' : ''}`}
            onClick={() => setRole('admin')}
          >
            🛡️ Admin
          </button>
          <button
            className={`rtab ${role === 'officer' ? 'on' : ''}`}
            onClick={() => setRole('officer')}
          >
            👤 Field Officer
          </button>
        </div>
        <form onSubmit={handleLogin}>
          <div className="fg" style={{ marginBottom: '13px' }}>
            <label>Username</label>
            <input
              id="lu"
              placeholder="Enter username"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="fg" style={{ marginBottom: '18px' }}>
            <label>Password</label>
            <div className="pw-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                id="lp"
                placeholder="Enter password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="pw-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="19"
                    height="19"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="19"
                    height="19"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <button type="submit" className="btn bb blg bw">
            Login →
          </button>
        </form>


      </div>
    </div>
  );
}
