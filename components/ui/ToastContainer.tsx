'use client';
import { useEffect } from 'react';
import { useNucleusStore } from '@/store/useNucleusStore';

export default function ToastContainer() {
  const toasts = useNucleusStore((s) => s.toasts);
  const removeToast = useNucleusStore((s) => s.removeToast);

  useEffect(() => {
    toasts.forEach((t) => {
      const timer = setTimeout(() => removeToast(t.id), t.type === 'alert' ? 8000 : 4000);
      return () => clearTimeout(timer);
    });
  }, [toasts, removeToast]);

  if (!toasts.length) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`} onClick={() => removeToast(t.id)}>
          <span>{t.type === 'success' ? '✓' : t.type === 'alert' ? '⚠' : '✕'}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
