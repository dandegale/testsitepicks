'use client';

import { useEffect, useState } from 'react';

// MUST BE 'export default'
export default function Toast({ message, type = 'success', onClose, duration = 3000 }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const styles = {
    success: 'border-teal-500 text-teal-400 bg-gray-900/95 shadow-[0_0_20px_rgba(20,184,166,0.3)]',
    error: 'border-pink-600 text-pink-500 bg-gray-900/95 shadow-[0_0_20px_rgba(219,39,119,0.3)]',
    info: 'border-blue-500 text-blue-400 bg-gray-900/95 shadow-[0_0_20px_rgba(59,130,246,0.3)]'
  };

  const icons = { success: '✓', error: '⚠️', info: 'ℹ️' };

  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-3 rounded-xl border backdrop-blur-md transition-all duration-300 ease-out transform ${visible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-8 opacity-0 scale-95'} ${styles[type]}`}>
      <span className="text-xl">{icons[type]}</span>
      <span className="text-xs font-black uppercase tracking-widest">{message}</span>
    </div>
  );
}