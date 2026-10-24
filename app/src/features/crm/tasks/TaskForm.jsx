import { ArrowLeft, CalendarClock, ClipboardList, FileText, NotebookPen, UserRound } from "lucide-react";
import LeadAvatar from "../leads/LeadAvatar";

const inputStyle = {
  width: "100%",
  height: 38,
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "var(--card)",
  color: "var(--text)",
  padding: "0 12px",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle = {
  fontSize: 12,
  fontWeight: 700,
  color: "var(--text-secondary)",
  letterSpacing: "0.02em",
};

export default function TaskForm({ lead, onAddNote, onBack }) {
  const handleNote = () => {
    if (typeof onAddNote === "function") onAddNote(lead);
  };

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            border: 0,
            color: "var(--primary)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            padding: 0,
          }}
        >
          <ArrowLeft size={16} />
          Back to Leads
        </button>
        <button type="button" className="btn-outline btn-sm" onClick={handleNote} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <NotebookPen size={15} />
          Add Note
        </button>
      </div>

      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 12,
          background: "var(--card)",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", minWidth: 0, flex: 1 }}>
            {lead ? <LeadAvatar lead={lead} /> : null}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Lead Task Form
              </div>
              <h2 style={{ margin: "4px 0 6px", fontSize: 17, fontWeight: 750, color: "var(--text)" }}>
                Create task for {lead?.name ?? "selected lead"}
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.55, maxWidth: 520 }}>
                Task will stay linked with {lead?.company ?? "this lead"} so your note and follow-up flow stay together.
              </p>
            </div>
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: "var(--soft)",
              fontSize: 12.5,
              fontWeight: 600,
              color: "var(--text-secondary)",
              whiteSpace: "nowrap",
            }}
          >
            <UserRound size={16} />
            <span>{lead?.owner ?? "Owner not assigned"}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 14 }}>
          <label style={{ display: "grid", gap: 7, minWidth: 0 }}>
            <span style={labelStyle}>Task Title</span>
            <input type="text" style={inputStyle} defaultValue={lead ? `Follow up with ${lead.name}` : ""} placeholder="Enter task title" />
          </label>

          <label style={{ display: "grid", gap: 7, minWidth: 0 }}>
            <span style={labelStyle}>Status</span>
            <select defaultValue="Open" style={inputStyle}>
              <option>Open</option>
              <option>In Progress</option>
              <option>Waiting</option>
              <option>Completed</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 7, minWidth: 0 }}>
            <span style={labelStyle}>Due Date</span>
            <input type="date" style={inputStyle} />
          </label>

          <label style={{ display: "grid", gap: 7, minWidth: 0 }}>
            <span style={labelStyle}>Priority</span>
            <select defaultValue="Medium" style={inputStyle}>
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
              <option>Urgent</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 7, gridColumn: "1 / -1" }}>
            <span style={labelStyle}>Description</span>
            <textarea
              rows={4}
              placeholder="Add task instructions, owner notes, and expected next step..."
              style={{ ...inputStyle, height: "auto", minHeight: 104, padding: "10px 12px", resize: "vertical", lineHeight: 1.55 }}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 12 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", border: "1px solid var(--border)", background: "var(--soft)", borderRadius: 10, padding: "12px" }}>
            <ClipboardList size={17} style={{ flexShrink: 0, marginTop: 1, color: "var(--primary)" }} />
            <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
              <strong style={{ fontSize: 12.5, color: "var(--text)" }}>Lead Source</strong>
              <span style={{ fontSize: 12.5, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lead?.source ?? "Not available"}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", border: "1px solid var(--border)", background: "var(--soft)", borderRadius: 10, padding: "12px" }}>
            <CalendarClock size={17} style={{ flexShrink: 0, marginTop: 1, color: "var(--primary)" }} />
            <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
              <strong style={{ fontSize: 12.5, color: "var(--text)" }}>Created On</strong>
              <span style={{ fontSize: 12.5, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lead?.createdOn ?? "Not available"}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", border: "1px solid var(--border)", background: "var(--soft)", borderRadius: 10, padding: "12px" }}>
            <FileText size={17} style={{ flexShrink: 0, marginTop: 1, color: "var(--primary)" }} />
            <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
              <strong style={{ fontSize: 12.5, color: "var(--text)" }}>Lead Email</strong>
              <span style={{ fontSize: 12.5, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lead?.email ?? "Not available"}</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <button type="button" className="btn-outline" onClick={handleNote}>
            Open Notes
          </button>
          <button type="button" className="btn-primary">
            Save Task
          </button>
        </div>
      </div>
    </section>
  );
}
