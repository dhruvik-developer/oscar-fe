import React, { useState, useRef, useEffect } from "react";
import { Download, ChevronDown, FileSpreadsheet, FileText, FileCode, Loader2 } from "lucide-react";

/**
 * Clean text for standard Helvetica font in jsPDF (avoids encoding issues with currency/symbols).
 */
function sanitizePdfText(str) {
  if (str == null) return "—";
  return String(str)
    .replace(/₹\s*/g, "Rs. ")
    .replace(/[^\x00-\x7F]/g, (char) => {
      if (char === "•" || char === "·") return "-";
      if (char === "—" || char === "–") return "-";
      if (char === "’" || char === "‘") return "'";
      if (char === "“" || char === "”") return '"';
      return "";
    });
}

/**
 * Universal HRMS Export Dropdown
 * Provides 1-click export to Excel (.xlsx), PDF (.pdf), and CSV (.csv).
 */
export default function HrmsExportDropdown({
  onExport,
  isExporting: externalIsExporting,
  filename = "hrms_export",
  reportTitle = "HRMS Report",
  subtitle = "",
  kpis = [],
  columns = [],
  rows = [],
  disabled = false,
  buttonLabel = "Export",
  align = "right",
  className = "",
  buttonClassName = "",
  subCategories = null, // e.g. [{ id: "requests", label: "Leave Requests" }, { id: "balances", label: "Leave Balances" }]
  selectedSubCategory = null,
  onSubCategoryChange = null,
}) {
  const [open, setOpen] = useState(false);
  const [localIsExporting, setLocalIsExporting] = useState(false);
  const dropdownRef = useRef(null);

  const isExporting = externalIsExporting ?? localIsExporting;

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // Built-in automated export engine if no custom onExport handler is provided
  const handleAutoExport = async (format) => {
    if (!rows || rows.length === 0) {
      alert("No data available to export for the current filters.");
      return;
    }

    setLocalIsExporting(true);
    setOpen(false);

    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const safeFilename = `${filename}_${dateStr}`;

      const headers = columns.map((c) => c.label || c.header || c.title || c.key || "");
      const formatTimeVal = (value) => {
        if (!value || value === "-" || value === "—") return "—";
        const str = String(value).trim();
        if (!str) return "—";
        if (/^(0?[1-9]|1[0-2]):[0-5][0-9](\s*[APap][Mm])$/.test(str)) return str.toUpperCase();
        if (str.includes("T") || /^\d{4}[-/]\d{2}[-/]\d{2}/.test(str)) {
          const d = new Date(str);
          if (!Number.isNaN(d.getTime())) {
            return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase();
          }
        }
        const m = /^(\d{1,2}):(\d{2})(?::\d{2})?/.exec(str);
        if (m) {
          let hours = parseInt(m[1], 10);
          const mins = m[2];
          const ampm = hours >= 12 ? "PM" : "AM";
          hours = hours % 12 || 12;
          return `${String(hours).padStart(2, "0")}:${mins} ${ampm}`;
        }
        const d = new Date(str);
        if (!Number.isNaN(d.getTime())) {
          return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase();
        }
        return str;
      };

      const getVal = (row, col) => {
        let val = "";
        if (col.get) val = col.get(row);
        else if (col.format) val = col.format(row);
        else if (col.key) val = row[col.key];

        const colLabel = String(col.label || col.header || col.title || col.key || "").toLowerCase();
        if (
          colLabel.includes("check-in") ||
          colLabel.includes("check in") ||
          colLabel.includes("check-out") ||
          colLabel.includes("check out")
        ) {
          if (val && val !== "—" && val !== "-") {
            const formatted = formatTimeVal(val);
            if (formatted) return formatted;
          }
        }
        return val ?? "";
      };

      // ── 1. CSV EXPORT ──
      if (format === "csv") {
        const escapeCsv = (val) => `"${String(val ?? "").replace(/"/g, '""')}"`;
        const csvLines = rows.map((r) => columns.map((c) => escapeCsv(getVal(r, c))).join(","));
        const content = "\uFEFF" + [headers.map(escapeCsv).join(","), ...csvLines].join("\r\n");
        const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${safeFilename}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }

      // ── 2. EXCEL (.xlsx) EXPORT ──
      else if (format === "excel") {
        const XLSX = await import("xlsx");
        const data = rows.map((r) => columns.map((c) => getVal(r, c) ?? ""));
        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

        // Auto calculate column widths
        ws["!cols"] = columns.map((col, idx) => {
          let maxLen = (col.label || "").length;
          data.forEach((row) => {
            const l = String(row[idx] ?? "").length;
            if (l > maxLen) maxLen = l;
          });
          return { wch: Math.min(Math.max(maxLen + 3, 10), 40) };
        });

        const wb = XLSX.utils.book_new();
        const sheetTitle = (reportTitle || "Report").replace(/[*?:\/\\\[\]]/g, "").slice(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, sheetTitle || "Sheet1");
        XLSX.writeFile(wb, `${safeFilename}.xlsx`);
      }

      // ── 3. PDF (.pdf) EXPORT ──
      else if (format === "pdf") {
        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF({
          orientation: "landscape",
          unit: "pt",
          format: "a4",
        });

        const pageWidth = 841.89;
        const pageHeight = 595.28;
        const margin = 28;
        const printableWidth = pageWidth - margin * 2; // 785.89 pt

        // Calculate column widths proportional to content or defaults
        const totalWeight = columns.reduce((acc, c) => acc + (c.width || 100), 0);
        const colWidths = columns.map((c) => ((c.width || 100) / totalWeight) * printableWidth);

        const drawHeader = (isFirstPage) => {
          if (isFirstPage) {
            // Dark Banner
            doc.setFillColor(15, 23, 42); // slate-900
            doc.rect(margin, margin, printableWidth, 32, "F");

            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(255, 255, 255);
            doc.text("OSCAR TEXTILE ERP  |  HRMS MANAGEMENT", margin + 12, margin + 20);

            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(203, 213, 225);
            doc.text("CONFIDENTIAL REPORT", margin + printableWidth - 120, margin + 20);

            // Report Title & Meta
            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(15, 23, 42);
            doc.text(reportTitle, margin, margin + 54);

            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(100, 116, 139);
            const metaInfo = [
              subtitle || `Generated: ${new Date().toLocaleDateString()}`,
              `Total Records: ${rows.length}`,
            ].filter(Boolean).join("  |  ");
            doc.text(metaInfo, margin, margin + 67);

            const genTime = `Generated: ${new Date().toLocaleString()}`;
            doc.text(genTime, margin + printableWidth - 150, margin + 67);

            let nextY = margin + 74;

            // Optional KPI strip
            if (kpis && kpis.length > 0) {
              doc.setFillColor(248, 250, 252);
              doc.setDrawColor(226, 232, 240);
              doc.roundedRect(margin, nextY, printableWidth, 26, 3, 3, "FD");

              const kpiWidth = printableWidth / Math.min(kpis.length, 7);
              kpis.slice(0, 7).forEach((k, idx) => {
                const kx = margin + idx * kpiWidth;
                doc.setFontSize(6.5);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(100, 116, 139);
                doc.text(String(k.label).toUpperCase(), kx + 8, nextY + 11);

                doc.setFontSize(9);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(15, 23, 42);
                doc.text(String(k.val), kx + 8, nextY + 22);
              });
              nextY += 34;
            }

            return nextY + 4;
          } else {
            doc.setFontSize(8.5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(100, 116, 139);
            doc.text(`${reportTitle} (continued)`, margin, margin + 14);
            doc.setDrawColor(226, 232, 240);
            doc.line(margin, margin + 20, margin + printableWidth, margin + 20);
            return margin + 26;
          }
        };

        const drawTableHeaders = (startY) => {
          doc.setFillColor(241, 245, 249);
          doc.setDrawColor(203, 213, 225);
          doc.rect(margin, startY, printableWidth, 18, "FD");

          doc.setFontSize(7.5);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(51, 65, 85);

          let curX = margin;
          columns.forEach((col, idx) => {
            const w = colWidths[idx];
            let textX = curX + 4;
            if (col.align === "center") textX = curX + w / 2;
            else if (col.align === "right") textX = curX + w - 4;

            doc.text(String(col.label || col.header || col.key || ""), textX, startY + 12, {
              align: col.align || "left",
            });
            curX += w;
          });

          return startY + 18;
        };

        let startY = drawHeader(true);
        let currentY = drawTableHeaders(startY);

        const rowHeight = 16;
        rows.forEach((r, rowIdx) => {
          if (currentY + rowHeight > pageHeight - 32) {
            doc.addPage();
            const nextStart = drawHeader(false);
            currentY = drawTableHeaders(nextStart);
          }

          if (rowIdx % 2 === 1) {
            doc.setFillColor(248, 250, 252);
            doc.rect(margin, currentY, printableWidth, rowHeight, "F");
          }

          doc.setDrawColor(241, 245, 249);
          doc.line(margin, currentY + rowHeight, margin + printableWidth, currentY + rowHeight);

          doc.setFontSize(7.5);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(30, 41, 59);

          let curX = margin;
          columns.forEach((col, cIdx) => {
            const w = colWidths[cIdx];
            const rawVal = getVal(r, col);
            const val = sanitizePdfText(rawVal);

            let textX = curX + 4;
            if (col.align === "center") textX = curX + w / 2;
            else if (col.align === "right") textX = curX + w - 4;

            let textToPrint = val;
            if (doc.getTextWidth(textToPrint) > w - 6) {
              while (textToPrint.length > 2 && doc.getTextWidth(textToPrint + "…") > w - 6) {
                textToPrint = textToPrint.slice(0, -1);
              }
              textToPrint += "…";
            }
            doc.text(textToPrint, textX, currentY + 11, {
              align: col.align || "left",
            });

            curX += w;
          });

          currentY += rowHeight;
        });

        // Add page footers
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(7.5);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(148, 163, 184);
          doc.text(`Page ${i} of ${pageCount}`, margin, pageHeight - 14);
          doc.text(
            "Confidential - OSCAR Textile ERP Internal HR Document",
            margin + printableWidth - 220,
            pageHeight - 14
          );
        }

        doc.save(`${safeFilename}.pdf`);
      }
    } catch (err) {
      console.error("Auto export error:", err);
      alert("Export failed: " + (err?.message || "Unknown error"));
    } finally {
      setLocalIsExporting(false);
    }
  };

  const handleSelectFormat = (format) => {
    if (onExport) {
      setOpen(false);
      onExport(format);
    } else {
      handleAutoExport(format);
    }
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        disabled={disabled || isExporting}
        className={
          buttonClassName ||
          "inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-[13px] font-semibold shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        }
        title="Export records"
      >
        {isExporting ? (
          <Loader2 size={15} className="animate-spin text-slate-600" />
        ) : (
          <Download size={15} className="text-slate-600" />
        )}
        <span>{isExporting ? "Exporting..." : buttonLabel}</span>
        <ChevronDown
          size={13}
          className={`text-slate-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          className={`absolute ${
            align === "left" ? "left-0" : "right-0"
          } mt-1.5 w-[235px] bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 text-left`}
        >
          {/* Sub-Category Switcher (e.g. Requests vs Balances) */}
          {subCategories && subCategories.length > 0 && (
            <div className="mb-1.5 p-1 bg-slate-100 rounded-lg flex items-center gap-1">
              {subCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onSubCategoryChange && onSubCategoryChange(cat.id)}
                  className={`flex-1 py-1 text-[11px] font-semibold rounded-md transition text-center cursor-pointer ${
                    selectedSubCategory === cat.id
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}

          <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Export Format
          </div>

          {/* Option 1: Excel */}
          <button
            type="button"
            onClick={() => handleSelectFormat("excel")}
            className="w-full px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-emerald-50/70 hover:text-emerald-800 rounded-lg flex items-center gap-2.5 transition-colors cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-100/80">
              <FileSpreadsheet size={16} />
            </div>
            <div>
              <div className="font-semibold text-slate-800 group-hover:text-emerald-900 text-[12.5px]">
                Excel Spreadsheet
              </div>
              <div className="text-[10px] text-slate-400">Microsoft Excel (.xlsx)</div>
            </div>
          </button>

          {/* Option 2: PDF */}
          <button
            type="button"
            onClick={() => handleSelectFormat("pdf")}
            className="w-full px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-rose-50/70 hover:text-rose-800 rounded-lg flex items-center gap-2.5 transition-colors cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 group-hover:bg-rose-100/80">
              <FileText size={16} />
            </div>
            <div>
              <div className="font-semibold text-slate-800 group-hover:text-rose-900 text-[12.5px]">
                PDF Document
              </div>
              <div className="text-[10px] text-slate-400">Formatted Report (.pdf)</div>
            </div>
          </button>

          {/* Option 3: CSV */}
          <button
            type="button"
            onClick={() => handleSelectFormat("csv")}
            className="w-full px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-blue-50/70 hover:text-blue-800 rounded-lg flex items-center gap-2.5 transition-colors cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-100/80">
              <FileCode size={16} />
            </div>
            <div>
              <div className="font-semibold text-slate-800 group-hover:text-blue-900 text-[12.5px]">
                CSV Document
              </div>
              <div className="text-[10px] text-slate-400">Comma-Separated (.csv)</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
