import {
  ChevronDown,
  Filter,
  Printer,
  LayoutGrid,
  SquareChartGantt,
} from "lucide-react";
import { useMemo } from 'react';
import { useCrmStore, leadTabsFrom } from '../../../stores/crmStore';
import RecordActionPanel from "./RecordActionPanel";

function ViewButton({ label, active, onClick, children }) {
  return (
    <button
      type="button"
      className={`toolbar-icon tooltip-anchor${active ? " active" : ""}`}
      aria-label={label}
      onClick={onClick}
    >
      {children}
      <span className="toolbar-tooltip">{label}</span>
    </button>
  );
}

export default function LeadsTabs({
  activeTab,
  onChange,
  isFilterOpen,
  onToggleFilter,
  isSortOpen,
  sortDraft,
  sortApplied,
  sortOptions,
  onToggleSort,
  onSortDraftChange,
  onApplySort,
  onCancelSort,
  onClearSort,
  leadView,
  onLeadViewChange,
  recordActionLead,
  recordActionLeads = [],
  onCloseRecordAction,
  onDeleteRecord,
  onPrint,
}) {
  // One tab per configured stage, counted from the leads the server returned.
  const leads = useCrmStore((s) => s.leads);
  const stages = useCrmStore((s) => s.stages);
  const tabs = useMemo(() => leadTabsFrom(leads, stages), [leads, stages]);
  const hasRecordAction = Boolean(recordActionLead) || recordActionLeads.length > 0;
  return (
    <div className="leads-toolbar-wrap">
      <div className="tabs-bar">
        <div className="tabs-list flex-wrap lg:flex-nowrap">
          <div className="relative">
            <select
              aria-label="Filter leads by status"
              value={activeTab}
              onChange={(event) => onChange(event.target.value)}
              className="tab-dropdown active"
              style={{ appearance: 'none', paddingRight: 32, cursor: 'pointer' }}
            >
              {tabs.map((tab) => (
                <option key={tab.key} value={tab.key}>{tab.label}</option>
              ))}
            </select>
            <ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
          </div>
        </div>
      </div>
      <div className={`list-toolbar${hasRecordAction ? " list-toolbar-actions" : ""}`}>
        <div className="list-toolbar-left">
          <button
            type="button"
            className={`toolbar-pill${isFilterOpen ? " active" : ""}`}
            onClick={onToggleFilter}
          >
            <Filter size={18} />
            Filter
          </button>
          <ViewButton label="Print Leads" onClick={onPrint}>
            <Printer size={18} />
          </ViewButton>
          <ViewButton label="Grid View" active={leadView === "grid"} onClick={() => onLeadViewChange("grid")}>
            <LayoutGrid size={18} />
          </ViewButton>
          <ViewButton label="Tile View" active={leadView === "tile"} onClick={() => onLeadViewChange("tile")}>
            <SquareChartGantt size={18} />
          </ViewButton>
          {hasRecordAction && (
            <RecordActionPanel
              lead={recordActionLead}
              leads={recordActionLeads}
              onClose={onCloseRecordAction}
              onDelete={onDeleteRecord}
            />
          )}
        </div>
      </div>
    </div>
  );
}
