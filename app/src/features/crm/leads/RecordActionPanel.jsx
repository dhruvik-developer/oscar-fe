import { TrendingDown, X } from "lucide-react";

export default function RecordActionPanel({ lead, leads = [], onClose, onDelete }) {
  const selectedLeads = leads.length > 0 ? leads : lead ? [lead] : [];
  const isBulk = selectedLeads.length > 1;
  const activeLead = lead ?? selectedLeads[0] ?? null;
  if (!activeLead && selectedLeads.length === 0) return null;

  function handleMarkLost() {
    if (isBulk) {
      onDelete(selectedLeads);
      return;
    }
    onDelete(activeLead.id);
  }

  return (
    <div className="record-action-panel" role="toolbar" aria-label="Record actions">
      <div className="record-action-buttons">
        <button type="button" className="record-action-button delete" onClick={handleMarkLost} aria-label="Mark record as lost">
          <TrendingDown size={17} />
          <span>{isBulk ? "Mark Records as Lost" : "Mark as Lost"}</span>
        </button>
        <button type="button" className="record-action-close" onClick={onClose} aria-label="Close record actions">
          <X size={17} />
        </button>
      </div>
    </div>
  );
}
