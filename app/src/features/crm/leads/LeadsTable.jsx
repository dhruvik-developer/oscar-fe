import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Archive, Building2, ChevronDown, ChevronUp, ChevronsUpDown, ClipboardList, Eye, Handshake, MoreVertical, NotebookPen, Pencil, Pin, RotateCcw, Scissors } from "lucide-react";
import LeadAvatar from "./LeadAvatar";
import { leadColumnPatch, leadColumnValue } from "./leadColumns";

function EditableCell({ row, field, value, onSave, className = "", onUpdate, renderValue }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const current = value !== undefined ? value : row[field];

  function startEditing() {
    setDraft(current ?? "");
    setEditing(true);
  }

  function save() {
    const nextValue = draft.trim();
    if (nextValue !== String(current ?? "")) {
      if (onSave) onSave(nextValue);
      else onUpdate?.(row.id, { [field]: nextValue });
    }
    setEditing(false);
  }

  function handleKeyDown(event) {
    if (event.key === "Enter") save();
    if (event.key === "Escape") setEditing(false);
  }

  if (editing) {
    return (
      <td className={className}>
        <input
          className="table-inline-input"
          value={draft}
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          onBlur={save}
          onKeyDown={handleKeyDown}
          aria-label={`Edit ${field}`}
        />
      </td>
    );
  }

  return (
    <td className={className} onDoubleClick={startEditing} title="Double-click to edit">
      {renderValue ? renderValue(row) : current}
    </td>
  );
}

// One body cell for a dynamic form-driven column.
function LeadColumnCell({ lead, column, onUpdateLead, onOpenLead, pinnedLeadIds, onTogglePin, variant }) {
  // System column — Lead No. (L-001). Blue link like the screenshot, opens detail.
  if (column.kind === "leadNumber") {
    const leadNo = lead.leadNumber || lead.lead_number || "—";
    return (
      <td
        className="nowrap cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          onOpenLead?.(lead);
        }}
      >
        <button
          type="button"
          className="lead-no-btn hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            onOpenLead?.(lead);
          }}
          aria-label={`Open details for ${leadNo}`}
          title={leadNo}
        >
          {leadNo}
        </button>
      </td>
    );
  }
  if (column.kind === "name") {
    return (
      <td
        className="lead-name-cell-wrap cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          onOpenLead?.(lead);
        }}
      >
        <div className="lead-name-cell">
          <LeadAvatar
            lead={lead}
            className={variant === "grid" ? "grid-lead-avatar" : "screenshot-avatar"}
          />
          <button
            type="button"
            className="lead-link-btn"
            onClick={(e) => {
              e.stopPropagation();
              onOpenLead?.(lead);
            }}
            aria-label={`Open details for ${lead.name}`}
          >
            <strong className="text-blue-600 hover:underline">{lead.name}</strong>
          </button>
        </div>
      </td>
    );
  }

  const cellValue = leadColumnValue(lead, column);
  if (column.kind === "row" && column.rowKey === "phone") {
    return (
      <EditableCell
        row={lead}
        field="phone"
        value={cellValue}
        onSave={(next) => onUpdateLead?.(lead.id, leadColumnPatch(column, next))}
        renderValue={(row) => (
          <span className="phone-cell">
            <span>{leadColumnValue(row, column)}</span>
          </span>
        )}
      />
    );
  }
  if (!column.editable) {
    return <td className="muted">{cellValue}</td>;
  }
  const cellClass = column.kind === "row" && column.rowKey === "email"
    ? "mail-link"
    : column.kind === "row" && column.rowKey === "createdOn"
      ? "muted nowrap"
      : "muted";
  return (
    <EditableCell
      row={lead}
      field={column.key}
      value={cellValue}
      className={cellClass}
      onSave={(next) => onUpdateLead?.(lead.id, leadColumnPatch(column, next))}
    />
  );
}

