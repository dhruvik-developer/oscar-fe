import { Pencil, Phone, Pin } from "lucide-react";
import LeadAvatar from "./LeadAvatar";

export default function LeadGridView({ rows = [], selected = [], pinnedLeadIds = [], onTogglePin, onToggleOne, onRequestMarkLost, onAddNote, onOpenLead, onMarkLost }) {
  return (
    <div className="lead-tile-grid">
      {rows.map((row) => (
        <article key={row.id} className="lead-tile-card">
          <div className="lead-tile-select">
            <input
              type="checkbox"
              className="row-check"
              checked={selected.includes(row.id)}
              onChange={() => {
                onToggleOne?.(row.id);
                onRequestMarkLost?.(row);
              }}
              aria-label={`Select ${row.name}`}
            />
          </div>
          <div className="lead-tile-head">
            <div className="lead-tile-person">
              <LeadAvatar lead={row} className="lead-tile-avatar" />
              <div>
                <strong>{row.status}</strong>
                <button type="button" className="lead-name-button" onClick={() => onOpenLead(row)}>
                  <span>{row.name}</span>
                </button>
              </div>
            </div>
            <div className="lead-tile-head-actions">
              <button
                type="button"
                className={`pinned-indicator${pinnedLeadIds.includes(row.id) ? " active" : ""}`}
                aria-label={`${pinnedLeadIds.includes(row.id) ? "Unpin" : "Pin"} ${row.name}`}
                title={pinnedLeadIds.includes(row.id) ? "Unpin record" : "Pin record"}
                onClick={() => onTogglePin?.(row)}
              >
                <Pin size={14} />
              </button>
              <button
                type="button"
                className="lead-tile-action"
                aria-label={`Open ${row.name}`}
                onClick={() => onAddNote(row)}
              >
                <Pencil size={15} />
              </button>
            </div>
          </div>

          <div className="lead-tile-body">
            <div className="lead-tile-line">
              <label>Lead No.</label>
              <button type="button" className="lead-no-btn" onClick={() => onOpenLead(row)}>
                {row.leadNumber || row.lead_number || '—'}
              </button>
            </div>
            <div className="lead-tile-line">
              <label>Title</label>
              <span>{row.jobTitle}</span>
            </div>
            <div className="lead-tile-line">
              <label>Company</label>
              <span>{row.company}</span>
            </div>
            <div className="lead-tile-line">
              <label>Industry</label>
              <span>{row.industry}</span>
            </div>
            <a className="lead-tile-email" href={`mailto:${row.email}`}>
              {row.email}
            </a>
            <div className="lead-tile-phone">
              <a href={`tel:${row.phone}`}>{row.phone}</a>
              <Phone size={16} />
            </div>
            <div className="lead-tile-line">
              <label>Lead Source</label>
              <span>{row.source}</span>
            </div>
          </div>
        </article>
      ))}

      {rows.length === 0 && <div className="table-card lead-grid-empty">No leads match the current filters.</div>}
    </div>
  );
}
