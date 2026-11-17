import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

/**
 * Drawer — centered modal with scale/fade entrance and exit animations.
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

  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeHovered, setCloseHovered] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setClosing(false);
      const raf = requestAnimationFrame(() => setMounted(true));
      return () => cancelAnimationFrame(raf);
    } else {
      setClosing(true);
      const timer = setTimeout(() => {
        setMounted(false);
        setClosing(false);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen && !mounted) return null;

  return (
    <div
      className="modal-backdrop drawer-backdrop"
      style={{
        zIndex: 1100,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        background: 'rgba(15, 23, 42, 0.45)',
        opacity: mounted && !closing ? 1 : 0,
        transition: 'opacity 0.25s ease',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="drawer-panel"
        style={{
          width: typeof width === 'number' ? `${width}px` : width === 'lg' ? '900px' : width === 'xl' ? '1100px' : '720px',
          maxWidth: '100%',
          height: 'auto',
          maxHeight: '92vh',
          background: '#ffffff',
          borderRadius: 16,
          border: '1px solid #e2e8f0',
          boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1101,
          overflow: 'hidden',
          transform: mounted && !closing ? 'scale(1)' : 'scale(0.95)',
          opacity: mounted && !closing ? 1 : 0,
          transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease',
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
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>{title}</h2>
            {subtitle && <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b', fontWeight: 400 }}>{subtitle}</p>}
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            onMouseEnter={() => setCloseHovered(true)}
            onMouseLeave={() => setCloseHovered(false)}
            aria-label="Close drawer"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              background: closeHovered ? '#fee2e2' : '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: closeHovered ? '#dc2626' : '#64748b',
              transition: 'all 0.15s ease',
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
              borderTop: '1px solid #f1f5f9',
              background: '#fafafa',
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
