import { useEffect, useRef, useState } from 'react';
import {
  X,
  Upload,
  Download,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  ClipboardPaste,
} from 'lucide-react';
import { exportToCSV } from '../../../services/exportUtils';

/**
 * LeadImportModal — a 2-step CSV import wizard for leads.
 * Step 1 Upload (drop / click / paste + template download),
 * Step 2 Review (validation summary + preview table + commit).
 * Separate from the shared ImportModal so inventory keeps its own look.
 */
export function LeadImportModal({ isOpen, onClose, templateHeaders = [], sampleRow = [], onImport }) {
  const [step, setStep] = useState('upload');
  const [csvText, setCsvText] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setStep('upload');
      setCsvText('');
      setParsedRows([]);
      setErrorMsg(null);
      setDragging(false);
      setShowPaste(false);
      setFileName('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function parseCSV(text) {
    setErrorMsg(null);
    const lines = String(text || '')
      .trim()
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      setErrorMsg('CSV must contain at least a header row and 1 data row.');
      setParsedRows([]);
      return [];
    }
    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    const rows = [];
    for (let i = 1; i < lines.length; i += 1) {
      const values = lines[i]
        .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
        .map((v) => v.trim().replace(/^"|"$/g, ''));
      const rowObj = {};
      headers.forEach((h, idx) => {
        rowObj[h] = values[idx] ?? '';
      });
      rows.push(rowObj);
    }
    setParsedRows(rows);
    return rows;
  }

  function readFile(file) {
    if (!file) return;
    setFileName(file.name || '');
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result || '';
      setCsvText(typeof content === 'string' ? content : '');
      const rows = parseCSV(content);
      if (rows.length > 0) setStep('review');
    };
    reader.readAsText(file);
  }

  function handlePaste(text) {
    setCsvText(text);
    setFileName('');
    parseCSV(text);
  }

  function handleDownloadTemplate() {
    exportToCSV('Sample_Leads_Template', templateHeaders, [sampleRow]);
  }

  function handleCommitImport() {
    if (parsedRows.length === 0) {
      setErrorMsg('No valid rows to import.');
      return;
    }
    onImport(parsedRows);
    onClose();
  }

  function rowHasName(row) {
    return ['Lead Name', 'Name', 'Lead', 'lead name', 'name'].some(
      (key) => row[key] !== undefined && String(row[key] ?? '').trim() !== '',
    );
  }

  const unnamedCount = parsedRows.filter((r) => !rowHasName(r)).length;
  const previewColumns = parsedRows.length > 0 ? Object.keys(parsedRows[0]) : [];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Import leads via CSV"
    >
      <div
        className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-11 h-11 rounded-2xl grid place-items-center shrink-0 text-white shadow-md shadow-emerald-600/25 bg-gradient-to-br from-emerald-500 to-teal-600">
              <FileSpreadsheet size={20} />
            </span>
            <div className="min-w-0">
              <h3 className="font-bold text-lg text-slate-900 leading-tight">Import Leads</h3>
              <p className="text-xs text-slate-500">Bulk add leads from a CSV file</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close import"
            className="w-9 h-9 grid place-items-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Steps */}
        <div className="flex items-center gap-2 px-5 sm:px-6 pt-4">
          {['upload', 'review'].map((key, index) => {
            const active = step === key;
            const done = step === 'review' && key === 'upload';
            return (
              <div key={key} className="flex items-center gap-2">
                {index > 0 && <span className="w-8 h-px bg-slate-200" />}
                <span
                  className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border transition ${
                    active
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : done
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-white border-slate-200 text-slate-400'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full grid place-items-center text-[10px] ${
                      active ? 'bg-white/25' : 'bg-slate-100'
                    }`}
                  >
                    {index + 1}
                  </span>
                  {key === 'upload' ? 'Upload file' : 'Review & import'}
                </span>
              </div>
            );
          })}
          {parsedRows.length > 0 && (
            <span className="ml-auto text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
              {parsedRows.length} rows
            </span>
          )}
        </div>

        {/* Body */}
        <div className="px-5 sm:px-6 py-4 overflow-y-auto flex-1">
          {step === 'upload' ? (
            <div className="space-y-3">
              <button
                type="button"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  readFile(e.dataTransfer?.files?.[0]);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`w-full rounded-2xl border-2 border-dashed p-8 text-center transition cursor-pointer ${
                  dragging
                    ? 'border-emerald-500 bg-emerald-50/60'
                    : 'border-slate-300 bg-slate-50/60 hover:border-emerald-400 hover:bg-emerald-50/30'
                }`}
              >
                <span
                  className={`mx-auto w-12 h-12 rounded-2xl grid place-items-center mb-2 transition ${
                    dragging ? 'bg-emerald-600 text-white' : 'bg-white text-slate-400 border border-slate-200 shadow-xs'
                  }`}
                >
                  <Upload size={22} />
                </span>
                <span className="block font-bold text-slate-800 text-sm">
                  {dragging ? 'Drop the CSV file here' : 'Drag & drop your .CSV file here'}
                </span>
                <span className="block text-xs text-slate-400 mt-1">or click to browse files</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => readFile(e.target.files?.[0])}
                  className="hidden"
                />
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setShowPaste((v) => !v)}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-left hover:border-blue-300 hover:bg-blue-50/30 transition cursor-pointer"
                >
                  <span className="w-9 h-9 rounded-xl grid place-items-center bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
                    <ClipboardPaste size={17} />
                  </span>
                  <span>
                    <span className="block text-[13px] font-bold text-slate-800">Paste CSV text</span>
                    <span className="block text-[11px] text-slate-400">Copy rows from a spreadsheet</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-left hover:border-emerald-300 hover:bg-emerald-50/30 transition cursor-pointer"
                >
                  <span className="w-9 h-9 rounded-xl grid place-items-center bg-emerald-50 text-emerald-600 border border-emerald-100 shrink-0">
                    <Download size={17} />
                  </span>
                  <span>
                    <span className="block text-[13px] font-bold text-slate-800">Get the template</span>
                    <span className="block text-[11px] text-slate-400">Correct columns, sample row</span>
                  </span>
                </button>
              </div>

              {showPaste && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    Raw CSV content (comma separated)
                  </label>
                  <textarea
                    rows={5}
                    value={csvText}
                    onChange={(e) => handlePaste(e.target.value)}
                    placeholder={`Example:\n${templateHeaders.join(',')}\n${sampleRow.join(',')}`}
                    className="w-full font-mono text-[11px] p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 text-slate-800"
                  />
                </div>
              )}

              {errorMsg && (
                <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
                  {errorMsg}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2.5">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-center">
                  <p className="text-lg font-black text-slate-900 leading-none">{parsedRows.length}</p>
                  <p className="text-[11px] text-slate-500 font-semibold mt-1">Total rows</p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-3 py-2.5 text-center">
                  <p className="text-lg font-black text-emerald-700 leading-none">
                    {parsedRows.length - unnamedCount}
                  </p>
                  <p className="text-[11px] text-emerald-600 font-semibold mt-1">With name</p>
                </div>
                <div
                  className={`rounded-2xl border px-3 py-2.5 text-center ${
                    unnamedCount > 0
                      ? 'border-amber-200 bg-amber-50/70'
                      : 'border-slate-200 bg-slate-50/70'
                  }`}
                >
                  <p
                    className={`text-lg font-black leading-none ${
                      unnamedCount > 0 ? 'text-amber-600' : 'text-slate-900'
                    }`}
                  >
                    {unnamedCount}
                  </p>
                  <p className="text-[11px] text-slate-500 font-semibold mt-1">Missing name</p>
                </div>
              </div>

              {unnamedCount > 0 && (
                <p className="flex items-start gap-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  Rows without a Lead Name will be imported as “Untitled Lead”.
                </p>
              )}

              {errorMsg && (
                <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
                  {errorMsg}
                </p>
              )}

              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-50 text-slate-500 font-bold sticky top-0">
                      <tr>
                        <th className="py-2 px-3 w-10">#</th>
                        {previewColumns.map((h) => (
                          <th key={h} className="py-2 px-3 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {parsedRows.slice(0, 8).map((row, idx) => {
                        const ok = rowHasName(row);
                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-1.5 px-3 text-slate-400 font-semibold">{idx + 1}</td>
                            {previewColumns.map((h) => (
                              <td
                                key={h}
                                className="py-1.5 px-3 text-slate-700 truncate max-w-[140px]"
                              >
                                {row[h]}
                              </td>
                            ))}
                            <td className="py-1.5 px-3">
                              {ok ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                                  <CheckCircle2 size={11} /> Ready
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                                  <AlertTriangle size={11} /> No name
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {parsedRows.length > 8 && (
                  <p className="text-[11px] text-slate-400 italic px-3 py-2 border-t border-slate-100 bg-slate-50/60">
                    + {parsedRows.length - 8} more rows will be imported
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-2 bg-slate-50/50">
          {step === 'review' ? (
            <button
              type="button"
              onClick={() => setStep('upload')}
              className="btn-outline"
            >
              <ArrowLeft size={15} /> Back
            </button>
          ) : (
            <button type="button" onClick={onClose} className="btn-outline">
              Cancel
            </button>
          )}
          {step === 'upload' ? (
            <button
              type="button"
              disabled={parsedRows.length === 0}
              onClick={() => parsedRows.length > 0 && setStep('review')}
              className="btn-primary"
            >
              Continue <ArrowRight size={15} />
            </button>
          ) : (
            <button
              type="button"
              disabled={parsedRows.length === 0}
              onClick={handleCommitImport}
              className="btn-primary"
            >
              <CheckCircle2 size={15} /> Import {parsedRows.length} Leads
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default LeadImportModal;
