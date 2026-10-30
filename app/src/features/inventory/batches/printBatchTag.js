import QRCode from 'qrcode';

/**
 * Detected LAN IP for the local machine so phones on the same Wi-Fi network
 * can reach the development server without getting "Site can't be reached" (localhost error).
 */
export const DEFAULT_LAN_IP = '192.168.1.46';

/**
 * Returns the best origin to use for mobile QR code scanning.
 * - If running on a public domain or LAN IP, returns window.location.origin.
 * - If running on localhost or 127.0.0.1, replaces it with the LAN IP so mobile phones
 *   on the same network can access it.
 */
export function getMobileScanOrigin() {
  const hostname = window.location.hostname;
  const port = window.location.port ? `:${window.location.port}` : '';
  const storedIp = typeof localStorage !== 'undefined' ? localStorage.getItem('oscar_lan_ip') : null;
  const lanIp = storedIp || DEFAULT_LAN_IP;

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `http://${lanIp}${port}`;
  }
  return window.location.origin;
}

/**
 * Generates the public mobile Batch Passport URL.
 * Encodes essential batch metadata in query parameters so that even if the mobile
 * device is unauthenticated or the backend server is temporarily unreachable,
 * the mobile Batch Passport card loads instantly with complete information.
 */
export function batchUrl(batchOrCode) {
  const origin = getMobileScanOrigin();
  if (typeof batchOrCode === 'string') {
    return `${origin}/batch/${encodeURIComponent(batchOrCode)}`;
  }

  const b = batchOrCode || {};
  const code = b.batchCode || 'UNKNOWN';
  const params = new URLSearchParams();

  if (b.item || b.itemName) params.set('item', b.item || b.itemName);
  if (b.fabricQuality) params.set('quality', b.fabricQuality);
  if (b.shade) params.set('shade', b.shade);
  if (Array.isArray(b.lots) && b.lots.length > 0) params.set('lots', b.lots.join(','));
  else if (b.lots) params.set('lots', String(b.lots));
  if (b.takaCount || b.takaRolls?.length) params.set('rolls', String(b.takaCount || b.takaRolls?.length));
  if (b.totalQuantity || b.received) params.set('qty', String(b.totalQuantity || b.received));
  if (b.uom) params.set('uom', b.uom);
  if (b.createdOn) params.set('date', b.createdOn);
  if (b.hsnCode) params.set('hsn', b.hsnCode);
  if (b.status) params.set('status', b.status);

  const qs = params.toString();
  return `${origin}/batch/${encodeURIComponent(code)}${qs ? `?${qs}` : ''}`;
}

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

/** Open a print window with one 100 x 60 mm tag per batch. */
export async function printBatchTags(batches) {
  // A PO receipt gets its tag once QC has passed it, never while at QC Hold.
  const waiting = batches.filter((b) => b && b.awaitingQc);
  if (waiting.length) {
    throw new Error(`${waiting.map((b) => b.batchCode).join(', ')} ${waiting.length === 1 ? 'is' : 'are'} waiting for QC; print the tag after QC passes.`);
  }
  const win = window.open('', '_blank', 'width=760,height=600');
  if (!win) throw new Error('The browser blocked the print window. Allow pop-ups for this site and try again.');

  const tags = await Promise.all(
    batches.map(async (b) => {
      const url = batchUrl(b);
      const qr = await QRCode.toDataURL(url, { margin: 1, width: 240, errorCorrectionLevel: 'M' });
      const spec = [b.fabricQuality, b.shade, b.width ? `${b.width}" W` : '', b.gsm ? `${b.gsm} GSM` : '']
        .filter(Boolean)
        .join(' • ');

      return `
        <div class="tag">
          <div class="qr-col">
            <img class="qr" src="${qr}" alt="QR ${escapeHtml(b.batchCode)}" />
            <div class="scan-hint">Scan with Phone</div>
          </div>
          <div class="body">
            <div class="header-row">
              <span class="brand">OSCAR</span>
              <span class="tag-badge">BATCH PASSPORT</span>
            </div>
            <div class="code">${escapeHtml(b.batchCode)}</div>
            <div class="row item-name"><b>${escapeHtml(b.item || b.itemName || 'Fabric Item')}</b></div>
            ${b.hsnCode ? `<div class="row">HSN: ${escapeHtml(b.hsnCode)}</div>` : ''}
            ${spec ? `<div class="row spec-row">${escapeHtml(spec)}</div>` : ''}
            ${b.totalQuantity ? `<div class="row">Total Qty: <b>${escapeHtml(String(b.totalQuantity))} ${escapeHtml(b.uom || 'MTR')}</b></div>` : ''}
            <div class="row">Received: ${escapeHtml(b.createdOn || '')}</div>
            <div class="row">Lot: ${escapeHtml(Array.isArray(b.lots) ? b.lots.join(', ') : (b.lots || '-'))}</div>
          </div>
        </div>`;
    }),
  );

  const lanOrigin = getMobileScanOrigin();

  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Batch tags</title>
    <style>
      @page { size: 100mm 60mm; margin: 0; }
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #000; background: #fff; }
      .no-print-bar { background: #1e293b; color: #e2e8f0; padding: 10px 16px; font-size: 11px; display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #3b82f6; }
      .no-print-bar button { background: #3b82f6; color: white; border: none; padding: 6px 14px; border-radius: 6px; font-weight: bold; cursor: pointer; }
      .no-print-bar button:hover { background: #2563eb; }
      .tag { width: 100mm; height: 60mm; box-sizing: border-box; padding: 4.5mm; display: flex; gap: 4mm;
             align-items: center; page-break-after: always; border: 1px dashed #cbd5e1; margin: 10px auto; background: white; }
      .qr-col { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 38mm; }
      .qr { width: 38mm; height: 38mm; display: block; }
      .scan-hint { font-size: 7.5pt; color: #64748b; font-weight: 600; text-transform: uppercase; margin-top: 1.5mm; letter-spacing: 0.5px; }
      .body { flex: 1; min-width: 0; font-size: 8.5pt; line-height: 1.35; color: #1e293b; }
      .header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1mm; }
      .brand { font-weight: 900; letter-spacing: 2px; font-size: 10pt; color: #0f172a; }
      .tag-badge { font-size: 6.5pt; font-weight: 800; background: #e0f2fe; color: #0369a1; padding: 1px 4px; border-radius: 3px; letter-spacing: 0.5px; }
      .code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 800; font-size: 11pt; margin: 1mm 0 1.5mm; color: #1d4ed8; word-break: break-all; }
      .item-name { font-size: 9pt; color: #0f172a; }
      .spec-row { color: #475569; }
      .row { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 0.5mm; }
      @media print {
        .no-print-bar { display: none !important; }
        .tag { border: none; margin: 0; }
      }
    </style></head><body>
    <div class="no-print-bar">
      <div>
        <span>📱 <b>Mobile Phone QR Target:</b> <code style="background:#0f172a;padding:2px 6px;border-radius:4px;color:#38bdf8;">${escapeHtml(lanOrigin)}</code></span>
        <span style="margin-left:12px;color:#94a3b8;">(Connect phone to same Wi-Fi to scan & view details)</span>
      </div>
      <div>
        <button onclick="window.print()">Print Tags</button>
      </div>
    </div>
    ${tags.join('')}
    <script>
      setTimeout(() => { window.focus(); }, 300);
    </script>
    </body></html>`);
  win.document.close();
}
