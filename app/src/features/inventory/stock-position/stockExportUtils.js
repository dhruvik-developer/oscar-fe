/**
 * Stock Position Exporter: CSV, Excel (.xls/.xlsx XML), and PDF (.pdf via jsPDF)
 * Formats data per screen with professional headers, KPI summaries, and clean styling.
 */

import { formatINR, formatNumberIN } from '../../accounts/accountingShared';

export function getExportColumns(screen, reprocessView, withCost) {
  if (screen === 'reprocessing') {
    if (reprocessView === 'store') {
      return [
        { key: 'batchCode', label: 'Batch Code', weight: 1.6 },
        { key: 'fabric', label: 'Fabric Item', weight: 2 },
        { key: 'quantity', label: 'Available Qty', weight: 1.1, align: 'right', isNumeric: true, format: (r) => `${formatNumberIN(r.quantity)} ${r.uom || 'm'}` },
        { key: 'qcStatus', label: 'QC Status', weight: 1 },
        { key: 'status', label: 'Status', weight: 1.2 },
        { key: 'location', label: 'Godown / Location', weight: 1.5 },
        { key: 'receivedDate', label: 'Receipt Date', weight: 1.1 },
      ];
    }
    return [
      { key: 'jwoNo', label: 'Job Work Order', weight: 1.3 },
      { key: 'batches', label: 'Batch', weight: 1.6, format: (r) => (Array.isArray(r.batches) ? r.batches.join(', ') : r.batches || '—') },
      { key: 'vendor', label: 'Vendor', weight: 1.6 },
      { key: 'process', label: 'Process', weight: 1.2 },
      { key: 'outwardQty', label: 'Sent (m)', weight: 1, align: 'right', isNumeric: true, format: (r) => formatNumberIN(r.outwardQty) },
      { key: 'returnedQty', label: 'Returned (m)', weight: 1, align: 'right', isNumeric: true, format: (r) => formatNumberIN(r.returnedQty) },
      { key: 'processLoss', label: 'Loss (m)', weight: 0.9, align: 'right', isNumeric: true, format: (r) => formatNumberIN(r.processLoss) },
      { key: 'pendingQty', label: 'Pending (m)', weight: 1, align: 'right', isNumeric: true, format: (r) => formatNumberIN(r.pendingQty) },
      { key: 'awaitingQcQty', label: 'Awaiting QC', weight: 1, align: 'right', isNumeric: true, format: (r) => formatNumberIN(r.awaitingQcQty) },
      ...(withCost ? [{ key: 'charges', label: 'Charges', weight: 1.2, align: 'right', format: (r) => (r.charges ? formatINR(r.charges) : '—') }] : []),
      { key: 'dueDate', label: 'Due Date', weight: 1 },
      { key: 'status', label: 'Status', weight: 1 },
    ];
  }

  if (screen === 'scrap') {
    return [
      { key: 'kind', label: 'Type', weight: 1.2 },
      { key: 'batchCode', label: 'Batch Code', weight: 1.6 },
      { key: 'fabric', label: 'Fabric', weight: 2 },
      { key: 'reason', label: 'Reason', weight: 1.6 },
      { key: 'quantity', label: 'Qty', weight: 1, align: 'right', isNumeric: true, format: (r) => `${formatNumberIN(r.quantity)} ${r.uom || 'm'}` },
      { key: 'reusable', label: 'Reusable', weight: 0.9, format: (r) => (r.reusable ? 'Yes' : 'No') },
      { key: 'disposition', label: 'Disposition', weight: 1.3 },
      { key: 'stockStatus', label: 'Status', weight: 1 },
      ...(withCost ? [{ key: 'value', label: 'Value', weight: 1.2, align: 'right', format: (r) => (r.value ? formatINR(r.value) : '—') }] : []),
    ];
  }

  if (screen === 'customer-returns') {
    return [
      { key: 'returnNumber', label: 'Return #', weight: 1.3 },
      { key: 'date', label: 'Date', weight: 1 },
      { key: 'customer', label: 'Customer', weight: 1.8 },
      { key: 'invoiceNumber', label: 'Invoice #', weight: 1.3 },
      { key: 'batchCode', label: 'Batch', weight: 1.5 },
      { key: 'fabric', label: 'Fabric', weight: 1.8 },
      { key: 'quantity', label: 'Qty (m)', weight: 1, align: 'right', isNumeric: true, format: (r) => formatNumberIN(r.quantity) },
      { key: 'reason', label: 'Reason', weight: 1.5 },
      { key: 'qcStatus', label: 'QC Status', weight: 1.1 },
      { key: 'disposition', label: 'Disposition', weight: 1.3 },
      { key: 'creditNote', label: 'Credit Note', weight: 1.2 },
      ...(withCost ? [{ key: 'creditValue', label: 'Credit Value', weight: 1.2, align: 'right', format: (r) => (r.creditValue ? formatINR(r.creditValue) : '—') }] : []),
    ];
  }

  if (screen === 'samples') {
    return [
      { key: 'sampleNumber', label: 'Sample ID', weight: 1.3 },
      { key: 'batchCode', label: 'Original Batch #', weight: 1.5 },
      { key: 'fabricShade', label: 'Fabric / Shade', weight: 1.8, format: (r) => `${r.fabricQuality || '—'} / ${r.shade || '—'}` },
      { key: 'customer', label: 'Customer', weight: 1.6, format: (r) => r.customer || r.party || '—' },
      { key: 'quantity', label: 'Issued Qty', weight: 1, align: 'right', isNumeric: true, format: (r) => `${formatNumberIN(r.quantity)} ${r.uom || 'm'}` },
      { key: 'returned', label: 'Returned Qty', weight: 0.9, align: 'right', isNumeric: true, format: (r) => formatNumberIN(r.returned) },
      { key: 'consumed', label: 'Consumed Qty', weight: 0.9, align: 'right', isNumeric: true, format: (r) => formatNumberIN(r.consumed) },
      { key: 'outstanding', label: 'Available Qty', weight: 1, align: 'right', isNumeric: true, format: (r) => formatNumberIN(r.outstanding) },
      { key: 'unitCost', label: 'Unit Cost', weight: 1, align: 'right', format: (r) => (r.unitCost ? formatINR(r.unitCost) : '—') },
      { key: 'totalValue', label: 'Total Value', weight: 1.2, align: 'right', format: (r) => (r.totalValue || r.estimatedCost ? formatINR(r.totalValue || r.estimatedCost) : '—') },
      { key: 'date', label: 'Issue Date', weight: 1 },
      { key: 'dueDate', label: 'Due Date', weight: 1, format: (r) => r.dueDate || '—' },
      { key: 'status', label: 'Status', weight: 1 },
    ];
  }

  // Default: 'usable' / rollColumns
  return [
    { key: 'batchCode', label: 'Batch Code', weight: 1.6 },
    { key: 'fabric', label: 'Fabric Quality', weight: 2 },
    { key: 'design', label: 'Design', weight: 1.2 },
    { key: 'shade', label: 'Colour / Shade', weight: 1.2 },
    { key: 'location', label: 'Godown / Location', weight: 1.6 },
    { key: 'quantity', label: 'Qty', weight: 1, align: 'right', isNumeric: true, format: (r) => `${formatNumberIN(r.quantity)} ${r.uom || 'm'}` },
    { key: 'qcStatus', label: 'QC Status', weight: 0.9 },
    { key: 'stockStatus', label: 'Status', weight: 1 },
    ...(withCost
      ? [
          { key: 'rate', label: 'Rate (₹)', weight: 1, align: 'right', isNumeric: true, format: (r) => (r.rate ? formatINR(r.rate) : '—') },
          { key: 'value', label: 'Value (₹)', weight: 1.2, align: 'right', isNumeric: true, format: (r) => (r.value ? formatINR(r.value) : '—') },
        ]
      : []),
  ];
}

