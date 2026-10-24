import { Building2, Mail, MapPin, Phone, Pin, TrendingDown, UserRound } from "lucide-react";
import LeadAvatar from "./LeadAvatar";
import { formatCurrency } from "../../../utils/currencyUtils";

export default function LeadCardGridView({ rows = [], selected = [], pinnedLeadIds = [], onTogglePin, onToggleOne, onRequestMarkLost, onAddNote, onOpenLead, onMarkLost }) {
  const activeCurrency = (typeof localStorage !== 'undefined' && localStorage.getItem('evenmore_currency')) || 'USD ($)';
  return (
    <div className="lead-grid">
      {rows.map((row) => (
        <article key={row.id} className="lead-grid-card">
          <input
            type="checkbox"
            className="lead-grid-select row-check"
            checked={selected.includes(row.id)}
            onChange={() => {
              onToggleOne?.(row.id);
              onRequestMarkLost?.(row);
            }}
            aria-label={`Select ${row.name}`}
          />
          <div className="lead-grid-top">
            <div className="lead-grid-person">
              <LeadAvatar lead={row} />
              <div>
                <button type="button" className="lead-name-button" onClick={() => onOpenLead(row)}>
                  <strong>{row.name}</strong>
                </button>
                <span>{row.status}</span>
              </div>
            </div>
            <div className="lead-grid-top-actions">
              <button
                type="button"
                className={`pinned-indicator${pinnedLeadIds.includes(row.id) ? " active" : ""}`}
                aria-label={`${pinnedLeadIds.includes(row.id) ? "Unpin" : "Pin"} ${row.name}`}
                title={pinnedLeadIds.includes(row.id) ? "Unpin record" : "Pin record"}
                onClick={() => onTogglePin?.(row)}
              >
                <Pin size={14} />
              </button>
              <button type="button" className="lead-grid-open" onClick={() => onOpenLead(row)}>
                Open
              </button>
            </div>
          </div>

          <button
            type="button"
            className="lead-grid-delete row-action-icon row-delete-action"
            onClick={() => onMarkLost?.(row.id)}
            aria-label={`Mark ${row.name} as lost`}
          >
            <TrendingDown size={15} />
            <span className="toolbar-tooltip">Mark as Lost</span>
          </button>

          <div className="lead-grid-company">
            <Building2 size={16} />
            <span>{row.company}</span>
          </div>
          <div className="lead-grid-meta">
            {(row.leadNumber || row.lead_number) && (
              <span><button type="button" className="lead-no-btn" onClick={() => onOpenLead(row)}>{row.leadNumber || row.lead_number}</button></span>
            )}
            <span><Mail size={15} /> {row.email}</span>
            <span><Phone size={15} /> {row.phone}</span>
            <span><UserRound size={15} /> {row.owner}</span>
            <span><MapPin size={15} /> {row.city}, {row.state}</span>
          </div>

          <div className="lead-grid-footer">
            <small>{row.source}</small>
            <b>{formatCurrency(row.amount || 0, localStorage.getItem('evenmore_currency') || 'USD ($)', { noDecimals: true })}</b>
          </div>
        </article>
      ))}

      {rows.length === 0 && (
        <div className="table-card lead-grid-empty">
          No leads match the current filters.
        </div>
      )}
    </div>
  );
}
