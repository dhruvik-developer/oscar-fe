import QRCode from 'qrcode';

/**
 * The URL a batch QR code carries. It holds only the batch ID: scanning opens
 * the signed-in Batch Traceability workspace, and the server decides what the
 * viewer may see (cost and profit need ledger access).
 */
export function batchUrl(code) {
  return `${window.location.origin}/inventory/batches/${encodeURIComponent(code)}`;
}

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

/** Open a print window with one 100 × 60 mm tag per batch. */
export async function printBatchTags(batches) {
  const win = window.open('', '_blank', 'width=720,height=560');
  if (!win) throw new Error('The browser blocked the print window. Allow pop-ups for this site and try again.');
  const tags = await Promise.all(
    batches.map(async (b) => {
      const qr = await QRCode.toDataURL(batchUrl(b.batchCode), { margin: 1, width: 220, errorCorrectionLevel: 'M' });
      const spec = [b.fabricQuality, b.shade, b.width ? `${b.width}" W` : '', b.gsm ? `${b.gsm} GSM` : '']
        .filter(Boolean)
        .join(' · ');
      return `
        <div class="tag">
          <img class="qr" src="${qr}" alt="QR ${escapeHtml(b.batchCode)}" />
          <div class="body">
            <div class="brand">OSCAR</div>
            <div class="code">${escapeHtml(b.batchCode)}</div>
            <div class="row"><b>${escapeHtml(b.item || '')}</b></div>
            ${b.hsnCode ? `<div class="row">HSN: ${escapeHtml(b.hsnCode)}</div>` : ''}
            ${spec ? `<div class="row">${escapeHtml(spec)}</div>` : ''}
            <div class="row">Received: ${escapeHtml(b.createdOn || '')}</div>
            <div class="row">Lot: ${escapeHtml((b.lots || []).join(', '))}</div>
          </div>
        </div>`;
    }),
  );
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Batch tags</title>
    <style>
      @page { size: 100mm 60mm; margin: 0; }
      body { margin: 0; font-family: Arial, sans-serif; color: #000; }
      .tag { width: 100mm; height: 60mm; box-sizing: border-box; padding: 4mm; display: flex; gap: 4mm;
             align-items: center; page-break-after: always; border: 1px dashed #bbb; }
      .qr { width: 38mm; height: 38mm; }
      .body { flex: 1; min-width: 0; font-size: 9pt; line-height: 1.35; }
      .brand { font-weight: 800; letter-spacing: 2px; font-size: 10pt; }
      .code { font-family: monospace; font-weight: 700; font-size: 11pt; margin: 1mm 0 2mm; word-break: break-all; }
      .row { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      @media print { .tag { border: none; } }
    </style></head><body>${tags.join('')}
    <script>window.onload = () => { window.focus(); window.print(); };</script></body></html>`);
  win.document.close();
}
