import { X, Maximize2, Minimize2 } from 'lucide-react';
import { useEffect, useState, useRef, useCallback } from 'react';

/**
 * Modal — CRM-styled modal dialog with resize, maximize, and responsive size controls.
 * Props:
 *  - isOpen: boolean
 *  - onClose: () => void
 *  - title: ReactNode / string
 *  - subtitle: ReactNode / string
 *  - children: ReactNode
 *  - footer: ReactNode
 *  - size: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full' (default: 'md')
 *  - resizable: boolean (default: true) — enables bottom-right drag-to-resize handle
 *  - allowMaximize: boolean (default: true) — enables top-right corner maximize/restore button
 *  - className: string (custom classes on modal-card)
 */
export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  resizable = true,
  allowMaximize = true,
  className = '',
  backdropClassName = '',
}) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [customSize, setCustomSize] = useState(null); // { width, height }
  const [isResizing, setIsResizing] = useState(false);
  const cardRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e) {
      if (e.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Reset custom size and maximize state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setIsMaximized(false);
      setCustomSize(null);
      setIsResizing(false);
    }
  }, [isOpen]);

  const toggleMaximize = useCallback(() => {
    setIsMaximized((prev) => !prev);
  }, []);

  // Corner resize drag handler (supports mouse, pointer, and touch)
  const handleResizeStart = useCallback((e) => {
    if (e.button !== undefined && e.button !== 0) return; // only primary / left click
    e.preventDefault();
    e.stopPropagation();

    const card = cardRef.current;
    if (!card) return;

    const startX = e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0;
    const startY = e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? 0;
    const rect = card.getBoundingClientRect();
    const startWidth = rect.width;
    const startHeight = rect.height;

    setIsResizing(true);
    setIsMaximized(false);

    const onPointerMove = (moveEvent) => {
      const clientX = moveEvent.clientX ?? (moveEvent.touches && moveEvent.touches[0]?.clientX) ?? startX;
      const clientY = moveEvent.clientY ?? (moveEvent.touches && moveEvent.touches[0]?.clientY) ?? startY;
      const deltaX = clientX - startX;
      const deltaY = clientY - startY;

      const minW = Math.min(360, window.innerWidth - 32);
      const maxW = window.innerWidth - 32;
      const minH = 240;
      const maxH = window.innerHeight - 32;

      // Because modal is centered in viewport, expand symmetrically so corner tracks mouse 1:1
      const newWidth = Math.min(Math.max(minW, startWidth + deltaX * 2), maxW);
      const newHeight = Math.min(Math.max(minH, startHeight + deltaY * 2), maxH);

      setCustomSize({
        width: `${Math.round(newWidth)}px`,
        height: `${Math.round(newHeight)}px`,
      });
    };

    const onPointerUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'nwse-resize';
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);
  }, []);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'modal-sm',
    md: '',
    lg: 'modal-lg',
    xl: 'modal-xl',
    '2xl': 'modal-2xl',
    '3xl': 'modal-3xl',
    full: 'modal-full',
  };
  const sizeClass = sizeClasses[size] || (size ? `modal-${size}` : '');

  const cardStyle = isMaximized
    ? {
        width: '98vw',
        height: '96vh',
        maxWidth: '98vw',
        maxHeight: '96vh',
      }
    : customSize
    ? {
        width: customSize.width,
        height: customSize.height,
        maxWidth: '98vw',
        maxHeight: '96vh',
      }
    : undefined;

  const cardClasses = [
    'modal-card',
    sizeClass,
    isMaximized ? 'is-maximized' : '',
    isResizing ? 'is-resizing' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={`modal-backdrop ${backdropClassName}`.trim()}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={cardRef}
        style={cardStyle}
        className={cardClasses}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div
            className="modal-header select-none"
            onDoubleClick={allowMaximize ? toggleMaximize : undefined}
            title={allowMaximize ? 'Double click to toggle maximize' : undefined}
          >
            <div className="min-w-0 pr-3">
              <h2>{title}</h2>
              {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
              {allowMaximize && (
                <button
                  type="button"
                  className="modal-control-btn"
                  onClick={toggleMaximize}
                  title={isMaximized ? 'Restore down' : 'Maximize (Fit Screen)'}
                  aria-label={isMaximized ? 'Restore down' : 'Maximize modal'}
                >
                  {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
              )}
              <button
                type="button"
                className="modal-close"
                onClick={onClose}
                aria-label="Close modal"
                title="Close (Esc)"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export default Modal;
