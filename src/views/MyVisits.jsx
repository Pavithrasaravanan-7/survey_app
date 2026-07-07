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

const base64ToFile = (base64String, filename) => {
  if (!base64String) return null;
  try {
    const arr = base64String.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  } catch (err) {
    console.error('base64ToFile conversion failed:', err);
    return null;
  }
};

const copyImageToClipboard = async (base64String, showToast) => {
  try {
    // Draw onto canvas to convert to PNG (ClipboardItem universally requires image/png in browsers)
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(async (pngBlob) => {
        try {
          const item = new ClipboardItem({ 'image/png': pngBlob });
          await navigator.clipboard.write([item]);
          showToast('📋 Image copied to clipboard! You can now paste (Ctrl+V) directly into WhatsApp.', 'green');
        } catch (err) {
          console.error('Failed to copy to clipboard:', err);
          showToast('Failed to copy image: ' + err.message, 'red');
        }
      }, 'image/png');
    };
    img.src = base64String;
  } catch (err) {
    console.error('Failed to prepare clipboard image:', err);
    showToast('Failed to copy image: ' + err.message, 'red');
  }
};

export default function MyVisits({ user, showPhotoModal, showToast }) {
  const [visits, setVisits] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [activeShareVisit, setActiveShareVisit] = useState(null);

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

                              const origin = window.location.origin;
                              const photoLinks = [];
                              if (v.ph) {
                                photoLinks.push(`VISIT PHOTO 📸 : ${origin}/api/visits/${v.id}/photo/visit`);
                              }
                              if (v.receiptPhoto || v.docs?.receiptPhoto) {
                                photoLinks.push(`RECEIPT PHOTO 🧾 : ${origin}/api/visits/${v.id}/photo/receipt`);
                              }
                              if (v.docs?.gstPhoto) {
                                photoLinks.push(`GST PHOTO 🧾 : ${origin}/api/visits/${v.id}/photo/gst`);
                              }
                              if (v.docs?.panPhoto) {
                                photoLinks.push(`PAN PHOTO 🪪 : ${origin}/api/visits/${v.id}/photo/pan`);
                              }
                              if (v.docs?.rentalPhoto) {
                                photoLinks.push(`RENTAL PHOTO 🏘️ : ${origin}/api/visits/${v.id}/photo/rental`);
                              }

                              let formattedWhatsAppText = `ZONE : ${v.zn.toUpperCase()}

WARD : ${v.wd}

COMPANY NAME : ${v.co.toUpperCase()}

CONTACT PERSON : ${contactPerson.toUpperCase()}

MOBILE NUMBER : ${v.contact}

E-mail 📩 : ${email}

PROFESSIONAL TAX ASSESSMENT NUMBER : ${v.asn}

GST NUMBER : ${gstNo}

STAFF COUNT : ${staffCount ? String(staffCount).padStart(2, '0') : ''}

REMARKS : ${(v.remarks || (v.pay === 'new_application' ? 'NEW APPLICATION' : v.pay)).toUpperCase()}`;

                              if (photoLinks.length > 0) {
                                formattedWhatsAppText += `\n\nPHOTOS 📷:\n${photoLinks.join('\n')}`;
                              }

                              const fallbackShare = (text) => {
                                navigator.clipboard.writeText(text)
                                  .then(() => {
                                    showToast('Copied to Clipboard! 📋', 'green');
                                    setActiveShareVisit(v);
                                    setTimeout(() => {
                                      window.open('https://chat.whatsapp.com/Bu7mRiit9qt6ZMLqzbjGxu?s=cl&p=a&ilr=0', '_blank');
                                    }, 300);
                                  })
                                  .catch((err) => {
                                    showToast('Failed to copy: ' + err.message, 'red');
                                    setActiveShareVisit(v);
                                  });
                              };

                              // Build files array for Web Share API
                              const shareFiles = [];
                              try {
                                if (v.ph) {
                                  const f = base64ToFile(v.ph, `visit_${v.id}.jpg`);
                                  if (f) shareFiles.push(f);
                                }
                                if (v.receiptPhoto || v.docs?.receiptPhoto) {
                                  const f = base64ToFile(v.receiptPhoto || v.docs.receiptPhoto, `receipt_${v.id}.jpg`);
                                  if (f) shareFiles.push(f);
                                }
                                if (v.docs?.gstPhoto) {
                                  const f = base64ToFile(v.docs.gstPhoto, `gst_${v.id}.jpg`);
                                  if (f) shareFiles.push(f);
                                }
                                if (v.docs?.panPhoto) {
                                  const f = base64ToFile(v.docs.panPhoto, `pan_${v.id}.jpg`);
                                  if (f) shareFiles.push(f);
                                }
                                if (v.docs?.rentalPhoto) {
                                  const f = base64ToFile(v.docs.rentalPhoto, `rental_${v.id}.jpg`);
                                  if (f) shareFiles.push(f);
                                }
                              } catch (fileErr) {
                                console.error('Failed to convert base64 to files for sharing:', fileErr);
                              }

                              const shareData = {
                                title: `Visit details: ${v.co}`,
                                text: formattedWhatsAppText,
                              };

                              if (navigator.share && shareFiles.length > 0) {
                                const finalShareData = { ...shareData, files: shareFiles };
                                if (navigator.canShare && navigator.canShare(finalShareData)) {
                                  navigator.share(finalShareData)
                                    .then(() => showToast('Shared successfully!', 'green'))
                                    .catch((err) => {
                                      if (err.name !== 'AbortError') {
                                        fallbackShare(formattedWhatsAppText);
                                      }
                                    });
                                  return;
                                }
                              }

                              fallbackShare(formattedWhatsAppText);
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
      {activeShareVisit && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px',
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--br)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '500px',
            padding: '20px',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '17px', color: 'var(--tc)' }}>📤 Share Details &amp; Photos</h3>
              <button
                type="button"
                className="btn bo bsm"
                style={{ minWidth: 'auto', padding: '4px 8px' }}
                onClick={() => setActiveShareVisit(null)}
              >
                ✕ Close
              </button>
            </div>
            
            <div style={{
              background: 'rgba(37, 211, 102, 0.08)',
              border: '1px dashed #25d366',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '13.5px',
              color: '#128c7e',
              lineHeight: '1.45',
            }}>
              <strong>📋 Visit details text copied!</strong>
              <br />
              Paste (Ctrl+V) in WhatsApp to send. Use the copy buttons below to copy the images to paste them into WhatsApp:
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                className="btn bb"
                style={{
                  backgroundColor: '#25d366',
                  borderColor: '#25d366',
                  color: '#fff',
                  width: '100%',
                }}
                onClick={() => {
                  window.open('https://chat.whatsapp.com/Bu7mRiit9qt6ZMLqzbjGxu?s=cl&p=a&ilr=0', '_blank');
                }}
              >
                💬 Open WhatsApp Group
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--mu)' }}>PHOTOS IN THIS VISIT:</span>
              <div style={{
                maxHeight: '220px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                paddingRight: '4px',
              }}>
                {/* Visit Photo */}
                {activeShareVisit.ph && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', border: '1px solid var(--br)', borderRadius: '8px' }}>
                    <img
                      src={activeShareVisit.ph}
                      alt="Visit"
                      style={{ width: '45px', height: '45px', objectFit: 'cover', borderRadius: '6px' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12.5px', fontWeight: 600 }}>📸 Visit Photo</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn bo bsm"
                        style={{ fontSize: '11px', padding: '4px 8px' }}
                        onClick={() => copyImageToClipboard(activeShareVisit.ph, showToast)}
                      >
                        📋 Copy
                      </button>
                      <a
                        href={activeShareVisit.ph}
                        download={`visit_${activeShareVisit.id}.jpg`}
                        className="btn bo bsm"
                        style={{ fontSize: '11px', padding: '4px 8px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        ⬇️ Save
                      </a>
                    </div>
                  </div>
                )}

                {/* Receipt Photo */}
                {(activeShareVisit.receiptPhoto || activeShareVisit.docs?.receiptPhoto) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', border: '1px solid var(--br)', borderRadius: '8px' }}>
                    <img
                      src={activeShareVisit.receiptPhoto || activeShareVisit.docs.receiptPhoto}
                      alt="Receipt"
                      style={{ width: '45px', height: '45px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--gn)' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12.5px', fontWeight: 600 }}>🧾 Receipt Photo</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn bo bsm"
                        style={{ fontSize: '11px', padding: '4px 8px' }}
                        onClick={() => copyImageToClipboard(activeShareVisit.receiptPhoto || activeShareVisit.docs.receiptPhoto, showToast)}
                      >
                        📋 Copy
                      </button>
                      <a
                        href={activeShareVisit.receiptPhoto || activeShareVisit.docs.receiptPhoto}
                        download={`receipt_${activeShareVisit.id}.jpg`}
                        className="btn bo bsm"
                        style={{ fontSize: '11px', padding: '4px 8px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        ⬇️ Save
                      </a>
                    </div>
                  </div>
                )}

                {/* GST Photo */}
                {activeShareVisit.docs?.gstPhoto && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', border: '1px solid var(--br)', borderRadius: '8px' }}>
                    <img
                      src={activeShareVisit.docs.gstPhoto}
                      alt="GST"
                      style={{ width: '45px', height: '45px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--bl)' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12.5px', fontWeight: 600 }}>🧾 GST Document</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn bo bsm"
                        style={{ fontSize: '11px', padding: '4px 8px' }}
                        onClick={() => copyImageToClipboard(activeShareVisit.docs.gstPhoto, showToast)}
                      >
                        📋 Copy
                      </button>
                      <a
                        href={activeShareVisit.docs.gstPhoto}
                        download={`gst_${activeShareVisit.id}.jpg`}
                        className="btn bo bsm"
                        style={{ fontSize: '11px', padding: '4px 8px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        ⬇️ Save
                      </a>
                    </div>
                  </div>
                )}

                {/* PAN Photo */}
                {activeShareVisit.docs?.panPhoto && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', border: '1px solid var(--br)', borderRadius: '8px' }}>
                    <img
                      src={activeShareVisit.docs.panPhoto}
                      alt="PAN"
                      style={{ width: '45px', height: '45px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--bl)' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12.5px', fontWeight: 600 }}>🪪 PAN Document</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn bo bsm"
                        style={{ fontSize: '11px', padding: '4px 8px' }}
                        onClick={() => copyImageToClipboard(activeShareVisit.docs.panPhoto, showToast)}
                      >
                        📋 Copy
                      </button>
                      <a
                        href={activeShareVisit.docs.panPhoto}
                        download={`pan_${activeShareVisit.id}.jpg`}
                        className="btn bo bsm"
                        style={{ fontSize: '11px', padding: '4px 8px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        ⬇️ Save
                      </a>
                    </div>
                  </div>
                )}

                {/* Rental Photo */}
                {activeShareVisit.docs?.rentalPhoto && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', border: '1px solid var(--br)', borderRadius: '8px' }}>
                    <img
                      src={activeShareVisit.docs.rentalPhoto}
                      alt="Rental"
                      style={{ width: '45px', height: '45px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--bl)' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12.5px', fontWeight: 600 }}>🏘️ Rental Deed</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn bo bsm"
                        style={{ fontSize: '11px', padding: '4px 8px' }}
                        onClick={() => copyImageToClipboard(activeShareVisit.docs.rentalPhoto, showToast)}
                      >
                        📋 Copy
                      </button>
                      <a
                        href={activeShareVisit.docs.rentalPhoto}
                        download={`rental_${activeShareVisit.id}.jpg`}
                        className="btn bo bsm"
                        style={{ fontSize: '11px', padding: '4px 8px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        ⬇️ Save
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
