import { modal } from '../context/ModalContext';

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

export function triggerPrint() {
    window.print();
}

/**
 * Directly downloads an HTML DOM element as a high-quality A4 PDF without opening the printer dialog.
 * Uses dynamic imports for jsPDF and html-to-image so pages importing exportToCSV don't pay bundle/load overhead.
 */
export async function downloadElementAsPdf(element, filename = 'document.pdf') {
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
        const pdf = new jsPDF({
            orientation: 'portrait',
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
            pdf.addPage();
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
