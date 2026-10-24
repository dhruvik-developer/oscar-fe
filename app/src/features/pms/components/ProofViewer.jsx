import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  MessageSquare,
  Send,
  FileText,
  Image as ImageIcon,
  Download,
  ExternalLink,
} from 'lucide-react';

/**
 * ProofViewer — proof renderer with photo/PDF support and comment stream.
 *
 * Renders real uploaded photos and PDFs when available from user uploads,
 * or shows an empty state when no file is available.
 */

function pageCountFor(doc) {
  return Math.max(1, Number(doc?.pageCount) || 1);
}

export function ProofViewer({ document: doc, projectName, annotations = [], onAddAnnotation }) {
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [draft, setDraft] = useState('');

  const pages = useMemo(() => pageCountFor(doc), [doc]);
  const safePage = Math.min(page, pages);

  const fileSource =
    doc?.fileData ||
    (doc?.previewUrl || null);
  const hasRealFile = Boolean(fileSource);
  const isImage =
    doc?.fileType?.startsWith('image/') ||
    doc?.fileData?.startsWith('data:image/') ||
    /\.(png|jpe?g|webp|gif|svg)($|\?)/i.test(doc?.fileName || '') ||
    /\.(png|jpe?g|webp|gif|svg)($|\?)/i.test(fileSource || '');
  const isPdf =
    doc?.fileType === 'application/pdf' ||
    doc?.fileData?.startsWith('data:application/pdf') ||
    /\.pdf($|\?)/i.test(doc?.fileName || '') ||
    /\.pdf($|\?)/i.test(fileSource || '');

  // The browser plugin gives no usable error when an iframe/img source is
  // dead, so probe the URL with a 1-byte range GET. Same-origin token URLs
  // need no auth headers; data: URLs (fresh local uploads) skip the probe.
  // A 'failed' probe renders an explicit fallback with the HTTP status plus
  // working open/download actions instead of a mysterious grey box.
  const [sourceState, setSourceState] = useState('ready');
  const [sourceStatus, setSourceStatus] = useState(null);

  useEffect(() => {
    setSourceState('ready');
    setSourceStatus(null);
    if (!fileSource || !hasRealFile || fileSource.startsWith('data:')) return;
    let cancelled = false;
    fetch(fileSource, { headers: { Range: 'bytes=0-0' } })
      .then((r) => {
        if (cancelled) return;
        setSourceStatus(r.status);
        if (!r.ok) setSourceState('failed');
      })
      .catch(() => {
        if (!cancelled) setSourceState('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [fileSource, hasRealFile]);

  function handleOpenExternal() {
    if (!fileSource) return;
    const win = window.open();
    if (win) {
      if (isImage) {
        win.document.write(`
          <!DOCTYPE html>
          <html>
            <head><title>${doc.fileName}</title></head>
            <body style="margin:0;background:#0f172a;display:flex;align-items:center;justify-content:center;height:100vh;overflow:auto;">
              <img src="${fileSource}" alt="${doc.fileName}" style="max-width:96%;max-height:96vh;object-fit:contain;box-shadow:0 10px 30px rgba(0,0,0,0.5);border-radius:6px;" />
            </body>
          </html>
        `);
      } else {
        win.location.href = fileSource;
      }
    }
  }

  function renderSourceFallback() {
    return (
      <div className="p-6 sm:p-10 bg-slate-100 flex flex-col items-center justify-center text-center min-h-[380px]">
        <FileText size={26} className="text-slate-300 mb-3" />
        <p className="text-xs font-bold text-slate-700">
          Preview couldn&apos;t load{sourceStatus ? ` (HTTP ${sourceStatus})` : ''}.
        </p>
        <p className="text-[11px] text-slate-500 mt-1 max-w-sm">
          The file itself is fine — open it directly instead.
        </p>
        <div className="flex items-center gap-2 mt-4">
          <button
            type="button"
            onClick={handleOpenExternal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700"
          >
            <ExternalLink size={12} /> Open in new tab
          </button>
          <a
            href={fileSource}
            download={doc.fileName}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#dce5f4] bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:text-blue-600"
          >
            <Download size={12} /> Download
          </a>
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="rounded-xl border border-dashed border-[#dce5f4] bg-[#f6f9ff] p-6 sm:p-10 text-center">
        <FileText size={22} className="text-slate-300 mx-auto mb-2" />
        <p className="text-xs text-slate-500">Select a version to preview it.</p>
      </div>
    );
  }

  function submitComment(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onAddAnnotation?.({ page: safePage, text });
    setDraft('');
  }

  const pageComments = annotations.filter((a) => a.page === safePage);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_260px] gap-4">
      {/* Preview pane */}
      <div className="rounded-xl border border-[#dce5f4] bg-white overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[#dce5f4] bg-[#f6f9ff] flex-wrap">
          <div className="flex items-center gap-1.5 min-w-0">
            {isImage ? (
              <ImageIcon size={13} className="text-blue-500 shrink-0" />
            ) : (
              <FileText size={13} className={isPdf ? 'text-rose-500 shrink-0' : 'text-slate-400 shrink-0'} />
            )}
            <span className="text-[11px] font-semibold text-slate-700 truncate" title={doc.fileName}>
              {doc.fileName}
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600 shrink-0">
              v{doc.version}.0
            </span>
            {hasRealFile && (
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                  isImage
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-rose-100 text-rose-700'
                }`}
              >
                {isImage ? 'Photo' : 'PDF'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {(!hasRealFile || isImage) && (
              <>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.6, Math.round((z - 0.2) * 10) / 10))}
                  disabled={zoom <= 0.6}
                  aria-label="Zoom out"
                  className="p-1 rounded text-slate-500 hover:bg-white disabled:opacity-30"
                >
                  <ZoomOut size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  aria-label="Reset zoom"
                  className="text-[10px] font-semibold text-slate-500 hover:text-blue-600 px-1 py-0.5 rounded"
                  title="Click to reset zoom"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(2.0, Math.round((z + 0.2) * 10) / 10))}
                  disabled={zoom >= 2.0}
                  aria-label="Zoom in"
                  className="p-1 rounded text-slate-500 hover:bg-white disabled:opacity-30"
                >
                  <ZoomIn size={13} />
                </button>
              </>
            )}

            {!hasRealFile && (
              <>
                <span className="w-px h-4 bg-slate-200 mx-1" />
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  aria-label="Previous page"
                  className="p-1 rounded text-slate-500 hover:bg-white disabled:opacity-30"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-[10px] font-semibold text-slate-600" data-test="pdf-page">
                  {safePage} / {pages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  disabled={safePage >= pages}
                  aria-label="Next page"
                  className="p-1 rounded text-slate-500 hover:bg-white disabled:opacity-30"
                >
                  <ChevronRight size={14} />
                </button>
              </>
            )}

            {hasRealFile && (
              <>
                <span className="w-px h-4 bg-slate-200 mx-1" />
                <a
                  href={fileSource}
                  download={doc.fileName}
                  className="p-1 rounded text-slate-500 hover:bg-white hover:text-blue-600 transition-colors"
                  title="Download to PC"
                >
                  <Download size={13} />
                </a>
                <button
                  type="button"
                  onClick={handleOpenExternal}
                  className="p-1 rounded text-slate-500 hover:bg-white hover:text-blue-600 transition-colors"
                  title="Open full preview in new tab"
                >
                  <ExternalLink size={13} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content Viewer: Real Photo, Real PDF, or Fallback Blueprint */}
        {hasRealFile && isImage ? (
          sourceState === 'failed' ? (
            renderSourceFallback()
          ) : (
            <div className="p-3 sm:p-6 bg-slate-900/5 flex items-center justify-center overflow-auto min-h-[380px] max-h-[580px]">
              <img
                src={fileSource}
                alt={doc.fileName}
                onError={() => setSourceState('failed')}
                className="max-w-full rounded-lg shadow-sm border border-slate-200 object-contain transition-transform duration-150"
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: 'center center',
                }}
              />
            </div>
          )
        ) : hasRealFile && isPdf ? (
          sourceState === 'failed' ? (
            renderSourceFallback()
          ) : (
            <div className="w-full bg-slate-100 min-h-[480px] h-[58vh] overflow-hidden">
              <iframe
                src={fileSource}
                title={doc.fileName}
                className="w-full h-full border-0"
              />
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center gap-1 bg-slate-50 p-6 text-center" style={{ minHeight: 340 }}>
            <p className="text-[13px] font-bold text-slate-600">No preview available</p>
            <p className="text-[12px] text-slate-400">The uploaded file for this version could not be loaded.</p>
          </div>
        )}
      </div>

      {/* Comment stream */}
      <aside className="rounded-xl border border-[#dce5f4] bg-white flex flex-col" style={{ maxHeight: 420 }}>
        <header className="flex items-center gap-1.5 px-3 py-2 border-b border-[#dce5f4]">
          <MessageSquare size={12} className="text-slate-400" />
          <span className="text-[11px] font-bold text-slate-700">Comments</span>
          <span className="text-[10px] text-slate-400 ml-auto">page {safePage}</span>
        </header>

        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {doc.revisionReason && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-2">
              <p className="text-[10px] font-bold text-orange-800 mb-0.5">Revision requested</p>
              <p className="text-[11px] text-orange-900">{doc.revisionReason}</p>
            </div>
          )}
          {doc.comments && (
            <div className="rounded-lg border border-[#dce5f4] bg-[#f6f9ff] px-2.5 py-2">
              <p className="text-[10px] font-bold text-slate-500 mb-0.5">
                {doc.uploadedBy?.name ?? 'Uploader'}
              </p>
              <p className="text-[11px] text-slate-700">{doc.comments}</p>
            </div>
          )}

          {pageComments.length === 0 && !doc.comments && !doc.revisionReason && (
            <p className="text-[11px] text-slate-400 text-center py-6">
              No comments on this page yet.
            </p>
          )}

          {pageComments.map((a) => (
            <div key={a.id} className="rounded-lg border border-[#dce5f4] px-2.5 py-2">
              <p className="text-[10px] font-bold text-slate-500 mb-0.5">{a.author ?? 'You'}</p>
              <p className="text-[11px] text-slate-700">{a.text}</p>
            </div>
          ))}
        </div>

        <form onSubmit={submitComment} className="p-2.5 border-t border-[#dce5f4] flex gap-1.5">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Comment on page ${safePage}…`}
            aria-label="Add a comment"
            className="flex-1 min-w-0 text-[11px] rounded-lg border border-[#dce5f4] px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            aria-label="Post comment"
            className="p-1.5 rounded-lg bg-blue-600 text-white disabled:opacity-30"
          >
            <Send size={12} />
          </button>
        </form>
      </aside>
    </div>
  );
}

export default ProofViewer;
