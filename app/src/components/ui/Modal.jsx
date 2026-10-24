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

  // Corner resize drag handler
  const handleResizeMouseDown = useCallback((e) => {
    if (e.button !== 0) return; // only left click
    e.preventDefault();
    e.stopPropagation();

    const card = cardRef.current;
    if (!card) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const rect = card.getBoundingClientRect();
    const startWidth = rect.width;
    const startHeight = rect.height;

    setIsResizing(true);
    setIsMaximized(false);

    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      const minW = Math.min(360, window.innerWidth - 32);
      const maxW = window.innerWidth - 32;
      const minH = 240;
      const maxH = window.innerHeight - 32;

      const newWidth = Math.min(Math.max(minW, startWidth + deltaX), maxW);
      const newHeight = Math.min(Math.max(minH, startHeight + deltaY), maxH);

      setCustomSize({
        width: `${Math.round(newWidth)}px`,
        height: `${Math.round(newHeight)}px`,
      });
    };

    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'nwse-resize';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
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
      className="modal-backdrop"
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

        {/* Resizable drag grip icon in bottom-right corner */}
        {resizable && !isMaximized && (
          <div
            role="button"
            tabIndex={-1}
            aria-label="Resize modal"
            title="Drag to resize modal (double-click to reset)"
            onMouseDown={handleResizeMouseDown}
            onDoubleClick={() => setCustomSize(null)}
            className="modal-resize-handle"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M11 4L4 11M11 7L7 11M11 10L10 11" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}

export default Modal;
