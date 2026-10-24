import { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Drawer — CRM-styled sliding slide-over panel.
 * Props: isOpen, onClose, title, subtitle, children, footer, width ('md'|'lg'|'xl'|number)
 */
export function Drawer({ isOpen, onClose, title, subtitle, children, footer, width = 540 }) {
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e) {
      if (e.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop drawer-backdrop"
      style={{ zIndex: 1100, display: 'flex', justifyContent: 'flex-end' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="drawer-panel"
        style={{
          width: typeof width === 'number' ? `${width}px` : width === 'lg' ? '680px' : width === 'xl' ? '820px' : '520px',
          maxWidth: '100%',
          height: '100vh',
          background: '#ffffff',
          boxShadow: '-8px 0 32px rgba(15, 23, 42, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1101,
          animation: 'drawerSlideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        role="dialog"
        aria-modal="true"
      >
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>{title}</h2>
            {subtitle && <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>{subtitle}</p>}
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close drawer"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748b',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {children}
        </div>

        {footer && (
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 10,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default Drawer;
