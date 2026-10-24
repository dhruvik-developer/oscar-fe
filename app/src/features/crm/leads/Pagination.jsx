import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";

export default function Pagination({ total = 10 }) {
  return (
    <div className="pagination-bar">
      <div className="total-records">Total Records <strong>{total}</strong></div>
      <div className="pager">
        <button type="button" className="page-nav" aria-label="Previous"><ChevronLeft size={15} /></button>
        {[1, 2, 3, 4, 5].map((p) => (
          <button key={p} type="button" className={`page-num${p === 1 ? " active" : ""}`}>{p}</button>
        ))}
        <button type="button" className="page-nav" aria-label="Next"><ChevronRight size={15} /></button>
        <button type="button" className="per-page">10 / page <ChevronDown size={14} /></button>
      </div>
    </div>
  );
}
