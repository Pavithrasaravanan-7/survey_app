import React from 'react';

export default function Modal({
  isOpen,
  icon = '⚠️',
  title = 'Alert',
  message = '',
  onConfirm,
  onClose,
  showCancel = false,
  confirmText = 'OK',
  confirmBtnStyle = {}
}) {
  if (!isOpen) return null;

  return (
    <div className="ovl op" onClick={onClose}>
      <div className="mdl" onClick={(e) => e.stopPropagation()}>
        <div className="mi">{icon}</div>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="mact">
          {showCancel && (
            <button className="btn bo" onClick={onClose}>
              Cancel
            </button>
          )}
          <button
            className="btn bb"
            style={confirmBtnStyle}
            onClick={() => {
              if (onConfirm) onConfirm();
              onClose();
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
