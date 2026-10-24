import { AlertTriangle, X } from "lucide-react";

export default function MarkAsLostModal({ lead, leads = [], onClose, onConfirm, onConfirmAll }) {
  const isBulk = leads.length > 0;

  if (!lead && !isBulk) return null;
  const recordLabel = isBulk ? `${leads.length} records` : "this record";

  function handleConfirm() {
    if (isBulk) onConfirmAll(leads);
    else onConfirm(lead.id);
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <section
        className="delete-lead-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mark-lost-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="delete-lead-head">
          <div className="delete-lead-icon">
            <AlertTriangle size={20} />
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close mark as lost dialog">
            <X size={18} />
          </button>
        </div>
        <h2 id="mark-lost-title">Mark as Lost</h2>
        <p>
          Are you sure you want to mark <strong>{isBulk ? recordLabel : lead.name}</strong> as lost? {isBulk ? 'These leads will' : 'This lead will'} remain in Leads and also appear in Lost Leads. Any open deals will move to Lost in the deal pipeline.
        </p>
        <div className="delete-lead-actions">
          <button type="button" className="btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="delete-confirm-btn"
            onClick={handleConfirm}
          >
            Mark as Lost
          </button>
        </div>
      </section>
    </div>
  );
}
