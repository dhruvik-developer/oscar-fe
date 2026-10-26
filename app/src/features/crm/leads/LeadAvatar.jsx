import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { initials } from '../../../services/crmSync';

/** Full-size view of a lead's photo. Closes on ✕, backdrop click or Esc. */
function PhotoPreview({ src, name, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Photo of ${name}`}
      // React bubbles portal events through the component tree, so stop them
      // here before they reach the table cell (double-click edits a lead).
      onClick={(e) => { e.stopPropagation(); onClose(); }}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <figure className="relative max-w-[90vw] max-h-[90vh] m-0" onClick={(e) => e.stopPropagation()}>
        <img
          src={src}
          alt={name}
          className="block max-w-[90vw] max-h-[80vh] rounded-2xl shadow-2xl bg-white object-contain"
        />
        <figcaption className="mt-3 text-center text-sm font-semibold text-white">{name}</figcaption>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close photo"
          className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-white text-slate-700 shadow-lg grid place-items-center hover:bg-slate-100 cursor-pointer"
        >
          <X size={18} />
        </button>
      </figure>
    </div>,
    document.body,
  );
}

/**
 * Round lead avatar: the photo, or initials when there is none.
 *
 * `previewable`: clicking a photo opens it full size instead of passing the
 * click on (to "open lead", row selection, inline edit…). Avatars without a
 * photo stay plain.
 */
export default function LeadAvatar({ lead, className = "", style, previewable = false }) {
  const [hasError, setHasError] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const shouldShowImage = Boolean(lead?.photo) && !hasError;
  const name = lead?.name ?? "Lead";

  const avatar = (
    <span
      className={`lead-avatar${className ? ` ${className}` : ""}`}
      style={{
        ...style,
        backgroundColor: lead?.avatarColor ?? "#2F6FED",
      }}
    >
      {shouldShowImage ? (
        <img src={lead.photo} alt={name} onError={() => setHasError(true)} />
      ) : (
        <span>{initials(name)}</span>
      )}
    </span>
  );

  if (!previewable || !shouldShowImage) return avatar;

  return (
    <>
      <button
        type="button"
        className="lead-avatar-preview-btn"
        title="View photo"
        aria-label={`View photo of ${name}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsPreviewOpen(true);
        }}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        {avatar}
      </button>
      {isPreviewOpen && (
        <PhotoPreview src={lead.photo} name={name} onClose={() => setIsPreviewOpen(false)} />
      )}
    </>
  );
}
