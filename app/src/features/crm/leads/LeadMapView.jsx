import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Mail,
  MapPin,
  Phone,
  Settings2,
  X,
} from "lucide-react";
import LeadAvatar from "./LeadAvatar";

import { formatCurrency } from "../../../utils/currencyUtils";

function formatAmount(value) {
  const activeCurrency = localStorage.getItem('evenmore_currency') || 'USD ($)';
  return formatCurrency(value || 0, activeCurrency, { noDecimals: true });
}

function getStatusTone(status) {
  const normalized = status.toLowerCase();
  if (normalized.includes("qualified")) return "green";
  if (normalized.includes("contact")) return "blue";
  if (normalized.includes("lost") || normalized.includes("junk")) return "red";
  return "pink";
}

export default function LeadMapView({
  rows = [],
  selected = [],
  onToggleOne,
  onAddNote,
  onOpenLead,
}) {
  const [activeLeadId, setActiveLeadId] = useState(rows[0]?.id ?? null);
  const [listPage, setListPage] = useState(1);
  const [mapMode, setMapMode] = useState("map");
  const [zoom, setZoom] = useState(1);
  const [sortMode, setSortMode] = useState(0);
  const [detailClosedId, setDetailClosedId] = useState(null);

  const LIST_PAGE_SIZE = 8;

  useEffect(() => {
    if (!rows.some((row) => row.id === activeLeadId)) {
      setActiveLeadId(rows[0]?.id ?? null);
    }
  }, [rows, activeLeadId]);

  useEffect(() => {
    setListPage(1);
  }, [rows.length, sortMode]);

  function selectLead(id) {
    setActiveLeadId(id);
    setDetailClosedId(null);
  }

  function cycleSort() {
    setSortMode((mode) => (mode + 1) % 4);
  }

  const activeLead = useMemo(
    () => rows.find((row) => row.id === activeLeadId) ?? rows[0] ?? null,
    [rows, activeLeadId],
  );

  const sortedRows = useMemo(() => {
    const list = [...rows];
    if (sortMode === 1) list.sort((a, b) => (b.amount || 0) - (a.amount || 0));
    if (sortMode === 2) list.sort((a, b) => (a.amount || 0) - (b.amount || 0));
    if (sortMode === 3) list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return list;
  }, [rows, sortMode]);

  const totalListPages = Math.max(1, Math.ceil(sortedRows.length / LIST_PAGE_SIZE));
  const safeListPage = Math.min(listPage, totalListPages);
  const pagedRows = sortedRows.slice((safeListPage - 1) * LIST_PAGE_SIZE, safeListPage * LIST_PAGE_SIZE);
  const listPageNumbers = [];
  for (let p = Math.max(1, safeListPage - 1); p <= Math.min(totalListPages, safeListPage + 1); p += 1) {
    listPageNumbers.push(p);
  }

  const showDetailPane = Boolean(activeLead) && detailClosedId !== activeLead.id;

  return (
    <section className="leads-map-page">
      <div className="leads-map-layout">
        <aside className="leads-map-list-pane">
          <div className="leads-map-pane-head">
            <h3>Leads ({rows.length})</h3>
            <button type="button" className="leads-map-pane-action" onClick={cycleSort} title="Cycle sort: none, amount high-low, amount low-high, name">
              Sort
              <ChevronsUpDown size={14} />
            </button>
          </div>

          <div className="leads-map-listing">
            {pagedRows.map((row) => (
              <div
                key={row.id}
                className={`leads-map-list-item${row.id === activeLead?.id ? " active" : ""}`}
              >
                <input
                  type="checkbox"
                  className="row-check"
                  checked={selected.includes(row.id)}
                  onChange={() => onToggleOne(row.id)}
                  aria-label={`Select ${row.name}`}
                />
                <button
                  type="button"
                  className="leads-map-list-main"
                  onClick={() => selectLead(row.id)}
                >
                  <LeadAvatar lead={row} className="leads-map-list-avatar" />
                  <div className="leads-map-list-copy">
                    <strong>{row.name.replace(" (Sample)", "")}</strong>
                    <span>{row.company}</span>
                    <small>{row.city}, {row.state}</small>
                  </div>
                  <b className={`leads-map-list-amount ${getStatusTone(row.status)}`}>
                    {formatAmount(row.amount)}
                  </b>
                </button>
              </div>
            ))}
          </div>

          <div className="leads-map-pagination">
            <button
              type="button"
              className="page-nav"
              aria-label="Previous page"
              disabled={safeListPage <= 1}
              onClick={() => setListPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={15} />
            </button>
            {listPageNumbers[0] > 1 && (
              <>
                <button type="button" className="page-num" onClick={() => setListPage(1)}>1</button>
                {listPageNumbers[0] > 2 && <span>...</span>}
              </>
            )}
            {listPageNumbers.map((p) => (
              <button
                key={p}
                type="button"
                className={`page-num${p === safeListPage ? " active" : ""}`}
                onClick={() => setListPage(p)}
              >
                {p}
              </button>
            ))}
            {listPageNumbers[listPageNumbers.length - 1] < totalListPages && (
              <>
                {listPageNumbers[listPageNumbers.length - 1] < totalListPages - 1 && <span>...</span>}
                <button type="button" className="page-num" onClick={() => setListPage(totalListPages)}>
                  {totalListPages}
                </button>
              </>
            )}
            <button
              type="button"
              className="page-nav"
              aria-label="Next page"
              disabled={safeListPage >= totalListPages}
              onClick={() => setListPage((p) => Math.min(totalListPages, p + 1))}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </aside>

        <div className="leads-map-stage">
          <div className="leads-map-stage-top">
            <div className="leads-map-tabs">
              <button
                type="button"
                className={mapMode === "map" ? "active" : ""}
                onClick={() => setMapMode("map")}
              >
                Map
              </button>
              <button
                type="button"
                className={mapMode === "satellite" ? "active" : ""}
                onClick={() => setMapMode("satellite")}
              >
                Satellite
              </button>
            </div>
            <button type="button" className="leads-map-focus-btn" onClick={() => setZoom(1)} title="Reset view">
              <Settings2 size={18} />
            </button>
          </div>

          <div className={`leads-map-canvas-pro${mapMode === "satellite" ? " satellite" : ""}`}>
            <div className="leads-map-canvas-zoom" style={{ transform: `scale(${zoom})` }}>
            <div className="map-water-edge" />
            <div className="map-region-label ahmedabad">Ahmedabad</div>
            <div className="map-region-label gujarat">GUJARAT</div>
            <div className="map-region-label surat">Surat</div>
            <div className="map-region-label mumbai">Mumbai</div>
            <div className="map-region-label nashik">Nashik</div>
            <div className="map-region-label maharashtra">MAHARASHTRA</div>
            <div className="map-route map-route-one" />
            <div className="map-route map-route-two" />
            <div className="map-route map-route-three" />
            <div className="map-route map-route-four" />

            {rows.map((row, index) => (
              <button
                key={row.id}
                type="button"
                className={`leads-map-marker-pro ${getStatusTone(row.status)}`}
                style={{ left: `${row.mapX}%`, top: `${row.mapY}%` }}
                onClick={() => selectLead(row.id)}
                aria-label={`Show ${row.name} on map`}
              >
                <span className="leads-map-marker-photo">
                  <LeadAvatar lead={row} className="leads-map-marker-avatar" />
                </span>
                <span className="leads-map-marker-pill">{formatAmount(row.amount)}</span>
                {index === 1 && <span className="leads-map-cluster-bubble">3</span>}
              </button>
            ))}

            {activeLead && (
              <div
                className="leads-map-info-card"
                style={{ left: `min(calc(${activeLead.mapX}% + 4%), calc(100% - 260px))`, top: `calc(${activeLead.mapY}% + 2%)` }}
              >
                <div className="leads-map-info-head">
                  <LeadAvatar lead={activeLead} className="leads-map-info-avatar" />
                  <div>
                    <strong>{activeLead.name.replace(" (Sample)", "")}</strong>
                    <span>{activeLead.company}</span>
                  </div>
                </div>
                <ul className="leads-map-info-list">
                  <li><MapPin size={14} /> 123, {activeLead.city} Industrial Estate, {activeLead.state}, {activeLead.country}</li>
                  <li><Phone size={14} /> +91 {activeLead.phone}</li>
                  <li><Mail size={14} /> {activeLead.email}</li>
                </ul>
                <button type="button" className="leads-map-link-btn" onClick={() => onOpenLead(activeLead)}>
                  View Details
                </button>
              </div>
            )}

            <div className="leads-map-zoom">
              <button type="button" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(2, Math.round((z + 0.2) * 10) / 10))}>+</button>
              <button type="button" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.6, Math.round((z - 0.2) * 10) / 10))}>-</button>
            </div>
            </div>
          </div>
        </div>

        <aside className="leads-map-detail-pane">
          {showDetailPane && (
            <>
              <div className="leads-map-detail-head">
                <h3>Lead Details</h3>
                <button
                  type="button"
                  className="modal-close"
                  aria-label="Close lead details"
                  onClick={() => setDetailClosedId(activeLead.id)}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="leads-map-detail-profile">
                <LeadAvatar lead={activeLead} className="leads-map-detail-avatar" />
                <div>
                  <strong>{activeLead.name.replace(" (Sample)", "")}</strong>
                  <span>{activeLead.company}</span>
                </div>
              </div>

              <div className="leads-map-detail-tags">
                <span className={`lead-status-chip ${getStatusTone(activeLead.status)}`}>{activeLead.status}</span>
                <b>{formatAmount(activeLead.amount)}</b>
              </div>

              <ul className="leads-map-detail-contact">
                <li><Phone size={15} /> +91 {activeLead.phone}</li>
                <li><Mail size={15} /> {activeLead.email}</li>
                <li><MapPin size={15} /> 123, {activeLead.city}, {activeLead.state}, {activeLead.country}</li>
              </ul>

              <div className="leads-map-detail-grid">
                <div><span>Lead Source</span><strong>{activeLead.source}</strong></div>
                <div><span>Assigned User</span><strong>{activeLead.owner}</strong></div>
                <div><span>Created On</span><strong>{activeLead.createdOn}</strong></div>
                <div><span>Pipeline</span><strong>Sales</strong></div>
              </div>

              <button type="button" className="btn-primary leads-map-detail-primary" onClick={() => onOpenLead(activeLead)}>
                View Full Details
              </button>

              <div className="leads-map-detail-actions">
                <button type="button" className="btn-outline">Edit</button>
                <button type="button" className="btn-outline">Create Deal</button>
              </div>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
