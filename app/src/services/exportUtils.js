/**
 * Universal CSV and Print Export Utility for Horizon ERP
 */
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
        alert('No data available to export.');
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
