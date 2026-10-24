import { useState } from 'react';
import { Lightbulb, X } from 'lucide-react';

export default function InfoBanner({ storageKey, title, text }) {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem(storageKey) !== '0';
    } catch {
      return true;
    }
  });

  if (!visible) return null;

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(storageKey, '0');
    } catch { }
  }

  return (
    <div className="relative flex items-start gap-3 overflow-hidden bg-gradient-to-r from-blue-50 via-indigo-50/70 to-white border border-blue-100 rounded-xl px-4 py-3 mb-4">
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-blue-500 to-indigo-600" />
      <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white grid place-items-center shrink-0 shadow-md shadow-blue-500/25">
        <Lightbulb size={16} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900">{title}</p>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{text}</p>
      </div>
      <button type="button" onClick={dismiss} className="text-slate-400 hover:text-slate-600 p-1 shrink-0" aria-label="Dismiss">
        <X size={15} />
      </button>
    </div>
  );
}
