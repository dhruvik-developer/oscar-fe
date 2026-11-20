import * as XLSX from 'xlsx';
import { modal } from '../context/ModalContext';

export function exportToExcel(filename, headers, rows, sheetName = 'Sheet1') {
    if (!rows || rows.length === 0) {
        modal.info('No data available to export.', 'Export Excel');
        return;
    }
    const safeName = `${filename.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`;
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Calculate dynamic column widths
    const colWidths = headers.map((h, i) => {
        let maxLen = String(h || '').length;
        for (const r of rows) {
            const val = r[i] !== null && r[i] !== undefined ? String(r[i]) : '';
            if (val.length > maxLen) maxLen = Math.min(val.length, 50);
        }
        return { wch: Math.max(maxLen + 3, 12) };
    });
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    XLSX.writeFile(wb, `${safeName}.xlsx`);
}

export async function exportToPDF(filename, headers, rows, options = {}) {
    if (!rows || rows.length === 0) {
        modal.info('No data available to export.', 'Export PDF');
        return;
    }
    const { jsPDF } = await import('jspdf');
    const title = options.title || filename.replace(/_/g, ' ');
    const subtitle = options.subtitle || `Generated: ${new Date().toLocaleString()}`;
    const isLandscape = options.orientation || (headers.length > 5 ? 'landscape' : 'portrait');
    const doc = new jsPDF({ orientation: isLandscape, unit: 'mm', format: 'a4' });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;

    const colWidths = options.colWidths || headers.map(() => contentWidth / headers.length);

    const renderHeader = (pageNumber) => {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(31, 46, 74);
        doc.text(title, margin, 15);

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(subtitle, margin, 21);

        const tableTop = 26;
        doc.setFillColor(31, 46, 74);
        doc.rect(margin, tableTop, contentWidth, 8, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');

        let x = margin + 2;
        headers.forEach((h, i) => {
            doc.text(String(h), x, tableTop + 5.5);
            x += colWidths[i];
        });

        return tableTop + 8;
    };

    let y = renderHeader(1);
    const rowHeight = 7;
    let pageCount = 1;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    rows.forEach((row, rowIndex) => {
        if (y + rowHeight > pageHeight - 15) {
            doc.setFontSize(7.5);
            doc.setTextColor(148, 163, 184);
            doc.text(`Page ${pageCount}`, pageWidth - margin - 15, pageHeight - 8);

            doc.addPage();
            pageCount++;
            y = renderHeader(pageCount);
        }

        if (rowIndex % 2 === 1) {
            doc.setFillColor(248, 250, 252);
            doc.rect(margin, y, contentWidth, rowHeight, 'F');
        }

        doc.setDrawColor(226, 232, 240);
        doc.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);

        doc.setTextColor(30, 41, 59);
        let x = margin + 2;
        row.forEach((cell, i) => {
            const val = cell !== null && cell !== undefined ? String(cell) : '';
            const maxChar = Math.max(10, Math.floor(colWidths[i] * 0.45));
            const textToPrint = val.length > maxChar ? val.slice(0, maxChar - 1) + '…' : val;
            doc.text(textToPrint, x, y + 4.8);
            x += colWidths[i];
        });

        y += rowHeight;
    });

    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${pageCount}`, pageWidth - margin - 15, pageHeight - 8);

    const safeName = `${filename.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`;
    doc.save(`${safeName}.pdf`);
}

export function exportToCSV(filename, headers, rows) {
    const escapeCell = (cell) => {
        if (cell === null || cell === undefined)
            return '""';
        const str = String(cell);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return `"${str}"`;
    };
    const csvContent = [
        headers.map(escapeCell).join(','),
        ...rows.map((row) => row.map(escapeCell).join(',')),
    ].join('\r\n');
    // Add UTF-8 BOM for Excel compatibility
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export function exportObjectsToCSV(filename, data, columnMapping) {
    if (!data || data.length === 0) {
        modal.info('No data available to export.', 'Export CSV');
        return;
    }
    if (columnMapping && columnMapping.length > 0) {
        const headers = columnMapping.map((c) => c.header);
        const rows = data.map((item) => columnMapping.map((c) => {
            if (typeof c.key === 'function') {
                return c.key(item);
            }
            return item[c.key];
        }));
        exportToCSV(filename, headers, rows);
    }
    else {
        const keys = Object.keys(data[0]);
        const headers = keys.map((k) => k.toUpperCase());
        const rows = data.map((item) => keys.map((k) => item[k]));
        exportToCSV(filename, headers, rows);
    }
}

export async function exportTableData(filename, columns, rows, format = 'csv') {
  const cols = columns.filter((c) => (c.key || c.id) !== 'actions');
  const headers = cols.map((c) => c.header || c.label || c.title || c.key || '');
  const data = rows.map((row) => cols.map((c) => {
    const k = c.key || c.accessor || c.id;
    let v = k != null && row ? row[k] : '';
    if (typeof v === 'object' && v !== null) v = JSON.stringify(v);
    return v ?? '';
  }));
  const safeName = `${filename}_${new Date().toISOString().slice(0,10)}`;
  if (format === 'csv') {
    exportToCSV(filename, headers, data);
    return;
  }
  if (format === 'xlsx') {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, `${safeName}.xlsx`);
    return;
  }
  if (format === 'pdf') {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: cols.length > 6 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
    doc.setFontSize(14);
    doc.text(filename, 14, 15);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 21);
    let y = 28;
    const colWidth = (doc.internal.pageSize.getWidth() - 28) / cols.length;
    doc.setFontSize(8);
    headers.forEach((h, i) => doc.text(String(h).slice(0, 18), 14 + i * colWidth, y));
    y += 6;
    data.forEach((row) => {
      row.forEach((cell, i) => doc.text(String(cell ?? '').slice(0, 18), 14 + i * colWidth, y));
      y += 5;
      if (y > doc.internal.pageSize.getHeight() - 15) { doc.addPage(); y = 15; }
    });
    doc.save(`${safeName}.pdf`);
  }
}

export function triggerPrint() {
    window.print();
}

/**
 * Directly downloads an HTML DOM element as a high-quality A4 PDF without opening the printer dialog.
 * Uses dynamic imports for jsPDF and html-to-image so pages importing exportToCSV don't pay bundle/load overhead.
 */
export async function downloadElementAsPdf(element, filename = 'document.pdf', options = {}) {
    if (!element) {
        window.print();
        return;
    }
    try {
        const [{ jsPDF }, { toPng }] = await Promise.all([
            import('jspdf'),
            import('html-to-image'),
        ]);
        const dataUrl = await toPng(element, {
            pixelRatio: 2,
            backgroundColor: '#ffffff',
            cacheBust: true,
            skipFonts: true,
        });
        const orientation = options?.orientation || 'portrait';
        const pdf = new jsPDF({
            orientation,
            unit: 'mm',
            format: 'a4',
        });
        const imgProps = pdf.getImageProperties(dataUrl);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        const pageHeight = pdf.internal.pageSize.getHeight();
        let heightLeft = pdfHeight;
        let position = 0;

        pdf.addImage(dataUrl, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
            position = heightLeft - pdfHeight;
            pdf.addPage('a4', orientation);
            pdf.addImage(dataUrl, 'PNG', 0, position, pdfWidth, pdfHeight);
            heightLeft -= pageHeight;
        }

        const safeFilename = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
        pdf.save(safeFilename);
    } catch (err) {
        console.error('Failed to generate direct PDF download, falling back to window.print():', err);
        window.print();
    }
}
