import React, { useEffect } from 'react';

function ToastItem({ toast, onRemove }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, 3800);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const ic = {
    green: '✅',
    red: '❌',
    amber: '⚠️',
    blue: 'ℹ️'
  };

  const cl = {
    green: 'tg',
    red: 'tr',
    amber: 'ta',
    blue: 'tb'
  };

  return (
    <div className={`tst ${cl[toast.type] || 'tb'}`}>
      <span>{ic[toast.type] || 'ℹ️'}</span>
      <span>{toast.msg}</span>
    </div>
  );
}

export default function ToastContainer({ toasts, onRemove }) {
  return (
    <div id="tsts">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  );
}
