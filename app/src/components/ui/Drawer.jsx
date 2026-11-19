import { useEffect, useState, useRef } from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';

/**
 * Drawer — centered modal with scale/fade entrance and exit animations.
 * Props: isOpen, onClose, title, subtitle, children, footer, width ('md'|'lg'|'xl'|number)
 * Features:
 *  - Header maximize/restore arrow button (⤢ / ⤡)
 *  - Header double-click to toggle maximize/restore
 *  - Bottom-right corner draggable resize arrow handle (nwse-resize)
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
  const [maxHovered, setMaxHovered] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [customSize, setCustomSize] = useState(null); // { width, height }

  const panelRef = useRef(null);

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
        setIsMaximized(false);
        setCustomSize(null);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Corner drag-to-resize logic
  const handleResizeMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    const startWidth = rect.width;
    const startHeight = rect.height;

    const handleMouseMove = (moveEvent) => {
      // Symmetrical resizing since modal is centered in backdrop
      const newWidth = Math.min(
        Math.max(480, startWidth + (moveEvent.clientX - startX) * 2),
        window.innerWidth * 0.98
      );
      const newHeight = Math.min(
        Math.max(340, startHeight + (moveEvent.clientY - startY) * 2),
        window.innerHeight * 0.96
      );
      setIsMaximized(false);
      setCustomSize({ width: Math.round(newWidth), height: Math.round(newHeight) });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'nwse-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  if (!isOpen && !mounted) return null;

  const defaultWidth = typeof width === 'number' ? `${width}px` : width === 'lg' ? '900px' : width === 'xl' ? '1100px' : '720px';
  const panelWidth = isMaximized ? '98vw' : customSize ? `${customSize.width}px` : defaultWidth;
  const panelHeight = isMaximized ? '96vh' : customSize ? `${customSize.height}px` : 'auto';
  const panelMaxHeight = isMaximized ? '96vh' : '92vh';

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
        ref={panelRef}
        className="drawer-panel"
        style={{
          position: 'relative',
          width: panelWidth,
          maxWidth: '98vw',
          height: panelHeight,
          maxHeight: panelMaxHeight,
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
          transition: customSize ? 'opacity 0.25s ease' : 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease',
        }}
        role="dialog"
        aria-modal="true"
      >
        <div
          onDoubleClick={() => {
            setIsMaximized((prev) => !prev);
            setCustomSize(null);
          }}
          title="Double-click header to maximize or restore"
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            userSelect: 'none',
            cursor: 'default',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>{title}</h2>
            {subtitle && <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b', fontWeight: 400 }}>{subtitle}</p>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Header Maximize / Expand Arrow Button */}
            <button
              type="button"
              className="modal-resize-btn"
              onClick={() => {
                setIsMaximized((prev) => !prev);
                setCustomSize(null);
              }}
              onMouseEnter={() => setMaxHovered(true)}
              onMouseLeave={() => setMaxHovered(false)}
              title={isMaximized ? 'Restore default size (or double-click header)' : 'Maximize / Expand window (or double-click header)'}
              aria-label={isMaximized ? 'Restore window size' : 'Maximize window'}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                background: maxHovered ? '#eff6ff' : '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: maxHovered ? '#2563eb' : '#64748b',
                transition: 'all 0.15s ease',
              }}
            >
              {isMaximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>

            {/* Close Button */}
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

        {/* Bottom-Right Corner Draggable Resize Arrow Handle */}
        {!isMaximized && (
          <div
            onMouseDown={handleResizeMouseDown}
            title="Drag corner arrow to resize window"
            style={{
              position: 'absolute',
              bottom: 2,
              right: 2,
              width: 18,
              height: 18,
              cursor: 'nwse-resize',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'flex-end',
              padding: 2,
              zIndex: 10,
              userSelect: 'none',
              opacity: 0.45,
              transition: 'opacity 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.45')}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#64748b" strokeWidth="1.6" strokeLinecap="round">
              <line x1="8.5" y1="2" x2="2" y2="8.5" />
              <line x1="8.5" y1="5.5" x2="5.5" y2="8.5" />
              <line x1="8.5" y1="8.5" x2="8.5" y2="8.5" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}

export default Drawer;
