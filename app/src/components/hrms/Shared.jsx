import { useState } from "react";
export function EmptyState({ icon = "search_off", title, desc, action }) {
  return <div className="py-14 flex flex-col items-center text-center text-muted">
      <span className="material-symbols-outlined text-[36px] opacity-60">{icon}</span>
      <div className="font-medium text-slate mt-2 text-[13px]">{title}</div>
      <div className="text-[12px] mt-1 max-w-sm">{desc}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>;
}
export function SkeletonCard() {
  return <div className="bg-card border border-border rounded-xl p-4 shadow-subtle animate-pulse"><div className="h-3 bg-soft rounded w-20" /><div className="h-6 bg-soft rounded w-16 mt-3" /><div className="h-3 bg-soft rounded w-24 mt-2" /></div>;
}
export function SkeletonTable() {
  return <div className="space-y-2 p-5">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 bg-soft rounded animate-pulse" />)}</div>;
}
export function ConfirmModal({ open, title, desc, confirmLabel = "Confirm", onConfirm, onClose, danger = false, requireReason = false, reason, setReason }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-card text-text border border-border rounded-xl shadow-xl w-full max-w-md p-4 sm:p-6 max-h-[95vh] overflow-y-auto flex flex-col gap-4">
        <h3 className="font-semibold text-[15px]">{title}</h3>
        <p className="text-[13px] text-muted">{desc}</p>
        {requireReason && <textarea value={reason} onChange={(e) => setReason?.(e.target.value)} placeholder="Rejection Reason (required)" rows={3} className="p-3 bg-soft border border-border rounded-xl text-[13px] text-text resize-none focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-card border border-border rounded-xl text-[13.5px] text-text hover:bg-card-hover transition-colors">Cancel</button>
          <button disabled={requireReason && !reason?.trim()} onClick={() => onConfirm(reason)} className={`px-5 py-2 rounded-xl text-[13.5px] font-medium disabled:opacity-40 transition-colors ${danger ? "bg-danger text-white hover:opacity-90" : "bg-primary text-white hover:bg-primary-dark"}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>;
}
export function ExportModal({ open, onClose, onExport }) {
  const [scope, setScope] = useState("Current View");
  const [format, setFormat] = useState("CSV");
  const [phase, setPhase] = useState("idle");
  if (!open) return null;
  function start() {
    setPhase("preparing");
    setTimeout(() => setPhase("done"), 1200);
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-card text-text border border-border rounded-xl shadow-xl w-full max-w-md p-4 sm:p-6 max-h-[95vh] overflow-y-auto flex flex-col gap-4">
        <div className="flex justify-between items-center"><h3 className="font-semibold">Export Attendance</h3><button onClick={onClose} className="w-7 h-7 rounded-full hover:bg-soft grid place-items-center"><span className="material-symbols-outlined text-[18px]">close</span></button></div>
        {phase === "idle" && <>
          <div><div className="text-[12px] font-medium">Scope</div><div className="grid grid-cols-3 gap-2 mt-1">{["Current View", "Selected Employees", "Date Range"].map((s) => <button key={s} onClick={() => setScope(s)} className={`px-2 py-2 rounded-xl border text-[11px] font-medium transition-colors ${scope === s ? "bg-primary text-white border-primary" : "bg-soft border-border text-text hover:bg-card-hover"}`}>{s}</button>)}</div></div>
          <div><div className="text-[12px] font-medium">Format</div><div className="flex gap-2 mt-1">{["CSV", "Excel", "PDF"].map((f) => <button key={f} onClick={() => setFormat(f)} className={`flex-1 py-2 rounded-xl border text-[13px] transition-colors ${format === f ? "bg-primary text-white border-primary" : "bg-card border-border text-text hover:bg-card-hover"}`}>{f}</button>)}</div></div>
          <button onClick={start} className="mt-2 py-2.5 bg-primary text-white hover:bg-primary-dark rounded-xl text-[13.5px] font-medium transition-colors">Export {format}</button>
        </>}
        {phase === "preparing" && <div className="py-6 flex flex-col items-center gap-3"><div className="w-8 h-8 border-2 border-border border-t-primary rounded-full animate-spin" /><div className="text-[13px] font-medium">Preparing export...</div><div className="text-[11px] text-muted">{scope} • {format}</div></div>}
        {phase === "done" && <div className="py-2 flex flex-col gap-3"><div className="flex items-center gap-2 text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 text-[13px]"><span className="material-symbols-outlined text-[18px]">check_circle</span>Export completed.</div><button onClick={() => {
    onExport({ scope, format });
    setPhase("idle");
    onClose();
  }} className="py-2.5 bg-primary text-white hover:bg-primary-dark rounded-xl text-[13.5px] font-medium transition-colors">Download</button><button onClick={() => setPhase("idle")} className="py-1 text-[12px] text-muted hover:text-text">Back</button></div>}
      </div>
    </div>;
}