export default function LeadsTable({ rows = [], selected = [], pinnedLeadIds = [], columns = [], sortField = "", sortDirection = "ascending", onSort, onToggleOne, onToggleAll, onTogglePin, onRequestMarkLost, onRequestMarkLostAll, onAddNote, onOpenLead, onUpdateLead, onEditLead, onToggleCloseLead, onCreateTask, onIssueSample, onConvertDeal, onConvertParty, onMarkLost, variant = "list" }) {
  const allChecked = rows.length > 0 && rows.every((row) => selected.includes(row.id));
  // Floating row menu — rendered in a portal with fixed positioning so the
  // scrollable table body can never clip it. Always opens under the ⋮ button.
  const [menu, setMenu] = useState(null); // { row, top, left }
  const MENU_WIDTH = 232;
  const MENU_GAP = 8;

  function openMenu(event, row) {
    const rect = event.currentTarget.getBoundingClientRect();
    setMenu({
      row,
      top: rect.bottom + MENU_GAP,
      left: Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)),
    });
  }

  function closeMenu() {
    setMenu(null);
  }

  // Dismiss the floating menu on outside click, Escape, scroll or resize.
  useEffect(() => {
    if (!menu) return;
    function handlePointerDown(event) {
      if (!event.target.closest?.('.lead-row-menu')) closeMenu();
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') closeMenu();
    }
    function handleScroll(event) {
      // Wheel/trackpad scrolling INSIDE the menu must not dismiss it —
      // only page/table scrolls close it.
      if (event.target?.closest?.('.lead-row-menu')) return;
      closeMenu();
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [menu]);

  const menuRow = menu?.row;
  const menuIsClosed = /closed|lost/i.test(String(menuRow?.status || ''));

  return (
    <div className={`table-card screenshot-table-card${variant === "grid" ? " grid-table-card" : ""}`}>
      <div className="table-scroll">
        <table className="leads-table screenshot-table">
          <thead>
            <tr>
              <th className="col-check" style={{ width: 40, minWidth: 40, textAlign: 'center' }}>
                <input
                  type="checkbox"
                  className="row-check"
                  checked={allChecked}
                  onChange={() => {
                    onToggleAll?.();
                    onRequestMarkLostAll?.(rows);
                  }}
                  aria-label="Select all"
                />
              </th>
              <th className="col-pin" style={{ width: 36, minWidth: 36, textAlign: 'center' }} title="Pinned records">
                <Pin size={13} className="text-slate-400 mx-auto opacity-70" />
              </th>
              {columns.map((column) => {
                const isActive = sortField === column.key;
                const isAscending = sortDirection !== "descending";
                return (
                  <th key={column.key} aria-sort={isActive ? (isAscending ? "ascending" : "descending") : "none"}>
                    <button
                      type="button"
                      className="th-sort-btn"
                      onClick={() => onSort?.(column.key)}
                      aria-label={`Sort by ${column.label}${isActive ? (isAscending ? ", ascending" : ", descending") : ""}`}
                    >
                      <span className="th-inner">{column.label}
                        {/* Both arrows always show; the active direction is highlighted. */}
                        <span className="sort-arrows" aria-hidden="true">
                          <ChevronUp size={12} strokeWidth={2.5} className={`sort-ico${isActive && isAscending ? " active" : ""}`} />
                          <ChevronDown size={12} strokeWidth={2.5} className={`sort-ico${isActive && !isAscending ? " active" : ""}`} />
                        </span>
                      </span>
                    </button>
                  </th>
                );
              })}
              <th className="col-more" scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isPinned = pinnedLeadIds.includes(row.id);
              return (
                <tr
                  key={row.id}
                  className={`${isPinned ? "pinned-lead-row" : ""} cursor-pointer hover:bg-slate-50/80 transition-colors`}
                  onClick={(e) => {
                    if (e.target.closest('input, button, .activity-action-wrap, .row-more, .lead-row-actions, .lead-pin-cell, .table-inline-input')) {
                      return;
                    }
                    onOpenLead?.(row);
                  }}
                >
                  <td className="lead-row-actions text-center" style={{ width: 40, minWidth: 40 }}>
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
                  </td>
                  <td className="lead-pin-cell text-center" style={{ width: 36, minWidth: 36 }}>
                    <button
                      type="button"
                      className={`lead-pin-btn ${isPinned ? "is-pinned" : ""}`}
                      title={isPinned ? "Unpin lead" : "Pin lead to top"}
                      aria-label={isPinned ? `Unpin ${row.name}` : `Pin ${row.name} to top`}
                      aria-pressed={isPinned}
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePin?.(row);
                      }}
                    >
                      <Pin
                        size={14}
                        fill={isPinned ? "currentColor" : "none"}
                        className={`transition-all duration-150 ${
                          isPinned
                            ? "text-blue-600"
                            : "text-slate-300 hover:text-slate-500"
                        }`}
                      />
                    </button>
                  </td>
                  {columns.map((column) => (
                    <LeadColumnCell
                      key={column.key}
                      lead={row}
                      column={column}
                      onUpdateLead={onUpdateLead}
                      onOpenLead={onOpenLead}
                      pinnedLeadIds={pinnedLeadIds}
                      onTogglePin={onTogglePin}
                      variant={variant}
                    />
                  ))}
                  <td>
                    <div className="activity-action-wrap">
                      <button
                        type="button"
                        className={`row-more${menu?.row?.id === row.id ? ' open' : ''}`}
                        aria-label={`More actions for ${row.name}`}
                        aria-expanded={menu?.row?.id === row.id}
                        aria-haspopup="menu"
                        onClick={(event) => {
                          if (menu?.row?.id === row.id) closeMenu();
                          else openMenu(event, row);
                        }}
                      >
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 3} className="empty-row">No leads match the current filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {menu && menuRow && createPortal(
        <div
          className="lead-row-menu"
          role="menu"
          aria-label={`Actions for ${menuRow.name}`}
          style={{
            top: menu.top,
            left: menu.left,
            width: MENU_WIDTH,
            maxHeight: `calc(100vh - ${menu.top}px - 8px)`,
            overflowY: 'auto',
          }}
        >
          <p className="lead-row-menu-title">{menuRow.name}</p>
          <button
            type="button"
            role="menuitem"
            className="lead-row-menu-item"
            onClick={() => {
              const target = menuRow;
              closeMenu();
              onOpenLead?.(target);
            }}
          >
            <span className="lead-row-menu-ico lead-row-menu-ico-blue">
              <Eye size={15} />
            </span>
            <span className="lead-row-menu-text">
              <strong className="text-blue-600">View Details</strong>
              <small>Open full lead profile & timeline</small>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="lead-row-menu-item"
            onClick={() => {
              const target = menuRow;
              closeMenu();
              onTogglePin?.(target);
            }}
          >
            <span className={`lead-row-menu-ico ${pinnedLeadIds.includes(menuRow.id) ? 'lead-row-menu-ico-blue' : 'lead-row-menu-ico-slate'}`}>
              <Pin size={15} fill={pinnedLeadIds.includes(menuRow.id) ? "currentColor" : "none"} />
            </span>
            <span className="lead-row-menu-text">
              <strong>{pinnedLeadIds.includes(menuRow.id) ? "Unpin Lead" : "Pin to Top"}</strong>
              <small>{pinnedLeadIds.includes(menuRow.id) ? "Remove pin from this lead" : "Keep this lead at top of list"}</small>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="lead-row-menu-item"
            onClick={() => {
              const target = menuRow;
              closeMenu();
              onEditLead?.(target);
            }}
          >
            <span className="lead-row-menu-ico lead-row-menu-ico-blue">
              <Pencil size={15} />
            </span>
            <span className="lead-row-menu-text">
              <strong>Edit Lead</strong>
              <small>Update lead information</small>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="lead-row-menu-item"
            onClick={() => {
              const target = menuRow;
              closeMenu();
              onAddNote?.(target);
            }}
          >
            <span className="lead-row-menu-ico lead-row-menu-ico-blue">
              <NotebookPen size={15} />
            </span>
            <span className="lead-row-menu-text">
              <strong>Add Note</strong>
              <small>Log a note on this lead</small>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="lead-row-menu-item"
            onClick={() => {
              const target = menuRow;
              closeMenu();
              onCreateTask?.(target);
            }}
          >
            <span className="lead-row-menu-ico lead-row-menu-ico-emerald">
              <ClipboardList size={15} />
            </span>
            <span className="lead-row-menu-text">
              <strong>Create Task</strong>
              <small>Sample visit follow-up</small>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="lead-row-menu-item"
            onClick={() => {
              const target = menuRow;
              closeMenu();
              onIssueSample?.(target);
            }}
          >
            <span className="lead-row-menu-ico lead-row-menu-ico-violet">
              <Scissors size={15} />
            </span>
            <span className="lead-row-menu-text">
              <strong>Issue Sample</strong>
              <small>Taka and meters cut</small>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="lead-row-menu-item"
            onClick={() => {
              const target = menuRow;
              closeMenu();
              onConvertDeal?.(target);
            }}
          >
            <span className="lead-row-menu-ico lead-row-menu-ico-amber">
              <Handshake size={15} />
            </span>
            <span className="lead-row-menu-text">
              <strong>Convert to Deal</strong>
              <small>Rate offer for design + colour</small>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="lead-row-menu-item"
            onClick={() => {
              const target = menuRow;
              closeMenu();
              onConvertParty?.(target);
            }}
          >
            <span className="lead-row-menu-ico lead-row-menu-ico-sky">
              <Building2 size={15} />
            </span>
            <span className="lead-row-menu-text">
              <strong>Convert to Party</strong>
              <small>Regular buyer for Sales Orders</small>
            </span>
          </button>
          <div className="lead-row-menu-divider" />
          {menuIsClosed ? (
            <button
              type="button"
              role="menuitem"
              className="lead-row-menu-item"
              onClick={() => {
                const target = menuRow;
                closeMenu();
                onToggleCloseLead?.(target);
              }}
            >
              <span className="lead-row-menu-ico lead-row-menu-ico-emerald">
                <RotateCcw size={15} />
              </span>
              <span className="lead-row-menu-text">
                <strong>Reopen Lead</strong>
                <small>Move back to the pipeline</small>
              </span>
            </button>
          ) : (
            <button
              type="button"
              role="menuitem"
              className="lead-row-menu-item lead-row-menu-item-warn"
              onClick={() => {
                const target = menuRow;
                closeMenu();
                onToggleCloseLead?.(target);
              }}
            >
              <span className="lead-row-menu-ico lead-row-menu-ico-amber">
                <Archive size={15} />
              </span>
              <span className="lead-row-menu-text">
                <strong>Close Lead</strong>
                <small>Keep the record, stop follow-up</small>
              </span>
            </button>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