export function exportStockCSV({ screenTitle, filename, headers, rows }) {
  const escapeCell = (val) => {
    if (val == null) return '""';
    const s = String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return `"${s}"`;
  };

  const headerLine = headers.map((h) => escapeCell(h.label)).join(',');
  const rowLines = rows.map((r) =>
    headers
      .map((h) => {
        const val = h.format ? h.format(r) : r[h.key] ?? '';
        return escapeCell(val);
      })
      .join(',')
  );

  const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function exportStockExcel({ title, screenTitle, filename, dateStr, kpis, headers, rows }) {
  const sanitize = (val) =>
    String(val ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#1E293B"/>
  </Style>
  <Style ss:ID="ReportTitle">
   <Font ss:FontName="Segoe UI" ss:Size="16" ss:Bold="1" ss:Color="#0F172A"/>
   <Alignment ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="ReportMeta">
   <Font ss:FontName="Segoe UI" ss:Size="9" ss:Italic="1" ss:Color="#64748B"/>
   <Alignment ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="KpiLabel">
   <Font ss:FontName="Segoe UI" ss:Size="9" ss:Bold="1" ss:Color="#475569"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="KpiVal">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#0F172A"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="TableHeader">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F172A"/>
   </Borders>
  </Style>
  <Style ss:ID="RowEven">
   <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
   <Alignment ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="RowOdd">
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
   <Alignment ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="NumberCellEven">
   <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="NumberCellOdd">
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="${sanitize(screenTitle).slice(0, 31)}">
  <Table ss:DefaultRowHeight="20">
`;

  // Title Row
  xml += `   <Row ss:Height="26">
    <Cell ss:MergeAcross="${Math.max(0, headers.length - 1)}" ss:StyleID="ReportTitle"><Data ss:Type="String">${sanitize(title)} • ${sanitize(screenTitle)}</Data></Cell>
   </Row>
   <Row ss:Height="18">
    <Cell ss:MergeAcross="${Math.max(0, headers.length - 1)}" ss:StyleID="ReportMeta"><Data ss:Type="String">Generated on: ${sanitize(dateStr)} | Authoritative Inventory Register</Data></Cell>
   </Row>
   <Row ss:Height="6"/>
`;

  // KPI Summary
  if (kpis && kpis.length) {
    xml += `   <Row ss:Height="22">\n`;
    kpis.slice(0, 6).forEach((k) => {
      xml += `    <Cell ss:StyleID="KpiLabel"><Data ss:Type="String">${sanitize(k.label)}:</Data></Cell>\n`;
      xml += `    <Cell ss:StyleID="KpiVal"><Data ss:Type="String">${sanitize(k.value)}</Data></Cell>\n`;
    });
    xml += `   </Row>\n   <Row ss:Height="8"/>\n`;
  }

  // Table Headers
  xml += `   <Row ss:Height="24">\n`;
  headers.forEach((h) => {
    xml += `    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">${sanitize(h.label)}</Data></Cell>\n`;
  });
  xml += `   </Row>\n`;

  // Table Rows
  rows.forEach((r, idx) => {
    const isOdd = idx % 2 === 1;
    xml += `   <Row ss:Height="20">\n`;
    headers.forEach((h) => {
      const val = h.format ? h.format(r) : r[h.key] ?? '';
      const rawVal = r[h.key];
      const isNum = h.isNumeric && typeof rawVal === 'number';
      const cellStyle = h.align === 'right' ? (isOdd ? 'NumberCellOdd' : 'NumberCellEven') : (isOdd ? 'RowOdd' : 'RowEven');

      if (isNum) {
        xml += `    <Cell ss:StyleID="${cellStyle}"><Data ss:Type="Number">${rawVal}</Data></Cell>\n`;
      } else {
        xml += `    <Cell ss:StyleID="${cellStyle}"><Data ss:Type="String">${sanitize(val)}</Data></Cell>\n`;
      }
    });
    xml += `   </Row>\n`;
  });

  xml += `  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xls') || filename.endsWith('.xlsx') ? filename : `${filename}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Returns balanced, print-ready columns tailored for Landscape A4 PDF.
 * Eliminates column collisions, prevents truncation, and formats currencies cleanly.
 */
export function getPdfExportColumns(screen, reprocessView, withCost) {
  if (screen === 'samples') {
    return [
      { key: 'sampleNumber', label: 'Sample ID', width: 85, align: 'left' },
      { key: 'batchCode', label: 'Batch #', width: 100, align: 'left' },
      { key: 'fabricShade', label: 'Fabric / Shade', width: 95, align: 'left', format: (r) => `${r.fabricQuality || '—'} / ${r.shade || '—'}` },
      { key: 'customer', label: 'Customer', width: 80, align: 'left', format: (r) => r.customer || r.party || '—' },
      { key: 'quantity', label: 'Issued', width: 48, align: 'right', format: (r) => `${formatNumberIN(r.quantity)} ${r.uom || 'm'}` },
      { key: 'returned', label: 'Ret.', width: 35, align: 'right', format: (r) => formatNumberIN(r.returned) },
      { key: 'consumed', label: 'Cons.', width: 35, align: 'right', format: (r) => formatNumberIN(r.consumed) },
      { key: 'outstanding', label: 'Avail.', width: 38, align: 'right', format: (r) => formatNumberIN(r.outstanding) },
      { key: 'unitCost', label: 'Rate (Rs.)', width: 48, align: 'right', format: (r) => (r.unitCost ? formatNumberIN(r.unitCost) : '—') },
      { key: 'totalValue', label: 'Value (Rs.)', width: 55, align: 'right', format: (r) => (r.totalValue || r.estimatedCost ? formatNumberIN(r.totalValue || r.estimatedCost) : '—') },
      { key: 'date', label: 'Issue Date', width: 50, align: 'left' },
      { key: 'dueDate', label: 'Due', width: 48, align: 'left', format: (r) => r.dueDate || '—' },
      { key: 'status', label: 'Status', width: 48, align: 'left' },
    ];
  }

  if (screen === 'reprocessing') {
    if (reprocessView === 'store') {
      return [
        { key: 'batchCode', label: 'Batch Code', width: 135, align: 'left' },
        { key: 'fabric', label: 'Fabric Item', width: 175, align: 'left' },
        { key: 'quantity', label: 'Available Qty', width: 90, align: 'right', format: (r) => `${formatNumberIN(r.quantity)} ${r.uom || 'm'}` },
        { key: 'qcStatus', label: 'QC Status', width: 90, align: 'center' },
        { key: 'location', label: 'Godown / Location', width: 170, align: 'left' },
        { key: 'receivedDate', label: 'Receipt Date', width: 110, align: 'left' },
      ];
    }
    return [
      { key: 'jwoNo', label: 'Job Work Order', width: 95, align: 'left' },
      { key: 'batches', label: 'Batch', width: 115, align: 'left', format: (r) => (Array.isArray(r.batches) ? r.batches.join(', ') : r.batches || '—') },
      { key: 'vendor', label: 'Vendor', width: 125, align: 'left' },
      { key: 'process', label: 'Process', width: 80, align: 'left' },
      { key: 'outwardQty', label: 'Sent (m)', width: 55, align: 'right', format: (r) => formatNumberIN(r.outwardQty) },
      { key: 'returnedQty', label: 'Ret. (m)', width: 55, align: 'right', format: (r) => formatNumberIN(r.returnedQty) },
      { key: 'processLoss', label: 'Loss (m)', width: 48, align: 'right', format: (r) => formatNumberIN(r.processLoss) },
      { key: 'pendingQty', label: 'Pend. (m)', width: 55, align: 'right', format: (r) => formatNumberIN(r.pendingQty) },
      { key: 'awaitingQcQty', label: 'Awaiting QC', width: 65, align: 'right', format: (r) => formatNumberIN(r.awaitingQcQty) },
      { key: 'status', label: 'Status', width: 55, align: 'left' },
      ...(withCost ? [{ key: 'charges', label: 'Charges (Rs.)', width: 52, align: 'right', format: (r) => (r.charges ? formatNumberIN(r.charges) : '—') }] : []),
    ];
  }

  if (screen === 'scrap') {
    return [
      { key: 'kind', label: 'Type', width: 85, align: 'left' },
      { key: 'batchCode', label: 'Batch Code', width: 125, align: 'left' },
      { key: 'fabric', label: 'Fabric', width: 145, align: 'left' },
      { key: 'reason', label: 'Reason', width: 115, align: 'left' },
      { key: 'quantity', label: 'Qty', width: 65, align: 'right', format: (r) => `${formatNumberIN(r.quantity)} ${r.uom || 'm'}` },
      { key: 'reusable', label: 'Reusable', width: 55, align: 'center', format: (r) => (r.reusable ? 'Yes' : 'No') },
      { key: 'disposition', label: 'Disposition', width: 80, align: 'left' },
      { key: 'stockStatus', label: 'Status', width: 60, align: 'left' },
      ...(withCost ? [{ key: 'value', label: 'Value (Rs.)', width: 60, align: 'right', format: (r) => (r.value ? formatNumberIN(r.value) : '—') }] : []),
    ];
  }

  if (screen === 'customer-returns') {
    return [
      { key: 'returnNumber', label: 'Return #', width: 85, align: 'left' },
      { key: 'date', label: 'Date', width: 58, align: 'left' },
      { key: 'customer', label: 'Customer', width: 125, align: 'left' },
      { key: 'invoiceNumber', label: 'Invoice #', width: 75, align: 'left' },
      { key: 'batchCode', label: 'Batch Code', width: 115, align: 'left' },
      { key: 'fabric', label: 'Fabric', width: 115, align: 'left' },
      { key: 'quantity', label: 'Qty (m)', width: 55, align: 'right', format: (r) => formatNumberIN(r.quantity) },
      { key: 'reason', label: 'Reason', width: 80, align: 'left' },
      { key: 'qcStatus', label: 'QC Status', width: 55, align: 'left' },
      ...(withCost ? [{ key: 'creditValue', label: 'Credit (Rs.)', width: 55, align: 'right', format: (r) => (r.creditValue ? formatNumberIN(r.creditValue) : '—') }] : []),
    ];
  }

  // Default: 'usable'
  return [
    { key: 'batchCode', label: 'Batch Code', width: 125, align: 'left' },
    { key: 'fabric', label: 'Fabric Quality', width: 145, align: 'left' },
    { key: 'design', label: 'Design / Colour', width: 110, align: 'left', format: (r) => [r.design, r.shade].filter(Boolean).join(' / ') || '—' },
    { key: 'location', label: 'Godown / Location', width: 125, align: 'left' },
    { key: 'quantity', label: 'Qty', width: 65, align: 'right', format: (r) => `${formatNumberIN(r.quantity)} ${r.uom || 'm'}` },
    { key: 'qcStatus', label: 'QC Status', width: 60, align: 'left' },
    { key: 'stockStatus', label: 'Status', width: 60, align: 'left' },
    ...(withCost ? [{ key: 'value', label: 'Value (Rs.)', width: 95, align: 'right', format: (r) => (r.value ? formatNumberIN(r.value) : '—') }] : []),
  ];
}

export async function exportStockPDF({ title, screenTitle, filename, dateStr, kpis, headers, rows, screen, reprocessView, withCost }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 26;
  const printWidth = pageWidth - margin * 2;

  // Clean characters unsupported by default Helvetica font (avoids ¹ instead of ₹)
  const sanitizePdfText = (str) => {
    if (str == null) return '—';
    return String(str)
      .replace(/₹\s*/g, 'Rs. ')
      .replace(/[^\x00-\x7F]/g, (char) => {
        if (char === '•' || char === '·') return '-';
        if (char === '—' || char === '–') return '-';
        if (char === '’' || char === '‘') return "'";
        if (char === '“' || char === '”') return '"';
        return '';
      });
  };

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(margin, margin, printWidth, 42, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(title || 'OSCAR TEXTILE ERP', margin + 14, margin + 20);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`${screenTitle}  |  Generated: ${dateStr}`, margin + 14, margin + 34);

  let curY = margin + 50;

  // KPI Bar
  if (kpis && kpis.length) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, curY, printWidth, 22, 'FD');

    let kpiX = margin + 10;
    kpis.slice(0, 6).forEach((k) => {
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      const lbl = `${sanitizePdfText(k.label).toUpperCase()}: `;
      doc.text(lbl, kpiX, curY + 14);
      const labelW = doc.getTextWidth(lbl);

      doc.setTextColor(15, 23, 42);
      const valStr = sanitizePdfText(String(k.value ?? '—'));
      doc.text(valStr, kpiX + labelW, curY + 14);
      kpiX += labelW + doc.getTextWidth(valStr) + 16;
    });

    curY += 28;
  }

  // Obtain tailored PDF columns
  const baseCols = screen ? getPdfExportColumns(screen, reprocessView, withCost) : headers;
  const sumColWeights = baseCols.reduce((acc, c) => acc + (c.width || c.weight || 1), 0);
  const pdfColumns = baseCols.map((c) => ({
    ...c,
    width: Math.floor(((c.width || c.weight || 1) / sumColWeights) * printWidth),
  }));
  const allocatedWidth = pdfColumns.reduce((acc, c) => acc + c.width, 0);
  if (pdfColumns.length > 0 && allocatedWidth < printWidth) {
    pdfColumns[pdfColumns.length - 1].width += (printWidth - allocatedWidth);
  }

  const drawTableHeader = (y) => {
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(margin, y, printWidth, 20, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);

    let x = margin;
    pdfColumns.forEach((col) => {
      const w = col.width;
      let label = sanitizePdfText(col.label);
      while (doc.getTextWidth(label) > w - 8 && label.length > 2) {
        label = label.slice(0, -3) + '..';
      }
      const textX = col.align === 'right' ? x + w - 6 : col.align === 'center' ? x + w / 2 : x + 6;
      doc.text(label, textX, y + 13, { align: col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left' });
      x += w;
    });
  };

  drawTableHeader(curY);
  curY += 20;

  const rowHeight = 17;
  rows.forEach((r, idx) => {
    // Check if new page needed
    if (curY + rowHeight > pageHeight - margin - 20) {
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page ${doc.internal.getNumberOfPages()}  |  Confidential`, pageWidth / 2, pageHeight - 12, { align: 'center' });

      doc.addPage();
      curY = margin;
      drawTableHeader(curY);
      curY += 20;
    }

    // Row Background
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, curY, printWidth, rowHeight, 'F');
    }
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, curY + rowHeight, margin + printWidth, curY + rowHeight);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);

    let x = margin;
    pdfColumns.forEach((col) => {
      const w = col.width;
      let val = col.format ? col.format(r) : String(r[col.key] ?? '—');
      if (val === '' || val == null) val = '—';
      val = sanitizePdfText(val);

      while (doc.getTextWidth(val) > w - 8 && val.length > 3) {
        val = val.slice(0, -4) + '...';
      }
      const textX = col.align === 'right' ? x + w - 6 : col.align === 'center' ? x + w / 2 : x + 6;
      doc.text(val, textX, curY + 11.5, { align: col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left' });
      x += w;
    });

    curY += rowHeight;
  });

  // Footer on last page
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`Page ${doc.internal.getNumberOfPages()}  |  Confidential`, pageWidth / 2, pageHeight - 12, { align: 'center' });

  const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  doc.save(safeFilename);
}
