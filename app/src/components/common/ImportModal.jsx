import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, CheckCircle2, AlertCircle, Download, Database } from 'lucide-react';
import { exportToCSV } from '../../services/exportUtils';
export const ImportModal = ({ isOpen, onClose, title, templateHeaders, sampleRow, onImport, }) => {
    const [csvText, setCsvText] = useState('');
    const [parsedRows, setParsedRows] = useState([]);
    const [errorMsg, setErrorMsg] = useState(null);
    const fileInputRef = useRef(null);
    // UX only: Esc dismisses. No logic changes.
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);
    if (!isOpen)
        return null;
    const parseCSV = (text) => {
        setErrorMsg(null);
        const lines = text.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
            setErrorMsg('CSV must contain at least a header row and 1 data row.');
            setParsedRows([]);
            return;
        }
        const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
        const rows = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            // Basic regex CSV split handling quotes
            const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((v) => v.trim().replace(/^"|"$/g, ''));
            const rowObj = {};
            headers.forEach((h, idx) => {
                rowObj[h] = values[idx] ?? '';
            });
            rows.push(rowObj);
        }
        setParsedRows(rows);
    };
    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result;
            setCsvText(content);
            parseCSV(content);
        };
        reader.readAsText(file);
    };
    const handleDownloadTemplate = () => {
        exportToCSV(`Sample_${title.replace(/\s+/g, '_')}_Template`, templateHeaders, [sampleRow]);
    };
    const handleCommitImport = () => {
        if (parsedRows.length === 0) {
            setErrorMsg('No valid rows to import.');
            return;
        }
        onImport(parsedRows);
        onClose();
        setCsvText('');
        setParsedRows([]);
    };
    return (<div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Import ${title} via CSV`}>
      <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-4 sm:p-6 shadow-2xl text-xs max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold">
              <Database size={16}/>
            </div>
            <div>
              <h3 className="font-bold text-base text-[#1F2E4A]">Import {title} via CSV</h3>
              <p className="text-[11px] text-slate-500">Bulk upload or paste spreadsheet data</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer">
            <X size={18}/>
          </button>
        </div>

        {/* Modal Body */}
        <div className="space-y-4 mt-4 overflow-y-auto pr-1 flex-1">
          <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <p className="font-semibold text-slate-800">Need the correct column format?</p>
              <p className="text-[11px] text-slate-500">Download our pre-formatted sample CSV template.</p>
            </div>
            <button type="button" onClick={handleDownloadTemplate} className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs">
              <Download size={13} className="text-slate-600"/>
              Download CSV Template
            </button>
          </div>

          {/* File Upload Area */}
          <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl p-5 text-center cursor-pointer bg-slate-50/50 hover:bg-blue-50/20 transition-colors">
            <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1.5"/>
            <p className="font-semibold text-slate-800">Click to upload .CSV file</p>
            <p className="text-[11px] text-slate-400">or paste raw CSV text below</p>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFileUpload} className="hidden"/>
          </div>

          {/* Raw CSV Text Paste */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Raw CSV Content (Comma Separated)
            </label>
            <textarea rows={4} value={csvText} onChange={(e) => {
            setCsvText(e.target.value);
            parseCSV(e.target.value);
        }} placeholder={`Example:\n${templateHeaders.join(',')}\n${sampleRow.join(',')}`} className="w-full font-mono text-[11px] p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"/>
          </div>

          {errorMsg && (<div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0 text-rose-600"/>
              <span>{errorMsg}</span>
            </div>)}

          {/* Parsed Preview Table */}
          {parsedRows.length > 0 && (<div className="space-y-1.5">
              <span className="font-bold text-slate-700 text-xs flex items-center gap-1">
                <CheckCircle2 size={13} className="text-emerald-600"/>
                Detected {parsedRows.length} Valid Records Ready for Import
              </span>
              <div className="overflow-x-auto max-h-40 border border-slate-200 rounded-lg">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-100 text-slate-600 font-semibold sticky top-0">
                    <tr>
                      {Object.keys(parsedRows[0]).map((h, i) => (<th key={i} className="py-1.5 px-2.5 border-b border-slate-200">
                          {h}
                        </th>))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {parsedRows.slice(0, 5).map((row, idx) => (<tr key={idx} className="hover:bg-slate-50">
                        {Object.values(row).map((val, i) => (<td key={i} className="py-1 px-2.5 text-slate-700 truncate max-w-[150px]">
                            {val}
                          </td>))}
                      </tr>))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 5 && (<p className="text-[10px] text-slate-400 italic">
                  + {parsedRows.length - 5} more rows not shown in preview
                </p>)}
            </div>)}
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-200 mt-4 flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0">
          <button type="button" onClick={onClose} className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium">
            Cancel
          </button>
          <button type="button" disabled={parsedRows.length === 0} onClick={handleCommitImport} className="px-4 py-1.5 bg-[#1F2E4A] hover:bg-[#152033] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold flex items-center gap-1.5 shadow-xs">
            <Database size={13}/>
            Commit Import ({parsedRows.length} Items)
          </button>
        </div>
      </div>
    </div>);
};
